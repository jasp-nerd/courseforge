import { CANVAS_SCHEMA_LOCATION, NS } from '../constants.js';
import { el, text, type XmlElement } from '../xml.js';

const canvasRootAttrs = {
  xmlns: NS.canvas,
  'xmlns:xsi': NS.xsi,
  'xsi:schemaLocation': CANVAS_SCHEMA_LOCATION,
};

export function writeCourseSettings(options: {
  identifier: string;
  title: string;
  courseCode: string;
  defaultView: string;
}): XmlElement {
  return el('course', { identifier: options.identifier, ...canvasRootAttrs }, [
    text('title', options.title),
    text('course_code', options.courseCode),
    el('start_at'),
    el('conclude_at'),
    text('is_public', 'false'),
    text('allow_student_wiki_edits', 'false'),
    text('allow_student_forum_attachments', 'true'),
    text('lock_all_announcements', 'false'),
    text('default_wiki_editing_roles', 'teachers'),
    text('allow_student_organized_groups', 'true'),
    text('default_view', options.defaultView),
    text('open_enrollment', 'false'),
    text('self_enrollment', 'false'),
    text('license', 'private'),
    text('indexed', 'false'),
    text('hide_final_grade', 'false'),
    text('hide_distribution_graphs', 'false'),
    text('allow_student_discussion_topics', 'true'),
    text('allow_student_discussion_editing', 'true'),
    text('show_announcements_on_home_page', 'false'),
    text('home_page_announcement_limit', '3'),
    text('usage_rights_required', 'false'),
    text('restrict_student_future_view', 'false'),
    text('restrict_student_past_view', 'false'),
    text('homeroom_course', 'false'),
    text('grading_standard_enabled', 'false'),
    el('default_post_policy', undefined, [text('post_manually', 'false')]),
    el('allow_final_grade_override'),
    text('enable_course_paces', 'false'),
  ]);
}

export interface MetaModuleItemInput {
  identifier: string;
  contentType: string;
  workflowState: string;
  title: string;
  identifierref?: string;
  url?: string;
  position: number;
  indent: number;
}

export interface MetaModuleInput {
  identifier: string;
  title: string;
  workflowState: string;
  position: number;
  requireSequentialProgress: boolean;
  items: MetaModuleItemInput[];
}

export function writeModuleMeta(modules: MetaModuleInput[]): XmlElement {
  return el(
    'modules',
    canvasRootAttrs,
    modules.map((mod) =>
      el('module', { identifier: mod.identifier }, [
        text('title', mod.title),
        text('workflow_state', mod.workflowState),
        text('position', mod.position),
        text('require_sequential_progress', String(mod.requireSequentialProgress)),
        text('locked', 'false'),
        el(
          'items',
          undefined,
          mod.items.map((item) =>
            el('item', { identifier: item.identifier }, [
              text('content_type', item.contentType),
              text('workflow_state', item.workflowState),
              text('title', item.title),
              item.identifierref ? text('identifierref', item.identifierref) : undefined,
              item.url ? text('url', item.url) : undefined,
              text('position', item.position),
              text('new_tab', ''),
              text('indent', item.indent),
              text('link_settings_json', 'null'),
            ]),
          ),
        ),
      ]),
    ),
  );
}

export interface AssignmentGroupInput {
  identifier: string;
  title: string;
  position: number;
  weight: number;
}

export function writeAssignmentGroups(groups: AssignmentGroupInput[]): XmlElement {
  return el(
    'assignmentGroups',
    canvasRootAttrs,
    groups.map((group) =>
      el('assignmentGroup', { identifier: group.identifier }, [
        text('title', group.title),
        text('position', group.position),
        text('group_weight', group.weight.toFixed(1)),
      ]),
    ),
  );
}

export function writeEmptyStub(rootName: string): XmlElement {
  return el(rootName, canvasRootAttrs);
}
