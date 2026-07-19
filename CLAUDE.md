# CourseForge — agent guide

AI-powered Canvas LMS course creator. pnpm + Turborepo monorepo, TypeScript, Node ≥ 22, ESM-first (dual CJS via tsup), Zod v4, Vitest, Biome.

## Commands

- `pnpm build` / `pnpm test` / `pnpm lint` / `pnpm typecheck` (all turbo-cached)
- Single package: `pnpm --filter @courseforge/imscc test`
- Single test file: `pnpm --filter @courseforge/imscc exec vitest run src/builder.test.ts`

## Architecture (dependency order)

`shared` (CourseSpec Zod schemas) → `imscc` (cartridge build/parse/modify/validate) → `canvas-client` (REST, zero MCP deps) → `mcp` (MCP server). `skills/` are SKILL.md dirs that call the package CLIs. Never import MCP SDK code outside `packages/mcp`.

## Rules

- **Spec first**: features get a `docs/specs/<name>.md` (contract + test matrix) before implementation.
- **Tests required**: imscc changes need round-trip and/or golden-file coverage; client changes need MSW-mocked tests; MCP tools need schema contract + handler tests. Don't weaken snapshots to make tests pass — investigate.
- **Small iterations**: don't bulk-generate modules; build one unit, test it, move on.
- **No secrets**: Canvas tokens/API keys only via env (`.env` is gitignored). Never log tokens. Never hardcode a Canvas URL outside tests/fixtures.
- **Untrusted-file hardening** (`packages/imscc`): `.imscc` files are untrusted input. Guard against zip-slip (reject `..`/absolute entry paths), zip bombs (entry count + uncompressed-size caps), and XXE (fast-xml-parser with DTD processing off). Never `eval` or execute cartridge content.
- **Canvas API invariants** (`packages/canvas-client`): always send `User-Agent`; never send a body on GET (CloudFront 403s); form-encode repeated-key params (`module[prerequisite_module_ids][]`); paginate via RFC-5988 `Link` headers with `per_page=100`; honor 429 `Retry-After` with backoff; cap concurrency (semaphore, default 5).
- **MCP conventions** (`packages/mcp`): every tool has Zod `inputSchema`, annotations (`readOnlyHint` for reads, `destructiveHint` for all writes, `openWorldHint: true`), and an `audience`. Content is created **unpublished by default**. Long-running jobs (imports/exports) are create → poll → report, never one blocking call.
- **IMSCC ground truth**: when a cartridge field is ambiguous, check `docs/imscc-format.md` first, then Canvas's own exporter (`instructure/canvas-lms` `lib/cc/`). The `course_settings/canvas_export.txt` flag file and `cccv1p0` extension XMLs are what make Canvas restore full fidelity — never drop them.
