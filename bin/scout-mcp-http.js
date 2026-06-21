#!/usr/bin/env node
// Scout MCP server — hosted HTTP transport (Streamable HTTP / SSE).
//
// Exposes the MCP server at a URL so remote clients can connect. Each POST is
// answered over SSE so progress notifications and the final result stream back.
// Stateless: a request carries everything needed.
//
// Env: SCOUT_API_KEY (required), PORT (3000), SCOUT_MCP_PATH (/mcp),
//      SCOUT_MCP_TOKEN (optional bearer the client must present).

import { createServer } from 'node:http';
import { dispatch } from '../lib/rpc.js';
import { VERSION } from '../lib/api.js';

const PORT = Number(process.env.PORT ?? 3000);
const ENDPOINT = process.env.SCOUT_MCP_PATH ?? '/mcp';
const TOKEN = process.env.SCOUT_MCP_TOKEN;

async function handle(req, res) {
  const path = (req.url || '').split('?')[0];

  if (path === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, version: VERSION }));
    return;
  }
  if (path !== ENDPOINT) {
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
    return;
  }
  if (TOKEN && req.headers.authorization !== `Bearer ${TOKEN}`) {
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'unauthorized' }));
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'method not allowed' }));
    return;
  }

  let body = '';
  for await (const chunk of req) body += chunk;
  let msg;
  try {
    msg = JSON.parse(body);
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid json' }));
    return;
  }

  const messages = Array.isArray(msg) ? msg : [msg];
  const hasRequests = messages.some((m) => m && m.id !== undefined && m.id !== null);
  if (!hasRequests) {
    res.writeHead(202).end();
    return;
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });
  const sse = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  const ctx = {
    sendNotification: (n) => {
      sse(n);
      return Promise.resolve();
    },
  };
  for (const m of messages) {
    const resp = await dispatch(m, ctx);
    if (resp) sse(resp);
  }
  res.end();
}

createServer((req, res) => {
  handle(req, res).catch((e) => {
    try {
      res.writeHead(500, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: e && e.message ? e.message : String(e) }));
    } catch {
      /* response already started */
    }
  });
}).listen(PORT, () => {
  process.stderr.write(`scout-mcp ${VERSION} (http) listening on :${PORT}${ENDPOINT}\n`);
});
