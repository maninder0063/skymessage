import { useCallback, useEffect, useRef, useState } from 'react';
import { Overlay, type OverlayPayload } from './Overlay.js';
import { ANIMATION_INTER_PLANE_DELAY_MS } from '@skymessage/shared/constants';

interface AnimationQueueProps {
  items: OverlayPayload[];
  onItemDelivered: (id: string) => void;
  onQueueComplete: () => void;
  /** Bumped each time main sends a new batch so the queue resets cleanly. */
  batchId: number;
}

/**
 * Serializes OverlayPayloads — one plane on screen at a time, with a small
 * gap between consecutive planes. Reset semantics: when `batchId` changes,
 * the current plane is cancelled and the new batch starts fresh.
 */
export function AnimationQueue({
  items,
  onItemDelivered,
  onQueueComplete,
  batchId,
}: AnimationQueueProps) {
  const [pending, setPending] = useState<OverlayPayload[]>(items);
  const [current, setCurrent] = useState<OverlayPayload | null>(null);
  const gapTimerRef = useRef<number | null>(null);

  // New batch -> reset
  useEffect(() => {
    if (gapTimerRef.current !== null) {
      window.clearTimeout(gapTimerRef.current);
      gapTimerRef.current = null;
    }
    setPending(items);
    setCurrent(items[0] ?? null);
    if (items.length > 0) {
      setPending(items.slice(1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchId]);

  const handleFinish = useCallback(
    (id: string) => {
      onItemDelivered(id);
      setCurrent(null);
      setPending((rest) => {
        if (rest.length === 0) {
          onQueueComplete();
          return rest;
        }
        gapTimerRef.current = window.setTimeout(() => {
          gapTimerRef.current = null;
          setCurrent(rest[0] ?? null);
          setPending((r) => r.slice(1));
        }, ANIMATION_INTER_PLANE_DELAY_MS);
        return rest;
      });
    },
    [onItemDelivered, onQueueComplete],
  );

  useEffect(() => {
    return () => {
      if (gapTimerRef.current !== null) {
        window.clearTimeout(gapTimerRef.current);
        gapTimerRef.current = null;
      }
    };
  }, []);

  if (!current) return null;
  return <Overlay payload={current} onFinish={handleFinish} />;
}
