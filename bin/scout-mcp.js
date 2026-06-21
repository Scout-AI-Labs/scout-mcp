#!/usr/bin/env node
// Scout MCP server — stdio transport (the default).
//
// Coding agents (Claude Code, Codex, Gemini CLI, Antigravity, Cursor,
// Windsurf) launch this over stdio. Newline-delimited JSON-RPC in, out.
// Configure with SCOUT_API_KEY. Key: https://platform.usescout.sh/settings.

import { dispatch } from '../lib/rpc.js';
import { VERSION } from '../lib/api.js';

const send = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const ctx = {
  sendNotification: (n) => {
    send(n);
    return Promise.resolve();
  },
};

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    dispatch(msg, ctx)
      .then((resp) => {
        if (resp) send(resp);
      })
      .catch(() => {});
  }
});
process.stdin.on('end', () => process.exit(0));

process.stderr.write(`scout-mcp ${VERSION} (stdio) ready\n`);
