import { createServer as createHttpServer } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createCourseForgeServer } from './server.js';

/**
 * Stateless Streamable-HTTP mode for hosted/multi-user deployments.
 * Security model (fail-closed):
 * - the Canvas URL is pinned server-side via CANVAS_BASE_URL (no SSRF via client input)
 * - the Canvas token arrives per-request in the X-Canvas-Token header; there is no
 *   server-side fallback token, so an unauthenticated request can never reach Canvas.
 */
export async function runHttpServer(options: { baseUrl: string; port: number }): Promise<void> {
  const httpServer = createHttpServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, server: 'courseforge-mcp' }));
      return;
    }
    if (req.method !== 'POST') {
      res.writeHead(405).end();
      return;
    }

    const token = req.headers['x-canvas-token'];
    if (typeof token !== 'string' || token.length === 0) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'missing X-Canvas-Token header' }));
      return;
    }

    try {
      const server = createCourseForgeServer({
        canvasBaseUrl: options.baseUrl,
        canvasToken: token,
      });
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);

      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const body: unknown =
        chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
      await transport.handleRequest(req, res, body);
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ error: error instanceof Error ? error.message : 'internal error' }),
        );
      }
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(options.port, resolve));
  console.error(
    `courseforge-mcp listening on http://localhost:${options.port} (Canvas pinned to ${options.baseUrl}); ` +
      'clients must send X-Canvas-Token per request',
  );
}
