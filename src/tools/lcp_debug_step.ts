/**
 * lcp_debug_step tool implementation
 */

import type { ToolResult, DebugState, StackFrame, Variable } from '../core/types.js';
import { sessionStore } from '../core/session.js';
import { withErrorHandling, DAPError } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';

interface DebugStepParams {
  sessionId: string;
  action: 'next' | 'stepIn' | 'stepOut' | 'continue';
  threadId?: number;
}

/**
 * Execute a debug step operation
 */
export async function lcpDebugStep(
  params: DebugStepParams
): Promise<ToolResult<DebugState>> {
  return withErrorHandling(async () => {
    logger.info('lcp_debug_step called', params);

    const session = sessionStore.get(params.sessionId);
    if (!session.dapClient) {
      throw new DAPError('No active debug session');
    }

    // Use threadId 1 as default (most programs have single thread)
    const threadId = params.threadId || 1;

    // Execute the action
    switch (params.action) {
      case 'next':
        await session.dapClient.next(threadId);
        break;
      case 'stepIn':
        await session.dapClient.stepIn(threadId);
        break;
      case 'stepOut':
        await session.dapClient.stepOut(threadId);
        break;
      case 'continue':
        await session.dapClient.continue(threadId);
        break;
    }

    // Wait for stopped event with timeout
    let stoppedEvent;
    try {
      stoppedEvent = (await session.dapClient.eventBus.waitFor('stopped', {
        timeout: 5000,
      })) as { reason: string; threadId: number };
    } catch (err) {
      // Timeout - program still running, pause it
      logger.warn('Debug step timeout, pausing execution', { error: err });
      await session.dapClient.pause(threadId);

      stoppedEvent = (await session.dapClient.eventBus.waitFor('stopped', {
        timeout: 2000,
      })) as { reason: string; threadId: number };
    }

    // Get current state
    const state = await getCurrentState(
      session.dapClient,
      stoppedEvent.threadId,
      stoppedEvent.reason
    );

    logger.info('lcp_debug_step completed', {
      action: params.action,
      status: state.status,
    });

    return state;
  });
}

/**
 * Get current debug state
 */
import type { DAPClient } from '../core/types.js';

async function getCurrentState(
  dapClient: DAPClient,
  threadId: number,
  reason: string
): Promise<DebugState> {
  // Get stack trace
  const stackTrace = (await dapClient.stackTrace(threadId)) as {
    stackFrames: Array<{
      id: number;
      name: string;
      source?: { path: string };
      line: number;
      column: number;
    }>;
  };

  const frames: StackFrame[] = stackTrace.stackFrames.map((frame) => ({
    id: frame.id,
    name: frame.name,
    file: frame.source?.path,
    line: frame.line,
    column: frame.column,
  }));

  // Get local variables for top frame
  let variables: Variable[] = [];
  if (frames.length > 0) {
    const scopes = (await dapClient.scopes(frames[0].id)) as {
      scopes: Array<{ name: string; variablesReference: number }>;
    };

    if (scopes.scopes.length > 0) {
      const vars = (await dapClient.variables(
        scopes.scopes[0].variablesReference
      )) as {
        variables: Array<{
          name: string;
          value: string;
          type?: string;
          variablesReference?: number;
        }>;
      };

      variables = vars.variables.map((v) => ({
        name: v.name,
        value: v.value,
        type: v.type,
        variablesReference: v.variablesReference,
      }));
    }
  }

  return {
    status: 'stopped',
    reason,
    currentLine: frames[0]?.line,
    currentFile: frames[0]?.file,
    callStack: frames,
    localVariables: variables,
  };
}
