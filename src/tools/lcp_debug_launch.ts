/**
 * lcp_debug_launch tool implementation
 */

import type { ToolResult } from '../core/types.js';
import { sessionStore } from '../core/session.js';
import { DebugpyClient } from '../dap/debugpy.js';
import { withErrorHandling } from '../utils/error-handler.js';
import { resolvePath } from '../utils/path-resolver.js';
import { logger } from '../utils/logger.js';

interface DebugLaunchParams {
  sessionId?: string;
  workspaceRoot?: string;
  program: string;
  args?: string[];
  env?: Record<string, string>;
}

interface DebugLaunchResult {
  sessionId: string;
  status: string;
  breakpointCount: number;
  currentLine?: number;
  currentFile?: string;
}

/**
 * Launch a debug session
 */
export async function lcpDebugLaunch(
  params: DebugLaunchParams
): Promise<ToolResult<DebugLaunchResult>> {
  return withErrorHandling(async () => {
    logger.info('lcp_debug_launch called', params);

    // Get or create session
    let session;
    if (params.sessionId) {
      session = sessionStore.get(params.sessionId);
    } else if (params.workspaceRoot) {
      session = sessionStore.create(params.workspaceRoot);
    } else {
      throw new Error('Either sessionId or workspaceRoot must be provided');
    }

    // Resolve program path
    const programPath = resolvePath(params.program, session.workspaceRoot);

    // Create DAP client
    const dapClient = new DebugpyClient(session.workspaceRoot);
    await dapClient.start();
    await dapClient.initialize();
    session.dapClient = dapClient;

    // Launch program
    await dapClient.launch(programPath, params.args, params.env);

    // Wait for stopped event (stopOnEntry=true)
    const stoppedEvent = (await dapClient.eventBus.waitFor('stopped', {
      timeout: 10000,
    })) as { reason: string; threadId: number };

    // Get initial state
    const stackTrace = (await dapClient.stackTrace(stoppedEvent.threadId)) as {
      stackFrames: Array<{
        id: number;
        name: string;
        source?: { path: string };
        line: number;
      }>;
    };

    const result: DebugLaunchResult = {
      sessionId: session.id,
      status: 'started',
      breakpointCount: dapClient.breakpointManager.count(),
      currentLine: stackTrace.stackFrames[0]?.line,
      currentFile: stackTrace.stackFrames[0]?.source?.path,
    };

    logger.info('lcp_debug_launch completed', result);
    return result;
  });
}
