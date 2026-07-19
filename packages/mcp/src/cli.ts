#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { runHttpServer } from './http.js';
import { runInit } from './init.js';
import { createCourseForgeServer } from './server.js';

const HELP = `courseforge-mcp — MCP server that builds real Canvas courses

Usage:
  courseforge-mcp                 Start in stdio mode (for Claude Desktop/Code, Cursor, ...)
  courseforge-mcp --http [port]   Start Streamable HTTP mode (token via X-Canvas-Token header)
  courseforge-mcp init            Print/write client config (Claude Code, Claude Desktop, Cursor)

Environment:
  CANVAS_BASE_URL   e.g. https://youruni.instructure.com   (required)
  CANVAS_API_TOKEN  personal access token from Canvas → Account → Settings  (stdio mode)
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }

  if (args[0] === 'init') {
    await runInit(args.slice(1));
    return;
  }

  const baseUrl = process.env.CANVAS_BASE_URL;
  if (!baseUrl) {
    console.error('CANVAS_BASE_URL is required (e.g. https://youruni.instructure.com)\n');
    console.error(HELP);
    process.exit(1);
  }

  if (args.includes('--http')) {
    const portArg = args[args.indexOf('--http') + 1];
    const port = portArg && /^\d+$/.test(portArg) ? Number(portArg) : 3980;
    await runHttpServer({ baseUrl, port });
    return;
  }

  const token = process.env.CANVAS_API_TOKEN;
  if (!token) {
    console.error('CANVAS_API_TOKEN is required in stdio mode\n');
    console.error(HELP);
    process.exit(1);
  }

  const server = createCourseForgeServer({ canvasBaseUrl: baseUrl, canvasToken: token });
  await server.connect(new StdioServerTransport());
  console.error(`courseforge-mcp connected (Canvas: ${baseUrl})`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
