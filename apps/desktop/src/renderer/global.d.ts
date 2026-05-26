/**
 * Renderer-side ambient declaration for the window.skymessage bridge.
 * The preload script (run in a different TS project) defines the actual
 * implementation; this file just exposes the typed shape to the renderer.
 */
import type { SkyMessageBridge } from '../preload/index.js';

declare global {
  interface Window {
    skymessage: SkyMessageBridge;
  }
}

export {};
