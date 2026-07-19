# Launch playbook

The checklist for making CourseForge findable. Work top-down; the registries compound.

## Repo settings (once, on GitHub)

- [x] Description: `AI-powered Canvas LMS course creator — MCP server, agent skills, and an IMSCC/Common Cartridge toolkit that turn a syllabus into an importable Canvas course`
- [x] Topics: `canvas-lms` `mcp` `model-context-protocol` `mcp-server` `agent-skills` `claude` `imscc` `common-cartridge` `edtech` `education` `ai` `course-builder` `lms` `instructure`
- [ ] Social preview image: Settings → General → Social preview → upload a 1280×640 PNG render of `assets/banner.svg`
- [ ] Record the demo GIF: `vhs assets/demo.tape` (install: `brew install vhs`), commit as `assets/demo.gif`, swap into README
- [ ] Enable Discussions; add `good first issue` labels to 5+ seeded issues (ideas: add `multiple_dropdowns` question type, add rubrics to cartridges, add a fixture from Brightspace, extend check_course_setup, Firefox extension manifest)

## npm

- [ ] `pnpm changeset` → version → publish `courseforge-mcp`, `@courseforge/imscc`, `@courseforge/canvas-client`, `@courseforge/shared` (release.yml automates after `NPM_TOKEN` secret is set)
- [ ] Verify `npx -y courseforge-mcp --help` works from a clean machine

## MCP registries (all of them — different audiences)

- [ ] Official MCP Registry: `npx @modelcontextprotocol/publisher` with `packages/mcp/server.json` (name `io.github.jasp-nerd/courseforge-mcp`)
- [ ] GitHub MCP Registry: submit via github.com/mcp
- [ ] Smithery (smithery.ai) — repo already has `smithery.yaml`
- [ ] mcp.so, PulseMCP, Glama — submit forms
- [ ] PR to `punkpeye/awesome-mcp-servers` (Education section)
- [ ] Build `.mcpb` bundle: `npx @anthropic-ai/mcpb pack packages/mcp` → attach to GitHub release for one-click Claude Desktop install

## Skills ecosystem

- [ ] skills.sh: verify `npx skills add jasp-nerd/courseforge` finds the `skills/` dir
- [ ] Submit to agentskills.io directory and `VoltAgent/awesome-agent-skills`

## Communities (lead with the teacher pain, not the tech)

Pitch: *"I built an open-source tool that turns a syllabus into a ready-to-review Canvas course — modules, assignments, quizzes and all — via AI agents or a downloadable import file."*

- [ ] Show HN (best: Tuesday–Thursday morning US time, link the repo, first comment = honest story + limitations)
- [ ] r/edtech, r/instructionaldesign, r/Professors (read each sub's self-promo rules first), r/canvaslms
- [ ] Instructure Community forum (community.canvaslms.com) — the highest-intent audience there is
- [ ] Product Hunt (after demo GIF + a hosted landing/docs page exist)
- [ ] LinkedIn post targeting instructional designers; offer to build one course free for feedback

## Content flywheel (ongoing)

- [ ] "How Canvas cartridges actually work" blog post (docs/imscc-format.md is 80% of it) — ranks for `.imscc` searches
- [ ] Short YouTube/Loom: syllabus → course in 3 minutes
- [ ] Respond fast to every issue for the first months; thank contributors publicly
