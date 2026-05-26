import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type AuthResultPayload,
  type AuthSnapshotPayload,
  type LoginPayload,
  type PlayMessagesPayload,
  type SignupPayload,
  type StatusPayload,
} from '../shared/ipc-channels.js';

const api = {
  // Overlay-side
  onPlayMessages(handler: (payload: PlayMessagesPayload) => void): () => void {
    const wrapped = (_: unknown, payload: PlayMessagesPayload) => handler(payload);
    ipcRenderer.on(IPC.PlayMessages, wrapped);
    return () => ipcRenderer.off(IPC.PlayMessages, wrapped);
  },
  onStatus(handler: (payload: StatusPayload) => void): () => void {
    const wrapped = (_: unknown, payload: StatusPayload) => handler(payload);
    ipcRenderer.on(IPC.Status, wrapped);
    return () => ipcRenderer.off(IPC.Status, wrapped);
  },
  notifyDelivered(messageId: string): void {
    ipcRenderer.send(IPC.MessageDelivered, { messageId });
  },
  notifyQueueComplete(): void {
    ipcRenderer.send(IPC.QueueComplete);
  },

  // Auth-side
  async login(payload: LoginPayload): Promise<AuthResultPayload> {
    return ipcRenderer.invoke(IPC.AuthLogin, payload);
  },
  async signup(payload: SignupPayload): Promise<AuthResultPayload> {
    return ipcRenderer.invoke(IPC.AuthSignup, payload);
  },
  async signOut(): Promise<void> {
    return ipcRenderer.invoke(IPC.AuthSignOut);
  },
  async getAuthSnapshot(): Promise<AuthSnapshotPayload> {
    return ipcRenderer.invoke(IPC.AuthSnapshot);
  },
  closeAuthWindow(): void {
    ipcRenderer.send(IPC.AuthCloseWindow);
  },
};

contextBridge.exposeInMainWorld('skymessage', api);

export type SkyMessageBridge = typeof api;
