---
name: canvas-course-builder
description: Build a complete Canvas LMS course from a syllabus, course outline, or course idea. Use when the user wants to create, generate, scaffold, or set up a Canvas course, convert a syllabus/curriculum into Canvas modules, pages, assignments, quizzes, or discussions, or produce an importable .imscc / Common Cartridge course package. Triggers on requests like "build my Canvas course", "turn this syllabus into a course", "create modules and assignments in Canvas", "make a course package I can import".
---

# Canvas course builder

You turn a teacher's raw material (syllabus, outline, slides, or just an idea) into a real Canvas course. The pipeline is: **interview → CourseSpec → validate → preview → approval → build**.

## 1. Gather what you need

Read whatever the teacher attached (syllabus, schedule, handbook). Then ask ONLY about gaps — don't interrogate. The essentials:

- Course title/code and rough weekly structure (how many modules? by week or by topic?)
- Assessment mix: assignments, quizzes, graded discussions? Weighted grading groups?
- Dates: term start, due-date rhythm (e.g. "Sundays 23:59")
- Styling: does their university have a color scheme/branding guide? Ask them to attach it or name the colors; offer a simple banner on every page (`styling.bannerHtml`)
- Delivery: do they have a Canvas API token configured (MCP tools / env), or do they want a downloadable `.imscc` file to upload manually?

## 2. Draft the CourseSpec

Write a CourseSpec JSON — the format is fully documented in [references/course-spec.md](references/course-spec.md). Rules of thumb:

- One module per week/topic; open each module with a `header` or overview `page`.
- Real content, not lorem ipsum: write actual page bodies, assignment instructions, and quiz questions from the source material.
- Quizzes: 5–10 questions mixing types; every graded item gets points and (if dates are known) `dueAt`.
- Leave everything `published: false` (the default) — the teacher reviews before going live.

## 3. Validate, preview, approve

1. Validate: MCP tool `validate_course_spec`, or CLI `npx -y @courseforge/imscc build spec.json` (validates on build).
2. Show the teacher a compact plan: modules → items with type/points/dates. **Wait for explicit approval before creating anything.**

## 4. Build

- **Canvas API available** (courseforge-mcp connected): `build_course_from_spec` with the target `course_id` (mode `import` is default and best). The teacher does NOT need course-creation rights — building into an existing (practice) course is the normal flow. Then run `check_course_setup` and report findings.
- **No API access**: `build_imscc_file` (MCP) or `npx -y @courseforge/imscc build spec.json -o course.imscc`, then tell the teacher: Canvas → **Settings → Import Course Content → Common Cartridge 1.x Package** → upload → import all.

## 5. Verify — never trust a green import alone

`build_course_from_spec` returns a `verification` block comparing the spec against what actually landed; if `verification.missing` is non-empty, Canvas skipped content silently. The usual culprit is quizzes on instances where Classic Quizzes is disabled (New-Quizzes-native) — the tool auto-routes quizzes there, but if any are still missing, create them with `create_quiz` + `add_quiz_question` + `add_module_item`. After any manual build path, confirm with `list_modules` + `list_module_items` that every spec item exists.

Report what was created, any migration issues, anything you had to repair, and remind them content is unpublished until they publish modules.
