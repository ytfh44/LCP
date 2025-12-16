/**
 * Generic LSP client implementation
 */

import { execa, type ResultPromise } from 'execa';
import { logger } from '../utils/logger.js';
import { LSPError } from '../utils/error-handler.js';

interface LSPRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: unknown;
}

interface LSPResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface LSPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: unknown;
}

type LSPMessage = LSPResponse | LSPNotification;

/**
 * Base LSP client class
 */
export class LSPClient {
  protected process?: ResultPromise;
  protected nextId = 1;
  protected pendingRequests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  protected notificationHandlers = new Map<
    string,
    (params: unknown) => void
  >();
  protected buffer = '';
  protected initialized = false;

  constructor(
    protected command: string,
    protected args: string[],
    protected workspaceRoot: string
  ) {}

  /**
   * Start the LSP server process
   */
  async start(): Promise<void> {
    logger.info('Starting LSP server', {
      command: this.command,
      args: this.args,
      workspaceRoot: this.workspaceRoot,
    });

    try {
      this.process = execa(this.command, this.args, {
        cwd: this.workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Handle stdout (LSP messages)
      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      // Handle stderr (logs)
      this.process.stderr?.on('data', (data: Buffer) => {
        logger.debug('LSP stderr', { data: data.toString() });
      });

      // Handle process exit
      this.process.on('exit', (code: number | null) => {
        logger.info('LSP server exited', { code });
        this.handleExit(code);
      });

      // Wait a bit for process to start
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      logger.error('Failed to start LSP server', { error });
      throw new LSPError('Failed to start LSP server', error);
    }
  }

  /**
   * Initialize the LSP server
   */
  async initialize(capabilities?: unknown): Promise<unknown> {
    const result = await this.sendRequest('initialize', {
      processId: process.pid,
      rootUri: `file:///${this.workspaceRoot.replace(/\\/g, '/')}`,
      capabilities: capabilities || {},
    });

    this.initialized = true;

    // Send initialized notification
    await this.sendNotification('initialized', {});

    logger.info('LSP server initialized');
    return result;
  }

  /**
   * Send a request to the LSP server
   */
  async sendRequest(method: string, params?: unknown): Promise<unknown> {
    if (!this.process || !this.process.stdin) {
      throw new LSPError('LSP server not started');
    }

    const id = this.nextId++;
    const request: LSPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
    });

    const content = JSON.stringify(request);
    const message = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n${content}`;

    logger.debug('Sending LSP request', { method, id });
    this.process.stdin.write(message);

    return promise;
  }

  /**
   * Send a notification to the LSP server
   */
  async sendNotification(method: string, params?: unknown): Promise<void> {
    if (!this.process || !this.process.stdin) {
      throw new LSPError('LSP server not started');
    }

    const notification: LSPNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const content = JSON.stringify(notification);
    const message = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n${content}`;

    logger.debug('Sending LSP notification', { method });
    this.process.stdin.write(message);
  }

  /**
   * Register a notification handler
   */
  onNotification(method: string, handler: (params: unknown) => void): void {
    this.notificationHandlers.set(method, handler);
  }

  /**
   * Shutdown the LSP server
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logger.info('Shutting down LSP server');

    try {
      await this.sendRequest('shutdown');
      await this.sendNotification('exit');
    } catch (error) {
      logger.warn('Error during LSP shutdown', { error });
    }

    // Kill process if still running
    if (this.process) {
      this.process.kill();
    }

    this.initialized = false;
  }

  /**
   * Handle incoming data from LSP server
   */
  private handleData(data: Buffer): void {
    this.buffer += data.toString();

    while (true) {
      // Look for Content-Length header
      const headerMatch = this.buffer.match(/Content-Length: (\d+)\r\n/);
      if (!headerMatch) {
        break;
      }

      const contentLength = parseInt(headerMatch[1], 10);
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        break;
      }

      const messageStart = headerEnd + 4;
      const messageEnd = messageStart + contentLength;

      if (this.buffer.length < messageEnd) {
        break;
      }

      const messageContent = this.buffer.substring(messageStart, messageEnd);
      this.buffer = this.buffer.substring(messageEnd);

      try {
        const message: LSPMessage = JSON.parse(messageContent);
        this.handleMessage(message);
      } catch (error) {
        logger.error('Failed to parse LSP message', { error, messageContent });
      }
    }
  }

  /**
   * Handle a parsed LSP message
   */
  private handleMessage(message: LSPMessage): void {
    if ('id' in message) {
      // Response
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          logger.warn('LSP request error', {
            id: message.id,
            error: message.error,
          });
          pending.reject(
            new LSPError(message.error.message, message.error.data)
          );
        } else {
          logger.debug('LSP request success', { id: message.id });
          pending.resolve(message.result);
        }
      }
    } else {
      // Notification
      const handler = this.notificationHandlers.get(message.method);
      if (handler) {
        handler(message.params);
      } else {
        logger.debug('Unhandled LSP notification', { method: message.method });
      }
    }
  }

  /**
   * Handle process exit
   */
  private handleExit(code: number | null): void {
    // Reject all pending requests
    for (const [, pending] of this.pendingRequests.entries()) {
      pending.reject(new LSPError(`LSP server exited with code ${code}`));
    }
    this.pendingRequests.clear();
    this.initialized = false;
  }
}
