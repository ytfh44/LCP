# LCP v0.2 功能规格说明书 (假设)

本文档详细定义了 LCP v0.2 版本（对应 Phase 2）的预期能力、技术规格和接口定义。

## 1. 核心目标
v0.2 的核心目标是从 "Python 单语言 MVP" 进化为 "多语言通用 IDE 后端"，并增强调试能力的深度。

## 2. 多语言支持能力 (Multi-Language Support)

系统将通过 `LanguageClientFactory` 和 `DebugAdapterFactory` 抽象层，根据文件扩展名自动加载对应的服务。

### 2.1 支持矩阵

| 语言 | 扩展名 | 静态分析 (LSP) | 动态调试 (DAP) | 备注 |
| :--- | :--- | :--- | :--- | :--- |
| **Python** | `.py` | `pyright` (stdio) | `debugpy` (socket/stdio) | v0.1 已实现，需优化稳定性 |
| **TypeScript/JS** | `.ts`, `.js`, `.tsx` | `typescript-language-server` | `js-debug` (或 `node-debug2`) | 需处理 node_modules 依赖解析 |
| **Go** | `.go` | `gopls` | `dlv` (delve) |需确保 GOPATH 正确 |
| **C/C++** | `.c`, `.cpp`, `.h` | `clangd` | `lldb-dap` (原 `lldb-vscode`) | 需 `compile_commands.json` 支持 |

### 2.2 自动路由 (LCP Router)
*   **能力假设**：用户无需指定语言，LCP 根据请求中的 `filePath` 自动判定。
*   **实现逻辑**：
    *   收到 `lcp_get_outline("main.go")` -> 识别为 Go -> 启动/复用 `gopls` 实例。
    *   支持多语言混合项目（如 Python 调用 C++），将维护多个独立的 LSP 进程。

### 2.3 配置管理
*   新增 `config.json` 或环境变量 `LCP_LANG_CONFIG`，允许用户自定义各语言 Server 的路径（若不在 PATH 中）。

## 3. 增强调试能力 (Advanced Debugging)

### 3.1 条件断点 (Conditional Breakpoints)
*   **原有接口**：`lcp_add_breakpoint(file, line)`
*   **v0.2 增强**：`lcp_add_breakpoint(file, line, condition?, hitCondition?, logMessage?)`
*   **参数说明**：
    *   `condition`: 表达式（如 `i > 5`），仅当为真时中断。
    *   `hitCondition`: 命中次数（如 `10`），第 10 次命中时中断。
    *   `logMessage`: 不中断，仅打印日志（实现 "Logpoints"）。

### 3.2 调试会话恢复 (Session Recovery) - *实验性*
*   **能力假设**：Agent 短暂断开后，LCP 保持调试进程存活一定时间（如 10分钟）。
*   **实现**：`sessionId` 可重入。只要 DAP 进程未死，再次调用 `lcp_debug_status(sessionId)` 可获取当前状态。

## 4. 新增工具接口 (New Tools)

为了支持更深度的代码理解，v0.2 将新增以下 MCP 工具：

### 4.1 `lcp_find_references` (查找引用)
获取某符号在项目中的所有使用位置。
```json
{
  "tool": "lcp_find_references",
  "params": {
    "file": "/path/to/main.py",
    "line": 10,
    "character": 5, // 或使用 symbolOffset/symbolName 模糊匹配
    "includeDeclaration": true
  }
}
```
*   **返回**：引用列表 `[{ file, line, codeSnippet }]`。

### 4.2 `lcp_go_to_definition` (跳转定义)
虽已有 `lcp_read_symbol`，但跳转定义能处理跨文件依赖。
*   **返回**：`{ file, range, isSameFile }`。

### 4.3 `lcp_format_document` (代码格式化)
调用 LSP 的 `textDocument/formatting`。
*   **场景**：Agent 生成代码后，调用此工具修复格式，避免 Lint 错误。

## 5. 架构升级假设

### 5.1 统一 LSP 客户端
v0.1 可能对 Pyright 进行了硬编码。v0.2 假设存在一个通用 `GenericLSPClient` 类：
*   处理通用的 `initialize`, `textDocument/*` 消息。
*   处理 Capability 协商（不同 Server 支持的功能不同）。

### 5.2 虚拟文件系统 (VFS) 增强
*   支持 `textDocument/didChange`（增量更新），而非每次全量打开。虽然 MCP 是无状态的，但 LSP Session 必须有状态。LCP 将在内存中维护文件版本。

## 6. 验收标准
1.  **混合调试**：能同时开启 Python 和 Go 的调试会话（互不干扰）。
2.  **条件断点有效**：设置 `i==5`，循环应在第 5 次停止。
3.  **引用查找准确**：能找到跨文件的函数调用。
