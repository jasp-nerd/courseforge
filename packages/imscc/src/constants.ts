/** Namespaces, resource types, and fixed strings of the Canvas Common Cartridge dialect (CC 1.1). */

export const CC_VERSION = '1.1.0';

export const NS = {
  imscp: 'http://www.imsglobal.org/xsd/imsccv1p1/imscp_v1p1',
  lom: 'http://ltsc.ieee.org/xsd/imsccv1p1/LOM/resource',
  lomimscc: 'http://ltsc.ieee.org/xsd/imsccv1p1/LOM/manifest',
  xsi: 'http://www.w3.org/2001/XMLSchema-instance',
  canvas: 'http://canvas.instructure.com/xsd/cccv1p0',
  imsdt: 'http://www.imsglobal.org/xsd/imsccv1p1/imsdt_v1p1',
  imswl: 'http://www.imsglobal.org/xsd/imsccv1p1/imswl_v1p1',
  qti: 'http://www.imsglobal.org/xsd/ims_qtiasiv1p2',
} as const;

export const MANIFEST_SCHEMA_LOCATION = [
  NS.imscp,
  'http://www.imsglobal.org/profile/cc/ccv1p1/ccv1p1_imscp_v1p2_v1p0.xsd',
  NS.lomimscc,
  'http://www.imsglobal.org/profile/cc/ccv1p1/LOM/ccv1p1_lommanifest_v1p0.xsd',
  NS.lom,
  'http://www.imsglobal.org/profile/cc/ccv1p1/LOM/ccv1p1_lomresource_v1p0.xsd',
].join(' ');

export const CANVAS_SCHEMA_LOCATION = `${NS.canvas} https://canvas.instructure.com/xsd/cccv1p0.xsd`;

export const RESOURCE_TYPE = {
  webcontent: 'webcontent',
  weblink: 'imswl_xmlv1p1',
  discussion: 'imsdt_xmlv1p1',
  assessment: 'imsqti_xmlv1p2/imscc_xmlv1p1/assessment',
  questionBank: 'imsqti_xmlv1p2/imscc_xmlv1p1/question-bank',
  lor: 'associatedcontent/imscc_xmlv1p1/learning-application-resource',
  basicLti: 'imsbasiclti_xmlv1p0',
} as const;

/** Canvas module_meta.xml item content types. */
export const CONTENT_TYPE = {
  page: 'WikiPage',
  assignment: 'Assignment',
  quiz: 'Quizzes::Quiz',
  discussion: 'DiscussionTopic',
  file: 'Attachment',
  link: 'ExternalUrl',
  header: 'ContextModuleSubHeader',
} as const;

/**
 * The exact content of course_settings/canvas_export.txt. Canvas's importer
 * treats the presence of this file as "this is a Canvas cartridge" and runs
 * the full-fidelity importer. Do not change it.
 */
export const CANVAS_EXPORT_FLAG =
  'Q: What did the panda say when he was forced out of his natural habitat?\nA: This is un-BEAR-able\n';

export const PATHS = {
  manifest: 'imsmanifest.xml',
  courseSettingsDir: 'course_settings',
  flag: 'course_settings/canvas_export.txt',
  courseSettings: 'course_settings/course_settings.xml',
  moduleMeta: 'course_settings/module_meta.xml',
  assignmentGroups: 'course_settings/assignment_groups.xml',
  rubrics: 'course_settings/rubrics.xml',
  filesMeta: 'course_settings/files_meta.xml',
  mediaTracks: 'course_settings/media_tracks.xml',
  syllabus: 'course_settings/syllabus.html',
  wikiContent: 'wiki_content',
  webResources: 'web_resources',
  nonCcAssessments: 'non_cc_assessments',
} as const;

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
