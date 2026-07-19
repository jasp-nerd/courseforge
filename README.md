<p align="center">
  <img src="assets/banner.svg" alt="CourseForge — from syllabus to a real Canvas course" width="820">
</p>

<p align="center">
  <a href="https://github.com/jasp-nerd/courseforge/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/jasp-nerd/courseforge/ci.yml?branch=main&label=CI" alt="CI status"></a>
  <a href="https://www.npmjs.com/package/courseforge-mcp"><img src="https://img.shields.io/npm/v/courseforge-mcp?label=courseforge-mcp" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="Apache-2.0 license"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-server-8A2BE2" alt="MCP server"></a>
</p>

**CourseForge turns a syllabus into a real Canvas course.** Hand your AI assistant a course outline and get back modules, pages, assignments, quizzes with questions, and discussions — imported straight into Canvas LMS, or packaged as a standards-compliant `.imscc` file any Canvas instance can import. Open source, agent-native, teacher-first.

> 🎬 *Demo GIF coming here — `assets/demo.tape` has the [VHS](https://github.com/charmbracelet/vhs) script to record it.*

## Why CourseForge?

Every existing Canvas MCP server can *read* your courses; some can create a page or an assignment. **None of them can build a whole course.** CourseForge is built around the one feature that changes the game: it generates a complete **Canvas-flavored IMS Common Cartridge** (the same format Canvas itself exports) and pushes it through Canvas's content-migrations API — so an AI agent can create an entire course, quizzes and all, in **one atomic import**. Everything arrives **unpublished**, ready for the teacher's review.

## Quickstart

### 1 · MCP server — let your AI build courses in Canvas

```bash
npx -y courseforge-mcp init        # interactive: writes config for Claude Code/Desktop/Cursor
```

Then ask your assistant: *“Here's my syllabus — build the course in Canvas course 12345.”*

<details>
<summary>Manual config / Claude Code one-liner</summary>

```bash
claude mcp add courseforge \
  -e CANVAS_BASE_URL=https://youruni.instructure.com \
  -e CANVAS_API_TOKEN=your-token \
  -- npx -y courseforge-mcp
```

Get a token in Canvas: **Account → Settings → + New access token**.
</details>

### 2 · No API token? Build an importable file instead

```bash
npx courseforge-imscc build examples/intro-to-chemistry.json
```

Upload the resulting `.imscc` in Canvas: **Settings → Import Course Content → Common Cartridge 1.x Package**. Done.

### 3 · Agent skills — for Claude Code, Codex, Cursor & 40+ agents

```bash
npx skills add jasp-nerd/courseforge      # canvas-course-builder, imscc-editor, canvas-course-qc
```

## What you get

| | |
|---|---|
| 🏗️ **`build_course_from_spec`** | One tool call: CourseSpec JSON → validated `.imscc` → imported into Canvas with progress + issue reporting |
| 📦 **`@courseforge/imscc`** | Build, parse, **modify**, and validate Canvas cartridges — the export → edit → re-import loop, with QTI 1.2 quiz generation (8 question types) |
| 🔌 **`courseforge-mcp`** | 20 tools: course/module/page/assignment/quiz/discussion creation, import/export, migration progress, and a pre-publish QC linter |
| 🧠 **Agent skills** | Interview the teacher, apply university branding, preview the build plan, create everything unpublished — portable across the open Agent Skills standard |
| 🌐 **`@courseforge/canvas-client`** | Standalone Canvas REST client: token *or* browser-cookie auth, Link-header pagination, 429 retry, the 3-step upload dance |
| 🛡️ **Hardened & tested** | 61 tests: golden-file manifests, round-trips on real Canvas exports, zip-slip/zip-bomb/XXE guards, MSW-mocked API, MCP protocol integration |

## How it works

```mermaid
flowchart LR
    A[📄 Syllabus / course idea] --> B[🤖 AI agent<br/>+ canvas-course-builder skill]
    B --> C[CourseSpec JSON<br/>Zod-validated]
    C -->|@courseforge/imscc| D[📦 .imscc<br/>Canvas cartridge]
    D -->|content_migrations API| E[🎓 Canvas course<br/>unpublished, ready for review]
    D -->|manual upload| E
    C -->|mode: api| E
    E -->|export| D
```

The **CourseSpec** is the lingua franca — a plain JSON course description ([reference](skills/canvas-course-builder/references/course-spec.md)). Agents write it, the `imscc` package turns it into a cartridge byte-identical in structure to Canvas's own exports (including the `canvas_export.txt` flag and `cccv1p0` extension XMLs, so *nothing* is lost on import), and the MCP server pushes it through the same import pipeline the Canvas UI uses.

## Compared to existing Canvas MCP servers

| | CourseForge | vishalsachdev/canvas-mcp | bruchris/canvas-lms-mcp |
|---|:---:|:---:|:---:|
| Build a whole course in one call | ✅ | — | — |
| Generate + import `.imscc` packages | ✅ | — | — |
| Modify existing Canvas exports | ✅ | — | — |
| Quiz generation incl. questions | ✅ QTI 1.2 | — | New Quizzes API |
| Course/content creation tools | ✅ | partial | ✅ |
| Grading / student-facing tools | — | ✅ | ✅ |
| Language | TypeScript | Python | TypeScript |

*Different goals: those are excellent course-**management** servers — CourseForge is the course-**creation** engine. Use them side by side.*

## Repository layout

```
packages/shared          CourseSpec Zod schemas (the shared course format)
packages/imscc           .imscc build / parse / modify / validate + CLI
packages/canvas-client   Canvas REST client (zero MCP dependencies)
packages/mcp             The courseforge-mcp server
skills/                  Agent Skills (open SKILL.md standard)
fixtures/                Real .imscc exports used in round-trip tests
docs/                    IMSCC format ground truth, specs, launch playbook
```

## Documentation

- [The Canvas `.imscc` format — ground truth](docs/imscc-format.md)
- [CourseSpec reference](skills/canvas-course-builder/references/course-spec.md)
- [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md)

## Roadmap

- [ ] Chrome extension (build courses from inside the Canvas UI, no token needed)
- [ ] Rubrics + outcomes in cartridges
- [ ] New Quizzes (QTI 2.x) authoring
- [ ] Course templates gallery
- [ ] `.mcpb` one-click bundle on the MCP registries

## License

[Apache-2.0](LICENSE) © jasp-nerd. Not affiliated with Instructure. Canvas is a trademark of Instructure, Inc.
