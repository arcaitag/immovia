import * as React from "react";
import { AccessibilityInfo, Animated, Easing, Platform, type StyleProp, type ViewStyle } from "react-native";

/**
 * Animation wie auf der Website (src/app/globals.css): Einblenden von unten.
 * Ist «Bewegung reduzieren» eingeschaltet, steht alles sofort da.
 */

const nativeDriver = Platform.OS !== "web";

/** Wert von 0 nach 1, einmal beim Erscheinen. */
function useEntrance(duration: number, delay: number, easing: (value: number) => number, native = nativeDriver): Animated.Value {
  const [progress] = React.useState(() => new Animated.Value(0));
  React.useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduced) => {
        if (!active) return;
        if (reduced) {
          progress.setValue(1);
          return;
        }
        animation = Animated.timing(progress, { toValue: 1, duration, delay, easing, useNativeDriver: native });
        animation.start();
      });
    return () => {
      active = false;
      animation?.stop();
    };
  }, [progress, duration, delay, easing, native]);
  return progress;
}

const FADE_UP = Easing.bezier(0.22, 1, 0.36, 1);

/** Blendet den Inhalt ein und schiebt ihn 8 Punkte nach oben (wie «animate-fade-up»). */
export function FadeUp({ delay = 0, style, children }: { delay?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const progress = useEntrance(450, delay, FADE_UP);
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
