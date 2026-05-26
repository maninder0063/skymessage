import type { AirplaneTheme, Message, UserPublic, IsoTimestamp, Uuid, Platform } from './db.js';

// -------- POST /api/messages ----------
export interface SendMessageRequest {
  recipientHandle: string;
  senderDisplayName: string;
  senderHandle?: string;      // omitted = anonymous
  body: string;               // 1..80 chars
  scheduledDeliveryAt?: IsoTimestamp; // omit = send now
}

export interface SendMessageResponse {
  message: Pick<Message, 'id' | 'recipientId' | 'scheduledDeliveryAt' | 'createdAt'>;
}

// -------- GET /api/messages/pending?user_id=... ----------
export interface PendingMessagesResponse {
  recipient: UserPublic & { timezone: string };
  messages: Array<
    Pick<Message, 'id' | 'body' | 'senderDisplayName' | 'isAnonymous' | 'createdAt'> & {
      theme: AirplaneTheme;
    }
  >;
  serverTime: IsoTimestamp;
}

// -------- POST /api/messages/:id/delivered ----------
export interface MarkDeliveredRequest {
  deviceId?: string;
}

// -------- POST /api/messages/:id/read ----------
export interface MarkReadRequest {
  deviceId?: string;
}

// -------- GET /api/users/:handle ----------
export interface PublicProfileResponse {
  user: UserPublic;
  acceptsMessages: boolean;
  acceptsAnonymous: boolean;
}

// -------- POST /api/users/:handle/block ----------
export interface BlockSenderRequest {
  blockedHandle?: string;
  blockedEmail?: string;
  reason?: string;
}

// -------- POST /api/devices/heartbeat ----------
export interface DeviceHeartbeatRequest {
  userId: Uuid;
  deviceId: string;
  platform: Platform;
  appVersion: string;
}

// -------- Error envelope ----------
export interface ApiError {
  error: {
    code:
      | 'invalid_input'
      | 'rate_limited'
      | 'profanity'
      | 'duplicate'
      | 'blocked'
      | 'queue_full'
      | 'not_found'
      | 'forbidden'
      | 'internal';
    message: string;
    retryAfterSeconds?: number;
  };
}
