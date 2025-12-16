/**
 * Generic DAP client implementation with state machine
 */

import { execa, type ResultPromise } from 'execa';
import { logger } from '../utils/logger.js';
import { DAPError } from '../utils/error-handler.js';
import { EventBus } from './event-bus.js';
import { BreakpointManager } from './breakpoint-manager.js';

interface DAPRequest {
  seq: number;
  type: 'request';
  command: string;
  arguments?: unknown;
}

interface DAPResponse {
  seq: number;
  type: 'response';
  request_seq: number;
  success: boolean;
  command: string;
  message?: string;
  body?: unknown;
}

interface DAPEvent {
  seq: number;
  type: 'event';
  event: string;
  body?: unknown;
}

type DAPMessage = DAPResponse | DAPEvent;

/**
 * Base DAP client class
 */
export class DAPClient {
  protected process?: ResultPromise;
  protected nextSeq = 1;
  protected pendingRequests = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  protected buffer = '';
  protected initialized = false;

  public eventBus = new EventBus();
  public breakpointManager = new BreakpointManager();

  constructor(
    protected command: string,
    protected args: string[],
    protected cwd: string
  ) {}

  /**
   * Start the DAP adapter process
   */
  async start(): Promise<void> {
    logger.info('Starting DAP adapter', {
      command: this.command,
      args: this.args,
      cwd: this.cwd,
    });

    try {
      this.process = execa(this.command, this.args, {
        cwd: this.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Handle stdout (DAP messages)
      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleData(data);
      });

      // Handle stderr (logs)
      this.process.stderr?.on('data', (data: Buffer) => {
        logger.debug('DAP stderr', { data: data.toString() });
      });

      // Handle process exit
      this.process.on('exit', (code: number | null) => {
        logger.info('DAP adapter exited', { code });
        this.handleExit(code);
      });

      // Wait a bit for process to start
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      logger.error('Failed to start DAP adapter', { error });
      throw new DAPError('Failed to start DAP adapter', error);
    }
  }

  /**
   * Initialize the DAP adapter
   */
  async initialize(): Promise<unknown> {
    const result = await this.sendRequest('initialize', {
      clientID: 'lcp',
      clientName: 'Language Context Provider',
      adapterID: 'python',
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: false,
      supportsRunInTerminalRequest: false,
      locale: 'en-US',
    });

    this.initialized = true;
    logger.info('DAP adapter initialized');
    return result;
  }

  /**
   * Send a request to the DAP adapter
   */
  async sendRequest(command: string, args?: unknown): Promise<unknown> {
    if (!this.process || !this.process.stdin) {
      throw new DAPError('DAP adapter not started');
    }

    const seq = this.nextSeq++;
    const request: DAPRequest = {
      seq,
      type: 'request',
      command,
      arguments: args,
    };

    const promise = new Promise((resolve, reject) => {
      this.pendingRequests.set(seq, { resolve, reject });
    });

    const content = JSON.stringify(request);
    const message = `Content-Length: ${Buffer.byteLength(content)}\r\n\r\n${content}`;

    logger.debug('Sending DAP request', { command, seq });
    this.process.stdin.write(message);

    return promise;
  }

  /**
   * Disconnect from the DAP adapter
   */
  async disconnect(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    logger.info('Disconnecting from DAP adapter');

    try {
      await this.sendRequest('disconnect', { terminateDebuggee: true });
    } catch (error) {
      logger.warn('Error during DAP disconnect', { error });
    }

    // Kill process if still running
    if (this.process) {
      this.process.kill();
    }

    this.eventBus.clear();
    this.initialized = false;
  }

  /**
   * Handle incoming data from DAP adapter
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
        const message: DAPMessage = JSON.parse(messageContent);
        this.handleMessage(message);
      } catch (error) {
        logger.error('Failed to parse DAP message', { error, messageContent });
      }
    }
  }

  /**
   * Handle a parsed DAP message
   */
  private handleMessage(message: DAPMessage): void {
    if (message.type === 'response') {
      // Response
      const pending = this.pendingRequests.get(message.request_seq);
      if (pending) {
        this.pendingRequests.delete(message.request_seq);
        if (!message.success) {
          logger.warn('DAP request failed', {
            seq: message.request_seq,
            command: message.command,
            message: message.message,
          });
          pending.reject(
            new DAPError(message.message || 'DAP request failed', message.body)
          );
        } else {
          logger.debug('DAP request success', {
            seq: message.request_seq,
            command: message.command,
          });
          pending.resolve(message.body);
        }
      }
    } else if (message.type === 'event') {
      // Event
      logger.debug('DAP event received', { event: message.event });
      this.eventBus.emit(message.event, message.body);
    }
  }

  /**
   * Handle process exit
   */
  private handleExit(code: number | null): void {
    // Reject all pending requests
    for (const [, pending] of this.pendingRequests.entries()) {
      pending.reject(new DAPError(`DAP adapter exited with code ${code}`));
    }
    this.pendingRequests.clear();
    this.eventBus.clear();
    this.initialized = false;
  }
}
