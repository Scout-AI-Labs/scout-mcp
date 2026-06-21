// Minimal MCP JSON-RPC 2.0 dispatcher. Tools only (no resources/prompts).
// Shared by the stdio and HTTP transports.

import { TOOLS } from './tools.js';
import { VERSION } from './api.js';

const PROTOCOL_VERSION = '2025-06-18';

const result = (id, r) => ({ jsonrpc: '2.0', id, result: r });
const rpcError = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } });

/**
 * Handle one JSON-RPC message. Returns a response object, or null for
 * notifications (no id). `ctx.sendNotification(notif)` pushes a notification
 * (e.g. progress) over the active transport.
 */
export async function dispatch(msg, ctx) {
  if (!msg || msg.jsonrpc !== '2.0') return null;
  const { id, method, params } = msg;

  // Notifications (initialized, cancelled, ...) get no response.
  if (id === undefined || id === null) return null;

  switch (method) {
    case 'initialize':
      return result(id, {
        protocolVersion: (params && params.protocolVersion) || PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'scout-mcp', version: VERSION },
      });

    case 'ping':
      return result(id, {});

    case 'tools/list':
      return result(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });

    case 'tools/call': {
      const name = params && params.name;
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);

      const progressToken = params && params._meta && params._meta.progressToken;
      const toolCtx = {
        async sendProgress(progress, message) {
          if (progressToken !== undefined && progressToken !== null) {
            await ctx.sendNotification({
              jsonrpc: '2.0',
              method: 'notifications/progress',
              params: { progressToken, progress, message },
            });
          }
        },
      };

      try {
        const res = await tool.handler((params && params.arguments) || {}, toolCtx);
        return result(id, res);
      } catch (e) {
        return result(id, {
          content: [{ type: 'text', text: e && e.message ? e.message : String(e) }],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}
