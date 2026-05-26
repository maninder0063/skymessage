import type { SkyMessageBridge } from './index.js';

declare global {
  interface Window {
    skymessage: SkyMessageBridge;
  }
}

export {};
