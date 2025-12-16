
import { sessionStore } from '../core/session.js';
import { languageRouter } from '../core/router.js';
import { LSPManager } from '../lsp/manager.js';
import { resolvePath } from '../utils/path-resolver.js';

interface LcpFormatDocumentArgs {
  sessionId?: string;
  workspaceRoot?: string;
  filePath: string;
}

export async function lcpFormatDocument(args: LcpFormatDocumentArgs) {
  const { sessionId, workspaceRoot, filePath } = args;

  let session;
  if (sessionId) {
    session = sessionStore.get(sessionId);
  } else if (workspaceRoot) {
    session = sessionStore.create(workspaceRoot);
  } else {
    throw new Error('Either sessionId or workspaceRoot must be provided');
  }

  const absolutePath = resolvePath(filePath, session.workspaceRoot);
  const lspClient = await languageRouter.getLSPClient(session, absolutePath);
  const lspManager = new LSPManager(lspClient, session);

  try {
    const edits = await lspManager.formatDocument(absolutePath);
    return edits;
  } catch (error) {
    throw new Error(`Failed to format document: ${error}`);
  }
}
