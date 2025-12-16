# LCP (Language Context Provider) 技术实现规范 v0.0.1pre

## 1. 愿景与核心定义

**LCP** 是一个基于 **MCP (Model Context Protocol)** 标准的中间件服务。它的核心使命是将人类使用的 IDE 后端能力（LSP 用于静态分析，DAP 用于动态调试）封装为 **LLM 可理解、无状态、原子化** 的工具集。

*   **定位**：Headless IDE Backend for AI Agents.
*   **解决痛点**：
    1.  **上下文劣化**：通过 LSP 的语义索引替代全文读取，将 Token 消耗降低 90% 以上。
    2.  **交互阻塞**：通过 DAP 将 GDB 的流式交互转化为原子化的 RPC 调用，消除 Agent 被挂起的风险。

---

## 2. 系统架构设计

### 2.1 技术栈选型
*   **Runtime**: Node.js (v20+) - 选型理由：最佳的异步 I/O 处理能力，原生支持 JSON-RPC。
*   **Interface Protocol**: MCP (Model Context Protocol) via `@modelcontextprotocol/sdk` (v1.23.0+).
*   **Upstream Protocols**:
    *   LSP Client: 基于 `vscode-languageserver-protocol` (v3.17+) 自研轻量级客户端。
    *   DAP Client: 基于 `@vscode/debugprotocol` (v1.61+) 自研状态机适配器。
*   **Process Management**: `execa` (v9.6+) - 用于精细控制 Language Server 和 Debug Adapter 的生命周期。
*   **Logging**: `winston` (v3.18+) - 用于结构化日志记录和调试。

### 2.2 架构图谱

```mermaid
graph TD
    User[LLM / Agent] -->|MCP Request| LCP_Server
    
    subgraph "LCP Core (Node.js)"
        LCP_Server[MCP Server Handler]
        Router[Session Router]
        
        subgraph "Static Analysis Engine"
            LSP_Mgr[LSP Manager]
            LSP_Client[LSP Client Implementation]
            VFS[Virtual File System / Cache]
            DiagnosticMap[Diagnostic Cache]
        end
        
        subgraph "Dynamic Debug Engine"
            DAP_Mgr[DAP Session Manager]
            DAP_Client[DAP Client & State Machine]
            Event_Bus[Event Bus (Wait-Notify)]
            BreakpointMap[Breakpoint Cache]
        end
        
        subgraph "Supporting Services"
            SessionStore[Session Store]
            ErrorHandler[Error Handler & Recovery]
            FileResolver[File Path Resolver]
        end
    end
    
    LSP_Client -->|JSON-RPC via Stdio| Pyright[Ext: Pyright]
    LSP_Client -->|JSON-RPC via Stdio| Gopls[Ext: Gopls]
    LSP_Client -->|JSON-RPC via Stdio| Clangd[Ext: Clangd]
    LSP_Client -->|JSON-RPC via Stdio| TsServer[Ext: TSServer]
    
    DAP_Client -->|DAP Protocol| DebugPy[Ext: DebugPy]
    DAP_Client -->|DAP Protocol| GDB_Adapter[Ext: OpenDebugAD7]
    DAP_Client -->|DAP Protocol| NodeDebug[Ext: Node Debug]
```

---

## 3. 核心模块实现细节

### 3.1 静态分析模块 (The Semantic Reader)

此模块的目标是**“反 grep”**。我们不提供搜索文本的能力，只提供查询符号的能力。

#### 3.1.1 核心工具定义 (MCP Tools)

1.  **`lcp_get_outline(file_path: string)`**
    *   **功能**：获取文件骨架，包括类、函数、变量等符号信息。
    *   **底层映射**：调用 LSP `textDocument/documentSymbol`。
    *   **参数说明**：
        *   `file_path`: 相对于项目根目录的文件路径（支持模糊匹配）。
    *   **返回数据**：扁平化的 JSON 列表，包含 `name`, `kind` (Class/Method/Variable), `range` (行号范围，1-based), `children` (嵌套符号)。
    *   **AI 策略**：LLM 首先调用此接口，建立文件的“心理地图”，而不是直接读全文。
    *   **错误处理**：如果文件不存在，返回模糊匹配建议；如果 LSP 服务不可用，返回友好错误信息。

