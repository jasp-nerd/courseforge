# The Canvas `.imscc` format — ground truth

A `.imscc` file is a **ZIP archive** (renamed) with `imsmanifest.xml` at its root. It implements the 1EdTech (IMS) **Common Cartridge** standard; Canvas layers its own extension XMLs (namespace `http://canvas.instructure.com/xsd/cccv1p0`) on top so a re-import restores full fidelity.

Two flavors:

1. **Generic CC 1.1/1.3** — portable to any LMS, but Canvas loses assignment settings, module state, quiz settings.
2. **Canvas Common Cartridge** — generic CC **plus** `course_settings/` extension files and the flag file `course_settings/canvas_export.txt`. Canvas detects the flag and runs its full-fidelity importer. **CourseForge always emits this flavor.**

## File layout

```
mycourse.imscc (ZIP)
├── imsmanifest.xml                     # REQUIRED: metadata + organizations + resources
├── course_settings/
│   ├── canvas_export.txt               # the Canvas flag file (fixed panda-joke content)
│   ├── course_settings.xml             # title, course_code, default_view, nav config
│   ├── module_meta.xml                 # authoritative Canvas module structure
│   ├── assignment_groups.xml           # gradebook groups + weights
│   ├── rubrics.xml files_meta.xml media_tracks.xml   # safe as empty stubs
│   └── syllabus.html                   # syllabus body
├── wiki_content/<slug>.html            # Pages (Canvas <meta> tags in <head>)
├── web_resources/...                   # Files (arbitrary tree)
├── <guid>/body.html + assignment_settings.xml        # one folder per assignment
├── <guid>/assessment_qti.xml + assessment_meta.xml   # one folder per quiz (QTI 1.2)
├── non_cc_assessments/<guid>.xml.qti   # optional full-fidelity Canvas QTI
├── <guid>.xml                          # discussion topic (imsdt) / topicMeta / weblink (imswl)
```

**Identifiers:** Canvas uses `g` + 32 hex chars. Any unique XML NCName works (must start with a letter). Keep identifiers stable across edits so Canvas updates instead of duplicating.

## The flag file (exact content, do not change)

```
Q: What did the panda say when he was forced out of his natural habitat?
A: This is un-BEAR-able
```

## imsmanifest.xml

Three sections under `<manifest identifier=...>` with CC 1.1 namespaces (`http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1`, LOM `.../imsccv1p1/LOM/...`):

1. `<metadata>` — `<schema>IMS Common Cartridge</schema>`, `<schemaversion>1.1.0</schemaversion>`, `<lomimscc:lom>` with the course title.
2. `<organizations>` — one `<organization identifier="org_1" structure="rooted-hierarchy">`, a wrapper `<item identifier="LearningModules">`, then one `<item>` per **module** (has `<title>`, no `identifierref`), each containing leaf `<item identifierref="<resource-id>">` per module item.
3. `<resources>` — every file in the zip declared. Resource `type` values:

| Content | resource `type` |
|---|---|
| Page / file | `webcontent` |
| Web link | `imswl_xmlv1p1` |
| Discussion | `imsdt_xmlv1p1` (+ `<dependency>` → topicMeta LOR) |
| Quiz | `imsqti_xmlv1p2/imscc_xmlv1p1/assessment` (+ dependency → assessment_meta LOR) |
| Canvas meta / assignments / course_settings bundle | `associatedcontent/imscc_xmlv1p1/learning-application-resource` ("LOR") |
| Basic LTI link | `imsbasiclti_xmlv1p0` |

The course_settings bundle is a single LOR resource whose `href` is `course_settings/canvas_export.txt` and whose `<file>` children list all course_settings XMLs. The syllabus is a separate LOR resource with `intendeduse="syllabus"`.

## Canvas extension XMLs (namespace `cccv1p0`)

### module_meta.xml (authoritative module structure for Canvas)

```xml
<modules xmlns="http://canvas.instructure.com/xsd/cccv1p0">
  <module identifier="g...">
    <title>Week 1</title>
    <workflow_state>unpublished</workflow_state>   <!-- active = published -->
    <position>1</position>
    <items>
      <item identifier="g...">
        <content_type>WikiPage</content_type>
        <workflow_state>active</workflow_state>
        <title>Overview</title>
        <identifierref>g...</identifierref>        <!-- → resource id in manifest -->
        <position>1</position>
        <indent>0</indent>
      </item>
    </items>
  </module>
</modules>
```

`content_type` vocabulary: `WikiPage`, `Assignment`, `Quizzes::Quiz`, `DiscussionTopic`, `Attachment` (file), `ExternalUrl` (uses `<url>` child, no identifierref), `ContextModuleSubHeader` (title only).

**Invariant:** the organization tree in imsmanifest.xml and module_meta.xml must stay consistent — same modules, same items, same order.

### course_settings.xml (minimum viable)

```xml
<course identifier="g..." xmlns="http://canvas.instructure.com/xsd/cccv1p0">
  <title>My Course</title>
  <course_code>ABC-101</course_code>
  <default_view>modules</default_view>   <!-- wiki|modules|assignments|feed|syllabus -->
</course>
```

### assignment_settings.xml (per assignment folder, next to the body .html)

