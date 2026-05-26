import { powerMonitor } from 'electron';
import { EventEmitter } from 'node:events';
import {
  IDLE_POLL_INTERVAL_MS,
  IDLE_THRESHOLD_SECONDS,
} from '@skymessage/shared/constants';

export type ReceptiveEvent = 'unlock-screen' | 'resume' | 'return-from-idle' | 'manual';

export interface ReceptiveEventInfo {
  kind: ReceptiveEvent;
  at: Date;
}

/**
 * Emits 'receptive' whenever the user becomes "present and ready" — the
 * narrow set of moments SkyMessage is allowed to interrupt with an animation.
 *
 * Sources:
 *  - powerMonitor 'unlock-screen' (Windows + macOS)
 *  - powerMonitor 'resume'        (after sleep/hibernate)
 *  - polled idle time: was idle > threshold, now active
 *  - manual                       (tray "Replay")
 *
 * The emitter debounces: at most one event per 8 seconds, since several
 * sources fire on a single unlock.
 */
export class ReceptiveDetector extends EventEmitter {
  private lastEmit = 0;
  private debounceMs = 8_000;
  private idleTimer: NodeJS.Timeout | null = null;
  private wasIdle = false;

  start(): void {
    powerMonitor.on('unlock-screen', () => this.fire('unlock-screen'));
    powerMonitor.on('resume', () => this.fire('resume'));

    this.idleTimer = setInterval(() => {
      const idleSeconds = powerMonitor.getSystemIdleTime();
      if (idleSeconds >= IDLE_THRESHOLD_SECONDS) {
        this.wasIdle = true;
      } else if (this.wasIdle) {
        this.wasIdle = false;
        this.fire('return-from-idle');
      }
    }, IDLE_POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = null;
    this.removeAllListeners();
  }

  triggerManually(): void {
    this.fire('manual');
  }

  private fire(kind: ReceptiveEvent): void {
    const now = Date.now();
    if (now - this.lastEmit < this.debounceMs) return;
    this.lastEmit = now;
    const info: ReceptiveEventInfo = { kind, at: new Date(now) };
    this.emit('receptive', info);
  }
}
