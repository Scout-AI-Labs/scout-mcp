# Scout MCP Server

Give your coding agent the live web. Scout's MCP server adds web search, scraping to Markdown, structured extraction, crawling, screenshots, and company lookup as tools any MCP client can call: Claude Code, Codex, Gemini CLI, Antigravity, Cursor, Windsurf, and Claude Desktop.

It has **zero dependencies** — the MCP protocol is implemented in a few hundred lines of plain JavaScript, with no build step and nothing pulled from npm at install time. When you run it, the only code that runs is the code in this repo. See [SECURITY.md](./SECURITY.md).

## Tools

| Tool | What it does |
|------|--------------|
| `scout_search` | Search the live web; ranked results as JSON. `depth: "deep"` runs an agentic multi-step search. |
| `scout_scrape` | Fetch a page as clean, LLM-ready Markdown (handles JS + bot defenses). |
| `scout_extract` | Pull structured data from one or more URLs against an objective. |
| `scout_crawl` | Crawl a site from a start URL, bounded by `max_pages`. |
| `scout_screenshot` | Capture a page screenshot. |
| `scout_company` | Company profile from a domain (name, industry, socials, logo). |
| `scout_answer` | Answer a question by reading a page and the pages it links to. |
| `scout_find_all` | Build a list of entities matching a natural-language query. |

## Get a key

Create an API key at [platform.usescout.sh/settings](https://platform.usescout.sh/settings) and set it as `SCOUT_API_KEY`. Every example below uses `npx`, so there's nothing to install first.

## Install per client

### Claude Code

```sh
claude mcp add scout --env SCOUT_API_KEY=sk_your_key -- npx -y @scout-ai/mcp
```

### Codex CLI

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.scout]
command = "npx"
args = ["-y", "@scout-ai/mcp"]
env = { SCOUT_API_KEY = "sk_your_key" }
```

### Gemini CLI

Add to `~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "scout": {
      "command": "npx",
      "args": ["-y", "@scout-ai/mcp"],
      "env": { "SCOUT_API_KEY": "sk_your_key" }
    }
  }
}
```

### Antigravity

In the MCP settings, add a server with this config (or paste it into the MCP config file):

```json
{
  "mcpServers": {
    "scout": {
      "command": "npx",
      "args": ["-y", "@scout-ai/mcp"],
      "env": { "SCOUT_API_KEY": "sk_your_key" }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` (project) or `~/.cursor/mcp.json` (global):

```json
{
  "mcpServers": {
    "scout": {
      "command": "npx",
      "args": ["-y", "@scout-ai/mcp"],
      "env": { "SCOUT_API_KEY": "sk_your_key" }
    }
  }
}
```

### Windsurf

Add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "scout": {
      "command": "npx",
      "args": ["-y", "@scout-ai/mcp"],
      "env": { "SCOUT_API_KEY": "sk_your_key" }
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config) using the same `mcpServers` block as above.

## Use it

Once connected, ask your agent things like:

- "Search the web for the latest on the EU AI Act and summarize the top 5 sources."
- "Scrape https://example.com/pricing and pull the plan names and prices."
- "Look up stripe.com and tell me their industry and socials."

The agent picks the right Scout tool and calls it.

## Progress on long jobs

`scout_search` with `depth: "deep"` runs an agentic multi-step search server-side. The server streams Scout's run events and forwards them as MCP progress notifications, so clients that show progress (Claude Code, Cursor) display live updates instead of a frozen spinner. The final results come back when the run finishes.

## Hosted HTTP/SSE transport

Besides stdio, the server can run over HTTP using MCP's Streamable HTTP transport, so a remote client can connect by URL:

```sh
SCOUT_API_KEY=sk_your_key npx -y -p @scout-ai/mcp scout-mcp-http
# listening on :3000/mcp
```

| Variable | Default | Purpose |
|----------|---------|---------|
| `PORT` | `3000` | Listen port. |
| `SCOUT_MCP_PATH` | `/mcp` | Endpoint path. |
| `SCOUT_MCP_TOKEN` | (none) | If set, clients must send `Authorization: Bearer <token>`. |

Point an MCP client at `http://your-host:3000/mcp`. There's a `/health` endpoint for load balancers. Each request is stateless (a fresh server per request), which keeps it simple to run behind any HTTP front end.

## Configuration

| Variable | Default | Purpose |
|----------|---------|---------|
| `SCOUT_API_KEY` | (required) | Your Scout API key. |
| `SCOUT_BASE_URL` | `https://core.usescout.sh` | Override the API origin. |

## Run from source

No install, no build (zero dependencies):

```sh
SCOUT_API_KEY=sk_your_key node bin/scout-mcp.js        # stdio
SCOUT_API_KEY=sk_your_key node bin/scout-mcp-http.js   # hosted HTTP/SSE
node test/smoke.mjs                                    # run the protocol test
```

## License

[MIT](./LICENSE)
