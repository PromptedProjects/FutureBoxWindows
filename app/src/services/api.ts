import { useAuthStore } from '../stores/auth.store';
import type {
  ApiResponse,
  PairCreateData,
  PairData,
  PairRequest,
  MeData,
  StatusData,
  ModelsData,
  ModelSlotsData,
  ChatData,
  ChatRequest,
  ConversationsData,
  ConversationMessagesData,
  PendingActionsData,
  ActionData,
  SubmitActionData,
  TrustRulesData,
  TrustRuleCreateData,
  TrustRuleRequest,
  ConfigData,
  ConfigValueData,
  ConfigSetRequest,
  FilesListData,
  FileReadData,
  FileWriteData,
  FileMoveData,
  FileCopyData,
  ClipboardData,
  ProcessListData,
  ProcessLaunchData,
  ScreenCaptureData,
  DisplayListData,
  BrowserTabsData,
  PowerActionData,
  VolumeData,
  NetworkInterfacesData,
  WifiNetworksData,
  PublicIpData,
  ScheduledTasksData,
  WebhooksData,
  SkillsData,
  ToolDefinitionsData,
  HotkeysData,
  ChannelsData,
} from '../types/api';

function getBaseUrl(): string {
  const host = useAuthStore.getState().host;
  if (!host) throw new Error('No host configured');
  // Host may already include protocol (http://...) or just be ip:port
  return host.startsWith('http') ? host : `http://${host}`;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  skipAuth = false,
): Promise<ApiResponse<T>> {
  const baseUrl = skipAuth && options.headers
    ? '' // will be overridden below
    : getBaseUrl();

  const url = `${baseUrl}${path}`;
  const token = useAuthStore.getState().token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token && !skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(url, {
      ...options,
      headers,
    });
    return (await res.json()) as ApiResponse<T>;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network request failed',
    };
  }
}

/** For requests that need a custom host (before pairing is stored) */
async function requestWithHost<T>(
  host: string,
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const baseUrl = host.startsWith('http') ? host : `http://${host}`;
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    return (await res.json()) as ApiResponse<T>;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network request failed',
    };
  }
}

// --- Public (no auth) ---

export function getStatus() {
  return request<StatusData>('/status', {}, true);
}

export function getStatusFromHost(host: string) {
  return requestWithHost<StatusData>(host, '/status');
}

// --- Pairing ---

export function createPairToken(host: string) {
  return requestWithHost<PairCreateData>(host, '/pair/create', { method: 'POST' });
}

