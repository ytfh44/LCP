# LCP (Language Context Provider)

**Headless IDE Backend for AI Agents**

LCP is a middleware service that bridges the gap between AI agents and IDE backend capabilities. It wraps LSP (Language Server Protocol) for static analysis and DAP (Debug Adapter Protocol) for dynamic debugging into a clean, stateless MCP (Model Context Protocol) interface.

## Features

### Phase 1 (Current - MVP)

**Static Analysis (LSP)**:
- 📋 **Get File Outline**: Retrieve symbol information (classes, functions, variables)
- 🔍 **Read Symbol Code**: Extract specific function/class code with fuzzy matching
- ⚠️ **Get Diagnostics**: Fetch compiler errors and warnings

**Dynamic Debugging (DAP)**:
- 🚀 **Launch Debug Session**: Start debugging with automatic entry point stop
- 🔴 **Manage Breakpoints**: Add, verify, and sync breakpoints
- ⏭️ **Step Operations**: next, stepIn, stepOut, continue with timeout protection
- 🧮 **Evaluate Expressions**: Execute code in current debug context
- 🛑 **Stop Debugging**: Clean session termination

**Supported Languages**: Python (via Pyright + debugpy)

## Installation

### Prerequisites

- Node.js 20+
- Python 3.8+ (for Python debugging)
- pip (for installing debugpy)

### Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python debugpy (required for debugging)
pip install debugpy
```

### Build

```bash
npm run build
```

## Usage

### Starting the Server

```bash
npm start
```

The server runs as an MCP server using stdio transport.

### Example Tool Calls

#### Get File Outline

```json
{
  "tool": "lcp_get_outline",
  "params": {
    "workspaceRoot": "/path/to/project",
    "filePath": "main.py"
  }
}
```

#### Read Symbol Code

```json
{
  "tool": "lcp_read_symbol",
  "params": {
    "sessionId": "uuid",
    "filePath": "main.py",
    "symbolName": "Calculator"
  }
}
```

#### Launch Debug Session

```json
{
  "tool": "lcp_debug_launch",
  "params": {
    "workspaceRoot": "/path/to/project",
    "program": "main.py",
    "args": []
  }
}
```

#### Add Breakpoint

```json
{
  "tool": "lcp_add_breakpoint",
  "params": {
    "sessionId": "uuid",
    "file": "main.py",
    "line": 10
  }
}
```

#### Execute Debug Step

```json
{
  "tool": "lcp_debug_step",
  "params": {
    "sessionId": "uuid",
    "action": "next"
  }
}
```

## Architecture

```
LLM/Agent
    ↓
MCP Server (LCP)
    ↓
├── LSP Client → Pyright (Python)
└── DAP Client → debugpy (Python)
```

### Key Components

- **Session Management**: Automatic session lifecycle with timeout cleanup
- **LSP Manager**: File tracking, diagnostic caching, coordinate conversion
- **DAP Client**: Event-driven debugging with awaitable events
- **Breakpoint Manager**: Centralized breakpoint tracking and synchronization
- **Error Handling**: Comprehensive error recovery and user-friendly messages

## Development

### Project Structure

```
src/
├── core/           # Core types and session management
├── lsp/            # LSP client and manager
├── dap/            # DAP client and event handling
├── tools/          # MCP tool implementations
├── utils/          # Utilities (logging, errors, path resolution)
└── index.ts        # Main entry point
```

### Scripts

- `npm run build` - Compile TypeScript
- `npm run dev` - Watch mode compilation
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run clean` - Clean build output

## Configuration

### Environment Variables

- `LCP_LOG_LEVEL` - Log level (error, warn, info, debug) - default: info
- `LCP_PORT` - Server port (if using HTTP transport)
- `LCP_TMP_DIR` - Temporary directory

## Troubleshooting

### Pyright not found

Install pyright globally or ensure it's in your project:
```bash
npm install -g pyright
```

### debugpy not found

Install debugpy for Python:
```bash
pip install debugpy
```

### Session timeout

Default session timeout is 30 minutes. Sessions are automatically cleaned up when inactive.

## Roadmap

- **Phase 2**: Multi-language support (Go, C/C++, TypeScript), conditional breakpoints, symbol references
- **Phase 3**: Hot reload debugging, reverse debugging, code completion, refactoring
- **Phase 4**: Distributed architecture, caching, plugin system

## License

MIT

## Contributing

Contributions are welcome! Please see the implementation plan and roadmap for details on planned features.
