import type { ActionTier } from './action.service.js';
import type { ToolDefinition } from '../providers/provider.interface.js';

// Re-export for consumers
export type { ToolDefinition };

export interface SkillAction {
  name: string;
  description: string;
  tier: ActionTier;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  actions: SkillAction[];
}

// Registry of all skills
const skills = new Map<string, Skill>();

/** Register a built-in skill */
export function registerSkill(skill: Skill): void {
  skills.set(skill.id, skill);
}

/** List all registered skills */
export function listSkills(): Skill[] {
  return Array.from(skills.values());
}

/** Get a specific skill */
export function getSkill(id: string): Skill | undefined {
  return skills.get(id);
}

/** Execute a skill action (returns result to pass back to AI) */
export async function executeSkillAction(
  skillId: string,
  actionName: string,
  params: Record<string, unknown>,
): Promise<{ success: boolean; result?: unknown; error?: string }> {
  const skill = skills.get(skillId);
  if (!skill) return { success: false, error: `Skill ${skillId} not found` };
  if (!skill.enabled) return { success: false, error: `Skill ${skillId} is disabled` };

  const action = skill.actions.find((a) => a.name === actionName);
  if (!action) return { success: false, error: `Action ${actionName} not found in skill ${skillId}` };

  // The actual execution would be handled by the skill's registered handler
  // For now, return a placeholder that will be connected to real services
  try {
    const handler = actionHandlers.get(`${skillId}.${actionName}`);
    if (handler) {
      const result = await handler(params);
      return { success: true, result };
    }
    return { success: false, error: `No handler for ${skillId}.${actionName}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Execution failed' };
  }
}

/** Get tool definitions for AI function calling */
export function getToolDefinitions(): ToolDefinition[] {
  const tools: ToolDefinition[] = [];

  for (const skill of skills.values()) {
    if (!skill.enabled) continue;

    for (const action of skill.actions) {
      const required = Object.entries(action.parameters)
        .filter(([, v]) => v.required)
        .map(([k]) => k);

      const properties: Record<string, { type: string; description: string }> = {};
      for (const [key, val] of Object.entries(action.parameters)) {
        properties[key] = { type: val.type, description: val.description };
      }

      tools.push({
        type: 'function',
        function: {
          name: `${skill.id}__${action.name}`,
          description: `[${skill.name}] ${action.description}`,
          parameters: {
            type: 'object',
            properties,
            required,
          },
        },
      });
    }
  }

  return tools;
}

/** Parse an API tool name like "clipboard__read" back to [skillId, actionName] */
export function parseToolName(toolName: string): [string, string] | null {
  const idx = toolName.indexOf('__');
  if (idx === -1) return null;
  return [toolName.slice(0, idx), toolName.slice(idx + 2)];
}

/** Look up the tier for a tool call by its API function name (e.g. "clipboard__read") */
export function getActionTier(toolName: string): ActionTier | null {
  const parsed = parseToolName(toolName);
  if (!parsed) return null;
  const [skillId, actionName] = parsed;
  const skill = skills.get(skillId);
  if (!skill) return null;
  const action = skill.actions.find((a) => a.name === actionName);
  return action?.tier ?? null;
}

// Action handler registry
type ActionHandler = (params: Record<string, unknown>) => Promise<unknown>;
const actionHandlers = new Map<string, ActionHandler>();

/** Register a handler for a skill action */
export function registerActionHandler(key: string, handler: ActionHandler): void {
  actionHandlers.set(key, handler);
}

/** Register all built-in skills */
export function registerBuiltinSkills(): void {
  // File system skill
  registerSkill({
    id: 'files',
    name: 'File System',
    description: 'Read, write, list, and manage files and directories',
    enabled: true,
    actions: [
      {
        name: 'list',
        description: 'List directory contents',
        tier: 'green',
        parameters: {
          path: { type: 'string', description: 'Directory path to list', required: false },
        },
      },
      {
        name: 'read',
        description: 'Read a text file',
        tier: 'green',
        parameters: {
          path: { type: 'string', description: 'File path to read', required: true },
        },
      },
      {
        name: 'write',
        description: 'Write content to a file',
        tier: 'yellow',
        parameters: {
          path: { type: 'string', description: 'File path to write', required: true },
          content: { type: 'string', description: 'Content to write', required: true },
        },
      },
      {
        name: 'delete',
        description: 'Delete a file or directory',
        tier: 'red',
        parameters: {
          path: { type: 'string', description: 'Path to delete', required: true },
          type: { type: 'string', description: '"file" or "directory"', required: false },
        },
      },
    ],
  });

  // Clipboard skill
  registerSkill({
    id: 'clipboard',
    name: 'Clipboard',
    description: 'Read and write system clipboard',
    enabled: true,
    actions: [
      {
        name: 'read',
        description: 'Read clipboard content',
        tier: 'green',
        parameters: {},
      },
      {
        name: 'write',
        description: 'Write text to clipboard',
        tier: 'yellow',
        parameters: {
          text: { type: 'string', description: 'Text to copy to clipboard', required: true },
        },
      },
    ],
  });

  // Process skill
  registerSkill({
    id: 'process',
    name: 'Process Manager',
    description: 'List, launch, and kill system processes',
    enabled: true,
    actions: [
      {
        name: 'list',
        description: 'List running processes',
        tier: 'green',
        parameters: {},
      },
      {
        name: 'launch',
        description: 'Launch an application',
        tier: 'red',
        parameters: {
          command: { type: 'string', description: 'Command to launch', required: true },
          args: { type: 'string', description: 'Space-separated arguments', required: false },
        },
      },
      {
        name: 'kill',
        description: 'Kill a process by PID',
        tier: 'red',
        parameters: {
          pid: { type: 'number', description: 'Process ID to kill', required: true },
        },
      },
    ],
  });

  // Screen capture skill
  registerSkill({
    id: 'screen',
    name: 'Screen Capture',
    description: 'Capture screenshots of the display',
    enabled: true,
    actions: [
      {
        name: 'capture',
        description: 'Take a screenshot of the screen',
        tier: 'yellow',
        parameters: {
          display_id: { type: 'number', description: 'Display ID (0 for primary)', required: false },
        },
      },
      {
        name: 'displays',
        description: 'List available displays',
        tier: 'green',
        parameters: {},
      },
    ],
  });

  // Browser skill
  registerSkill({
    id: 'browser',
    name: 'Browser Control',
    description: 'Control web browser tabs, navigate, and interact with pages',
    enabled: true,
    actions: [
      {
        name: 'list_tabs',
        description: 'List open browser tabs',
        tier: 'green',
        parameters: {},
      },
      {
        name: 'open_tab',
        description: 'Open a new browser tab',
        tier: 'yellow',
        parameters: {
          url: { type: 'string', description: 'URL to open', required: true },
        },
      },
      {
        name: 'screenshot',
        description: 'Take a screenshot of a browser tab',
        tier: 'green',
        parameters: {
          tab_id: { type: 'string', description: 'Tab index', required: true },
        },
      },
      {
        name: 'get_content',
        description: 'Get text content of a browser tab',
        tier: 'green',
        parameters: {
          tab_id: { type: 'string', description: 'Tab index', required: true },
        },
      },
      {
        name: 'navigate',
        description: 'Navigate a browser tab to a URL',
        tier: 'yellow',
        parameters: {
          tab_id: { type: 'string', description: 'Tab index', required: true },
          url: { type: 'string', description: 'URL to navigate to', required: true },
        },
      },
      {
        name: 'eval',
        description: 'Execute JavaScript in a browser tab',
        tier: 'red',
        parameters: {
          tab_id: { type: 'string', description: 'Tab index', required: true },
          script: { type: 'string', description: 'JavaScript to execute', required: true },
        },
      },
    ],
  });

  // Power skill
  registerSkill({
    id: 'power',
    name: 'Power Management',
    description: 'Shutdown, restart, sleep, and lock the system',
    enabled: true,
    actions: [
      {
        name: 'shutdown',
        description: 'Shutdown the system',
        tier: 'red',
        parameters: {
          delay: { type: 'number', description: 'Delay in seconds before shutdown', required: false },
        },
      },
      {
        name: 'restart',
        description: 'Restart the system',
        tier: 'red',
        parameters: {
          delay: { type: 'number', description: 'Delay in seconds before restart', required: false },
        },
      },
      {
        name: 'sleep',
        description: 'Put the system to sleep',
        tier: 'red',
        parameters: {},
      },
      {
        name: 'lock',
        description: 'Lock the workstation',
        tier: 'yellow',
        parameters: {},
      },
    ],
  });

  // Audio skill
  registerSkill({
    id: 'audio',
    name: 'Audio Control',
    description: 'Control system volume and mute',
    enabled: true,
    actions: [
      {
        name: 'get_volume',
        description: 'Get current volume level',
        tier: 'green',
        parameters: {},
      },
      {
        name: 'set_volume',
        description: 'Set system volume',
        tier: 'green',
        parameters: {
          level: { type: 'number', description: 'Volume level 0-100', required: true },
        },
      },
      {
        name: 'toggle_mute',
        description: 'Toggle audio mute',
        tier: 'green',
        parameters: {},
      },
    ],
  });

  // Network skill
  registerSkill({
    id: 'network',
    name: 'Network Info',
    description: 'Get network interface info, WiFi networks, and public IP',
    enabled: true,
    actions: [
      {
        name: 'interfaces',
        description: 'List network interfaces',
        tier: 'green',
        parameters: {},
      },
      {
        name: 'wifi',
        description: 'Scan WiFi networks',
        tier: 'green',
        parameters: {},
      },
      {
        name: 'public_ip',
        description: 'Get public IP address',
        tier: 'green',
        parameters: {},
      },
    ],
  });

  // Notification skill
  registerSkill({
    id: 'notification',
    name: 'Notifications',
    description: 'Send desktop notifications',
    enabled: true,
    actions: [
      {
        name: 'send',
        description: 'Send a desktop notification',
        tier: 'green',
        parameters: {
          title: { type: 'string', description: 'Notification title', required: true },
          message: { type: 'string', description: 'Notification message', required: true },
        },
      },
    ],
  });

  // System skill — run shell commands
  registerSkill({
    id: 'system',
    name: 'System Shell',
    description: 'Execute shell commands on the host machine',
    enabled: true,
    actions: [
      {
        name: 'run',
        description: 'Execute a shell command and return its output',
        tier: 'red',
        parameters: {
          command: { type: 'string', description: 'Shell command to execute', required: true },
        },
      },
    ],
  });

  // Browser open skill — open URL in default browser
  registerSkill({
    id: 'browser_open',
    name: 'Open in Browser',
    description: 'Open a URL in the default desktop browser',
    enabled: true,
    actions: [
      {
        name: 'open',
        description: 'Open a URL in the default desktop browser',
        tier: 'green',
        parameters: {
          url: { type: 'string', description: 'URL to open', required: true },
        },
      },
    ],
  });

  // Register action handlers that connect skills to real services
  registerBuiltinHandlers();
}

async function registerBuiltinHandlers(): Promise<void> {
  // File handlers
  const { listDirectory, readTextFile, writeTextFile, deleteFile, deleteDirectory, getDefaultRoot } = await import('./files.service.js');
  registerActionHandler('files.list', async (p) => listDirectory((p.path as string) || getDefaultRoot()));
  registerActionHandler('files.read', async (p) => readTextFile(p.path as string));
  registerActionHandler('files.write', async (p) => { writeTextFile(p.path as string, p.content as string); return { written: true }; });
  registerActionHandler('files.delete', async (p) => {
    if (p.type === 'directory') { deleteDirectory(p.path as string); } else { deleteFile(p.path as string); }
    return { deleted: true };
  });

  // Clipboard handlers
  const { readClipboard, writeClipboard } = await import('./clipboard.service.js');
  registerActionHandler('clipboard.read', async () => readClipboard());
  registerActionHandler('clipboard.write', async (p) => { writeClipboard(p.text as string); return { written: true }; });

  // Process handlers
  const { listProcesses, launchApp, killProcess } = await import('./process.service.js');
  registerActionHandler('process.list', async () => listProcesses());
  registerActionHandler('process.launch', async (p) => launchApp(p.command as string, p.args ? (p.args as string).split(' ') : []));
  registerActionHandler('process.kill', async (p) => killProcess(p.pid as number));

  // Screen handlers
  const { captureScreen, listDisplays } = await import('./screen.service.js');
  registerActionHandler('screen.capture', async (p) => captureScreen(p.display_id as number | undefined));
  registerActionHandler('screen.displays', async () => listDisplays());

  // Browser handlers
  const browser = await import('./browser.service.js');
  registerActionHandler('browser.list_tabs', async () => browser.listTabs());
  registerActionHandler('browser.open_tab', async (p) => browser.openTab(p.url as string));
  registerActionHandler('browser.screenshot', async (p) => browser.screenshotPage(p.tab_id as string));
  registerActionHandler('browser.get_content', async (p) => browser.getPageContent(p.tab_id as string));
  registerActionHandler('browser.navigate', async (p) => browser.navigateTab(p.tab_id as string, p.url as string));
  registerActionHandler('browser.eval', async (p) => browser.evaluateScript(p.tab_id as string, p.script as string));

  // Power handlers
  const power = await import('./power.service.js');
  registerActionHandler('power.shutdown', async (p) => { power.shutdown(p.delay as number | undefined); return { initiated: true }; });
  registerActionHandler('power.restart', async (p) => { power.restart(p.delay as number | undefined); return { initiated: true }; });
  registerActionHandler('power.sleep', async () => { power.sleep(); return { initiated: true }; });
  registerActionHandler('power.lock', async () => { power.lock(); return { initiated: true }; });

  // Audio handlers
  const audio = await import('./audio.service.js');
  registerActionHandler('audio.get_volume', async () => ({ level: audio.getVolume() }));
  registerActionHandler('audio.set_volume', async (p) => { audio.setVolume(p.level as number); return { level: p.level }; });
  registerActionHandler('audio.toggle_mute', async () => { audio.toggleMute(); return { toggled: true }; });

  // Network handlers
  const net = await import('./network.service.js');
  registerActionHandler('network.interfaces', async () => net.getNetworkInterfaces());
  registerActionHandler('network.wifi', async () => net.getWifiNetworks());
  registerActionHandler('network.public_ip', async () => net.getPublicIp());

  // Notification handler
  const { sendDesktopNotification } = await import('./notification.service.js');
  registerActionHandler('notification.send', async (p) => {
    sendDesktopNotification({ title: p.title as string, message: p.message as string });
    return { sent: true };
  });

  // System shell handler
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  registerActionHandler('system.run', async (p) => {
    const { stdout, stderr } = await execAsync(p.command as string, { timeout: 30000, maxBuffer: 1024 * 1024 });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  });

  // Browser open handler
  const { openInDefaultBrowser } = await import('./browser.service.js');
  registerActionHandler('browser_open.open', async (p) => {
    openInDefaultBrowser(p.url as string);
    return { opened: true, url: p.url };
  });
}