2.  **`lcp_read_symbol(file_path: string, symbol_name: string)`**
    *   **功能**：精准读取某个函数或类的代码。
    *   **底层映射**：
        1.  调用 `textDocument/documentSymbol` 找到 `symbol_name` 对应的 `range`。
        2.  读取文件内容，仅切片返回该 `range` 内的文本。
    *   **参数说明**：
        *   `file_path`: 相对于项目根目录的文件路径（支持模糊匹配）。
        *   `symbol_name`: 符号名称（支持模糊匹配）。
    *   **返回数据**：符号的完整代码文本，包含注释和上下文信息。
    *   **优势**：避免读取无关的 import 语句、其他辅助函数，最大化信噪比。
    *   **特殊处理**：如果符号代码超过 10k Tokens，自动截断中间部分，返回 `... (skipping N lines) ...`。

3.  **`lcp_find_references(symbol_name: string, context_file: string)`**
    *   **功能**：全项目查找符号引用。
    *   **底层映射**：
        1.  `textDocument/definition` 锁定符号位置。
        2.  `textDocument/references` 获取所有调用点。
        3.  读取每个引用点的上下文代码片段。
    *   **参数说明**：
        *   `symbol_name`: 符号名称（支持模糊匹配）。
        *   `context_file`: 上下文文件路径，用于确定符号的具体定义。
    *   **返回数据**：`[{ file: "main.py", line: 10, code_snippet: "process_data(x)", context: "def main(): process_data(x)" }, ...]`
    *   **错误处理**：如果符号未找到，返回模糊匹配建议；如果 LSP 服务不可用，返回友好错误信息。

4.  **`lcp_get_diagnostics(file_path?: string)`**
    *   **功能**：获取编译器报错和警告。
    *   **实现逻辑**：LCP 维护一个 `DiagnosticMap`，缓存 LSP Server 异步推送的 `textDocument/publishDiagnostics` 通知。
    *   **参数说明**：
        *   `file_path` (可选): 相对于项目根目录的文件路径。如果未提供，返回所有文件的诊断信息。
    *   **返回数据**：`[{ file: "main.py", line: 5, severity: "error", message: "Undefined variable 'x'" }, ...]`
    *   **更新机制**：每次文件变更后，LSP 会推送新的诊断信息，LCP 实时更新缓存。

#### 3.1.2 关键实现难点：LSP 生命周期管理

LSP 是有状态的。LCP 必须模拟 IDE 的行为：

1.  **Initialize**: 
    *   启动时发送 `initialize` 请求，协商 capabilities。
    *   支持动态启动和停止 LSP 服务，根据文件类型自动选择合适的 LSP 服务。

2.  **DidOpen**: 
    *   当 LLM 第一次关注某文件时，发送 `textDocument/didOpen`，将文件内容加载到 LSP Server 内存中。
    *   支持批量 `didOpen` 操作，提高性能。

3.  **DidChange**: 
    *   当文件内容变更时，发送 `textDocument/didChange`，更新 LSP Server 内存中的文件内容。
    *   支持增量更新，仅发送变更部分，提高性能。

4.  **DidClose**: 
    *   当文件不再被使用时，发送 `textDocument/didClose`，释放 LSP Server 内存。
    *   实现基于时间的自动关闭机制，例如 5 分钟未使用的文件自动关闭。

5.  **Shutdown**: 
    *   当 LSP 服务长时间未使用时，自动关闭，释放资源。
    *   支持按需重启 LSP 服务。

### 3.2 动态调试模块 (The Atomic Debugger)

这是最具挑战性的部分。必须将 DAP 的**异步事件流**转换为 MCP 的**同步请求响应**。

