import type {
  ApiError,
  PendingMessagesResponse,
} from '@skymessage/types';

export type AccessTokenProvider = () => Promise<string | null>;

export interface HeartbeatInput {
  deviceId: string;
  platform: 'windows' | 'macos' | 'linux';
  appVersion: string;
}

export class DesktopApiClient {
  constructor(
    private baseUrl: string,
    private getAccessToken: AccessTokenProvider,
  ) {}

  updateBaseUrl(url: string): void { this.baseUrl = url; }

  async pending(): Promise<PendingMessagesResponse> {
    return this.request<PendingMessagesResponse>('/api/messages/pending');
  }

  async markDelivered(id: string): Promise<void> {
    await this.request<{ ok: true }>(`/api/messages/${encodeURIComponent(id)}/delivered`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async markRead(id: string): Promise<void> {
    await this.request<{ ok: true }>(`/api/messages/${encodeURIComponent(id)}/read`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async heartbeat(input: HeartbeatInput): Promise<void> {
    await this.request<{ ok: true }>('/api/devices/heartbeat', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await this.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined ?? {}),
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      let payload: ApiError | null = null;
      try { payload = (await res.json()) as ApiError; } catch { /* */ }
      throw new Error(payload?.error.message ?? `HTTP ${res.status}`);
    }
    return (await res.json()) as T;
  }
}
