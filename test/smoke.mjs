// End-to-end smoke test for the stdio MCP server, against a mock Scout API.
// Zero dependencies; run with: node test/smoke.mjs

import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER = join(__dirname, '..', 'bin', 'scout-mcp.js');

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} - ${msg}`);
  if (!cond) failures++;
};

// --- mock Scout API -------------------------------------------------------
const api = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = (code, obj) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    const path = req.url;
    if (path === '/v1/page/markdown') return json(200, { markdown: '# Hello world' });
    if (path === '/v1/search') return json(202, { search_id: 'abc' });
    if (path === '/v1/searches/abc/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      return res.end(
        'event: run.progress\ndata: {"type":"run.progress","pct":50}\n\n' +
          'event: run.completed\ndata: {"type":"run.completed"}\n\n',
      );
    }
    if (path === '/v1/searches/abc') return json(200, { status: 'completed', results: [{ title: 'x' }] });
    return json(404, {});
  });
});

await new Promise((r) => api.listen(0, '127.0.0.1', r));
const port = api.address().port;

// --- spawn the server -----------------------------------------------------
const child = spawn(process.execPath, [SERVER], {
  env: { ...process.env, SCOUT_API_KEY: 'test', SCOUT_BASE_URL: `http://127.0.0.1:${port}` },
  stdio: ['pipe', 'pipe', 'inherit'],
});

const out = [];
let buf = '';
child.stdout.setEncoding('utf8');
child.stdout.on('data', (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (line) out.push(JSON.parse(line));
  }
});

const send = (msg) => child.stdin.write(JSON.stringify(msg) + '\n');

send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'scout_scrape', arguments: { url: 'https://x.com' } } });
send({
  jsonrpc: '2.0',
  id: 4,
  method: 'tools/call',
  params: { name: 'scout_search', arguments: { query: 'hi', depth: 'deep' }, _meta: { progressToken: 'p1' } },
});

// Wait for responses to all four requests (deep search streams, so give it time).
const deadline = Date.now() + 5000;
while (Date.now() < deadline) {
  if (out.some((m) => m.id === 4)) break;
  await new Promise((r) => setTimeout(r, 50));
}

const byId = (id) => out.find((m) => m.id === id);

const init = byId(1);
check(init?.result?.serverInfo?.name === 'scout-mcp', 'initialize returns serverInfo');
check(typeof init?.result?.protocolVersion === 'string', 'initialize returns protocolVersion');

const list = byId(2);
const names = (list?.result?.tools ?? []).map((t) => t.name);
check(names.length === 8, `tools/list returns 8 tools (${names.length})`);
check(names.includes('scout_search') && names.includes('scout_company'), 'tools/list includes expected tools');
check(list?.result?.tools?.[0]?.inputSchema?.type === 'object', 'tools carry a JSON Schema inputSchema');

const scrape = byId(3);
check(/Hello world/.test(scrape?.result?.content?.[0]?.text ?? ''), 'scout_scrape returns the page markdown');

const progress = out.filter((m) => m.method === 'notifications/progress' && m.params?.progressToken === 'p1');
check(progress.length >= 2, `deep search streamed progress notifications (${progress.length})`);

const deep = byId(4);
check(/"status": "completed"/.test(deep?.result?.content?.[0]?.text ?? ''), 'deep search returns final results');

child.kill();
api.close();

console.log(failures === 0 ? '\nALL PASSED' : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
