import { courseImportTools } from './course-import.js';
import { courseTools } from './courses.js';
import { qcTools } from './qc.js';
import { structureTools } from './structure.js';
import type { ToolContext, ToolDefinition, ToolDomainRegistration } from './types.js';

export const CATALOG: readonly ToolDomainRegistration[] = [
  { domain: 'courses', getTools: courseTools },
  { domain: 'structure', getTools: structureTools },
  { domain: 'course-import', getTools: courseImportTools },
  { domain: 'qc', getTools: qcTools },
];

export function allTools(ctx: ToolContext): ToolDefinition[] {
  const tools = CATALOG.flatMap((registration) => registration.getTools(ctx));
  const names = new Set<string>();
  for (const tool of tools) {
    if (names.has(tool.name)) throw new Error(`duplicate tool name: ${tool.name}`);
    names.add(tool.name);
  }
  return tools;
}
