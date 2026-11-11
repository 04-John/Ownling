// 24 px line icons, 2 px stroke (design/boards/elements.png). Decorative: callers label the button.
import type { SVGProps } from 'react';

type IconProps = { size?: number } & Omit<SVGProps<SVGSVGElement>, 'width' | 'height'>;

function Svg({ size = 20, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconBack = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Svg>
);
/** A coat hanger: the wardrobe. */
export const IconHanger = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 8.5a2.5 2.5 0 1 1 2.5-2.5" />
    <path d="M12 8.5v1.5L3.5 16a1.4 1.4 0 0 0 .8 2.5h15.4a1.4 1.4 0 0 0 .8-2.5L12 10" />
  </Svg>
);
export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Svg>
);
export const IconLockOpen = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 7.5-2" />
  </Svg>
);
export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </Svg>
);
export const IconDrop = (p: IconProps) => (
  <Svg strokeLinecap="butt" {...p}>
    <path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z" />
  </Svg>
);
export const IconSparkle = (p: IconProps) => (
  <Svg strokeLinecap="butt" {...p}>
    <path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" />
  </Svg>
);
export const IconChat = (p: IconProps) => (
  <Svg strokeLinecap="butt" {...p}>
    <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
  </Svg>
);
export const IconSend = (p: IconProps) => (
  <Svg strokeWidth={2.2} {...p}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </Svg>
);
export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="11" height="11" rx="2.5" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Svg>
);

/** Food is rain: the filled raindrop used for feed portions. Art colors, same in both themes. */
export const RainDrop = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11z" fill="#6AA6F2" stroke="#2B3145" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
);

/** The Ownling mark: baby Mochi on rain (brand art, same in both themes). */
export const LogoMark = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <rect width="100" height="100" rx="24" fill="#2D63D8" />
    <g fill="#FFFFFF">
      <circle cx="50" cy="60" r="24" />
      <circle cx="32" cy="62" r="15" />
      <circle cx="68" cy="62" r="15" />
      <circle cx="40" cy="42" r="14" />
      <circle cx="60" cy="38" r="16" />
    </g>
    <ellipse cx="42" cy="58" rx="4.4" ry="5.6" fill="#1F2230" />
    <ellipse cx="58" cy="58" rx="4.4" ry="5.6" fill="#1F2230" />
  </svg>
);
