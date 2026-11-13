import { Image } from "expo-image";
import * as React from "react";
import { AccessibilityInfo, Animated, Easing, Platform, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

/**
 * Animationen wie auf der Website (src/app/globals.css): Einblenden von unten, aufsteigende Wörter
 * im Titel und der gezeichnete Strich. Ist «Bewegung reduzieren» eingeschaltet, steht alles sofort da.
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
const WORD_RISE = Easing.bezier(0.2, 0.75, 0.25, 1);
const SWOOSH_DRAW = Easing.bezier(0.65, 0, 0.35, 1);

/** Blendet den Inhalt ein und schiebt ihn 8 Punkte nach oben (wie «animate-fade-up»). */
export function FadeUp({ delay = 0, style, children }: { delay?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const progress = useEntrance(450, delay, FADE_UP);
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Ein Wort, das aus einer Maske aufsteigt (wie «.hero-word»). */
export function RiseWord({ children, delay, style, lineHeight }: { children: string; delay: number; style: StyleProp<TextStyle>; lineHeight: number }) {
  const progress = useEntrance(700, delay, WORD_RISE);
  return (
    // Platz für Unterlängen (g) in der Maske, ohne die Zeilenhöhe zu verändern
    <View style={{ overflow: "hidden", paddingBottom: 6, marginBottom: -6 }}>
      <Animated.Text style={[style, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [lineHeight * 1.15, 0] }) }] }]}>{children}</Animated.Text>
    </View>
  );
}

/** Der Strich unter dem letzten Wort des Titels; er zeichnet sich von links nach rechts. */
export function Swoosh({ delay, style }: { delay: number; style?: StyleProp<ViewStyle> }) {
  // Breite ist eine Layout-Eigenschaft und läuft deshalb nicht über den nativen Treiber
  const progress = useEntrance(600, delay, SWOOSH_DRAW, false);
  const [width, setWidth] = React.useState(0);
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ height: 12 }, style]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Animated.View style={{ height: 12, overflow: "hidden", width: progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }}>
        {width > 0 ? <Image source={require("../../assets/images/swoosh.png")} style={{ width, height: 12 }} contentFit="fill" /> : null}
      </Animated.View>
    </View>
  );
}
