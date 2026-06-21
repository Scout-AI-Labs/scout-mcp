// Scout tool definitions. Each tool carries a JSON Schema input and a handler.
// Handlers return { content: [...] } (optionally { isError: true }) or throw.

import { call, streamEvents } from './api.js';

const TERMINAL = new Set(['run.completed', 'run.failed', 'run.cancelled']);

function ok(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

const S = (props, required = []) => ({ type: 'object', properties: props, required });

export const TOOLS = [
  {
    name: 'scout_search',
    description:
      'Search the live web and return ranked results as JSON. Set depth="deep" for an ' +
      'agentic multi-step search; it reports progress as it runs.',
    inputSchema: S(
      {
        query: { type: 'string', description: 'The search query' },
        limit: { type: 'integer', description: 'Maximum results to return' },
        country: { type: 'string', description: 'Two-letter country code, e.g. "us"' },
        depth: { type: 'string', enum: ['shallow', 'standard', 'deep'], description: 'Search depth' },
      },
      ['query'],
    ),
    async handler(args, ctx) {
      const { query, limit, country, depth } = args;
      if (depth !== 'deep') {
        return ok(await call('POST', '/v1/search', { queries: [query], limit, country, depth }));
      }
      const created = await call('POST', '/v1/search', { queries: [query], depth: 'deep', limit, country });
      const id = created && created.search_id;
      if (!id) return ok(created);
      let n = 0;
      for await (const evt of streamEvents(`/v1/searches/${encodeURIComponent(id)}/events`)) {
        n += 1;
        await ctx.sendProgress(n, evt.event ?? 'searching');
        if (evt.event && TERMINAL.has(evt.event)) break;
      }
      return ok(await call('GET', `/v1/searches/${encodeURIComponent(id)}`));
    },
  },
  {
    name: 'scout_scrape',
    description: 'Fetch a web page and return clean, LLM-ready Markdown. Handles JS rendering and bot defenses.',
    inputSchema: S(
      {
        url: { type: 'string', description: 'The page URL to scrape' },
        max_chars: { type: 'integer', description: 'Truncate the Markdown to this many characters' },
      },
      ['url'],
    ),
    async handler({ url, max_chars }) {
      return ok(await call('POST', '/v1/page/markdown', { url, max_chars }));
    },
  },
  {
    name: 'scout_extract',
    description: 'Extract structured data from one or more URLs. Provide an objective describing what to pull.',
    inputSchema: S(
      {
        urls: { type: 'array', items: { type: 'string' }, description: 'URLs to extract from' },
        objective: { type: 'string', description: 'What to extract, in plain language' },
      },
      ['urls'],
    ),
    async handler({ urls, objective }) {
      return ok(await call('POST', '/v1/extract', { urls, objective }));
    },
  },
  {
    name: 'scout_crawl',
    description: 'Crawl a website from a start URL and return its pages. Bound it with max_pages.',
    inputSchema: S(
      {
        start_url: { type: 'string', description: 'The URL to start crawling from' },
        max_pages: { type: 'integer', description: 'Maximum pages to crawl' },
        same_host_only: { type: 'boolean', description: 'Stay on the same host' },
      },
      ['start_url'],
    ),
    async handler({ start_url, max_pages, same_host_only }) {
      return ok(await call('POST', '/v1/site/crawl', { start_url, max_pages, same_host_only }));
    },
  },
  {
    name: 'scout_screenshot',
    description: 'Capture a screenshot of a web page. Returns a URL (or data URI) to the image.',
    inputSchema: S(
      {
        url: { type: 'string', description: 'The page URL to capture' },
        full_page: { type: 'boolean', description: 'Capture the full scrollable page' },
      },
      ['url'],
    ),
    async handler({ url, full_page }) {
      return ok(await call('POST', '/v1/page/screenshot', { url, full_page }));
    },
  },
  {
    name: 'scout_company',
    description: 'Look up a company profile from its domain: name, description, industry, socials, logo, and more.',
    inputSchema: S({ domain: { type: 'string', description: 'The company domain, e.g. "stripe.com"' } }, ['domain']),
    async handler({ domain }) {
      return ok(await call('POST', '/v1/company', { domain }));
    },
  },
  {
    name: 'scout_answer',
    description: 'Answer a natural-language question by reading a page and the pages it links to.',
    inputSchema: S(
      {
        url: { type: 'string', description: 'The page to read' },
        question: { type: 'string', description: 'The question to answer' },
      },
      ['url', 'question'],
    ),
    async handler({ url, question }) {
      return ok(await call('POST', '/v1/ai-query', { url, question }));
    },
  },
  {
    name: 'scout_find_all',
    description: 'Build a list of entities matching a natural-language query (e.g. "Series A fintech companies in Europe").',
    inputSchema: S(
      {
        query: { type: 'string', description: 'What to find' },
        limit: { type: 'integer', description: 'Maximum entities to return' },
      },
      ['query'],
    ),
    async handler({ query, limit }) {
      return ok(await call('POST', '/v1/lists', { query, limit }));
    },
  },
];
