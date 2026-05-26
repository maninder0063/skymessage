import type { CSSProperties } from 'react';
import planeImg from './assets/plane.png';

interface PlaneProps {
  style?: CSSProperties;
}

/**
 * Photorealistic plane sprite ported verbatim from meeting-plane-electron.
 * Side view, nose facing RIGHT so the banner trails to the LEFT.
 * Rendered at 300x150 — the same size the Overlay layout assumes.
 */
export function Plane({ style }: PlaneProps) {
  return (
    <img
      src={planeImg}
      width={300}
      height={150}
      alt=""
      draggable={false}
      style={{
        display: 'block',
        imageRendering: 'auto',
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        pointerEvents: 'none',
        userSelect: 'none',
        ...style,
      }}
    />
  );
}