#### 3.2.1 核心机制：Awaitable Events (事件栅栏)

LLM 的思维是线性的：“我执行下一步 -> 告诉我结果”。
但 GDB/DAP 是异步的：“发送 Next 指令 -> (不确定的时间后) -> 收到 Stopped 事件”。

**LCP 的解决方案：**
在 `lcp_debug_step` 函数内部创建一个 `Promise`，该 Promise 只有在收到 DAP 的 `stopped` 事件（或超时）时才会 Resolve。

```typescript
// 伪代码实现逻辑
async function handle_step_over(sessionId: string) {
    const session = sessionStore.get(sessionId);
    if (!session || !session.dapClient) {
        throw new Error("No active debug session");
    }
    
    // 1. 发送指令给 Debug Adapter
    await session.dapClient.send('next'); 
    
    // 2. 挂起 MCP 响应，等待 "stopped" 事件
    const stopEvent = await session.eventBus.waitFor('stopped', { timeout: 5000 });
    
    // 3. 收到停止事件后，自动获取当前的堆栈和变量
    const stack = await session.dapClient.send('stackTrace', { threadId: stopEvent.threadId });
    const scopes = await session.dapClient.send('scopes', { frameId: stack.stackFrames[0].id });
    const variables = await session.dapClient.send('variables', { variablesReference: scopes[0].variablesReference });
    
    // 4. 打包返回给 LLM
    return {
        status: "stopped",
        reason: stopEvent.reason, // "step", "breakpoint", "exception"
        current_line: stack.stackFrames[0].line, // 1-based
        current_file: stack.stackFrames[0].source.path,
        call_stack: stack.stackFrames.map(frame => ({
            function: frame.name,
            file: frame.source?.path,
            line: frame.line
        })),
        local_variables: variables.variables // 直接给 JSON，不给文本
    };
}
```

#### 3.2.2 核心工具定义 (MCP Tools)

1.  **`lcp_debug_launch(program: string, args: string[], env?: Record<string, string>)`**
    *   **功能**：启动调试会话，自动停在入口点（Entry Point）。
    *   **参数说明**：
        *   `program`: 要调试的程序路径（支持模糊匹配）。
        *   `args`: 程序参数列表。
        *   `env` (可选): 环境变量映射。
    *   **返回数据**：`{ session_id: "uuid", status: "started", breakpoint_count: 0, current_line: 1 }`
    *   **实现细节**：
        *   根据程序类型自动选择合适的 Debug Adapter。
        *   启动 Debug Adapter 进程。
        *   发送 `initialize` 和 `launch` 请求。
        *   等待程序停止在入口点。

2.  **`lcp_add_breakpoint(file: string, line: number)`**
    *   **功能**：添加断点。
    *   **参数说明**：
        *   `file`: 相对于项目根目录的文件路径（支持模糊匹配）。
        *   `line`: 行号（1-based）。
    *   **返回数据**：`{ breakpoint_id: "uuid", verified: true, file: "main.py", line: 10 }`
    *   **底层映射**：映射到 DAP `setBreakpoints`。
    *   **实现细节**：
        *   LCP 在内存中维护 `BreakpointMap`，存储所有断点信息。
        *   每次添加断点时，重新发送全量断点列表给 Debug Adapter。
        *   支持条件断点和日志断点（Phase 2）。

3.  **`lcp_remove_breakpoint(breakpoint_id: string)`**
    *   **功能**：移除断点。
    *   **参数说明**：
        *   `breakpoint_id`: 断点 ID。
    *   **返回数据**：`{ success: true, remaining_breakpoints: 2 }`
    *   **实现细节**：
        *   从 `BreakpointMap` 中移除断点。
        *   重新发送全量断点列表给 Debug Adapter。

