/**
 * Placeholder feed data so the app runs before the backend exists.
 * Swap this for a Zero query (see src/lib/zero/queries.ts -> useFeedQuery)
 * once zero-cache + the Go backend are serving real `video` rows.
 *
 * The HLS URLs below are public test streams — replace with your CDN/Mux output.
 */
export type FeedVideoItem = {
  id: string;
  langCode: string;
  level: string;
  title: string;
  phrase: string;
  translation: string;
  hlsUrl: string;
  thumbUrl: string;
  durationMs: number;
};

export const SAMPLE_VIDEOS: FeedVideoItem[] = [
  {
    id: 'v1',
    langCode: 'es',
    level: 'a1',
    title: 'Greetings',
    phrase: '¡Hola! ¿Cómo estás?',
    translation: 'Hello! How are you?',
    hlsUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    thumbUrl: '',
    durationMs: 12000,
  },
  {
    id: 'v2',
    langCode: 'es',
    level: 'a1',
    title: 'Ordering coffee',
    phrase: 'Un café, por favor.',
    translation: 'A coffee, please.',
    hlsUrl: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
    thumbUrl: '',
    durationMs: 15000,
  },
  {
    id: 'v3',
    langCode: 'es',
    level: 'a2',
    title: 'Directions',
    phrase: '¿Dónde está la estación?',
    translation: 'Where is the station?',
    hlsUrl: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_ts/master.m3u8',
    thumbUrl: '',
    durationMs: 18000,
  },
];
