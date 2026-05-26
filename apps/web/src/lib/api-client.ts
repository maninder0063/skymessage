import type {
  ApiError,
  PublicProfileResponse,
  SendMessageRequest,
  SendMessageResponse,
} from '@skymessage/types';
import { PUBLIC_ENV } from './env';

class SkyMessageApiError extends Error {
  constructor(
    public code: ApiError['error']['code'],
    message: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'SkyMessageApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${PUBLIC_ENV.API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    let payload: ApiError | null = null;
    try { payload = (await res.json()) as ApiError; } catch { /* ignore */ }
    throw new SkyMessageApiError(
      payload?.error.code ?? 'internal',
      payload?.error.message ?? `Request failed: ${res.status}`,
      payload?.error.retryAfterSeconds,
    );
  }

  return (await res.json()) as T;
}

export const api = {
  getProfile(handle: string): Promise<PublicProfileResponse> {
    return request(`/api/users/${encodeURIComponent(handle)}`);
  },
  sendMessage(input: SendMessageRequest): Promise<SendMessageResponse> {
    return request('/api/messages', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
};

export { SkyMessageApiError };