4.  **`lcp_debug_step(session_id: string, action: 'next' | 'stepIn' | 'stepOut' | 'continue')`**
    *   **功能**：原子化调试操作。执行动作 -> 等待停止 -> 返回当前状态。
    *   **参数说明**：
        *   `session_id`: 调试会话 ID。
        *   `action`: 调试动作。
    *   **返回数据**：
        ```json
        {
            "status": "stopped",
            "reason": "breakpoint",
            "current_line": 15,
            "current_file": "main.py",
            "call_stack": [{ "function": "main", "file": "main.py", "line": 15 }],
            "local_variables": [{ "name": "x", "value": "10", "type": "int" }]
        }
        ```
    *   **防卡死机制**：
        *   如果 5秒内没停下来（比如进入死循环），LCP 主动发送 `pause` 指令。
        *   返回：`{ status: "paused", reason: "timeout", message: "程序仍在运行，已强制暂停，当前位置如下..." }`。

5.  **`lcp_debug_evaluate(session_id: string, expression: string)`**
    *   **功能**：在当前上下文执行表达式。
    *   **参数说明**：
        *   `session_id`: 调试会话 ID。
        *   `expression`: 要执行的表达式。
    *   **返回数据**：`{ value: "10", type: "int", variablesReference: 0 }`
    *   **底层映射**：映射到 DAP `evaluate`。

6.  **`lcp_debug_stop(session_id: string)`**
    *   **功能**：停止调试会话。
    *   **参数说明**：
        *   `session_id`: 调试会话 ID。
    *   **返回数据**：`{ success: true, message: "Debug session stopped" }`
    *   **实现细节**：
        *   发送 `disconnect` 请求给 Debug Adapter。
        *   停止 Debug Adapter 进程。
        *   清理会话资源。

---

## 4. 协议转换层 (Translation Layer)

LCP 的核心价值在于**翻译**。它不是简单的透传，而是数据的清洗和重组。

### 4.1 坐标系转换

*   **LSP/DAP**: 通常使用 **0-based** 索引（第0行是第一行）。
*   **LLM/Human**: 通常理解 **1-based** 索引。
*   **LCP 职责**: 
    *   在输入边界：将 LLM 提供的 1-based 索引转换为 0-based 索引，发送给 LSP/DAP。
    *   在输出边界：将 LSP/DAP 返回的 0-based 索引转换为 1-based 索引，返回给 LLM。
    *   防止 LLM 产生“差一错误 (Off-by-one Error)”。

### 4.2 路径标准化

*   **URI vs Path**: 
    *   LSP 使用 `file:///path/to/code.py` 格式。
    *   DAP 有时使用绝对路径格式。
    *   LLM 通常使用相对路径格式。
*   **LCP 职责**: 
    *   统一向 LLM 暴露相对路径（相对于项目根目录）。
    *   在内部自动转换为绝对 URI 发送给 LSP。
    *   在内部自动转换为绝对路径发送给 DAP。
    *   实现文件路径模糊匹配和自动补全。

### 4.3 数据格式转换

*   **LSP/DAP**: 返回结构化 JSON 数据。
*   **LLM**: 偏好简洁、易理解的文本格式。
*   **LCP 职责**: 
    *   清洗和重组 LSP/DAP 返回的数据，使其更适合 LLM 理解。
    *   移除冗余字段，保留核心信息。
    *   转换复杂数据结构为简洁格式。

---

## 5. 状态管理与并发控制

由于 MCP Server 可能是长期运行的，而 LLM 的请求是间歇性的，LCP 需要健壮的状态管理。

### 5.1 会话隔离 (Session Isolation)

*   **设计原则**: 每个 LLM/Agent 会话对应一个独立的 LCP 会话。
*   **实现方式**: 
    *   使用 `Map<SessionID, Session>` 存储所有会话。
    *   每个会话包含独立的 LSP Client、DAP Client 和状态信息。
    *   支持并发处理多个会话，互不干扰。
*   **SessionID 生成**: 
    *   使用 UUID v4 生成唯一会话 ID。
    *   会话 ID 作为所有调试相关请求的必填参数。
*   **会话超时**: 
    *   实现会话超时机制，默认 30 分钟未活动则自动清理。
    *   支持手动关闭会话。

