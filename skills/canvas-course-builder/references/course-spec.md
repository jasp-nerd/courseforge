# CourseSpec reference

The CourseSpec is CourseForge's JSON course format (Zod schema: `@courseforge/shared`). One spec fully describes a Canvas course; it can be packaged as `.imscc` or built live over the API.

```json
{
  "course": {
    "title": "Introduction to Chemistry",
    "code": "CHEM-101",
    "syllabus": "<p>Full syllabus HTML…</p>",
    "defaultView": "modules"
  },
  "assignmentGroups": [
    { "name": "Assignments", "weight": 60 },
    { "name": "Participation", "weight": 40 }
  ],
  "modules": [
    {
      "name": "Week 1 — Matter",
      "published": false,
      "requireSequentialProgress": false,
      "items": [ ...items, see below... ]
    }
  ],
  "styling": {
    "institution": "Example University",
    "primaryColor": "#0077b3",
    "bannerHtml": "<div style=\"background:#0077b3;color:#fff;padding:12px 16px;border-radius:8px\"><strong>CHEM-101</strong> · Example University</div>"
  }
}
```

Notes: `assignmentGroups` defaults to one unweighted "Assignments" group; weights are percentages and should sum to 100 when used. `defaultView` ∈ `modules|wiki|assignments|syllabus|feed`. All dates are `YYYY-MM-DDThh:mm:ss` (seconds optional).

## Item types

Every item lives in a module's `items` array and has a `type` + `title`.

### page
```json
{ "type": "page", "title": "Welcome", "body": "<h2>Hi</h2><p>…</p>", "published": true }
```

### assignment
```json
{
  "type": "assignment", "title": "Lab report", "body": "<p>Instructions…</p>",
  "points": 10, "gradingType": "points",
  "submissionTypes": ["online_upload"],
  "dueAt": "2026-09-07T23:59:00", "unlockAt": null, "lockAt": null,
  "assignmentGroup": "Assignments", "peerReviews": false, "published": false
}
```
`gradingType` ∈ `points|percent|pass_fail|letter_grade|gpa_scale|not_graded`. `submissionTypes` ∈ `online_text_entry|online_url|online_upload|media_recording|none|on_paper|discussion_topic|online_quiz|external_tool`.

### quiz (Classic Quiz via QTI 1.2)
```json
{
  "type": "quiz", "title": "Checkpoint", "description": "<p>…</p>",
  "quizType": "assignment", "shuffleAnswers": false, "allowedAttempts": 1,
  "scoringPolicy": "keep_highest", "oneQuestionAtATime": false,
  "dueAt": "2026-09-10T23:59:00", "assignmentGroup": "Assignments",
  "questions": [ ...questions... ]
}
```

Question types (each has `text` (HTML) and `points`, default 1):

| type | extra fields |
|---|---|
| `multiple_choice` | `answers: [{text, correct}]` — exactly one correct |
| `multiple_answers` | `answers: [{text, correct}]` — one or more correct |
| `true_false` | `correct: true\|false` |
| `short_answer` | `acceptedAnswers: ["Au", "au"]` |
| `essay` | — (manually graded) |
| `numerical` | `answer: 6, tolerance: 0.1` |
| `matching` | `pairs: [{left, right}]` |
| `text_only` | just `text` — an ungraded info block |

Canvas imports these as **Classic Quizzes**; the teacher can convert to New Quizzes in one click afterwards.

### discussion
```json
{ "type": "discussion", "title": "Introduce yourself", "body": "<p>Prompt…</p>",
  "threaded": true, "graded": true, "points": 5, "dueAt": "…", "assignmentGroup": "Participation" }
```

### link, file, header
```json
{ "type": "link", "title": "LibreTexts chapter", "url": "https://…" }
{ "type": "file", "title": "Periodic table", "path": "handouts/table.pdf", "contentBase64": "…" }
{ "type": "header", "title": "📚 Readings" }
```
For `file`: with the CLI, omit `contentBase64` and place the file at `path` relative to the spec; programmatically, pass bytes via `BuildOptions.files`.

## Styling

`styling.bannerHtml` is prepended to every page body — build it from the university's colors (ask the teacher for their branding guide). Keep it inline-styled (Canvas strips `<style>` blocks in many themes) and accessible (contrast ≥ 4.5:1).

## Authoring guidance

- Write real instructional content; a page should be 150–400 words with headings and lists.
- Give every graded item points; align weights with the syllabus's grading table.
- Use `header` items to break long modules into sections.
- Internal links between pages can use the placeholder `$WIKI_REFERENCE$/pages/<slug>`; file links `$IMS-CC-FILEBASE$/…` — Canvas rewrites them on import.
