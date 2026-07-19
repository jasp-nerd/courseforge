---
"@courseforge/shared": minor
"@courseforge/imscc": patch
"@courseforge/canvas-client": minor
"courseforge-mcp": minor
---

Fixes from the first live end-to-end test against a production Canvas instance:

- `build_course_from_spec` now converts spec datetimes from the course's time zone to UTC for cartridge imports (previously "23:59" imported as 23:59 UTC), auto-routes quizzes to New Quizzes on instances where Classic Quizzes is disabled (`new_quizzes_native_experience`), accepts an explicit `import_quizzes_next` override, and returns a `verification` block that diffs the spec against the modules that actually landed — catching content Canvas skips silently.
- New: `localDateTimeToUtc` (shared) and `courses.listEnabledFeatures` (canvas-client).
- The styling banner is now applied to assignment descriptions, not just pages.
- Docs/skills: corrected the CLI invocation to `npx -y @courseforge/imscc`.