### 5.2 虚拟文件系统 (Shadow VFS)

*   **设计目标**: 确保 LSP 始终使用最新的文件内容，减少 AI 幻觉。
*   **实现方式**: 
    *   LCP 维护一个虚拟文件系统，缓存所有打开文件的内容。
    *   监听文件系统变更事件（使用 `chokidar` (v5.0.0+)）。
    *   一旦文件变了，立即向 LSP 发送 `textDocument/didChange`。
*   **支持的变更类型**: 
    *   文件内容变更。
    *   文件创建和删除。
    *   文件重命名和移动。
*   **与 MCP Filesystem Server 集成**: 
    *   当 Agent 通过 MCP Filesystem Server 修改文件时，LCP 收到通知并更新 VFS。
    *   支持 `lcp_apply_edit` 直接修改文件内容（Phase 2）。

### 5.3 资源管理

*   **LSP 进程管理**: 
    *   按需启动 LSP 服务，根据文件类型自动选择。
    *   长时间未使用的 LSP 服务自动关闭。
    *   支持 LSP 服务崩溃自动重启。
*   **DAP 进程管理**: 
    *   每个调试会话对应一个独立的 DAP 进程。
    *   调试会话结束后，自动关闭 DAP 进程。
    *   支持 DAP 进程崩溃自动重启。
*   **内存管理**: 
    *   定期清理过期会话和缓存。
    *   限制每个会话的内存使用。
    *   支持内存使用监控和告警。

---

## 6. 错误处理与自我修复

LLM 经常会传错参数，LCP 必须极其宽容。

### 6.1 模糊匹配文件名

*   **问题**: LLM 可能会说 `read_symbol("user.py", ...)`，但实际文件是 `src/models/user.py`。
*   **解决方案**: 
    *   实现基于文件名的模糊搜索算法。
    *   如果匹配唯一，自动纠正并执行。
    *   如果匹配多个，返回歧义列表，供 LLM 选择。
    *   支持部分路径匹配和大小写不敏感匹配。

### 6.2 符号解析容错

*   **问题**: LLM 可能会提供不完整或错误的符号名称。
*   **解决方案**: 
    *   实现基于符号名称的模糊匹配算法。
    *   支持前缀匹配、后缀匹配和子串匹配。
    *   如果匹配唯一，自动纠正并执行。
    *   如果匹配多个，返回歧义列表，供 LLM 选择。

### 6.3 Debug Adapter 崩溃恢复

*   **问题**: 底层的 Debug Adapter 可能会崩溃（常见于 C++ 调试）。
*   **解决方案**: 
    *   使用 `execa` 监控 Debug Adapter 进程状态。
    *   如果进程退出码非零，自动重启 Adapter。
    *   向 LLM 返回友好错误信息：“调试器意外重置，请重新启动调试会话”。
    *   支持断点和会话状态恢复（Phase 2）。

### 6.4 LSP 服务不可用处理

*   **问题**: LSP 服务可能会超时或返回错误。
*   **解决方案**: 
    *   实现 LSP 服务健康检查机制。
    *   如果 LSP 服务不可用，自动重启。
    *   向 LLM 返回友好错误信息：“静态分析服务暂时不可用，请稍后重试”。
    *   支持降级到基本文本搜索（Phase 2）。

### 6.5 超长响应截断

*   **问题**: `lcp_read_symbol` 可能返回超过 10k Tokens 的代码（比如巨型初始化数组）。
*   **解决方案**: 
    *   实现自动截断机制，默认截断阈值为 10k Tokens。
    *   截断中间部分，返回 `... (skipping N lines) ...`。
    *   向 LLM 说明截断情况，并提供获取完整代码的选项。
    *   支持自定义截断阈值（Phase 2）。

### 6.6 请求超时处理

*   **问题**: LSP 或 DAP 请求可能会超时。
*   **解决方案**: 
    *   为所有 LSP 和 DAP 请求设置超时时间（默认 5秒）。
    *   超时后返回友好错误信息：“请求超时，请稍后重试”。
    *   支持异步请求和轮询机制（Phase 2）。