Key fields: `title`, `due_at`/`unlock_at`/`lock_at` (ISO `YYYY-MM-DDThh:mm:ss`), `assignment_group_identifierref`, `workflow_state` (`unpublished`/`active`), `points_possible`, `grading_type` (`points|percent|pass_fail|letter_grade|gpa_scale|not_graded`), `submission_types` (comma-separated: `online_text_entry,online_url,online_upload,media_recording,none,on_paper,discussion_topic,online_quiz,external_tool`), `position`, `peer_reviews`.

### assessment_meta.xml (per quiz folder)

Quiz settings (`quiz_type` = `assignment|practice_quiz|graded_survey|survey`, `allowed_attempts`, `shuffle_answers`, `scoring_policy`, `show_correct_answers`, `one_question_at_a_time`) plus a **nested `<assignment>`** element linking the quiz to the gradebook (with `quiz_identifierref`, `submission_types>online_quiz`, `assignment_group_identifierref`).

### assignment_groups.xml

`<assignmentGroup identifier>` with `title`, `position`, `group_weight`. Every assignment/quiz references a group by identifier.

## Content files

- **Pages** (`wiki_content/*.html`): full HTML doc; `<head>` carries `<title>` plus Canvas metas: `<meta name="identifier" content="g..."/>`, `<meta name="editing_roles" content="teachers"/>`, `<meta name="workflow_state" content="active"/>`.
- **Assignments**: plain HTML body file in the assignment's guid folder.
- **Discussions**: an `imsdt_xmlv1p1` `<topic>` (title + `<text texttype="text/html">` with **HTML-entity-escaped** body) + a `cccv1p0` `<topicMeta>` LOR (discussion_type `side_comment|threaded`, workflow_state, optional nested `<assignment>` for graded discussions). Announcements are discussions with announcement type in topicMeta.
- **Web links**: `imswl_xmlv1p1` `<webLink><title/><url href target="_iframe"/></webLink>`.
- **Link rewriting placeholders** inside HTML bodies: `$IMS-CC-FILEBASE$` (→ course files base), `$WIKI_REFERENCE$`, `$CANVAS_OBJECT_REFERENCE$` — Canvas rewrites these on import; use them for internal links so they survive.

## Quizzes / QTI

- Canvas CC import understands **QTI 1.2** (`http://www.imsglobal.org/xsd/ims_qtiasiv1p2`) and produces **Classic Quizzes**. Do not emit QTI 2.x for cartridge import.
- `assessment_qti.xml`: `<questestinterop><assessment ident title><qtimetadata cc_profile=cc.exam.v0p1, cc_maxattempts><section ident="root_section">…items…`.
- Item shape: `<item>` → `itemmetadata/qtimetadata` (**`question_type`** — the field Canvas keys on — and `points_possible`) → `presentation` (`material/mattext texttype="text/html"` + `response_lid`/`response_str`) → `resprocessing` (`decvar SCORE 0–100`, `respcondition`/`varequal`/`setvar`).
- `question_type` values Canvas understands: `multiple_choice_question`, `multiple_answers_question`, `true_false_question`, `short_answer_question`, `essay_question`, `matching_question`, `numerical_question`, `calculated_question`, `multiple_dropdowns_question`, `multiple_blanks_question`, `text_only_question`.
- **New Quizzes** cannot be authored via CC import; teachers convert Classic → New in one click, or the API migration can be created with `settings[import_quizzes_next]=true`.

## Validation invariants (check before emitting any cartridge)

1. Every `identifierref` (organizations + module_meta) resolves to a `<resource identifier>`.
2. Every `<resource>`/`<file href>` points to a file present in the zip, and every zip file is declared.
3. Every `<dependency identifierref>` resolves (quiz → assessment_meta LOR, discussion → topicMeta LOR).
4. Every `assignment_group_identifierref` resolves to `assignment_groups.xml`.
5. Identifiers are valid NCNames (start with a letter); dates are ISO `YYYY-MM-DDThh:mm:ss`.
6. `imsmanifest.xml` is at the zip root; entry paths are relative (no leading `/` or `..`).

## Canvas import API (the 4-step dance)

```
1. POST /api/v1/courses/:id/content_migrations
     migration_type=common_cartridge_importer
     pre_attachment[name]=course.imscc  pre_attachment[size]=<bytes>
     (optional: settings[import_quizzes_next]=true, date_shift_options[...])
   → { id, pre_attachment: { upload_url, upload_params }, progress_url }
2. POST upload_url as multipart/form-data: all upload_params fields first, then `file` last.
3. Poll progress_url (GET /api/v1/progress/:id) until workflow_state completed|failed.
4. GET /courses/:id/content_migrations/:id/migration_issues → warnings/errors.
```

Manual path for teachers without tokens: **Course → Settings → Import Course Content → Common Cartridge 1.x Package**.

## Safe modification of an existing export

1. Unzip to a working dir (keep the original).
2. Parse `imsmanifest.xml` + `module_meta.xml` as the source of truth.
3. Adding content = write the file + add `<resource>` + add items to **both** the organization tree and module_meta (with positions).
4. Renames must touch all three places (content file, module_meta, organization title).
5. Removal must delete the resource, its files, and **every** reference — orphan refs are the #1 import failure.
6. Never touch the flag file or the `cccv1p0` namespaces. Re-zip root-relative.

References: 1EdTech CC 1.1–1.3 spec; `instructure/canvas-lms` `lib/cc/` (exporter, `cc_helper.rb` constants, `xsd/cccv1p0.xsd`); `instructure/moodle2cc` `lib/moodle2cc/canvas_cc/` writers; Canvas Content Migrations API docs.
