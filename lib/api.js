// Scout REST helpers. Zero dependencies; built on the global fetch (Node 18+).

export const VERSION = '0.1.0';
const BASE_URL = process.env.SCOUT_BASE_URL ?? 'https://core.usescout.sh';

function apiKey() {
  const key = process.env.SCOUT_API_KEY;
  if (!key) {
    throw new Error('SCOUT_API_KEY is not set. Get a key at https://platform.usescout.sh/settings');
  }
  return key;
}

/** Call a Scout REST endpoint and return the parsed JSON (throws on non-2xx). */
export async function call(method, path, body) {
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      authorization: `Bearer ${apiKey()}`,
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': `scout-mcp/${VERSION}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* leave as text */
  }
  if (!res.ok) {
    const detail = typeof data === 'string' ? data : JSON.stringify(data);
    throw new Error(`Scout API ${res.status}: ${detail}`);
  }
  return data;
}

/** Stream a GET Server-Sent-Events endpoint, yielding { event, data } records. */
export async function* streamEvents(path) {
  const res = await fetch(BASE_URL + path, {
    headers: {
      authorization: `Bearer ${apiKey()}`,
      accept: 'text/event-stream',
      'user-agent': `scout-mcp/${VERSION}`,
    },
  });
  if (!res.ok || !res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const block = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let event;
        const dataLines = [];
        for (const line of block.split('\n')) {
          if (line === '' || line.startsWith(':')) continue;
          const colon = line.indexOf(':');
          const field = colon === -1 ? line : line.slice(0, colon);
          let val = colon === -1 ? '' : line.slice(colon + 1);
          if (val.startsWith(' ')) val = val.slice(1);
          if (field === 'event') event = val;
          else if (field === 'data') dataLines.push(val);
        }
        if (dataLines.length) yield { event, data: dataLines.join('\n') };
      }
    }
  } finally {
    reader.releaseLock();
  }
}
