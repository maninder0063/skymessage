/**
 * Single source of truth for IPC channel names + payload shapes.
 * Both preload (contextBridge) and main use these constants.
 * Renderer imports the types via the preload `.d.ts`.
 */
import type { PendingMessagesResponse } from '@skymessage/types';

export const IPC = {
  PlayMessages:     'sm:play-messages',
  Hide:             'sm:hide',
  AnimationDone:    'sm:animation-done',
  MessageDelivered: 'sm:message-delivered',
  QueueComplete:    'sm:queue-complete',
  RequestPending:   'sm:request-pending',
  Status:           'sm:status',
  AuthLogin:        'sm:auth-login',
  AuthSignup:       'sm:auth-signup',
  AuthSignOut:      'sm:auth-sign-out',
  AuthSnapshot:     'sm:auth-snapshot',
  AuthCloseWindow:  'sm:auth-close-window',
} as const;

export interface PlayMessagesPayload {
  messages: PendingMessagesResponse['messages'];
  recipient: PendingMessagesResponse['recipient'];
  trigger: 'unlock-screen' | 'resume' | 'return-from-idle' | 'manual';
}

export interface StatusPayload {
  apiBaseUrl: string;
  handle: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  handle: string;
  displayName: string;
  timezone: string;
}

export interface AuthResultPayload {
  ok: boolean;
  error?: string;
  meta?: { userId: string; handle: string; displayName: string; email: string | null };
}

export interface AuthSnapshotPayload {
  signedIn: boolean;
  meta: { userId: string; handle: string; displayName: string; email: string | null; timezone: string } | null;
}
