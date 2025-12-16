/**
 * lcp_debug_stop tool implementation
 */

import type { ToolResult } from '../core/types.js';
import { sessionStore } from '../core/session.js';
import { withErrorHandling, DAPError } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';

interface DebugStopParams {
  sessionId: string;
}

interface DebugStopResult {
  success: boolean;
  message: string;
}

/**
 * Stop a debug session
 */
export async function lcpDebugStop(
  params: DebugStopParams
): Promise<ToolResult<DebugStopResult>> {
  return withErrorHandling(async () => {
    logger.info('lcp_debug_stop called', params);

    const session = sessionStore.get(params.sessionId);
    if (!session.dapClient) {
      throw new DAPError('No active debug session');
    }

    // Disconnect from debugger
    await session.dapClient.disconnect();
    session.dapClient = undefined;

    const result: DebugStopResult = {
      success: true,
      message: 'Debug session stopped',
    };

    logger.info('lcp_debug_stop completed');
    return result;
  });
}
