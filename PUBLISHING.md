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

Bump `version` in `package.json` before every subsequent publish — npm rejects re-publishing the same version.

## 4. Get listed

Submitting to these is what actually drives discovery — publishing to npm alone doesn't put you in front of anyone.

- **Official MCP servers repo** — PR against [modelcontextprotocol/servers](https://github.com/modelcontextprotocol/servers), community servers section (alphabetical, one-line description + link).
- **[PulseMCP](https://www.pulsemcp.com/)** — submit via their site; they crawl npm/GitHub too, but a direct submission is faster.
- **[Smithery](https://smithery.ai/)** — has a CLI (`npx @smithery/cli install`) and a submission flow for listing your server in their registry.
- **[Glama](https://glama.ai/mcp/servers)** — MCP server directory, submit via their site.
- **[awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)** — PR adding an entry under the MCP servers section.
- **awesome-cursor** (search GitHub — several maintained lists exist) — PR adding an entry.
- **[Cursor directory](https://cursor.directory/mcp)** — submit via their site if they take community submissions; otherwise it may pull from the official servers repo automatically.

For each listing, keep the description consistent: "Offline MCP server for planning structured project specs — validate, render, and checklist tools for any MCP client." and link both the npm package and `draftlytic.com`.

## Notes

- This package has zero runtime dependency on the main `draftlytic` app or its Supabase backend — it's safe to iterate on independently once split out.
- If the schema in `src/spec-schema.ts` changes, bump at least the minor version and mention the change in the README's spec-shape block.