---

## 7. 开发路线图 (Roadmap)

### Phase 1: MVP (Python Focus) - Q1 2024

*   **核心功能**: 
    *   集成 `pyright` (LSP) 和 `debugpy` (DAP)。
    *   实现基础的静态分析工具：`lcp_get_outline`, `lcp_read_symbol`, `lcp_get_diagnostics`。
    *   实现基础的调试工具：`lcp_debug_launch`, `lcp_add_breakpoint`, `lcp_debug_step`, `lcp_debug_evaluate`。
    *   实现会话管理和资源释放。
*   **技术目标**: 
    *   支持 Python 3.8+。
    *   实现 MCP 协议集成。
    *   支持基本的错误处理和容错机制。
*   **验收标准**: 
    *   能够成功启动调试会话并执行基本调试操作。
    *   能够准确获取文件大纲和符号信息。
    *   能够处理常见错误情况，返回友好错误信息。
    *   性能：单个请求响应时间 < 1秒。

### Phase 2: 多语言支持 - Q2 2024

*   **核心功能**: 
    *   引入 `gopls` (Go), `clangd` (C/C++), `tsserver` (TS)。
    *   实现 **LCP Router**：根据文件扩展名自动启动对应的 Language Server。
    *   支持条件断点和日志断点。
    *   实现 `lcp_find_references` 工具。
    *   支持会话状态恢复。
*   **技术目标**: 
    *   支持 4 种主流语言：Python, Go, C/C++, TypeScript。
    *   实现高级错误处理和自我修复机制。
    *   支持并发处理多个会话。
*   **验收标准**: 
    *   能够自动选择合适的 LSP 服务。
    *   能够处理跨语言项目。
    *   能够恢复崩溃的 Debug Adapter 会话。
    *   性能：并发处理 10+ 会话，响应时间 < 2秒。

### Phase 3: 高级特性 - Q3 2024

*   **核心功能**: 
    *   **Hot Reload Debugging**: 允许 LLM 在调试过程中修改代码并热重载（需要 DAP 支持）。
    *   **Reverse Debugging**: 集成 `rr` 或 GDB 的反向调试功能，允许 LLM “回退一步”。
    *   **智能代码补全**: 基于 LSP 的 `completionItem/resolve` 提供智能代码补全。
    *   **代码重构支持**: 支持重命名、提取函数等重构操作。
*   **技术目标**: 
    *   实现高级调试功能。
    *   支持代码生成和重构。
    *   提高 AI 辅助开发的效率。
*   **验收标准**: 
    *   能够在调试过程中修改代码并热重载。
    *   能够执行反向调试操作。
    *   能够提供准确的代码补全建议。
    *   能够执行基本的代码重构操作。

### Phase 4: 性能优化与扩展 - Q4 2024

*   **核心功能**: 
    *   实现分布式架构，支持水平扩展。
    *   优化 LSP 和 DAP 通信性能。
    *   实现缓存机制，提高重复请求响应速度。
    *   支持插件系统，允许扩展新的 LSP 和 DAP 服务。
*   **技术目标**: 
    *   支持大规模项目（10k+ 文件）。
    *   实现毫秒级响应时间。
    *   支持自定义插件扩展。
*   **验收标准**: 
    *   能够处理 10k+ 文件的大型项目。
    *   平均响应时间 < 500ms。
    *   能够通过插件扩展支持新的语言和工具。

---

## 8. 部署与运维

### 8.1 部署方式

*   **Docker 容器**: 提供官方 Docker 镜像，支持快速部署。
*   **二进制分发**: 提供 Windows, macOS, Linux 二进制文件。
*   **npm 包**: 支持通过 npm 安装和运行。

### 8.2 配置选项

