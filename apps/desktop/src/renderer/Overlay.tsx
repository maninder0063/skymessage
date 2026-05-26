import { useEffect, useRef, useState } from 'react';
import { Plane } from './Plane.js';
import { Banner } from './Banner.js';
import { ANIMATION_PLANE_DURATION_MS } from '@skymessage/shared/constants';

export interface OverlayPayload {
  id: string;
  sender: string;
  message: string;
}

interface OverlayProps {
  payload: OverlayPayload;
  onFinish: (id: string) => void;
}

/**
 * Single plane sweep — ported from meeting-plane-electron.
 *
 * The WHOLE animation is one Web Animations API call on the sweep wrapper.
 * Same compositor pipeline CSS @keyframes use — no React commits during the
 * sweep, no JS work between frames. `.banner-air` adds a subtle wind-catch
 * rotation pivoted from the rope-attachment edge (CSS keyframe, GPU layer,
 * doesn't touch the sweep).
 */
export function Overlay({ payload, onFinish }: OverlayProps) {
  const sweepRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1920,
    height: typeof window !== 'undefined' ? window.innerHeight : 1080,
  });

  useEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Layout constants — mirror meeting-plane exactly.
  const BANNER_WIDTH = 520;
  const PLANE_WIDTH = 300;
  const GROUP_WIDTH = BANNER_WIDTH + PLANE_WIDTH - 30;

  const startX = -GROUP_WIDTH - 100;
  const endX = viewport.width + 200;
  const flyY = Math.max(80, viewport.height * 0.22);

  useEffect(() => {
    const el = sweepRef.current;
    if (!el) return;

    const dx = endX - startX;
    const duration = ANIMATION_PLANE_DURATION_MS;

    const anim = el.animate(
      [
        { transform: `translate3d(${startX}px, 0, 0)`, opacity: 0, offset: 0 },
        { transform: `translate3d(${startX + dx * 0.05}px, 0, 0)`, opacity: 1, offset: 0.05 },
        { transform: `translate3d(${startX + dx * 0.95}px, 0, 0)`, opacity: 1, offset: 0.95 },
        { transform: `translate3d(${endX}px, 0, 0)`, opacity: 0, offset: 1 },
      ],
      {
        duration,
        easing: 'cubic-bezier(0.32, 0, 0.68, 1)',
        fill: 'forwards',
      },
    );

    const handleFinish = () => onFinish(payload.id);
    anim.addEventListener('finish', handleFinish);

    return () => {
      anim.removeEventListener('finish', handleFinish);
      try { anim.cancel(); } catch { /* main may already be tearing this down */ }
    };
  }, [payload.id, startX, endX, onFinish]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <div
        ref={sweepRef}
        style={{
          position: 'absolute',
          top: flyY,
          left: 0,
          width: GROUP_WIDTH,
          height: 170,
          zIndex: 1,
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden',
          contain: 'layout style paint',
          opacity: 0,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
          <div className="banner-air" style={{ position: 'absolute', left: 0, top: 20 }}>
            <Banner sender={payload.sender} message={payload.message} />
          </div>
          <div style={{ position: 'absolute', left: BANNER_WIDTH - 30, top: 5 }}>
            <Plane />
          </div>
        </div>
      </div>
    </div>
  );
}
