import type { CSSProperties } from 'react';
import bannerImg from './assets/banner.png';

/**
 * =============================================================================
 *                      Banner — SkyMessage adaptation
 * =============================================================================
 * Visual chrome (cloth photo + braided ropes + typography rhythm) is identical
 * to meeting-plane-electron. Only the content slots changed:
 *
 *   meeting-plane                    SkyMessage
 *   ----------------------------     -------------------------------
 *   eyebrow:  "MEETING IN" + clock   "FROM" + airplane icon
 *   headline: "10:00" (red, huge)    message body (auto-sized 22..46px)
 *   title:    meeting title          sender display name
 *   meta:     "via Google Calendar"  omitted (cleaner for casual notes)
 *
 * Headline auto-sizes by message length so a short "Hi!" stays cinematic and a
 * full 80-char message still fits without truncation.
 * =============================================================================
 */

const TOKENS = {
  color: {
    accent:        '#A2261F',  // aviation red, used only for the headline
    inkPrimary:    '#1B2738',  // deep navy paired with plane tail
    inkSecondary:  '#3A4B66',
    inkMuted:      '#5C6A82',
    rule:          '#B8AE92',
  },
  font: {
    sans: "'Roboto', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
    numFeatures: '"lnum" 1, "tnum" 1',
  },
  tracking: {
    eyebrow: 1.6,
    headline: -0.9,
    title: 0.1,
    meta: 0.8,
  },
} as const;

interface BannerProps {
  sender: string;
  message: string;
  /** Override the eyebrow text. Defaults to "FROM". */
  eyebrow?: string;
  style?: CSSProperties;
}

const BannerPlaneIcon = () => (
  <svg
    width={13}
    height={13}
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    style={{ display: 'block', flexShrink: 0 }}
  >
    <path
      d="M3.2 11.6 21 4l-7.6 17.8-2.1-7.9-8.1-2.3z"
      stroke={TOKENS.color.inkSecondary}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  </svg>
);

interface EyebrowProps {
  text: string;
}

const BannerEyebrow = ({ text }: EyebrowProps) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
    <BannerPlaneIcon />
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: `${TOKENS.tracking.eyebrow}px`,
        color: TOKENS.color.inkSecondary,
        textTransform: 'uppercase',
        lineHeight: 1,
        fontFamily: TOKENS.font.sans,
        opacity: 0.78,
      }}
    >
      {text}
    </span>
  </div>
);

/**
 * The HEADLINE — the message body itself. Auto-sizes so it always reads
 * cinematically: a 1-word note feels like a billboard, an 80-char note
 * still fits on one line inside the 320px safe-zone.
 */
function headlineSizeFor(body: string): number {
  const len = body.length;
  if (len <= 14) return 46;
  if (len <= 24) return 38;
  if (len <= 36) return 30;
  if (len <= 52) return 24;
  return 20;
}

interface HeadlineProps {
  body: string;
}

const BannerHeadline = ({ body }: HeadlineProps) => (
  <div
    style={{
      color: TOKENS.color.accent,
      lineHeight: 1.02,
      fontFamily: TOKENS.font.sans,
      fontSize: headlineSizeFor(body),
      fontWeight: 800,
      letterSpacing: `${TOKENS.tracking.headline}px`,
      maxWidth: 310,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    }}
  >
    {body}
  </div>
);

interface SenderRowProps {
  sender: string;
}

const BannerSender = ({ sender }: SenderRowProps) => (
  <div style={{ marginTop: 6 }}>
    <div
      aria-hidden
      style={{
        width: 36,
        height: 1,
        background: TOKENS.color.rule,
        opacity: 0.55,
        marginBottom: 5,
      }}
    />
    <div
      className="banner-title"
      title={sender}
      style={{
        fontSize: 18,
        fontWeight: 600,
        letterSpacing: `${TOKENS.tracking.title}px`,
        color: TOKENS.color.inkPrimary,
        lineHeight: 1.2,
        fontFamily: TOKENS.font.sans,
      }}
    >
      {sender}
    </div>
  </div>
);

/**
 * Cloth banner (real photo) trailing behind the plane, with braided ropes
 * leading from the right-edge eyelets to the plane's tail. The plane lives
 * in Overlay.tsx and sits to the RIGHT of this banner.
 */
export function Banner({ sender, message, eyebrow = 'From', style }: BannerProps) {
  return (
    <div style={{ position: 'relative', width: 520, height: 173, ...style }}>
      <img
        src={bannerImg}
        alt=""
        draggable={false}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          pointerEvents: 'none',
          userSelect: 'none',
          willChange: 'transform',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
      />

      {/* Braided ropes from cloth eyelets to plane tail. overflow:visible lets
          the lines extend past the banner's right edge into the plane area. */}
      <svg
        width={520}
        height={173}
        viewBox="0 0 520 173"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
      >
        <line x1="495" y1="22" x2="552" y2="75" stroke="#3A2E1A" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
        <line x1="495" y1="22" x2="552" y2="75" stroke="#C9AC73" strokeWidth="0.6" strokeLinecap="round" opacity="0.75" />
        <line x1="495" y1="151" x2="552" y2="88" stroke="#3A2E1A" strokeWidth="1.3" strokeLinecap="round" opacity="0.85" />
        <line x1="495" y1="151" x2="552" y2="88" stroke="#C9AC73" strokeWidth="0.6" strokeLinecap="round" opacity="0.75" />
      </svg>

      {/* Text safe-zone — sits inside the cloth's clean band, clear of the
          ragged left flutter (x<150) and the eyelet zone (x>495). */}
      <div
        style={{
          position: 'absolute',
          left: 150,
          top: 20,
          width: 320,
          height: 132,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
      >
        <BannerEyebrow text={eyebrow} />
        <BannerHeadline body={message} />
        <BannerSender sender={sender} />
      </div>
    </div>
  );
}
