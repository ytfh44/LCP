
import { sessionStore } from '../core/session.js';
import { languageRouter } from '../core/router.js';
import { LSPManager } from '../lsp/manager.js';
import { resolvePath } from '../utils/path-resolver.js';

interface LcpRenameSymbolArgs {
  sessionId?: string;
  workspaceRoot?: string;
  filePath: string;
  line: number;
  character: number;
  newName: string;
}

export async function lcpRenameSymbol(args: LcpRenameSymbolArgs) {
  const { sessionId, workspaceRoot, filePath, line, character, newName } = args;

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
    const edit = await lspManager.renameSymbol(absolutePath, line, character, newName);
    return edit;
  } catch (error) {
    throw new Error(`Failed to rename symbol: ${error}`);
  }
}
