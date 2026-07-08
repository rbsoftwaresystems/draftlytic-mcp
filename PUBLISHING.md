# Publishing checklist (operator-only)

This package lives inside the main `draftlytic` monorepo for development, but ships as a standalone npm package and (ideally) a standalone GitHub repo, since most MCP directories expect one repo per server.

## 1. Split into its own repo

Pick one:

**Option A — `git subtree split` (preserves history for this directory):**

```bash
cd /path/to/draftlytic
git subtree split --prefix=mcp-server -b draftlytic-mcp-standalone
mkdir ../draftlytic-mcp && cd ../draftlytic-mcp
git init
git pull ../draftlytic draftlytic-mcp-standalone
git remote add origin git@github.com:<you>/draftlytic-mcp.git
git push -u origin main
```

**Option B — fresh copy (simpler, loses history):**

```bash
mkdir ../draftlytic-mcp
cp -r mcp-server/* mcp-server/.gitignore ../draftlytic-mcp/
cd ../draftlytic-mcp
git init && git add -A && git commit -m "Initial commit"
gh repo create draftlytic-mcp --public --source=. --push
```

Either way, end up with `draftlytic-mcp` as its own GitHub repo before publishing to npm — the README links to it, and `package.json`'s `repository` field should point at it.

## 2. Verify before publishing

```bash
cd draftlytic-mcp   # the standalone copy, not mcp-server/ inside the monorepo
npm install
npm run build
npm run smoke
```

All three must pass clean. Also sanity-check the README's install snippets still match the actual package name and bin name.

## 3. Publish to npm

```bash
npm login   # if not already
npm publish --access public
```

Since the package is scopeless (`draftlytic-mcp`, not `@draftlytic/mcp`), `--access public` is required on first publish (npm defaults unscoped packages to public anyway, but it's harmless to be explicit).

**2FA gotcha:** if the npm account has 2FA-on-publish, `npm publish` fails with `EOTP`. `--otp` needs a *TOTP* code — a **passkey cannot produce one**. Either add an authenticator app (npmjs.com → 2FA) and pass `--otp=<code>`, or publish with an access token that acts as the second factor. Classic "Automation" tokens are being phased out in favor of **Granular Access Tokens** (Read and write, scoped to `draftlytic-mcp`); run publish with the token inline so it isn't persisted:

```bash
npm publish --access public --//registry.npmjs.org/:_authToken=<TOKEN>
```

Bump `version` in `package.json` before every subsequent publish — npm rejects re-publishing the same version.

## 4. Get listed

Submitting to these is what actually drives discovery — publishing to npm alone doesn't put you in front of anyone.

- **Official MCP Registry** (`registry.modelcontextprotocol.io`) — the canonical listing. Note: [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers) **retired its third-party server list** (its `CONTRIBUTING.md` now says "we don't accept new server implementations" and points here). Do **not** open a PR against that repo — it will be closed. Publish via the registry instead (see step 5 below); other directories (PulseMCP, Glama, etc.) increasingly crawl the registry.
- **[PulseMCP](https://www.pulsemcp.com/)** — submit via their site; they crawl npm/GitHub too, but a direct submission is faster.
- **[Smithery](https://smithery.ai/)** — has a CLI (`npx @smithery/cli install`) and a submission flow for listing your server in their registry.
- **[Glama](https://glama.ai/mcp/servers)** — MCP server directory, submit via their site.
- **[awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)** — no longer accepts PRs for new entries. Submit via their [issue form](https://github.com/hesreallyhim/awesome-claude-code/issues/new?template=recommend-resource.yml) instead (category: "Documentation, Knowledge & Learning" — there's no dedicated MCP-servers category).
- **awesome-cursor** (search GitHub — several maintained lists exist) — PR adding an entry.
- **[Cursor directory](https://cursor.directory/mcp)** — submit via their site if they take community submissions; otherwise it may pull from the official servers repo automatically.

For each listing, keep the description consistent: "Offline MCP server for planning structured project specs — validate, render, and checklist tools for any MCP client." and link both the npm package and `draftlytic.com`.

## 5. Publish to the MCP Registry

The registry hosts only metadata — it verifies the metadata against the **already-published npm package**, so do this *after* step 3.

1. **Ownership marker** — the published npm package must carry an `mcpName` field in `package.json`. With GitHub auth, the name must start with `io.github.<github-user>/`. Ours:

   ```jsonc
   // package.json
   "mcpName": "io.github.rbsoftwaresystems/draftlytic-mcp"
   ```

   Adding/changing this means republishing to npm (bump the version first — see Versioning in `CLAUDE.md`).

2. **`server.json`** (repo root) — `name` must equal `mcpName`, `version` must match the npm version, `description` is capped at **100 chars**. Regenerate a template with `mcp-publisher init` if the schema URL changes.

   ```json
   {
     "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
     "name": "io.github.rbsoftwaresystems/draftlytic-mcp",
     "description": "Offline MCP server for planning structured project specs — validate, render, and checklist tools.",
     "repository": { "url": "https://github.com/rbsoftwaresystems/draftlytic-mcp", "source": "github" },
     "version": "0.4.1",
     "packages": [
       { "registryType": "npm", "identifier": "draftlytic-mcp", "version": "0.4.1", "transport": { "type": "stdio" } }
     ]
   }
   ```

3. **Install the CLI, authenticate, publish:**

   ```bash
   brew install mcp-publisher              # or grab a release binary
   mcp-publisher login github              # device flow — must be the rbsoftwaresystems account
   mcp-publisher publish
   ```

   The GitHub JWT is **short-lived** — if `publish` returns `401 ... token is expired`, re-run `mcp-publisher login github` and publish again immediately. Verify:

   ```bash
   curl "https://registry.modelcontextprotocol.io/v0.1/servers?search=io.github.rbsoftwaresystems/draftlytic-mcp"
   ```

Bump `version` in both `package.json` and `server.json` (kept in sync) for every subsequent registry publish, same as npm.

## Notes

- This package has zero runtime dependency on the main `draftlytic` app or its Supabase backend — it's safe to iterate on independently once split out.
- If the schema in `src/spec-schema.ts` changes, bump at least the minor version and mention the change in the README's spec-shape block.
