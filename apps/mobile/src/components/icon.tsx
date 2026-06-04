import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { COLORS } from '@/constants/gav';

/**
 * Stroke-based icon set ported from the ГАВ design. Icons inherit `color`;
 * pass `filled` to fill the shape (used for active like/bookmark/nav states).
 */
export type IconName =
  | 'home'
  | 'trophy'
  | 'gift'
  | 'user'
  | 'plus'
  | 'heart'
  | 'comment'
  | 'share'
  | 'bookmark'
  | 'check'
  | 'x'
  | 'chevR'
  | 'chevL'
  | 'chevD'
  | 'bolt'
  | 'fire'
  | 'lock'
  | 'bell'
  | 'settings'
  | 'play'
  | 'pause'
  | 'globe'
  | 'upload'
  | 'chart'
  | 'flag'
  | 'sparkle'
  | 'crown'
  | 'edit'
  | 'add'
  | 'clock'
  | 'sound'
  | 'cards'
  | 'book';

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  /** Fill the glyph instead of stroking it. */
  filled?: boolean;
  strokeWidth?: number;
};

export function Icon({ name, size = 26, color = COLORS.text, filled = false, strokeWidth = 2.4 }: Props) {
  // Shared stroke props for outline glyphs.
  const s = {
    fill: filled ? color : 'none',
    stroke: filled ? 'none' : color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'home' && <Path d="M4 11 L12 4 L20 11 V20 a1 1 0 0 1 -1 1 H5 a1 1 0 0 1 -1 -1 Z" {...s} />}
      {name === 'trophy' && (
        <G {...s}>
          <Path d="M7 4h10v4a5 5 0 0 1 -10 0Z" />
          <Path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1 -3 3" />
          <Path d="M10 13h4M9 20h6M12 13v7" />
        </G>
      )}
      {name === 'gift' && (
        <G {...s}>
          <Rect x="4" y="9" width="16" height="11" rx="1.5" />
          <Path d="M4 9h16M12 9v11M8.5 9C6 9 6 4.5 9 5c2 .4 3 4 3 4M15.5 9C18 9 18 4.5 15 5c-2 .4-3 4-3 4" />
        </G>
      )}
      {name === 'user' && (
        <G {...s}>
          <Circle cx="12" cy="8" r="4" />
          <Path d="M5 21a7 7 0 0 1 14 0" />
        </G>
      )}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />}
      {name === 'heart' && (
        <Path
          d="M12 21C5 15.5 3 12 3 8.5A4.5 4.5 0 0 1 12 6 4.5 4.5 0 0 1 21 8.5C21 12 19 15.5 12 21Z"
          fill={filled ? color : 'none'}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )}
      {name === 'comment' && <Path d="M21 12a8 8 0 0 1 -11.5 7.2L4 21l1.8-5.5A8 8 0 1 1 21 12Z" {...s} />}
      {name === 'share' && <Path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v13M7 8l5-5 5 5" {...s} />}
      {name === 'bookmark' && (
        <Path
          d="M6 4h12v17l-6-4-6 4Z"
          fill={filled ? color : 'none'}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      )}
      {name === 'check' && <Path d="M5 13l4 4L19 7" fill="none" stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />}
      {name === 'x' && <Path d="M6 6l12 12M18 6L6 18" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />}
      {name === 'chevR' && <Path d="M9 5l7 7-7 7" {...s} />}
      {name === 'chevL' && <Path d="M15 5l-7 7 7 7" {...s} />}
      {name === 'chevD' && <Path d="M5 9l7 7 7-7" {...s} />}
      {name === 'bolt' && <Path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill={color} />}
      {name === 'fire' && <Path d="M12 2c1 4-2 5-2 8a2 2 0 0 0 4 0c2 2 3 3 3 6a5 5 0 0 1-10 0c0-4 5-6 5-14Z" fill={color} />}
      {name === 'lock' && (
        <G {...s}>
          <Rect x="5" y="11" width="14" height="9" rx="2" />
          <Path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </G>
      )}
      {name === 'bell' && (
        <G {...s}>
          <Path d="M6 16V10a6 6 0 0 1 12 0v6l2 2H4Z" />
          <Path d="M10 20a2 2 0 0 0 4 0" />
        </G>
      )}
      {name === 'settings' && (
        <G {...s}>
          <Circle cx="12" cy="12" r="3" />
          <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
        </G>
      )}
      {name === 'play' && <Path d="M7 4l13 8-13 8Z" fill={color} />}
      {name === 'pause' && (
        <G fill={color}>
          <Rect x="6" y="5" width="4" height="14" rx="1.5" />
          <Rect x="14" y="5" width="4" height="14" rx="1.5" />
        </G>
      )}
      {name === 'globe' && (
        <G {...s}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
        </G>
      )}
      {name === 'upload' && <Path d="M12 16V4m0 0L7 9m5-5 5 5M5 20h14" {...s} />}
      {name === 'chart' && (
        <G {...s}>
          <Path d="M4 20V4M4 20h16" />
          <Path d="M8 16v-4M12 16V8M16 16v-7" />
        </G>
      )}
      {name === 'flag' && <Path d="M5 21V4h12l-2 4 2 4H5" {...s} />}
      {name === 'sparkle' && <Path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill={color} />}
      {name === 'crown' && <Path d="M4 18h16M4 18l-1-9 5 4 4-7 4 7 5-4-1 9" {...s} />}
      {name === 'edit' && <Path d="M5 19h14M14 4l4 4-9 9H5v-4Z" {...s} />}
      {name === 'add' && (
        <G {...s}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 8v8M8 12h8" />
        </G>
      )}
      {name === 'clock' && (
        <G {...s}>
          <Circle cx="12" cy="12" r="9" />
          <Path d="M12 7v5l3 2" />
        </G>
      )}
      {name === 'sound' && (
        <G {...s}>
          <Path d="M4 9h4l5-4v14l-5-4H4Z" fill={color} stroke="none" />
          <Path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12" />
        </G>
      )}
      {name === 'cards' && (
        <G {...s}>
          <Rect x="3" y="7" width="13" height="13" rx="2" />
          <Path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
        </G>
      )}
      {name === 'book' && (
        <G {...s}>
          <Path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 0-3 3Z" />
          <Path d="M19 7H8a3 3 0 0 0-3 3" />
        </G>
      )}
    </Svg>
  );
}
