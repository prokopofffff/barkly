import { View } from 'react-native';
import YoutubePlayer from 'react-native-youtube-iframe';

type Props = {
  videoId: string;
  /** Play only while this is the active feed item. */
  playing: boolean;
  width: number;
  height: number;
};

/**
 * The video surface for an embedded YouTube Short, played via the official
 * IFrame player (the ingestion pipeline emits `video.youtubeId`; we host no
 * media). Sits behind the ГАВ learning overlay — `pointerEvents="none"` so taps
 * on subtitle words and the action rail pass through to the overlay, not the
 * WebView. Chrome (controls, branding, related videos) is stripped.
 */
export function YouTubeShort({ videoId, playing, width, height }: Props) {
  return (
    <View pointerEvents="none" style={{ width, height }}>
      <YoutubePlayer
        height={height}
        width={width}
        videoId={videoId}
        play={playing}
        // single-video loop: IFrame loops a one-item playlist
        playList={[videoId]}
        initialPlayerParams={{
          controls: false,
          modestbranding: true,
          rel: false,
          loop: true,
          preventFullScreen: true,
        }}
        webViewProps={{
          allowsInlineMediaPlayback: true,
          mediaPlaybackRequiresUserAction: false,
        }}
      />
    </View>
  );
}
