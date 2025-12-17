
// Node 18+ has native fetch
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import LCP Tools from dist
import { lcpGetOutline } from '../dist/tools/lcp_get_outline.js';
import { lcpReadSymbol } from '../dist/tools/lcp_read_symbol.js';
import { lcpGetDiagnostics } from '../dist/tools/lcp_get_diagnostics.js';
import { lcpFindReferences } from '../dist/tools/lcp_find_references.js';
// We omit DAP tools for this initial verification to avoid starting debug processes that might hang
// but we include them in the definitions for the model to see.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_FILE = path.join(__dirname, '../verification_output/session.log');
const MODEL_NAME = 'qwen3:4b';
const BASE_URL = 'http://localhost:11434';

// Tool Definitions (Simplified for the model)
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'lcp_get_outline',
      description: 'Get file outline with symbols.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Path to the file' },
          workspaceRoot: { type: 'string', description: 'Root of the workspace' }
        },
        required: ['filePath', 'workspaceRoot']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lcp_read_symbol',
      description: 'Read the code of a specific symbol.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string' },
          symbolName: { type: 'string' },
          workspaceRoot: { type: 'string' }
        },
        required: ['filePath', 'symbolName', 'workspaceRoot']
      }
    }
  },
   {
    type: 'function',
    function: {
      name: 'lcp_get_diagnostics',
      description: 'Get diagnostics (errors) for a file.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string' },
          workspaceRoot: { type: 'string' }
        },
        required: ['workspaceRoot']
      }
    }
  }
];

function log(message) {
  const timestamp = new Date().toISOString();
  const logMsg = `[${timestamp}] ${message}\n`;
  console.log(logMsg.trim());
  fs.appendFileSync(LOG_FILE, logMsg);
}

async function callOllama(messages) {
  log(`Sending request to Ollama with ${messages.length} messages...`);
  try {
    const response = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: messages,
        tools: TOOLS,
        stream: false,
        options: {
            num_ctx: 2048
        }
      })
    });
    
    if (!response.ok) {
        throw new Error(`Ollama API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    log(`Error calling Ollama: ${error.message}`);
    return null;
  }
}

async function executeTool(toolCall) {
  const name = toolCall.function.name;
  const args = toolCall.function.arguments; // Is usually an object already if parsed by Ollama, or string?
  // Ollama tool calls arguments are objects.
  
  log(`Executing tool: ${name} with args: ${JSON.stringify(args)}`);
  
  try {
    let result;
    // Map tool names to imported functions
    // Note: The imported functions expect 'params' object
    switch (name) {
      case 'lcp_get_outline':
        result = await lcpGetOutline(args);
        break;
      case 'lcp_read_symbol':
        result = await lcpReadSymbol(args);
        break;
      case 'lcp_get_diagnostics':
          result = await lcpGetDiagnostics(args);
          break;
      default:
        return `Error: Unknown tool ${name}`;
    }
    return JSON.stringify(result, null, 2);
  } catch (e) {
    return `Error executing ${name}: ${e.message}`;
  }
}

async function runAgent() {
  log('Starting Verification Agent...');
  
  // Clean log
  fs.writeFileSync(LOG_FILE, '');

  const workspaceRoot = path.resolve(__dirname, '..');
  const targetFile = 'src/index.ts'; // A good file to start with

  const messages = [
    {
      role: 'system',
      content: `You are a QA Agent verifying the LCP (Language Context Provider) tools. 
      Your task is to explore the codebase using the provided tools.
      Follow these steps:
1. Get the outline of the file "test/fixtures/sample.py".
2. Pick a class or function from the outline and read its content using lcp_read_symbol.
3. Check for any diagnostics in "test/fixtures/sample.py".
      
      The workspace root is: ${workspaceRoot}
      ALWAYS provide 'workspaceRoot' in your tool calls.
      `
    },
    {
      role: 'user',
      content: `Please analyze 'test/fixtures/sample.py'.`
    }
  ];

  let turn = 0;
  const MAX_TURNS = 10;

  while (turn < MAX_TURNS) {
    turn++;
    log(`--- Turn ${turn} ---`);

    const response = await callOllama(messages);
    if (!response) break;

    const message = response.message;
    messages.push(message);

    log(`Agent content: ${message.content || '(no content)'}`);

    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        // Validation for Ollama's format often needing a fix or check?
        // Usually message.tool_calls is: [{ function: { name: '...', arguments: {...} } }]
        
        const toolResult = await executeTool(toolCall);
        log(`Tool Result: ${toolResult.substring(0, 200)}...`);

        messages.push({
          role: 'tool',
          content: toolResult,
          name: toolCall.function.name // Some APIs require this, Ollama might just need role: tool?
          // Actually, standard Chat format for tools usually requires a specific ID matching the call.
          // Ollama's implementation can vary, but let's try standard OpenAI format which Ollama tries to mimic.
        });
      }
    } else {
      log('No tool calls made. Agent considers task complete or is chatting.');
      // If the agent says "Done" or similar, we could stop.
      if (message.content.toLowerCase().includes('diagnostics') && message.content.toLowerCase().includes('symbol')) {
           log('Agent seems to have covered the topics.');
           break;
      }
    }
  }

  log('Verification finished.');
}

runAgent().catch(err => log(`Fatal error: ${err.message}`));
