/**
 * lcp_debug_evaluate tool implementation
 */

import type { ToolResult } from '../core/types.js';
import { sessionStore } from '../core/session.js';
import { withErrorHandling, DAPError } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';

interface DebugEvaluateParams {
  sessionId: string;
  expression: string;
  frameId?: number;
  context?: 'watch' | 'repl' | 'hover';
}

interface EvaluateResult {
  value: string;
  type?: string;
  variablesReference?: number;
}

/**
 * Evaluate an expression in the current debug context
 */
export async function lcpDebugEvaluate(
  params: DebugEvaluateParams
): Promise<ToolResult<EvaluateResult>> {
  return withErrorHandling(async () => {
    logger.info('lcp_debug_evaluate called', params);

    const session = sessionStore.get(params.sessionId);
    if (!session.dapClient) {
      throw new DAPError('No active debug session');
    }

    const result = (await session.dapClient.evaluate(
      params.expression,
      params.frameId,
      params.context
    )) as {
      result: string;
      type?: string;
      variablesReference?: number;
    };

    const evaluateResult: EvaluateResult = {
      value: result.result,
      type: result.type,
      variablesReference: result.variablesReference,
    };

    logger.info('lcp_debug_evaluate completed', {
      expression: params.expression,
      value: evaluateResult.value,
    });

    return evaluateResult;
  });
}
