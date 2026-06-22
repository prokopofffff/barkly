// NativeWind v4 only maps `className` → `style` for React Native core components
// (View/Text/Pressable/…). Third-party components such as expo-linear-gradient
// must be registered explicitly, otherwise their `className` is silently dropped.
//
// This bit us in the floating BottomNav: its `flex-row absolute bottom-0` lived
// only in className, so it collapsed into a static vertical column that stole
// layout height from the feed (breaking FlashList paging). Registering the
// interop here, once, makes className work on every LinearGradient in the app.
import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

cssInterop(LinearGradient, { className: 'style' });
