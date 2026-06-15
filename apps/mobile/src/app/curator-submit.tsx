import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@rocicorp/zero/react';

import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Field } from '@/components/link-account-banner';
import { COLORS } from '@/constants/gav';
import { useAuth } from '@/lib/auth/auth-context';
import { useCurrentUserQuery } from '@/lib/zero/queries';

/**
 * Curator hub (bk-jaz.9.3). One role-aware screen:
 *  - curator / admin → paste a YouTube Shorts URL; the backend validates it's an
 *    embeddable Short and runs it through the ingestion pipeline (POST /curator/videos).
 *  - basic → a "Стать куратором" application (we vet by email before granting).
 * Either way it carries the banner "Скоро создавать видео смогут все".
 *
 * Role comes from the synced Zero `user` row, so a grant lights up the submit UI
 * live — no re-login. See BACKEND_PLAN §7.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL;
// Placeholder team inbox for curator applications — swap for the real address.
const CURATOR_CONTACT_EMAIL = 'curators@barkly.app';

type SubmitResult = { id: string; status: 'queued' | 'duplicate'; existing?: 'video' | 'ingest' };

const ERROR_RU: Record<string, string> = {
  invalid_url: 'Это не похоже на ссылку YouTube',
  not_embeddable: 'Это видео нельзя встроить — автор запретил',
  not_a_short: 'Подходят только Shorts (до 3 минут)',
  fetch_failed: 'Не удалось получить видео с YouTube',
  invalid_credentials: 'Нет доступа куратора',
  bad_request: 'Проверь ссылку и попробуй ещё раз',
};

export default function CuratorSubmitScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [me] = useQuery(useCurrentUserQuery(user?.userID ?? ''));
  const role = me?.role ?? 'basic';
  const isCurator = role === 'curator' || role === 'admin';

  return (
    <View className="flex-1 bg-bg">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 40 }}
        >
          {/* header */}
          <View className="flex-row items-center gap-3" style={{ paddingHorizontal: 22, paddingBottom: 14 }}>
            <IconButton icon="chevL" onPress={() => router.back()} />
            <Text className="font-nunito-black text-content" style={{ fontSize: 27, letterSpacing: -0.5 }}>
              {isCurator ? 'Загрузить Shorts' : 'Стать куратором'}
            </Text>
          </View>

          {/* "soon for everyone" banner — always shown */}
          <View style={{ paddingHorizontal: 22, paddingBottom: 14 }}>
            <View
              className="flex-row items-center gap-3 overflow-hidden rounded-[20px]"
              style={{ padding: 14, borderWidth: 1, borderColor: 'rgba(192,132,252,0.34)' }}
            >
              <LinearGradient
                colors={['rgba(192,132,252,0.16)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: 'absolute', inset: 0 }}
              />
              <Icon name="clock" size={20} color={COLORS.violet} />
              <Text className="flex-1 font-nunito-bold text-content" style={{ fontSize: 13, lineHeight: 18 }}>
                Скоро создавать видео смогут все 🎬
              </Text>
            </View>
          </View>

          {isCurator ? <SubmitForm token={user?.token ?? null} /> : <ApplyCard userID={user?.userID} email={user?.email} />}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** Curator/admin: paste a YouTube Shorts URL → POST /curator/videos. */
function SubmitForm({ token }: { token: string | null }) {
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = !!API_URL && !!token;

  const submit = async () => {
    const value = url.trim();
    if (!value) return setError('Вставь ссылку на YouTube Shorts');
    if (!canSubmit) return setError('Бэкенд не подключён');
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/curator/videos`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: value }),
      });
      const body = (await res.json().catch(() => ({}))) as Partial<SubmitResult> & { error?: string };
      if (!res.ok) {
        setError(ERROR_RU[body.error ?? ''] ?? 'Что-то пошло не так');
        return;
      }
      if (body.status === 'duplicate') {
        setSuccess(body.existing === 'video' ? 'Это видео уже в ленте' : 'Это видео уже обрабатывается');
      } else {
        setSuccess('Готово! Видео обрабатывается и скоро появится в ленте 🎬');
        setUrl('');
      }
    } catch {
      setError('Нет связи с сервером');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ paddingHorizontal: 22 }} className="gap-3">
      <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 13, lineHeight: 18 }}>
        Вставь ссылку на YouTube Shorts. Мы проверим ролик, сделаем субтитры и квиз — и добавим его в ленту.
      </Text>

      <Field
        value={url}
        onChangeText={(t) => {
          setUrl(t);
          setError(null);
          setSuccess(null);
        }}
        placeholder="https://youtube.com/shorts/…"
        keyboardType="url"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!submitting}
        onSubmitEditing={submit}
      />

      {error && (
        <Text className="font-nunito-bold" style={{ color: COLORS.rose, fontSize: 13 }}>
          {error}
        </Text>
      )}
      {success && (
        <Text className="font-nunito-bold" style={{ color: COLORS.green, fontSize: 13 }}>
          {success}
        </Text>
      )}

      <Pressable
        onPress={submit}
        disabled={submitting}
        className="w-full flex-row items-center justify-center gap-2 rounded-[20px]"
        style={{ backgroundColor: COLORS.lime, paddingVertical: 16, opacity: submitting ? 0.4 : 1 }}
      >
        <Icon name="upload" size={18} color="#0a0e02" />
        <Text className="font-nunito-black" style={{ color: '#0a0e02', fontSize: 16 }}>
          {submitting ? 'Отправляем…' : 'Отправить'}
        </Text>
      </Pressable>
    </View>
  );
}

/** Basic user: pitch + "apply" mailto. We vet by email before granting curator. */
function ApplyCard({ userID, email }: { userID?: string; email?: string }) {
  const apply = () => {
    const subject = encodeURIComponent('Заявка в кураторы Barkly');
    const body = encodeURIComponent(
      `Привет! Хочу стать куратором Barkly.\n\nМой ID: ${userID ?? '—'}\nEmail: ${email ?? '—'}\n\nНемного о себе и почему я подойду: `,
    );
    Linking.openURL(`mailto:${CURATOR_CONTACT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
  };

  return (
    <View style={{ paddingHorizontal: 22 }} className="gap-3">
      <View
        className="rounded-[20px]"
        style={{ padding: 18, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line }}
      >
        <View className="flex-row items-center gap-2.5" style={{ marginBottom: 8 }}>
          <Icon name="crown" size={22} color={COLORS.gold} />
          <Text className="font-nunito-x text-content" style={{ fontSize: 19 }}>
            Стань куратором
          </Text>
        </View>
        <Text className="font-nunito-bold" style={{ color: COLORS.textDim, fontSize: 14, lineHeight: 20 }}>
          Кураторы добавляют YouTube Shorts в ленту и помогают другим учить английский. Оставь заявку — мы напишем
          тебе на почту и расскажем, как подтвердить навыки.
        </Text>
      </View>

      <Pressable
        onPress={apply}
        className="w-full flex-row items-center justify-center gap-2 rounded-[20px]"
        style={{ backgroundColor: COLORS.lime, paddingVertical: 16 }}
      >
        <Icon name="sparkle" size={18} color="#0a0e02" />
        <Text className="font-nunito-black" style={{ color: '#0a0e02', fontSize: 16 }}>
          Подать заявку
        </Text>
      </Pressable>
    </View>
  );
}
