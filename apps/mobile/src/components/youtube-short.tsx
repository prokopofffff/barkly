import { useRef, useState } from 'react';
import { View } from 'react-native';
import YoutubePlayer, { PLAYER_STATES, type YoutubeIframeRef } from 'react-native-youtube-iframe';

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
 *
 * We fade in only once `onReady` fires (the gradient placeholder behind shows
 * until then, so there's no black flash) and self-heal the loop: a single-video
 * playlist loop is unreliable on the IFrame API, so on ENDED we seek back to 0.
 * A failed embed (shouldn't happen — the pipeline only promotes
 * `playable_in_embed` clips) stays transparent over the placeholder.
 */
export function YouTubeShort({ videoId, playing, width, height }: Props) {
  const ref = useRef<YoutubeIframeRef>(null);
  const [ready, setReady] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <View pointerEvents="none" style={{ width, height, opacity: ready && !errored ? 1 : 0 }}>
      <YoutubePlayer
        ref={ref}
        height={height}
        width={width}
        videoId={videoId}
        play={playing}
        // single-video loop: IFrame loops a one-item playlist
        playList={[videoId]}
        onReady={() => setReady(true)}
        onError={() => setErrored(true)}
        onChangeState={(state: PLAYER_STATES) => {
          // Belt-and-braces loop: restart from the top if the playlist loop drops.
          if (state === PLAYER_STATES.ENDED) ref.current?.seekTo(0, true);
        }}
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
