import * as pty from 'node-pty';
import { wsManager } from '../ws-manager.js';
import {
  createWSMessage,
  type ShellExecPayload,
  type ShellInputPayload,
  type ShellKillPayload,
  type ShellOutputPayload,
  type ShellExitPayload,
  type ShellResizePayload,
} from '../ws-protocol.js';

interface PtyShell {
  pty: pty.IPty;
  sessionId: string;
  tabId: string;
  messageId: string;
}

/** Persistent PTY shells, keyed by "sessionId:tabId" */
const activeShells = new Map<string, PtyShell>();

function shellKey(sessionId: string, tabId: string): string {
  return `${sessionId}:${tabId}`;
}

/** Spawn or reuse a persistent PTY shell for a tab */
function ensureShell(sessionId: string, messageId: string, tabId: string, cwd?: string): PtyShell {
  const key = shellKey(sessionId, tabId);
  const existing = activeShells.get(key);
  if (existing) {
    // Update messageId so responses go to the latest request
    existing.messageId = messageId;
    return existing;
  }

  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'powershell.exe' : '/bin/bash';
  const startDir = cwd || process.env.USERPROFILE || process.env.HOME || '.';

  const term = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 120,
    rows: 30,
    cwd: startDir,
    env: process.env as Record<string, string>,
  });

  const entry: PtyShell = { pty: term, sessionId, tabId, messageId };
  activeShells.set(key, entry);

  term.onData((data: string) => {
    wsManager.send(
      sessionId,
      createWSMessage<ShellOutputPayload>('shell.output', entry.messageId, {
        tab_id: tabId,
        data,
        stream: 'stdout',
      }),
    );
  });

  term.onExit(({ exitCode, signal }) => {
    activeShells.delete(key);
    wsManager.send(
      sessionId,
      createWSMessage<ShellExitPayload>('shell.exit', entry.messageId, {
        tab_id: tabId,
        code: exitCode,
        signal: signal !== undefined ? String(signal) : null,
      }),
    );
  });

  return entry;
}

export function handleShellExec(
  sessionId: string,
  messageId: string,
  payload: ShellExecPayload,
): void {
  const shell = ensureShell(sessionId, messageId, payload.tab_id, payload.cwd);
  // Send the command to the persistent shell
  shell.pty.write(payload.command + '\r');
}

export function handleShellInput(sessionId: string, payload: ShellInputPayload): void {
  const key = shellKey(sessionId, payload.tab_id);
  const shell = activeShells.get(key);
  if (shell) {
    shell.pty.write(payload.data);
  }
}

export function handleShellKill(sessionId: string, payload: ShellKillPayload): void {
  const key = shellKey(sessionId, payload.tab_id);
  killShellByKey(key);
}

export function handleShellResize(sessionId: string, payload: ShellResizePayload): void {
  const key = shellKey(sessionId, payload.tab_id);
  const shell = activeShells.get(key);
  if (shell) {
    shell.pty.resize(payload.cols, payload.rows);
  }
}

function killShellByKey(key: string): void {
  const shell = activeShells.get(key);
  if (shell) {
    shell.pty.kill();
    activeShells.delete(key);
  }
}

/** Clean up all shells when a client disconnects */
export function cleanupShells(sessionId: string): void {
  const prefix = `${sessionId}:`;
  for (const key of activeShells.keys()) {
    if (key.startsWith(prefix)) {
      killShellByKey(key);
    }
  }
}
