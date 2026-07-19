---
name: canvas-course-qc
description: Quality-check a Canvas LMS course before the term starts or before publishing. Use when the user asks to review, audit, QC, sanity-check, or "make sure my course is ready" — checking for missing due dates, unpublished modules, empty modules, zero-point graded work, quizzes without questions, or assignment-group weights that don't add up. Also use after building or importing a course to verify the result.
---

# Canvas course QC

Run a readiness review of a Canvas course and deliver a prioritized, actionable report.

## With courseforge-mcp connected

1. Call `check_course_setup` with the `course_id` — it returns structured findings:
   - assignments without due dates
   - graded assignments worth 0 points
   - unpublished modules / empty modules
   - quizzes with no questions
   - assignment-group weights that don't sum to 100
2. Deepen where it warns: `list_modules` + `list_module_items` to spot ordering problems (e.g. an assignment due before its content module), `get_course` to check the syllabus exists.

## Manual review dimensions (beyond the automated checks)

- **Navigation**: is the home page (`default_view`) sensible? Does module 1 orient students (start-here page, syllabus link)?
- **Pacing**: due dates spaced evenly? Nothing due before its module unlocks?
- **Grading story**: do the group weights match what the syllabus promises?
- **Accessibility basics**: pages use real headings (h2/h3, not bold text), links have descriptive text (not "click here"), images referenced in HTML have alt attributes, color contrast of any custom banner ≥ 4.5:1.
- **Student view**: remind the teacher to use Canvas's Student View before publishing.

## Report format

Give the teacher: ✅ what's ready, ⚠️ warnings with the exact item names and one-line fixes, and a short "do these 3 things before publishing" list. Offer to fix findings directly (via the structure tools or by editing the cartridge with the imscc-editor skill) — but only change things after they agree.
