/**
 * Core type definitions for LCP
 */

import type { LSPClient } from '../lsp/client.js';

/**
 * Supported language types
 */
export enum LanguageType {
  PYTHON = 'python',
  GO = 'go',
  CPP = 'cpp',
  TYPESCRIPT = 'typescript',
  UNKNOWN = 'unknown',
}
/**
 * Forward declaration to avoid circular dependency
 */
export interface DAPClient {
  // Basic DAP client interface
  stackTrace: (threadId: number) => Promise<unknown>;
  scopes: (frameId: number) => Promise<unknown>;
  variables: (variablesReference: number) => Promise<unknown>;
  next: (threadId: number) => Promise<unknown>;
  stepIn: (threadId: number) => Promise<unknown>;
  stepOut: (threadId: number) => Promise<unknown>;
  continue: (threadId: number) => Promise<unknown>;
  pause: (threadId: number) => Promise<unknown>;
  evaluate: (expression: string, frameId?: number, context?: 'watch' | 'repl' | 'hover') => Promise<unknown>;
  disconnect: () => Promise<void>;
  breakpointManager: {
    add: (file: string, line: number, options?: {
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
      enabled?: boolean;
    }) => BreakpointInfo;
    getByFile: (file: string) => BreakpointInfo[];
    updateVerification: (breakpointId: string, verified: boolean) => void;
  };
  eventBus: {
    waitFor: (eventName: string, options?: { timeout?: number }) => Promise<unknown>;
  };
}

/**
 * Session represents a single LCP session with associated LSP and DAP clients
 */
export interface Session {
  id: string;
  createdAt: Date;
  lastAccessedAt: Date;
  workspaceRoot: string;
  /** @deprecated Use lspClients instead for multi-language support */
  lspClient?: LSPClient;
  /** Map of language type to LSP client for multi-language support */
  lspClients: Map<LanguageType, LSPClient>;
  dapClient?: DAPClient;
  openFiles: Set<string>;
  diagnostics: Map<string, DiagnosticInfo[]>;
}

/**
 * Generic tool result wrapper
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Diagnostic information from LSP
 */
export interface DiagnosticInfo {
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  source?: string;
  code?: string | number;
}

/**
 * Symbol information from LSP
 */
export interface SymbolInfo {
  name: string;
  kind: string;
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  children?: SymbolInfo[];
  detail?: string;
}

/**
 * Breakpoint information
 */
export interface BreakpointInfo {
  id: string;
  file: string;
  line: number;
  verified: boolean;
  enabled: boolean;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
}

/**
 * Debug session state
 */
export interface DebugState {
  status: 'running' | 'stopped' | 'paused' | 'terminated';
  reason?: string;
  currentLine?: number;
  currentFile?: string;
  callStack?: StackFrame[];
  localVariables?: Variable[];
}

/**
 * Stack frame information
 */
export interface StackFrame {
  id: number;
  name: string;
  file?: string;
  line?: number;
  column?: number;
}

/**
 * Variable information
 */
export interface Variable {
  name: string;
  value: string;
  type?: string;
  variablesReference?: number;
}

/**
 * LSP position (0-based)
 */
export interface Position {
  line: number;
  character: number;
}

/**
 * LSP range (0-based)
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * Reference information for lcp_find_references
 */
export interface ReferenceInfo {
  file: string;
  line: number;
  column: number;
  context: string;
  isDefinition: boolean;
}

/**
 * Error codes
 */
export enum ErrorCode {
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  SYMBOL_NOT_FOUND = 'SYMBOL_NOT_FOUND',
  LSP_ERROR = 'LSP_ERROR',
  DAP_ERROR = 'DAP_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
