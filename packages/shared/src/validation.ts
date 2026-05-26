import { z } from 'zod';
import { MESSAGE_MAX_LENGTH, MESSAGE_MIN_LENGTH } from './constants.js';

const HANDLE_RE = /^[a-z0-9][a-z0-9_-]{1,29}$/;

export const HandleSchema = z
  .string()
  .min(2)
  .max(30)
  .regex(HANDLE_RE, 'Handle must be lowercase letters, digits, hyphen, or underscore.');

export const DisplayNameSchema = z.string().trim().min(1).max(40);

export const MessageBodySchema = z
  .string()
  .trim()
  .min(MESSAGE_MIN_LENGTH)
  .max(MESSAGE_MAX_LENGTH);

export const SendMessageInput = z.object({
  recipientHandle: HandleSchema,
  senderDisplayName: DisplayNameSchema,
  senderHandle: HandleSchema.optional(),
  body: MessageBodySchema,
  scheduledDeliveryAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .refine(
      (iso) => !iso || new Date(iso).getTime() > Date.now() - 60_000,
      'Scheduled delivery must be in the future.',
    )
    .refine(
      (iso) => !iso || new Date(iso).getTime() < Date.now() + 1000 * 60 * 60 * 24 * 90,
      'Scheduled delivery must be within 90 days.',
    ),
});

export type SendMessageInputT = z.infer<typeof SendMessageInput>;

export const BlockSenderInput = z
  .object({
    blockedHandle: HandleSchema.optional(),
    blockedEmail: z.string().email().optional(),
    reason: z.string().max(200).optional(),
  })
  .refine((v) => v.blockedHandle || v.blockedEmail, {
    message: 'Must provide blockedHandle or blockedEmail.',
  });

export const DeviceHeartbeatInput = z.object({
  userId: z.string().uuid(),
  deviceId: z.string().min(8).max(128),
  platform: z.enum(['windows', 'macos', 'linux']),
  appVersion: z.string().min(1).max(32),
});
