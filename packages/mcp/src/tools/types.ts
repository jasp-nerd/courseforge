import type { Canvas } from '@courseforge/canvas-client';
import type { ZodRawShape } from 'zod';

export type ToolAudience = 'educator' | 'shared';

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodRawShape;
  annotations: ToolAnnotations;
  audience: ToolAudience;
  // biome-ignore lint/suspicious/noExplicitAny: params are validated by the MCP SDK against inputSchema
  handler: (params: any) => Promise<unknown>;
}

export interface ToolContext {
  canvas: Canvas;
}

export interface ToolDomainRegistration {
  domain: string;
  getTools: (ctx: ToolContext) => ToolDefinition[];
}

/** Convention: reads are readOnly, every write is flagged destructive so hosts ask first. */
export const READ = {
  readOnlyHint: true,
  openWorldHint: true,
} satisfies ToolAnnotations;

export const WRITE = {
  destructiveHint: true,
  openWorldHint: true,
} satisfies ToolAnnotations;

/** Uniform result shape: tools return data; the server serializes it. */
export function ok(data: unknown): unknown {
  return data;
}