*   **环境变量**: 
    *   `LCP_PORT`: 服务端口，默认 3000。
    *   `LCP_LOG_LEVEL`: 日志级别，默认 "info"。
    *   `LCP_TMP_DIR`: 临时目录，默认 "/tmp/lcp"。
    *   `LCP_MAX_SESSIONS`: 最大并发会话数，默认 10。

*   **配置文件**: 
    *   支持通过 `lcp.config.json` 配置详细参数。
    *   支持配置 LSP 和 DAP 服务路径。
    *   支持配置超时时间和缓存大小。

### 8.3 监控与日志

*   **结构化日志**: 使用 `winston` 记录结构化日志，支持 JSON 格式。
*   **指标监控**: 暴露 Prometheus 指标，支持监控：
    *   请求次数和响应时间。
    *   会话数量和资源使用情况。
    *   LSP 和 DAP 服务健康状态。
*   **错误追踪**: 支持集成 Sentry 等错误追踪服务。

### 8.4 安全考虑

*   **网络安全**: 
    *   支持 TLS 加密（Phase 2）。
    *   支持 API 密钥认证（Phase 2）。
    *   支持 IP 白名单（Phase 2）。

*   **进程隔离**: 
    *   使用 `execa` 隔离 LSP 和 DAP 进程。
    *   限制进程权限，防止恶意代码执行。

*   **数据安全**: 
    *   不存储敏感数据，所有会话数据在内存中临时存储。
    *   支持会话数据加密（Phase 3）。

---

## 9. API 参考

### 9.1 静态分析 API

#### `lcp_get_outline(file_path: string)`
*   **请求示例**: `{ "tool": "lcp_get_outline", "params": { "file_path": "main.py" } }`
*   **响应示例**: 
    ```json
    {
        "success": true,
        "data": [
            {
                "name": "main",
                "kind": "function",
                "range": { "start": { "line": 1, "character": 0 }, "end": { "line": 5, "character": 0 } },
                "children": []
            }
        ]
    }
    ```

#### `lcp_read_symbol(file_path: string, symbol_name: string)`
*   **请求示例**: `{ "tool": "lcp_read_symbol", "params": { "file_path": "main.py", "symbol_name": "main" } }`
*   **响应示例**: 
    ```json
    {
        "success": true,
        "data": "def main():\n    print(\"Hello, World!\")\n    return 0"
    }
    ```

#### `lcp_find_references(symbol_name: string, context_file: string)`
*   **请求示例**: `{ "tool": "lcp_find_references", "params": { "symbol_name": "process_data", "context_file": "main.py" } }`
*   **响应示例**: 
    ```json
    {
        "success": true,
        "data": [
            {
                "file": "main.py",
                "line": 10,
                "code_snippet": "process_data(x)",
                "context": "def main(): process_data(x)"
            }
        ]
    }
    ```

#### `lcp_get_diagnostics(file_path?: string)`
*   **请求示例**: `{ "tool": "lcp_get_diagnostics", "params": { "file_path": "main.py" } }`
*   **响应示例**: 
    ```json
    {
        "success": true,
        "data": [
            {
                "file": "main.py",
                "line": 5,
                "severity": "error",
                "message": "Undefined variable 'x'"
            }
        ]
    }
    ```

### 9.2 动态调试 API

#### `lcp_debug_launch(program: string, args: string[], env?: Record<string, string>)`
*   **请求示例**: `{ "tool": "lcp_debug_launch", "params": { "program": "main.py", "args": ["--verbose"] } }`
*   **响应示例**: 
    ```json
    {
        "success": true,
        "data": { "session_id": "uuid", "status": "started", "breakpoint_count": 0, "current_line": 1 }
    }
    ```

#### `lcp_add_breakpoint(file: string, line: number)`
*   **请求示例**: `{ "tool": "lcp_add_breakpoint", "params": { "file": "main.py", "line": 10 } }`
*   **响应示例**: 
    ```json
    {
        "success": true,
        "data": { "breakpoint_id": "uuid", "verified": true, "file": "main.py", "line": 10 }
    }
    ```

