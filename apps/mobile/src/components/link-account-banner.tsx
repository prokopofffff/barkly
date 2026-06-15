import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { COLORS } from '@/constants/gav';
import { Sharik } from '@/components/mascot';
import { useAuth } from '@/lib/auth/auth-context';
import { useLocalProfile } from '@/lib/profile/local-profile';

/**
 * "Save your progress" nudge — Duolingo-style deferred registration.
 *
 * The person is already using the app under an anonymous session; this never
 * blocks them. It offers to LINK a real identity (same userID, progress carried
 * over — see auth-context) and is always dismissable ("Позже").
 *
 * Shown by:
 *  - the Profile tab (account hub), and
 *  - the feed, once LINK_PROMPT_QUIZ_THRESHOLD quizzes are done.
 * Both gate on `user.isAnonymous && !linkPromptDismissed` at the call site.
 *
 * Apple is offered only on iOS; per App Store rules Sign in with Apple is
 * mandatory wherever we also offer Google/email. Email linking is unverified
 * for now — OTP confirmation is a follow-up (see auth-context / BACKEND_PLAN).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

export function LinkAccountCard() {
  const { linkWithApple, linkWithGoogle, linkWithEmail } = useAuth();
  const { dismissLinkPrompt } = useLocalProfile();

  const [mode, setMode] = useState<'choices' | 'email'>('choices');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitEmail = async () => {
    const mail = email.trim();
    if (!EMAIL_RE.test(mail)) return setError('Введите корректный email');
    if (password.length < MIN_PASSWORD) return setError(`Пароль — минимум ${MIN_PASSWORD} символов`);
    setError(null);
    setSubmitting(true);
    try {
      // No OTP yet — the stub links in place, keeping the same userID. The real
      // backend will send a confirmation code before flipping is_anonymous.
      await linkWithEmail(mail, password);
    } catch {
      setError('Не получилось. Попробуй ещё раз');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View
      className="overflow-hidden rounded-[24px]"
      style={{ padding: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line2 }}
    >
      <View className="flex-row items-center gap-3">
        <Sharik mood="happy" size={64} cosmetic="scarf" />
        <View className="flex-1">
          <Text className="font-nunito-black text-content" style={{ fontSize: 19, lineHeight: 23 }}>
            Сохрани свой прогресс
          </Text>
          <Text
            className="font-nunito-semibold text-content-dim"
            style={{ fontSize: 13, lineHeight: 18, marginTop: 4 }}
          >
            Привяжи аккаунт, чтобы стрик, XP и словарь не потерялись и были на всех устройствах.
          </Text>
        </View>
      </View>

      {mode === 'choices' ? (
        <>
          <View className="gap-2.5" style={{ marginTop: 16 }}>
            {Platform.OS === 'ios' && (
              <AuthButton label=" Продолжить с Apple" bg="#ffffff" fg="#000000" onPress={linkWithApple} />
            )}
            <AuthButton
              label="Продолжить с Google"
              bg={COLORS.surface2}
              fg={COLORS.text}
              border
              onPress={linkWithGoogle}
            />
            <AuthButton
              label="Продолжить с Email"
              bg={COLORS.surface2}
              fg={COLORS.text}
              border
              onPress={() => {
                setError(null);
                setMode('email');
              }}
            />
          </View>

          <Pressable onPress={dismissLinkPrompt} className="self-center" style={{ marginTop: 14 }}>
            <Text className="font-nunito-x text-content-dim" style={{ fontSize: 13 }}>
              Позже
            </Text>
          </Pressable>
        </>
      ) : (
        <>
          <View className="gap-2.5" style={{ marginTop: 16 }}>
            <Field
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setError(null);
              }}
              placeholder="Email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              editable={!submitting}
            />
            <Field
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
              placeholder="Пароль"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              editable={!submitting}
              onSubmitEditing={submitEmail}
            />
            {error && (
              <Text className="font-nunito-bold" style={{ color: COLORS.rose, fontSize: 13 }}>
                {error}
              </Text>
            )}
            <AuthButton
              label={submitting ? 'Создаём…' : 'Создать аккаунт'}
              bg={COLORS.lime}
              fg="#0a0e02"
              disabled={submitting}
              onPress={submitEmail}
            />
          </View>

          <Pressable onPress={() => setMode('choices')} className="self-center" style={{ marginTop: 14 }}>
            <Text className="font-nunito-x text-content-dim" style={{ fontSize: 13 }}>
              Назад
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

/**
 * Feed presentation: the same card centred over a dimmed backdrop. Tapping the
 * backdrop dismisses (treated as "later"), so it never traps the user.
 */
export function LinkAccountOverlay() {
  const { dismissLinkPrompt } = useLocalProfile();

  return (
    <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: 'rgba(5,5,7,0.72)' }}>
      <Pressable className="absolute inset-0" onPress={dismissLinkPrompt} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ width: '100%', paddingHorizontal: 22 }}
      >
        <LinkAccountCard />
      </KeyboardAvoidingView>
    </View>
  );
}

/** Shared styled text input (lime-on-dark, rounded). Reused by other forms. */
export function Field(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor={COLORS.textFaint}
      className="font-nunito-bold text-content"
      style={{
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        fontSize: 15,
        backgroundColor: COLORS.surface2,
        borderWidth: 1,
        borderColor: COLORS.line2,
      }}
      {...props}
    />
  );
}

function AuthButton({
  label,
  bg,
  fg,
  border,
  disabled,
  onPress,
}: {
  label: string;
  bg: string;
  fg: string;
  border?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="w-full items-center justify-center rounded-[16px]"
      style={{
        paddingVertical: 14,
        backgroundColor: bg,
        borderWidth: border ? 1 : 0,
        borderColor: COLORS.line2,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text className="font-nunito-x" style={{ color: fg, fontSize: 15 }}>
        {label}
      </Text>
    </Pressable>
  );
}
