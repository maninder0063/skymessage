import { useEffect, useState } from 'react';
import { AnimationQueue } from './AnimationQueue.js';
import type { OverlayPayload } from './Overlay.js';

export function App() {
  const [items, setItems] = useState<OverlayPayload[]>([]);
  const [batchId, setBatchId] = useState(0);

  useEffect(() => {
    const unsub = window.skymessage.onPlayMessages((payload) => {
      const queue: OverlayPayload[] = payload.messages.map((m) => ({
        id: m.id,
        sender: m.isAnonymous ? 'Anonymous' : m.senderDisplayName,
        message: m.body,
      }));
      setItems(queue);
      setBatchId((b) => b + 1);
    });
    return unsub;
  }, []);

  return (
    <AnimationQueue
      items={items}
      batchId={batchId}
      onItemDelivered={(id) => window.skymessage.notifyDelivered(id)}
      onQueueComplete={() => {
        window.skymessage.notifyQueueComplete();
        setItems([]);
      }}
    />
  );
}
