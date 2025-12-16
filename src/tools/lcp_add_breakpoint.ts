/**
 * lcp_add_breakpoint tool implementation
 */

import type { ToolResult, BreakpointInfo } from '../core/types.js';
import { sessionStore } from '../core/session.js';
import type { DebugpyClient } from '../dap/debugpy.js';
import { withErrorHandling, DAPError } from '../utils/error-handler.js';
import { resolvePath } from '../utils/path-resolver.js';
import { toZeroBased } from '../utils/coordinate-converter.js';
import { logger } from '../utils/logger.js';

interface AddBreakpointParams {
  sessionId: string;
  file: string;
  line: number;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
}

/**
 * Add a breakpoint
 */
export async function lcpAddBreakpoint(
  params: AddBreakpointParams
): Promise<ToolResult<BreakpointInfo>> {
  return withErrorHandling(async () => {
    logger.info('lcp_add_breakpoint called', params);

    const session = sessionStore.get(params.sessionId);
    if (!session.dapClient) {
      throw new DAPError('No active debug session');
    }

    // Resolve file path
    const filePath = resolvePath(params.file, session.workspaceRoot);

    // Add to breakpoint manager
    const breakpoint = session.dapClient.breakpointManager.add(
      filePath,
      params.line,
      {
        condition: params.condition,
        hitCondition: params.hitCondition,
        logMessage: params.logMessage,
      }
    );

    // Sync with DAP adapter
    const fileBreakpoints =
      session.dapClient.breakpointManager.getByFile(filePath);
    const dapBreakpoints = fileBreakpoints.map((bp: BreakpointInfo) => ({
      line: toZeroBased(bp.line),
      condition: bp.condition,
      hitCondition: bp.hitCondition,
      logMessage: bp.logMessage,
    }));

    const response = (await (session.dapClient as DebugpyClient).setBreakpoints(
      filePath,
      dapBreakpoints
    )) as {
      breakpoints: Array<{ verified: boolean; line: number }>;
    };

    // Update verification status
    if (response.breakpoints && response.breakpoints.length > 0) {
      const lastBreakpoint =
        response.breakpoints[response.breakpoints.length - 1];
      session.dapClient.breakpointManager.updateVerification(
        breakpoint.id,
        lastBreakpoint.verified
      );
      breakpoint.verified = lastBreakpoint.verified;
    }

    logger.info('lcp_add_breakpoint completed', breakpoint);
    return breakpoint;
  });
}
