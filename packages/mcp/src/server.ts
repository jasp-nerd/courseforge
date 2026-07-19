import { createCanvas } from '@courseforge/canvas-client';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { allTools } from './tools/catalog.js';
import type { ToolContext } from './tools/types.js';

export interface ServerConfig {
  canvasBaseUrl: string;
  canvasToken: string;
  userAgent?: string;
}

export const SERVER_INFO = {
  name: 'courseforge-mcp',
  version: '0.1.0',
} as const;

/** Build a fully-wired MCP server. One instance per connection/token. */
export function createCourseForgeServer(config: ServerConfig): McpServer {
  if (!config.canvasBaseUrl) throw new Error('canvasBaseUrl is required');
  if (!config.canvasToken) throw new Error('canvasToken is required');

  const ctx: ToolContext = {
    canvas: createCanvas({
      baseUrl: config.canvasBaseUrl,
      auth: { type: 'token', token: config.canvasToken },
      userAgent: config.userAgent,
    }),
  };

  const server = new McpServer(SERVER_INFO, {
    instructions:
      'CourseForge builds real Canvas courses. Typical flow: draft a CourseSpec from the ' +
      "teacher's syllabus → validate_course_spec → build_course_from_spec (or build_imscc_file " +
      'for a downloadable package). Everything is created unpublished for teacher review. ' +
      'Finish with check_course_setup.',
  });

  for (const tool of allTools(ctx)) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      async (params: Record<string, unknown>) => {
        try {
          const result = await tool.handler(params);
          return {
            content: [
              { type: 'text' as const, text: JSON.stringify(result ?? { ok: true }, null, 2) },
            ],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: 'text' as const, text: `Error: ${message}` }],
            isError: true,
          };
        }
      },
    );
  }

  return server;
}