#### `lcp_debug_step(session_id: string, action: 'next' | 'stepIn' | 'stepOut' | 'continue')`
*   **请求示例**: `{ "tool": "lcp_debug_step", "params": { "session_id": "uuid", "action": "next" } }`
*   **响应示例**: 
    ```json
    {
        "success": true,
        "data": {
            "status": "stopped",
            "reason": "step",
            "current_line": 11,
            "current_file": "main.py",
            "call_stack": [{ "function": "main", "file": "main.py", "line": 11 }],
            "local_variables": [{ "name": "x", "value": "10", "type": "int" }]
        }
    }
    ```

---

## 10. 示例使用场景

### 10.1 代码理解场景

```
LLM: 我想了解 main.py 文件的结构，请帮我获取文件大纲。
Tool Call: lcp_get_outline("main.py")
Tool Response: [{ "name": "main", "kind": "function", "range": { "start": { "line": 1, "character": 0 }, "end": { "line": 5, "character": 0 } } }]
LLM: 请帮我查看 main 函数的具体实现。
Tool Call: lcp_read_symbol("main.py", "main")
Tool Response: "def main():\n    print(\"Hello, World!\")\n    return 0"
```

### 10.2 调试场景

```
LLM: 请帮我启动 main.py 的调试会话。
Tool Call: lcp_debug_launch("main.py", [])
Tool Response: { "session_id": "uuid", "status": "started", "breakpoint_count": 0, "current_line": 1 }
LLM: 请在第 3 行添加一个断点。
Tool Call: lcp_add_breakpoint("main.py", 3)
Tool Response: { "breakpoint_id": "uuid", "verified": true, "file": "main.py", "line": 3 }
LLM: 请执行 continue 操作，直到遇到断点。
Tool Call: lcp_debug_step("uuid", "continue")
Tool Response: { "status": "stopped", "reason": "breakpoint", "current_line": 3, "current_file": "main.py", "call_stack": [{ "function": "main", "file": "main.py", "line": 3 }], "local_variables": [] }
LLM: 请执行 next 操作。
Tool Call: lcp_debug_step("uuid", "next")
Tool Response: { "status": "stopped", "reason": "step", "current_line": 4, "current_file": "main.py", "call_stack": [{ "function": "main", "file": "main.py", "line": 4 }], "local_variables": [] }
```

---

## 11. 常见问题 (FAQ)

### Q1: LCP 支持哪些编程语言？

A: Phase 1 支持 Python，Phase 2 支持 Go, C/C++, TypeScript，后续将支持更多语言。

### Q2: LCP 与其他 IDE 后端服务有什么区别？

A: LCP 专门为 LLM/Agent 设计，提供无状态、原子化的 API，优化了 Token 消耗和交互体验。

### Q3: LCP 如何处理大型项目？

A: LCP 实现了高效的缓存机制和按需加载策略，支持处理 10k+ 文件的大型项目。

### Q4: LCP 支持远程调试吗？

A: Phase 1 支持本地调试，Phase 2 将支持远程调试。

### Q5: LCP 如何保证安全性？

A: LCP 实现了进程隔离、数据加密和访问控制机制，确保使用安全。

---

## 12. 贡献指南

### 12.1 开发环境搭建

1.  克隆代码仓库：`git clone https://github.com/example/lcp.git`
2.  安装依赖：`npm install`
3.  启动开发服务器：`npm run dev`
4.  运行测试：`npm test`

### 12.2 代码规范

*   **TypeScript**: 使用 TypeScript 编写所有代码，严格类型检查。
*   **ESLint**: 使用 ESLint 进行代码 linting。
*   **Prettier**: 使用 Prettier 格式化代码。
*   **Jest**: 使用 Jest 编写单元测试和集成测试。

### 12.3 提交规范

*   使用 Conventional Commits 规范提交代码。
*   提交前运行 `npm run lint` 和 `npm test`。
*   提供详细的提交信息，说明修改内容和原因。

---

## 13. 许可证

LCP 采用 MIT 许可证，详见 LICENSE 文件。
