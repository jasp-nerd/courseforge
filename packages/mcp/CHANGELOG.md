# courseforge-mcp

## 0.3.0

### Minor Changes

- 973829f: Fixes from the first live end-to-end test against a production Canvas instance:

  - `build_course_from_spec` now converts spec datetimes from the course's time zone to UTC for cartridge imports (previously "23:59" imported as 23:59 UTC), auto-routes quizzes to New Quizzes on instances where Classic Quizzes is disabled (`new_quizzes_native_experience`), accepts an explicit `import_quizzes_next` override, and returns a `verification` block that diffs the spec against the modules that actually landed — catching content Canvas skips silently.
  - New: `localDateTimeToUtc` (shared) and `courses.listEnabledFeatures` (canvas-client).
  - The styling banner is now applied to assignment descriptions, not just pages.
  - Docs/skills: corrected the CLI invocation to `npx -y @courseforge/imscc`.

### Patch Changes

- Updated dependencies [973829f]
  - @courseforge/shared@0.3.0
  - @courseforge/imscc@0.2.1
  - @courseforge/canvas-client@0.3.0

## 0.2.0

### Minor Changes

- c7f164a: Initial release: CourseSpec schemas, Canvas-flavored IMSCC build/parse/modify/validate with CLI, standalone Canvas REST client with the content_migrations import dance, and the courseforge-mcp server (20 tools, stdio + Streamable HTTP, init wizard).

### Patch Changes

- Updated dependencies [c7f164a]
  - @courseforge/shared@0.2.0
  - @courseforge/imscc@0.2.0
  - @courseforge/canvas-client@0.2.0
