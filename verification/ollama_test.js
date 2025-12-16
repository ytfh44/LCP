
// Node 18+ has native fetch
import fs from 'fs';

const MODEL_NAME = 'qwen3:4b';
const BASE_URL = 'http://localhost:11434';

async function test() {
    console.log('Sending simple request...');
    try {
        const response = await fetch(`${BASE_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: [{ role: 'user', content: 'Say hello' }],
                stream: false,
                options: {
                    num_ctx: 2048
                }
            })
        });
        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e);
    }
}

test();
