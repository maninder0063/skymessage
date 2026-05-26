import {
  DUPLICATE_WINDOW_HOURS,
  MAX_MESSAGES_PER_SENDER_PER_DAY,
  MAX_UNREAD_PER_RECIPIENT,
  SEND_COOLDOWN_SECONDS,
} from './constants.js';

export type SpamCheckCode =
  | 'ok'
  | 'rate_limited'
  | 'cooldown'
  | 'duplicate'
  | 'queue_full'
  | 'blocked';

export interface SpamCheckInput {
  /** How many messages this sender has already sent to this recipient today */
  sentToRecipientToday: number;
  /** Seconds since the last send from this sender to this recipient */
  secondsSinceLastSend: number | null;
  /** Has this exact body been sent in the last 24h? */
  duplicateInWindow: boolean;
  /** Recipient's current unread queue length */
  recipientUnreadCount: number;
  /** Is this sender blocked by the recipient? */
  isBlocked: boolean;
  /** Recipient setting: only accept from allowed senders, and sender is not in list */
  notAllowedBySetting: boolean;
}

export interface SpamCheckResult {
  ok: boolean;
  code: SpamCheckCode;
  reason?: string;
  retryAfterSeconds?: number;
}

export function evaluateSpam(input: SpamCheckInput): SpamCheckResult {
  if (input.isBlocked || input.notAllowedBySetting) {
    return { ok: false, code: 'blocked', reason: 'Recipient does not accept messages from this sender.' };
  }
  if (input.sentToRecipientToday >= MAX_MESSAGES_PER_SENDER_PER_DAY) {
    return {
      ok: false,
      code: 'rate_limited',
      reason: `Daily limit reached (${MAX_MESSAGES_PER_SENDER_PER_DAY} per recipient).`,
      retryAfterSeconds: secondsUntilMidnightLocal(),
    };
  }
  if (
    input.secondsSinceLastSend !== null &&
    input.secondsSinceLastSend < SEND_COOLDOWN_SECONDS
  ) {
    return {
      ok: false,
      code: 'cooldown',
      reason: `Slow down — wait a moment before sending again.`,
      retryAfterSeconds: SEND_COOLDOWN_SECONDS - input.secondsSinceLastSend,
    };
  }
  if (input.duplicateInWindow) {
    return {
      ok: false,
      code: 'duplicate',
      reason: `Already sent that exact message in the last ${DUPLICATE_WINDOW_HOURS}h.`,
    };
  }
  if (input.recipientUnreadCount >= MAX_UNREAD_PER_RECIPIENT) {
    return {
      ok: false,
      code: 'queue_full',
      reason: `Recipient already has ${MAX_UNREAD_PER_RECIPIENT} unread banners waiting.`,
    };
  }
  return { ok: true, code: 'ok' };
}

function secondsUntilMidnightLocal(): number {
  const now = new Date();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
}