export function pair(host: string, body: PairRequest) {
  return requestWithHost<PairData>(host, '/pair', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// --- Auth check ---

export function getMe() {
  return request<MeData>('/me');
}

// --- Models ---

export function getModels() {
  return request<ModelsData>('/models');
}

export function getModelSlots() {
  return request<ModelSlotsData>('/models/slots');
}

// --- Chat ---

export function sendChat(body: ChatRequest) {
  return request<ChatData>('/chat', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

// --- Conversations ---

export function getConversations(limit = 50, offset = 0) {
  return request<ConversationsData>(
    `/conversations?limit=${limit}&offset=${offset}`,
  );
}

export function getConversationMessages(
  conversationId: string,
  limit = 100,
  offset = 0,
) {
  return request<ConversationMessagesData>(
    `/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`,
  );
}

// --- Actions ---

export function getPendingActions() {
  return request<PendingActionsData>('/pending');
}

export function approveAction(id: string) {
  return request<ActionData>(`/approve/${id}`, { method: 'POST', body: '{}' });
}

export function denyAction(id: string) {
  return request<ActionData>(`/deny/${id}`, { method: 'POST', body: '{}' });
}

// --- Trust Rules ---

export function getTrustRules() {
  return request<TrustRulesData>('/trust-rules');
}

export function createTrustRule(body: TrustRuleRequest) {
  return request<TrustRuleCreateData>('/trust-rules', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function deleteTrustRule(id: string) {
  return request<void>(`/trust-rules/${id}`, { method: 'DELETE' });
}

// --- Config ---

export function getConfig() {
  return request<ConfigData>('/config');
}

export function getConfigValue(key: string) {
  return request<ConfigValueData>(`/config/${encodeURIComponent(key)}`);
}

export function setConfig(body: ConfigSetRequest) {
  return request<void>('/config', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

// --- Files ---

export function listFiles(dirPath?: string) {
  const query = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
  return request<FilesListData>(`/files/list${query}`);
}

export function readFile(filePath: string) {
  return request<FileReadData>(`/files/read?path=${encodeURIComponent(filePath)}`);
}

// --- Transcription ---

export function transcribeAudio(base64Audio: string, language?: string) {
  return request<{ text: string }>('/transcribe', {
    method: 'POST',
    body: JSON.stringify({ audio: base64Audio, language: language || undefined }),
  });
}

// --- TTS ---

export function textToSpeech(text: string, voice?: string) {
  return request<{ audio: string }>('/tts', {
    method: 'POST',
    body: JSON.stringify({ text, voice }),
  });
}

// --- File CRUD (Phase 1) ---

export function writeFile(filePath: string, content: string) {
  return request<FileWriteData>('/files/write', {
    method: 'POST',
    body: JSON.stringify({ path: filePath, content }),
  });
}

export function mkdir(dirPath: string) {
  return request<FileWriteData>('/files/mkdir', {
    method: 'POST',
    body: JSON.stringify({ path: dirPath }),
  });
}

export function deleteFilePath(filePath: string, type?: 'file' | 'directory') {
  return request<FileWriteData>('/files/delete', {
    method: 'DELETE',
    body: JSON.stringify({ path: filePath, type }),
  });
}

export function moveFile(src: string, dest: string) {
  return request<FileMoveData>('/files/move', {
    method: 'POST',
    body: JSON.stringify({ src, dest }),
  });
}

export function copyFile(src: string, dest: string) {
  return request<FileCopyData>('/files/copy', {
    method: 'POST',
    body: JSON.stringify({ src, dest }),
  });
}

// --- Clipboard (Phase 1) ---

export function getClipboard() {
  return request<ClipboardData>('/clipboard');
}

export function setClipboard(text: string) {
  return request<{ written: boolean }>('/clipboard', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

// --- Processes (Phase 1) ---

export function getProcesses() {
  return request<ProcessListData>('/processes');
}

export function getProcessInfo(pid: number) {
  return request<unknown>(`/processes/${pid}`);
}

export function launchApp(command: string, args?: string[], cwd?: string) {
  return request<ProcessLaunchData>('/processes/launch', {
    method: 'POST',
    body: JSON.stringify({ command, args, cwd }),
  });
}

export function killProcess(pid: number, force?: boolean) {
  return request<{ pid: number; killed: boolean }>(`/processes/kill?pid=${pid}`, {
    method: 'POST',
    body: JSON.stringify({ force }),
  });
}

// --- Screen (Phase 2) ---

export function getDisplays() {
  return request<DisplayListData>('/screen/displays');
}

export function captureScreen(displayId?: number) {
  const query = displayId !== undefined ? `?display=${displayId}` : '';
  return request<ScreenCaptureData>(`/screen/capture${query}`);
}

// --- Browser (Phase 2) ---

export function getBrowserTabs() {
  return request<BrowserTabsData>('/browser/tabs');
}

export function openBrowserTab(url: string) {
  return request<unknown>('/browser/tabs', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export function openInDesktopBrowser(url: string) {
  return request<{ opened: boolean; url: string }>('/browser/open', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export function closeBrowserTab(id: string) {
  return request<unknown>(`/browser/tabs/${id}`, { method: 'DELETE' });
}

export function navigateBrowserTab(id: string, url: string) {
  return request<unknown>(`/browser/tabs/${id}/navigate`, {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export function screenshotBrowserTab(id: string) {
  return request<ScreenCaptureData>(`/browser/tabs/${id}/screenshot`);
}

export function getBrowserTabContent(id: string) {
  return request<{ content: string }>(`/browser/tabs/${id}/content`);
}

// --- Power (Phase 3) ---

export function powerShutdown(delay?: number) {
  return request<PowerActionData>('/power/shutdown', {
    method: 'POST',
    body: JSON.stringify({ delay }),
  });
}

export function powerRestart(delay?: number) {
  return request<PowerActionData>('/power/restart', {
    method: 'POST',
    body: JSON.stringify({ delay }),
  });
}

export function powerSleep() {
  return request<PowerActionData>('/power/sleep', { method: 'POST', body: '{}' });
}

export function powerLock() {
  return request<PowerActionData>('/power/lock', { method: 'POST', body: '{}' });
}

export function powerCancelShutdown() {
  return request<PowerActionData>('/power/cancel', { method: 'POST', body: '{}' });
}

// --- Audio (Phase 3) ---

export function getVolume() {
  return request<VolumeData>('/audio/volume');
}

export function setVolume(level: number) {
  return request<VolumeData>('/audio/volume', {
    method: 'POST',
    body: JSON.stringify({ level }),
  });
}

export function muteAudio() {
  return request<unknown>('/audio/mute', { method: 'POST', body: '{}' });
}

export function unmuteAudio() {
  return request<unknown>('/audio/unmute', { method: 'POST', body: '{}' });
}

export function toggleMute() {
  return request<unknown>('/audio/toggle', { method: 'POST', body: '{}' });
}

// --- Network (Phase 3) ---

export function getNetworkInterfaces() {
  return request<NetworkInterfacesData>('/network/interfaces');
}

export function getWifiNetworks() {
  return request<WifiNetworksData>('/network/wifi');
}

export function getPublicIp() {
  return request<PublicIpData>('/network/public-ip');
}

// --- Scheduler (Phase 4) ---

export function getScheduledTasks() {
  return request<ScheduledTasksData>('/tasks');
}

export function createScheduledTask(task: { name: string; cron: string; action_type: string; tier: string; action_payload?: unknown }) {
  return request<unknown>('/tasks', {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

export function deleteScheduledTask(id: string) {
  return request<unknown>(`/tasks/${id}`, { method: 'DELETE' });
}

export function runScheduledTaskNow(id: string) {
  return request<unknown>(`/tasks/${id}/run`, { method: 'POST', body: '{}' });
}

export function enableScheduledTask(id: string) {
  return request<unknown>(`/tasks/${id}/enable`, { method: 'POST', body: '{}' });
}

export function disableScheduledTask(id: string) {
  return request<unknown>(`/tasks/${id}/disable`, { method: 'POST', body: '{}' });
}

// --- Webhooks (Phase 4) ---

export function getWebhooks() {
  return request<WebhooksData>('/webhooks');
}

export function createWebhook(webhook: { name: string; slug: string; action_type: string; tier: string }) {
  return request<unknown>('/webhooks', {
    method: 'POST',
    body: JSON.stringify(webhook),
  });
}

export function deleteWebhook(id: string) {
  return request<unknown>(`/webhooks/${id}`, { method: 'DELETE' });
}

// --- Skills (Phase 5) ---

export function getSkills() {
  return request<SkillsData>('/skills');
}

export function getSkill(id: string) {
  return request<unknown>(`/skills/${id}`);
}

export function executeSkillAction(skillId: string, action: string, params?: Record<string, unknown>) {
  return request<unknown>(`/skills/${skillId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ action, params }),
  });
}

export function getToolDefinitions() {
  return request<ToolDefinitionsData>('/skills/tools');
}

// --- Notifications (Phase 5) ---

export function sendDesktopNotification(title: string, message: string) {
  return request<{ sent: boolean }>('/notifications/desktop', {
    method: 'POST',
    body: JSON.stringify({ title, message }),
  });
}

// --- Camera (Phase 6) ---

export function getCameraDevices() {
  return request<{ devices: { id: string; name: string }[] }>('/camera/devices');
}

export function capturePhoto(deviceId?: string) {
  return request<ScreenCaptureData>('/camera/photo', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId }),
  });
}

// --- Channels (Phase 6) ---

export function getChannels() {
  return request<ChannelsData>('/channels');
}

export function enableChannel(type: string, config: Record<string, string>) {
  return request<unknown>(`/channels/${type}/enable`, {
    method: 'POST',
    body: JSON.stringify({ config }),
  });
}

export function disableChannel(type: string) {
  return request<unknown>(`/channels/${type}/disable`, { method: 'POST', body: '{}' });
}

// --- Hotkeys (Phase 7) ---

export function getHotkeys() {
  return request<HotkeysData>('/hotkeys');
}

export function createHotkey(combo: string, actionType: string, tier?: string) {
  return request<unknown>('/hotkeys', {
    method: 'POST',
    body: JSON.stringify({ combo, action_type: actionType, tier }),
  });
}

export function deleteHotkey(id: string) {
  return request<unknown>(`/hotkeys/${id}`, { method: 'DELETE' });
}
