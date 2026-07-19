import type { IdGenerator, ModuleItem } from '@courseforge/shared';
import { CONTENT_TYPE, PATHS, RESOURCE_TYPE } from '../constants.js';
import { renderXml } from '../xml.js';
import type { MetaModuleItemInput } from './canvas-settings.js';
import {
  slugify,
  writeAssessmentMeta,
  writeAssignmentHtml,
  writeAssignmentSettings,
  writeDiscussionTopic,
  writePageHtml,
  writeTopicMeta,
  writeWebLink,
} from './content.js';
import type { ManifestOrgItem, ManifestResource } from './manifest.js';
import { writeAssessmentQti } from './qti.js';

export interface ItemWriteContext {
  nextId: IdGenerator;
  resolveGroup: (name?: string) => string;
  uniqueSlug: (title: string) => string;
  nextAssignmentPosition: () => number;
  bannerHtml?: string;
  fileBytes?: Record<string, Uint8Array>;
}

export interface WrittenItem {
  files: Array<[string, Uint8Array]>;
  resources: ManifestResource[];
  orgItem: ManifestOrgItem;
  metaItem: Omit<MetaModuleItemInput, 'position'>;
}

const encoder = new TextEncoder();

function decodeBase64(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(value, 'base64'));
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Generate the content files, manifest resources, and module entries for one module item. */
export function writeItem(item: ModuleItem, ctx: ItemWriteContext): WrittenItem {
  const { nextId } = ctx;
  const metaItemId = nextId();

  switch (item.type) {
    case 'page': {
      const resourceId = nextId();
      const path = `${PATHS.wikiContent}/${ctx.uniqueSlug(item.title)}.html`;
      return {
        files: [[path, encoder.encode(writePageHtml(item, resourceId, ctx.bannerHtml))]],
        resources: [
          {
            identifier: resourceId,
            type: RESOURCE_TYPE.webcontent,
            href: path,
            files: [path],
            dependencies: [],
          },
        ],
        orgItem: {
          identifier: nextId(),
          title: item.title,
          identifierref: resourceId,
          children: [],
        },
        metaItem: {
          identifier: metaItemId,
          contentType: CONTENT_TYPE.page,
          workflowState: item.published ? 'active' : 'unpublished',
          title: item.title,
          identifierref: resourceId,
          indent: 0,
        },
      };
    }

    case 'assignment': {
      const resourceId = nextId();
      const bodyPath = `${resourceId}/${ctx.uniqueSlug(item.title)}.html`;
      const settingsPath = `${resourceId}/assignment_settings.xml`;
      return {
        files: [
          [bodyPath, encoder.encode(writeAssignmentHtml(item))],
          [
            settingsPath,
            encoder.encode(
              renderXml(
                writeAssignmentSettings(
                  item,
                  resourceId,
                  ctx.resolveGroup(item.assignmentGroup),
                  ctx.nextAssignmentPosition(),
                ),
              ),
            ),
          ],
        ],
        resources: [
          {
            identifier: resourceId,
            type: RESOURCE_TYPE.lor,
            href: bodyPath,
            files: [bodyPath, settingsPath],
            dependencies: [],
          },
        ],
        orgItem: {
          identifier: nextId(),
          title: item.title,
          identifierref: resourceId,
          children: [],
        },
        metaItem: {
          identifier: metaItemId,
          contentType: CONTENT_TYPE.assignment,
          workflowState: item.published ? 'active' : 'unpublished',
          title: item.title,
          identifierref: resourceId,
          indent: 0,
        },
      };
    }

    case 'quiz': {
      const quizId = nextId();
      const metaLorId = nextId();
      const quizAssignmentId = nextId();
      const qtiPath = `${quizId}/assessment_qti.xml`;
      const metaPath = `${quizId}/assessment_meta.xml`;
      return {
        files: [
          [qtiPath, encoder.encode(renderXml(writeAssessmentQti(item, quizId, nextId)))],
          [
            metaPath,
            encoder.encode(
              renderXml(
                writeAssessmentMeta(
                  item,
                  quizId,
                  quizAssignmentId,
                  ctx.resolveGroup(item.assignmentGroup),
                ),
              ),
            ),
          ],
        ],
        resources: [
          {
            identifier: quizId,
            type: RESOURCE_TYPE.assessment,
            files: [qtiPath],
            dependencies: [metaLorId],
          },
          {
            identifier: metaLorId,
            type: RESOURCE_TYPE.lor,
            href: metaPath,
            files: [metaPath],
            dependencies: [],
          },
        ],
        orgItem: { identifier: nextId(), title: item.title, identifierref: quizId, children: [] },
        metaItem: {
          identifier: metaItemId,
          contentType: CONTENT_TYPE.quiz,
          workflowState: item.published ? 'active' : 'unpublished',
          title: item.title,
          identifierref: quizId,
          indent: 0,
        },
      };
    }

    case 'discussion': {
      const topicId = nextId();
      const metaLorId = nextId();
      const gradedAssignmentId = item.graded ? nextId() : undefined;
      const topicPath = `${topicId}.xml`;
      const metaPath = `${metaLorId}.xml`;
      return {
        files: [
          [topicPath, encoder.encode(renderXml(writeDiscussionTopic(item)))],
          [
            metaPath,
            encoder.encode(
              renderXml(
                writeTopicMeta(
                  item,
                  metaLorId,
                  topicId,
                  gradedAssignmentId,
                  ctx.resolveGroup(item.assignmentGroup),
                ),
              ),
            ),
          ],
        ],
        resources: [
          {
            identifier: topicId,
            type: RESOURCE_TYPE.discussion,
            files: [topicPath],
            dependencies: [metaLorId],
          },
          {
            identifier: metaLorId,
            type: RESOURCE_TYPE.lor,
            href: metaPath,
            files: [metaPath],
            dependencies: [],
          },
        ],
        orgItem: { identifier: nextId(), title: item.title, identifierref: topicId, children: [] },
        metaItem: {
          identifier: metaItemId,
          contentType: CONTENT_TYPE.discussion,
          workflowState: item.published ? 'active' : 'unpublished',
          title: item.title,
          identifierref: topicId,
          indent: 0,
        },
      };
    }

    case 'file': {
      const resourceId = nextId();
      const path = `${PATHS.webResources}/${item.path}`;
      const bytes =
        ctx.fileBytes?.[item.path] ??
        (item.contentBase64 ? decodeBase64(item.contentBase64) : undefined);
      if (!bytes) {
        throw new Error(
          `file item "${item.title}" (${item.path}) has no content: supply contentBase64 in the spec or bytes via BuildOptions.files`,
        );
      }
      return {
        files: [[path, bytes]],
        resources: [
          {
            identifier: resourceId,
            type: RESOURCE_TYPE.webcontent,
            href: path,
            files: [path],
            dependencies: [],
          },
        ],
        orgItem: {
          identifier: nextId(),
          title: item.title,
          identifierref: resourceId,
          children: [],
        },
        metaItem: {
          identifier: metaItemId,
          contentType: CONTENT_TYPE.file,
          workflowState: 'active',
          title: item.title,
          identifierref: resourceId,
          indent: 0,
        },
      };
    }

    case 'link': {
      const resourceId = nextId();
      const path = `${resourceId}.xml`;
      return {
        files: [[path, encoder.encode(renderXml(writeWebLink(item)))]],
        resources: [
          { identifier: resourceId, type: RESOURCE_TYPE.weblink, files: [path], dependencies: [] },
        ],
        orgItem: {
          identifier: nextId(),
          title: item.title,
          identifierref: resourceId,
          children: [],
        },
        metaItem: {
          identifier: metaItemId,
          contentType: CONTENT_TYPE.link,
          workflowState: 'active',
          title: item.title,
          url: item.url,
          indent: 0,
        },
      };
    }

    case 'header': {
      return {
        files: [],
        resources: [],
        orgItem: { identifier: nextId(), title: item.title, children: [] },
        metaItem: {
          identifier: metaItemId,
          contentType: CONTENT_TYPE.header,
          workflowState: 'active',
          title: item.title,
          indent: 0,
        },
      };
    }
  }
}

export { slugify };
