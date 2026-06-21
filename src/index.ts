#!/usr/bin/env node
/**
 * Scout MCP server.
 *
 * Exposes Scout's web-intelligence tools (search, scrape, extract, crawl,
 * screenshot, company enrichment, page Q&A, find-all) over the Model Context
 * Protocol, so any MCP client — Claude Code, Codex, Gemini CLI, Antigravity,
 * Cursor, Windsurf — can call the live web.
 *
 * Configure with the SCOUT_API_KEY environment variable. Get a key at
 * https://platform.usescout.sh/settings.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const VERSION = '0.1.0';
const BASE_URL = process.env.SCOUT_BASE_URL ?? 'https://core.usescout.sh';
const API_KEY = process.env.SCOUT_API_KEY ?? '';

type ToolResult = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

async function call(method: string, path: string, body?: unknown): Promise<unknown> {
  if (!API_KEY) {
    throw new Error('SCOUT_API_KEY is not set. Get a key at https://platform.usescout.sh/settings');
  }
  const res = await fetch(BASE_URL + path, {
    method,
    headers: {
      authorization: `Bearer ${API_KEY}`,
      'content-type': 'application/json',
      accept: 'application/json',
      'user-agent': `scout-mcp/${VERSION}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = text;
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

/** Wrap a call so failures come back as a tool error, not a crash. */
async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    const data = await fn();
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  } catch (err) {
    return {
      content: [{ type: 'text', text: err instanceof Error ? err.message : String(err) }],
      isError: true,
    };
  }
}

const server = new McpServer({ name: 'scout-mcp', version: VERSION });

server.registerTool(
  'scout_search',
  {
    title: 'Scout Web Search',
    description:
      'Search the live web and return ranked results as JSON. Use for current events, ' +
      'facts, and finding sources. Set depth="deep" for an agentic multi-step search.',
    inputSchema: {
      query: z.string().describe('The search query'),
      limit: z.number().int().optional().describe('Maximum results to return'),
      country: z.string().optional().describe('Two-letter country code, e.g. "us"'),
      depth: z.enum(['shallow', 'standard', 'deep']).optional().describe('Search depth'),
    },
  },
  ({ query, limit, country, depth }) =>
    run(() => call('POST', '/v1/search', { queries: [query], limit, country, depth })),
);

server.registerTool(
  'scout_scrape',
  {
    title: 'Scout Scrape to Markdown',
    description: 'Fetch a web page and return clean, LLM-ready Markdown. Handles JS rendering and bot defenses.',
    inputSchema: {
      url: z.string().describe('The page URL to scrape'),
      max_chars: z.number().int().optional().describe('Truncate the Markdown to this many characters'),
    },
  },
  ({ url, max_chars }) => run(() => call('POST', '/v1/page/markdown', { url, max_chars })),
);

server.registerTool(
  'scout_extract',
  {
    title: 'Scout Structured Extraction',
    description:
      'Extract structured data from one or more URLs. Provide an objective describing what to pull.',
    inputSchema: {
      urls: z.array(z.string()).describe('URLs to extract from'),
      objective: z.string().optional().describe('What to extract, in plain language'),
    },
  },
  ({ urls, objective }) => run(() => call('POST', '/v1/extract', { urls, objective })),
);

server.registerTool(
  'scout_crawl',
  {
    title: 'Scout Site Crawl',
    description: 'Crawl a website from a start URL and return its pages. Bound it with max_pages.',
    inputSchema: {
      start_url: z.string().describe('The URL to start crawling from'),
      max_pages: z.number().int().optional().describe('Maximum pages to crawl'),
      same_host_only: z.boolean().optional().describe('Stay on the same host'),
    },
  },
  ({ start_url, max_pages, same_host_only }) =>
    run(() => call('POST', '/v1/site/crawl', { start_url, max_pages, same_host_only })),
);

server.registerTool(
  'scout_screenshot',
  {
    title: 'Scout Screenshot',
    description: 'Capture a screenshot of a web page. Returns a URL (or data URI) to the image.',
    inputSchema: {
      url: z.string().describe('The page URL to capture'),
      full_page: z.boolean().optional().describe('Capture the full scrollable page'),
    },
  },
  ({ url, full_page }) => run(() => call('POST', '/v1/page/screenshot', { url, full_page })),
);

server.registerTool(
  'scout_company',
  {
    title: 'Scout Company Enrichment',
    description: 'Look up a company profile from its domain: name, description, industry, socials, logo, and more.',
    inputSchema: {
      domain: z.string().describe('The company domain, e.g. "stripe.com"'),
    },
  },
  ({ domain }) => run(() => call('POST', '/v1/company', { domain })),
);

server.registerTool(
  'scout_answer',
  {
    title: 'Scout Page Q&A',
    description: 'Answer a natural-language question by reading a page and the pages it links to.',
    inputSchema: {
      url: z.string().describe('The page to read'),
      question: z.string().describe('The question to answer'),
    },
  },
  ({ url, question }) => run(() => call('POST', '/v1/ai-query', { url, question })),
);

server.registerTool(
  'scout_find_all',
  {
    title: 'Scout Find-All',
    description: 'Build a list of entities matching a natural-language query (e.g. "Series A fintech companies in Europe").',
    inputSchema: {
      query: z.string().describe('What to find'),
      limit: z.number().int().optional().describe('Maximum entities to return'),
    },
  },
  ({ query, limit }) => run(() => call('POST', '/v1/lists', { query, limit })),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stderr is safe; stdout is the protocol channel.
  process.stderr.write(`scout-mcp ${VERSION} ready\n`);
}

main().catch((err) => {
  process.stderr.write(`scout-mcp fatal: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
