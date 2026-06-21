# Security

## Supply chain

This package has **zero runtime and zero dev dependencies**. The MCP protocol
is implemented directly in plain JavaScript under `lib/` and `bin/`. There is
no build step and no transitive dependency tree, so a compromise of some other
npm package cannot reach you through this one.

- **No install scripts.** Installing the package runs no code. `npx @scout-ai/mcp`
  executes only the files in this repository.
- **Reproducible + signed.** Releases publish from this repo's GitHub Actions via
  npm trusted publishing (OIDC, no long-lived token) with provenance attestation,
  so you can verify a published version was built from this source.
- **Pinned CI.** The workflows run a protocol smoke test before anything ships.

If you vendor or fork this, the entire surface is a handful of files you can read
in one sitting. That is the point.

## Reporting a vulnerability

Email security@usescout.sh with details and steps to reproduce. Please do not
open a public issue for an unpatched vulnerability.
