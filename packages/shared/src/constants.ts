export const MESSAGE_MAX_LENGTH = 80;
export const MESSAGE_MIN_LENGTH = 1;

// Anti-spam thresholds
export const MAX_MESSAGES_PER_SENDER_PER_DAY = 3;
export const MAX_UNREAD_PER_RECIPIENT = 5;
export const SEND_COOLDOWN_SECONDS = 20;
export const DUPLICATE_WINDOW_HOURS = 24;

// Animation behavior
export const ANIMATION_INTER_PLANE_DELAY_MS = 2500;
export const ANIMATION_PLANE_DURATION_MS = 8500;
export const ANIMATION_OVERLAY_SHOW_DELAY_MS = 350;
export const ANIMATION_OVERLAY_HIDE_DELAY_MS = 600;

// Idle detection (desktop)
export const IDLE_THRESHOLD_SECONDS = 300;          // 5 minutes
export const IDLE_POLL_INTERVAL_MS = 30_000;        // poll every 30s

// Server poll frequency safety
export const MIN_POLL_INTERVAL_SECONDS = 15;
