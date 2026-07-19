# Contributing to CourseForge

Bug reports, docs, tests, new tools, new question types, and skill improvements are all welcome.

## Quick start

```bash
git clone https://github.com/jasp-nerd/courseforge.git
cd courseforge
pnpm install
pnpm build
pnpm test
```

Requirements: Node ≥ 22, pnpm ≥ 9 (`corepack enable` gives you the pinned version).

## Repository layout

| Package | What it is |
|---|---|
| `packages/shared` | `CourseSpec` Zod schemas, the course format every pillar consumes |
| `packages/imscc` | Build / parse / modify / validate `.imscc` (Canvas-flavored Common Cartridge) |
| `packages/canvas-client` | Standalone Canvas REST client (token or cookie auth) |
| `packages/mcp` | The `courseforge-mcp` MCP server |
| `skills/` | Agent Skills (open SKILL.md standard, portable across 40+ agents) |
| `docs/specs/` | Tests-first design specs. Write one before building a feature |
| `fixtures/` | Real `.imscc` exports from Canvas/Moodle/Blackboard used in round-trip tests |

## Workflow

1. **Spec first.** For anything beyond a small fix, add or update a spec in `docs/specs/` describing the contract (inputs, outputs, error cases, tests) before writing code. Reviewers read the spec first.
2. **Small PRs.** One logical change per PR.
3. **Tests are required.** New tools need contract + handler tests; IMSCC changes need round-trip/golden coverage; client changes need MSW-mocked tests. PRs without meaningful tests won't be merged.
4. **Add a changeset** for user-visible changes: `pnpm changeset`.
5. **Before pushing:** `pnpm lint && pnpm typecheck && pnpm test`.

## AI-assisted contributions

We build this project with AI agents and welcome AI-assisted PRs, on one condition: you understand and stand behind every line you submit. Please:

- Keep generations small and reviewed; no bulk-generated modules.
- Never commit secrets; Canvas tokens belong in `.env` (gitignored).
- Security-sensitive areas (ZIP handling, XML parsing, HTTP auth) get extra scrutiny; the hardening rules live in `CLAUDE.md`.

## Good first issues

Look for the [`good first issue`](https://github.com/jasp-nerd/courseforge/labels/good%20first%20issue) label. Typical starters: adding a QTI question type, adding a Canvas API domain module, improving a skill's references, adding fixtures from another LMS.

## Reporting bugs

Use the issue templates. For cartridge bugs, attach a minimal `.imscc` (or the spec JSON that generates one) and the Canvas import error/migration issues if you have them.

## Code of Conduct

Be kind. See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
