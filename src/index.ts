#!/usr/bin/env node
/**
 * LCP (Language Context Provider) - Main Entry Point
 * MCP Server for LSP and DAP integration
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';
import { sessionStore } from './core/session.js';

// Import tools
import { lcpGetOutline } from './tools/lcp_get_outline.js';
import { lcpReadSymbol } from './tools/lcp_read_symbol.js';
import { lcpGetDiagnostics } from './tools/lcp_get_diagnostics.js';
import { lcpFindReferences } from './tools/lcp_find_references.js';
import { lcpDebugLaunch } from './tools/lcp_debug_launch.js';
import { lcpAddBreakpoint } from './tools/lcp_add_breakpoint.js';
import { lcpDebugStep } from './tools/lcp_debug_step.js';
import { lcpDebugEvaluate } from './tools/lcp_debug_evaluate.js';
import { lcpDebugStop } from './tools/lcp_debug_stop.js';
import { lcpCompletion } from './tools/lcp_completion.js';
import { lcpRenameSymbol } from './tools/lcp_rename_symbol.js';
import { lcpFormatDocument } from './tools/lcp_format_document.js';

/**
 * Create and configure MCP server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: 'lcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        // LSP Tools
        {
          name: 'lcp_get_outline',
          description:
            'Get file outline with hierarchical symbol information including classes, functions, methods, and variables. Returns symbol names, kinds, ranges, and nested children.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID (optional, will create new session if not provided)',
              },
              workspaceRoot: {
                type: 'string',
                description: 'Workspace root directory (required if sessionId not provided)',
              },
              filePath: {
                type: 'string',
                description: 'File path relative to workspace root (supports fuzzy matching)',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'lcp_read_symbol',
          description:
            'Extract the complete source code of a specific symbol (function, class, method) from a file. Supports fuzzy matching for symbol names. Automatically truncates symbols larger than 40k characters.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID (optional)',
              },
              workspaceRoot: {
                type: 'string',
                description: 'Workspace root directory (required if sessionId not provided)',
              },
              filePath: {
                type: 'string',
                description: 'File path relative to workspace root',
              },
              symbolName: {
                type: 'string',
                description: 'Symbol name to read (supports fuzzy matching)',
              },
            },
            required: ['filePath', 'symbolName'],
          },
        },
        {
          name: 'lcp_get_diagnostics',
          description:
            'Get LSP diagnostics (errors, warnings, hints) for a specific file or all files in the workspace. Provides severity, message, range, and source information.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID (optional)',
              },
              workspaceRoot: {
                type: 'string',
                description: 'Workspace root directory (required if sessionId not provided)',
              },
              filePath: {
                type: 'string',
                description: 'File path (optional, returns all diagnostics if not provided)',
              },
            },
          },
        },
        {
          name: 'lcp_find_references',
          description:
            'Find all references to a symbol across the project. Returns definition location and all reference locations with context. Supports multi-language projects (Python, Go, C/C++, TypeScript).',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID (optional)',
              },
              workspaceRoot: {
                type: 'string',
                description: 'Workspace root directory (required if sessionId not provided)',
              },
              filePath: {
                type: 'string',
                description: 'File path containing the symbol',
              },
              symbolName: {
                type: 'string',
                description: 'Name of the symbol to find references for',
              },
              includeDeclaration: {
                type: 'boolean',
                description: 'Include the declaration in results (default: true)',
              },
            },
            required: ['filePath', 'symbolName'],
          },
        },

        {
          name: 'lcp_completion',
          description:
            'Get code completion items at a specific position. Returns a list of completion items with label, kind, detail, and sortText.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID (optional)',
              },
              workspaceRoot: {
                type: 'string',
                description: 'Workspace root directory (required if sessionId not provided)',
              },
              filePath: {
                type: 'string',
                description: 'File path relative to workspace root',
              },
              line: {
                type: 'number',
                description: 'Line number (1-based)',
              },
              character: {
                type: 'number',
                description: 'Character offset (1-based)',
              },
            },
            required: ['filePath', 'line', 'character'],
          },
        },
        {
          name: 'lcp_rename_symbol',
          description:
            'Rename a symbol across the project. Applies changes to all files where the symbol is referenced. Returns the WorkspaceEdit object.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID (optional)',
              },
              workspaceRoot: {
                type: 'string',
                description: 'Workspace root directory (required if sessionId not provided)',
              },
              filePath: {
                type: 'string',
                description: 'File path relative to workspace root',
              },
              line: {
                type: 'number',
                description: 'Line number (1-based)',
              },
              character: {
                type: 'number',
                description: 'Character offset (1-based)',
              },
              newName: {
                type: 'string',
                description: 'New name for the symbol',
              },
            },
            required: ['filePath', 'line', 'character', 'newName'],
          },
        },
        {
          name: 'lcp_format_document',
          description:
            'Format a document using the language server. Returns a list of TextEdits to apply.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID (optional)',
              },
              workspaceRoot: {
                type: 'string',
                description: 'Workspace root directory (required if sessionId not provided)',
              },
              filePath: {
                type: 'string',
                description: 'File path relative to workspace root',
              },
            },
            required: ['filePath'],
          },
        },
        // DAP Tools
        {
          name: 'lcp_debug_launch',
          description: 'Launch a debug session for a Python program. Automatically stops at the program entry point and returns the session ID and initial execution state. Requires debugpy to be installed.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID (optional)',
              },
              workspaceRoot: {
                type: 'string',
                description: 'Workspace root directory (required if sessionId not provided)',
              },
              program: {
                type: 'string',
                description: 'Program file path to debug',
              },
              args: {
                type: 'array',
                items: { type: 'string' },
                description: 'Program arguments',
              },
              env: {
                type: 'object',
                description: 'Environment variables',
              },
            },
            required: ['program'],
          },
        },
        {
          name: 'lcp_add_breakpoint',
          description: 'Add a breakpoint at a specific line (1-based). Supports conditional breakpoints, hit conditions, and log messages. Returns verification status and breakpoint ID. Requires an active debug session.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID',
              },
              file: {
                type: 'string',
                description: 'File path',
              },
              line: {
                type: 'number',
                description: 'Line number (1-based)',
              },
              condition: {
                type: 'string',
                description: 'Conditional breakpoint expression (optional)',
              },
              hitCondition: {
                type: 'string',
                description: 'Hit condition (optional)',
              },
              logMessage: {
                type: 'string',
                description: 'Log message (optional)',
              },
            },
            required: ['sessionId', 'file', 'line'],
          },
        },
        {
          name: 'lcp_debug_step',
          description: 'Execute a debug step operation (next line, step into function, step out of function, or continue to next breakpoint). Returns updated execution state with call stack and local variables. Automatically pauses execution after 5 seconds if no breakpoint is hit.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID',
              },
              action: {
                type: 'string',
                enum: ['next', 'stepIn', 'stepOut', 'continue'],
                description: 'Debug action to perform',
              },
              threadId: {
                type: 'number',
                description: 'Thread ID (optional, defaults to 1)',
              },
            },
            required: ['sessionId', 'action'],
          },
        },
        {
          name: 'lcp_debug_evaluate',
          description: 'Evaluate a Python expression in the current debug context. Executes in the context of the specified stack frame (or top frame if not specified). Returns the result value, type, and variable reference.',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID',
              },
              expression: {
                type: 'string',
                description: 'Expression to evaluate',
              },
              frameId: {
                type: 'number',
                description: 'Stack frame ID (optional)',
              },
              context: {
                type: 'string',
                enum: ['watch', 'repl', 'hover'],
                description: 'Evaluation context (optional)',
              },
            },
            required: ['sessionId', 'expression'],
          },
        },
        {
          name: 'lcp_debug_stop',
          description: 'Stop a debug session',
          inputSchema: {
            type: 'object',
            properties: {
              sessionId: {
                type: 'string',
                description: 'Session ID',
              },
            },
            required: ['sessionId'],
          },
        },
      ],
    };
  });

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.info('Tool called', { name, args });

    try {
      let result;

      switch (name) {
        // LSP Tools
        case 'lcp_get_outline':
          result = await lcpGetOutline(args as never);
          break;
        case 'lcp_read_symbol':
          result = await lcpReadSymbol(args as never);
          break;
        case 'lcp_get_diagnostics':
          result = await lcpGetDiagnostics(args as never);
          break;
        case 'lcp_find_references':
          result = await lcpFindReferences(args as never);
          break;

        // DAP Tools
        case 'lcp_debug_launch':
          result = await lcpDebugLaunch(args as never);
          break;
        case 'lcp_add_breakpoint':
          result = await lcpAddBreakpoint(args as never);
          break;
        case 'lcp_debug_step':
          result = await lcpDebugStep(args as never);
          break;
        case 'lcp_debug_evaluate':
          result = await lcpDebugEvaluate(args as never);
          break;
        case 'lcp_debug_stop':
          result = await lcpDebugStop(args as never);
          break;
        case 'lcp_completion':
          result = await lcpCompletion(args as never);
          break;
        case 'lcp_rename_symbol':
          result = await lcpRenameSymbol(args as never);
          break;
        case 'lcp_format_document':
          result = await lcpFormatDocument(args as never);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Tool execution failed', { name, error });
      throw error;
    }
  });

  return server;
}

/**
 * Main function
 */
async function main() {
  logger.info('Starting LCP server');

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  logger.info('LCP server started and ready');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down LCP server');
    await sessionStore.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Shutting down LCP server');
    await sessionStore.shutdown();
    process.exit(0);
  });
}

// Run main function
main().catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
