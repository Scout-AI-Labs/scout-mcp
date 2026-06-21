# Changelog

## [0.1.0] - 2026-06-21

Initial release.

- Zero dependencies: the MCP protocol is implemented in plain JavaScript (no `@modelcontextprotocol/sdk`, no `zod`, no build step).
- 8 tools: `scout_search`, `scout_scrape`, `scout_extract`, `scout_crawl`, `scout_screenshot`, `scout_company`, `scout_answer`, `scout_find_all`.
- Two transports: stdio (`scout-mcp`) and hosted Streamable HTTP/SSE (`scout-mcp-http`).
- Deep search (`scout_search` with `depth: "deep"`) streams Scout run events as MCP progress notifications.
- Install docs for Claude Code, Codex, Gemini CLI, Antigravity, Cursor, Windsurf, and Claude Desktop.
- Verified end-to-end by a protocol smoke test that runs in CI.
