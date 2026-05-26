import type { Message, User, UserPublic, UserSettings } from '@skymessage/types';

// Postgres uses snake_case; our domain types use camelCase.
// These mappers keep the boundary tight.

interface UserRow {
  id: string;
  auth_user_id: string | null;
  handle: string;
  display_name: string;
  email: string | null;
  avatar_url: string | null;
  timezone: string;
  theme: User['theme'];
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

interface MessageRow {
  id: string;
  sender_id: string | null;
  sender_display_name: string;
  recipient_id: string;
  body: string;
  scheduled_delivery_at: string;
  delivered_at: string | null;
  read_at: string | null;
  is_anonymous: boolean;
  created_at: string;
}

interface SettingsRow {
  user_id: string;
  allowed_senders_only: boolean;
  animations_paused_until: string | null;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  work_hours_start: number;
  work_hours_end: number;
  max_queue_per_unlock: number;
  profanity_strict: boolean;
  updated_at: string;
}

export function mapUser(row: UserRow): User {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    handle: row.handle,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    timezone: row.timezone,
    theme: row.theme,
    isAdmin: row.is_admin,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapUserPublic(row: Pick<UserRow, 'id' | 'handle' | 'display_name' | 'avatar_url' | 'theme'>): UserPublic {
  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    theme: row.theme,
  };
}

export function mapMessage(row: MessageRow): Message {
  return {
    id: row.id,
    senderId: row.sender_id,
    senderDisplayName: row.sender_display_name,
    recipientId: row.recipient_id,
    body: row.body,
    scheduledDeliveryAt: row.scheduled_delivery_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    isAnonymous: row.is_anonymous,
    createdAt: row.created_at,
  };
}

export function mapSettings(row: SettingsRow): UserSettings {
  return {
    userId: row.user_id,
    allowedSendersOnly: row.allowed_senders_only,
    animationsPausedUntil: row.animations_paused_until,
    quietHoursStart: row.quiet_hours_start,
    quietHoursEnd: row.quiet_hours_end,
    workHoursStart: row.work_hours_start,
    workHoursEnd: row.work_hours_end,
    maxQueuePerUnlock: row.max_queue_per_unlock,
    profanityStrict: row.profanity_strict,
    updatedAt: row.updated_at,
  };
}

export type { UserRow, MessageRow, SettingsRow };
