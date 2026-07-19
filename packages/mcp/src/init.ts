import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';

/**
 * `courseforge-mcp init` — friction-free client setup.
 * Prints the right config snippet for every supported client, or merges it
 * directly into the client's config file with --write <client>.
 */

interface ClientTarget {
  id: string;
  label: string;
  configPath: () => string;
  /** JSON path inside the config file where servers live. */
  serversKey: string;
}

const CLIENTS: ClientTarget[] = [
  {
    id: 'claude-code',
    label: 'Claude Code (~/.claude.json)',
    configPath: () => join(homedir(), '.claude.json'),
    serversKey: 'mcpServers',
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop',
    configPath: () =>
      platform() === 'darwin'
        ? join(homedir(), 'Library/Application Support/Claude/claude_desktop_config.json')
        : join(homedir(), 'AppData/Roaming/Claude/claude_desktop_config.json'),
    serversKey: 'mcpServers',
  },
  {
    id: 'cursor',
    label: 'Cursor (~/.cursor/mcp.json)',
    configPath: () => join(homedir(), '.cursor', 'mcp.json'),
    serversKey: 'mcpServers',
  },
];

function serverEntry(baseUrl: string, token: string): Record<string, unknown> {
  return {
    command: 'npx',
    args: ['-y', 'courseforge-mcp'],
    env: {
      CANVAS_BASE_URL: baseUrl,
      CANVAS_API_TOKEN: token,
    },
  };
}

export async function runInit(args: string[]): Promise<void> {
  const writeTarget = args.includes('--write') ? args[args.indexOf('--write') + 1] : undefined;

  let baseUrl = process.env.CANVAS_BASE_URL ?? '';
  let token = process.env.CANVAS_API_TOKEN ?? '';

  if ((!baseUrl || !token) && process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    if (!baseUrl) {
      baseUrl = (await rl.question('Canvas URL (e.g. https://youruni.instructure.com): ')).trim();
    }
    if (!token) {
      token = (
        await rl.question('Canvas API token (Canvas → Account → Settings → New access token): ')
      ).trim();
    }
    rl.close();
  }
  if (!baseUrl) {
    console.error('No Canvas URL given (set CANVAS_BASE_URL or run interactively).');
    process.exit(1);
  }
  const tokenValue = token || '<paste-your-canvas-token>';

  if (!writeTarget) {
    console.log('\nAdd courseforge-mcp to your client:\n');
    for (const client of CLIENTS) {
      console.log(`# ${client.label} — ${client.configPath()}`);
      console.log(
        JSON.stringify(
          { [client.serversKey]: { courseforge: serverEntry(baseUrl, tokenValue) } },
          null,
          2,
        ),
      );
      console.log();
    }
    console.log('Or write it directly:  courseforge-mcp init --write claude-code');
    console.log(
      'Claude Code one-liner: claude mcp add courseforge -e CANVAS_BASE_URL=' +
        `${baseUrl} -e CANVAS_API_TOKEN=... -- npx -y courseforge-mcp`,
    );
    return;
  }

  const client = CLIENTS.find((c) => c.id === writeTarget);
  if (!client) {
    console.error(`Unknown client "${writeTarget}". Known: ${CLIENTS.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }

  const path = client.configPath();
  let config: Record<string, unknown> = {};
  try {
    config = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>;
  } catch {
    // file missing or invalid — start fresh
  }
  const servers = (config[client.serversKey] ?? {}) as Record<string, unknown>;
  servers.courseforge = serverEntry(baseUrl, tokenValue);
  config[client.serversKey] = servers;

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(config, null, 2)}\n`);
  console.log(`✔ wrote "courseforge" server to ${path}`);
  if (!token) console.log('  (remember to replace <paste-your-canvas-token> with a real token)');
}
