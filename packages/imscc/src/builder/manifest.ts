import { CC_VERSION, MANIFEST_SCHEMA_LOCATION, NS } from '../constants.js';
import { el, text, type XmlElement } from '../xml.js';

export interface ManifestResource {
  identifier: string;
  type: string;
  href?: string;
  intendedUse?: string;
  files: string[];
  dependencies: string[];
}

export interface ManifestOrgItem {
  identifier: string;
  title?: string;
  identifierref?: string;
  children: ManifestOrgItem[];
}

export function writeManifest(options: {
  manifestIdentifier: string;
  title: string;
  organizationRoot: ManifestOrgItem[];
  resources: ManifestResource[];
  schemaVersion?: string;
}): XmlElement {
  const renderItem = (item: ManifestOrgItem): XmlElement =>
    el('item', { identifier: item.identifier, identifierref: item.identifierref }, [
      item.title !== undefined ? text('title', item.title) : undefined,
      ...item.children.map(renderItem),
    ]);

  return el(
    'manifest',
    {
      identifier: options.manifestIdentifier,
      xmlns: NS.imscp,
      'xmlns:lom': NS.lom,
      'xmlns:lomimscc': NS.lomimscc,
      'xmlns:xsi': NS.xsi,
      'xsi:schemaLocation': MANIFEST_SCHEMA_LOCATION,
    },
    [
      el('metadata', undefined, [
        text('schema', 'IMS Common Cartridge'),
        text('schemaversion', options.schemaVersion ?? CC_VERSION),
        el('lomimscc:lom', undefined, [
          el('lomimscc:general', undefined, [
            el('lomimscc:title', undefined, [text('lomimscc:string', options.title)]),
          ]),
          el('lomimscc:rights', undefined, [
            el('lomimscc:copyrightAndOtherRestrictions', undefined, [
              text('lomimscc:value', 'yes'),
            ]),
            el('lomimscc:description', undefined, [
              text('lomimscc:string', 'Private (Copyrighted)'),
            ]),
          ]),
        ]),
      ]),
      el('organizations', undefined, [
        el('organization', { identifier: 'org_1', structure: 'rooted-hierarchy' }, [
          el('item', { identifier: 'LearningModules' }, options.organizationRoot.map(renderItem)),
        ]),
      ]),
      el(
        'resources',
        undefined,
        options.resources.map((resource) =>
          el(
            'resource',
            {
              identifier: resource.identifier,
              type: resource.type,
              href: resource.href,
              intendeduse: resource.intendedUse,
            },
            [
              ...resource.files.map((href) => el('file', { href })),
              ...resource.dependencies.map((identifierref) => el('dependency', { identifierref })),
            ],
          ),
        ),
      ),
    ],
  );
}
