/**
 * Hand-written domain types mirroring the SQL schema.
 *
 * These are stable and used everywhere. When the schema gets richer, regenerate
 * the full row/insert/update triples into `database.generated.ts` via
 * `pnpm db:types` and re-export them here.
 */

export type Uuid = string;
export type IsoTimestamp = string;

export type AirplaneTheme = 'classic' | 'sunset' | 'retro' | 'minimal' | 'birthday';

export type Platform = 'windows' | 'macos' | 'linux';

export interface User {
  id: Uuid;
  authUserId: Uuid | null;
  handle: string;
  displayName: string;
  email: string | null;
  avatarUrl: string | null;
  timezone: string; // IANA, e.g. 'America/Los_Angeles'
  theme: AirplaneTheme;
  isAdmin: boolean;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface UserPublic {
  id: Uuid;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  theme: AirplaneTheme;
}

export interface Message {
  id: Uuid;
  senderId: Uuid | null;
  senderDisplayName: string;
  recipientId: Uuid;
  body: string;
  scheduledDeliveryAt: IsoTimestamp;
  deliveredAt: IsoTimestamp | null;
  readAt: IsoTimestamp | null;
  isAnonymous: boolean;
  createdAt: IsoTimestamp;
}

export interface UserSettings {
  userId: Uuid;
  allowedSendersOnly: boolean;
  animationsPausedUntil: IsoTimestamp | null;
  quietHoursStart: number | null; // 0-23
  quietHoursEnd: number | null;   // 0-23
  workHoursStart: number;
  workHoursEnd: number;
  maxQueuePerUnlock: number;
  profanityStrict: boolean;
  updatedAt: IsoTimestamp;
}

export interface BlockedUserRecord {
  id: Uuid;
  blockerId: Uuid;
  blockedUserId: Uuid | null;
  blockedHandle: string | null;
  blockedEmail: string | null;
  reason: string | null;
  createdAt: IsoTimestamp;
}

export interface DeviceRecord {
  id: Uuid;
  userId: Uuid;
  deviceId: string;
  platform: Platform;
  appVersion: string | null;
  lastSeenAt: IsoTimestamp;
  createdAt: IsoTimestamp;
}
