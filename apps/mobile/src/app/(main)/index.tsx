import { FlashList, type ViewToken } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { CommentsSheet } from '@/components/comments-sheet';
import { FeedVideo } from '@/components/feed-video';
import { LinkAccountOverlay } from '@/components/link-account-banner';
import { QuizSheet } from '@/components/quiz-sheet';
import { RewardBurst, type Burst } from '@/components/reward-burst';
import { useAuth } from '@/lib/auth/auth-context';
import { useGame } from '@/lib/feed/game-context';
import { LINK_PROMPT_QUIZ_THRESHOLD, useLocalProfile } from '@/lib/profile/local-profile';
import { type FeedVideoItem } from '@/lib/feed/sample-videos';
import { useFeedVideos } from '@/lib/zero/hooks';

// Treat an item as "active" once it covers ≥80% of the viewport. Static, so
// it lives at module scope (FlashList requires a stable reference).
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 80 };

/**
 * The core ГАВ screen: a vertical, full-screen, paged video feed with the
 * learning overlay (tappable subtitles, quizzes, XP/streak gamification).
 *
 * Gamification state lives in the shared GameProvider so the other tabs stay
 * in sync. The feed reads from Zero via useFeedVideos() (queries.ts -> useFeedQuery),
 * falling back to bundled samples until the backend serves real `video` rows.
 */
export default function FeedScreen() {
  const { height } = useWindowDimensions();
  const router = useRouter();
  const videos = useFeedVideos();
  const { state, earn, saveWord } = useGame();
  const { user } = useAuth();
  const { quizzesCompleted, linkPromptDismissed, recordQuizCompleted } = useLocalProfile();
  const [activeIndex, setActiveIndex] = useState(0);
  const [quizOpen, setQuizOpen] = useState(false);
  const [burst, setBurst] = useState<Burst | null>(null);
  const [commentsFor, setCommentsFor] = useState<FeedVideoItem | null>(null);

  // Stable across renders — FlashList rejects a changing onViewableItemsChanged.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<FeedVideoItem>[] }) => {
      const idx = viewableItems[0]?.index;
      if (idx != null) {
        setActiveIndex(idx);
        setQuizOpen(false);
      }
    },
    [],
  );

  const finishQuiz = (correct: boolean, xp: number) => {
    setQuizOpen(false);
    const newCombo = correct ? state.combo + 1 : 0;
    earn(correct ? xp : 0, newCombo);
    recordQuizCompleted(); // feeds the "save your progress" nudge threshold
    const id = Math.random();
    setBurst(correct ? { id, correct: true, xp, combo: newCombo } : { id, correct: false });
    setTimeout(() => setBurst((b) => (b && b.id === id ? null : b)), correct ? 1500 : 1250);
  };

  // After a few completed quizzes, nudge an anonymous learner to secure their
  // progress — never before they've invested, always dismissable.
  const showLinkNudge =
    !!user?.isAnonymous && !linkPromptDismissed && quizzesCompleted >= LINK_PROMPT_QUIZ_THRESHOLD;

  const activeVideo = videos[activeIndex];

  const renderItem = useCallback(
    ({ item, index }: { item: FeedVideoItem; index: number }) => (
      <FeedVideo
        item={item}
        isActive={index === activeIndex}
        height={height}
        state={state}
        onQuiz={() => setQuizOpen(true)}
        onComments={() => setCommentsFor(item)}
        onEarn={earn}
        onSaveWord={saveWord}
        onOpenVocab={() => router.push('/vocabulary')}
      />
    ),
    [activeIndex, height, state, earn, saveWord, router],
  );

  return (
    <View className="flex-1 bg-bg">
      <FlashList
        data={videos}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        viewabilityConfig={VIEWABILITY_CONFIG}
        onViewableItemsChanged={onViewableItemsChanged}
      />

      {quizOpen && activeVideo && (
        <QuizSheet quiz={activeVideo.quiz} onClose={() => setQuizOpen(false)} onResult={finishQuiz} />
      )}

      {burst && <RewardBurst key={burst.id} data={burst} />}

      {commentsFor && <CommentsSheet count={commentsFor.comments} onClose={() => setCommentsFor(null)} />}

      {showLinkNudge && <LinkAccountOverlay />}
    </View>
  );
}
