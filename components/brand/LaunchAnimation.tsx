import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomBrandWave, TopBrandWave } from "@/components/brand/BrandWaves";

/* eslint-disable react-hooks/refs -- Animated.Value refs are stable animation handles. */
type LaunchAnimationProps = {
  onFinished: () => void;
};

const COLORS = {
  background: "#FBF7F0",
  ink: "#1E1B16",
  muted: "#6B6153",
  saffron: "#E96B35",
  gold: "#F4B83F",
  green: "#27864F",
};
const useNativeDriver = Platform.OS !== "web";

export function LaunchAnimation({ onFinished }: LaunchAnimationProps) {
  const insets = useSafeAreaInsets();
  const [reducedMotion, setReducedMotion] = useState<boolean | null>(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    }
    return null;
  });
  const waveOpacity = useRef(new Animated.Value(0)).current;
  const topWaveY = useRef(new Animated.Value(-12)).current;
  const bottomWaveY = useRef(new Animated.Value(12)).current;
  const sparkOpacity = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const sparkScale = useRef([0, 1, 2].map(() => new Animated.Value(0.55))).current;
  const illustrationOpacity = useRef(new Animated.Value(0)).current;
  const illustrationScale = useRef(new Animated.Value(0.92)).current;
  const wordmarkOpacity = useRef(new Animated.Value(0)).current;
  const wordmarkY = useRef(new Animated.Value(9)).current;
  const detailsOpacity = useRef(new Animated.Value(0)).current;
  const detailsY = useRef(new Animated.Value(6)).current;
  const loaderOpacity = useRef([0, 1, 2].map(() => new Animated.Value(1))).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion !== null) return;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReducedMotion)
      .catch(() => setReducedMotion(false));
  }, [reducedMotion]);

  useEffect(() => {
    if (reducedMotion === null) return;

    const timing = (value: Animated.Value, toValue: number, duration: number) =>
      Animated.timing(value, {
        toValue,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver,
      });

    const loaderLoop = Animated.loop(
      Animated.stagger(
        115,
        loaderOpacity.map((value) =>
          Animated.sequence([
            Animated.timing(value, { toValue: 0.35, duration: 210, useNativeDriver }),
            Animated.timing(value, { toValue: 1, duration: 210, useNativeDriver }),
          ]),
        ),
      ),
    );
    if (!reducedMotion) loaderLoop.start();

    const sequence = reducedMotion
      ? Animated.sequence([
          Animated.parallel([
            timing(waveOpacity, 1, 240),
            timing(illustrationOpacity, 1, 260),
            timing(illustrationScale, 1, 260),
            timing(wordmarkOpacity, 1, 260),
            timing(wordmarkY, 0, 260),
            timing(detailsOpacity, 1, 280),
            ...sparkOpacity.map((value) => timing(value, 1, 240)),
          ]),
          Animated.delay(90),
          Animated.timing(overlayOpacity, { toValue: 0, duration: 210, useNativeDriver }),
        ])
      : Animated.sequence([
          Animated.parallel([
            timing(waveOpacity, 1, 440),
            timing(topWaveY, 0, 520),
            timing(bottomWaveY, 0, 520),
            Animated.stagger(
              90,
              sparkOpacity.map((value, index) =>
                Animated.parallel([
                  timing(value, 1, 250),
                  timing(sparkScale[index]!, 1, 250),
                ]),
              ),
            ),
          ]),
          Animated.parallel([
            timing(illustrationOpacity, 1, 440),
            timing(illustrationScale, 1, 440),
          ]),
          Animated.parallel([
            timing(wordmarkOpacity, 1, 320),
            timing(wordmarkY, 0, 320),
          ]),
          Animated.parallel([
            timing(detailsOpacity, 1, 270),
            timing(detailsY, 0, 270),
          ]),
          Animated.delay(420),
          Animated.timing(overlayOpacity, {
            toValue: 0,
            duration: 350,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver,
          }),
        ]);

    sequence.start(({ finished }) => {
      loaderLoop.stop();
      if (finished) onFinished();
    });

    return () => {
      sequence.stop();
      loaderLoop.stop();
    };
  }, [
    bottomWaveY,
    detailsOpacity,
    detailsY,
    illustrationOpacity,
    illustrationScale,
    loaderOpacity,
    onFinished,
    overlayOpacity,
    reducedMotion,
    sparkOpacity,
    sparkScale,
    topWaveY,
    waveOpacity,
    wordmarkOpacity,
    wordmarkY,
  ]);

  return (
    <Animated.View
      accessible
      accessibilityRole="alert"
      accessibilityLabel="eKta Social, একতা. Your Community, Connected. Sanket Pixel Technologies."
      style={[styles.overlay, { opacity: overlayOpacity }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[styles.topWave, { opacity: waveOpacity, transform: [{ translateY: topWaveY }] }]}
      >
        <TopBrandWave />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.bottomWave, { opacity: waveOpacity, transform: [{ translateY: bottomWaveY }] }]}
      >
        <BottomBrandWave />
      </Animated.View>

      <View style={styles.brandLockup}>
        <View style={styles.illustrationArea}>
          <Animated.View
            accessible={false}
            style={{ opacity: illustrationOpacity, transform: [{ scale: illustrationScale }] }}
          >
            <Image
              source={require("@/assets/brand/handshake-unity-final.png")}
              style={styles.illustration}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
          <Animated.View style={[styles.spark, styles.sparkSaffron, { opacity: sparkOpacity[0], transform: [{ translateY: sparkScale[0]!.interpolate({ inputRange: [0.55, 1], outputRange: [8, 0] }) }, { scale: sparkScale[0]! }] }]} />
          <Animated.View style={[styles.spark, styles.sparkGold, { opacity: sparkOpacity[1], transform: [{ translateY: sparkScale[1]!.interpolate({ inputRange: [0.55, 1], outputRange: [8, 0] }) }, { scale: sparkScale[1]! }] }]} />
          <Animated.View style={[styles.spark, styles.sparkGreen, { opacity: sparkOpacity[2], transform: [{ translateY: sparkScale[2]!.interpolate({ inputRange: [0.55, 1], outputRange: [8, 0] }) }, { scale: sparkScale[2]! }] }]} />
        </View>

        <Animated.View style={{ opacity: wordmarkOpacity, transform: [{ translateY: wordmarkY }] }}>
          <Text style={styles.wordmark}>একতা</Text>
        </Animated.View>
        <Animated.View style={[styles.brandDetails, { opacity: detailsOpacity, transform: [{ translateY: detailsY }] }]}>
          <View style={styles.tricolorUnderline} accessibilityElementsHidden>
            <View style={[styles.underlineSegment, { backgroundColor: COLORS.saffron }]} />
            <View style={[styles.underlineSegment, { backgroundColor: COLORS.gold }]} />
            <View style={[styles.underlineSegment, { backgroundColor: COLORS.green }]} />
          </View>
          <Text style={styles.tagline}>Your Community, Connected</Text>
          <View style={styles.loadingDots} accessibilityLabel="Loading">
            {loaderOpacity.map((opacity, index) => (
              <Animated.View key={index} style={[styles.loadingDot, { opacity, backgroundColor: [COLORS.saffron, COLORS.gold, COLORS.green][index] }]} />
            ))}
          </View>
        </Animated.View>
      </View>

      <Text style={[styles.footer, { bottom: Math.max(insets.bottom + 18, 28) }]}>Sanket Pixel Technologies</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 999,
    elevation: 999,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  topWave: { position: "absolute", top: 0, left: 0, right: 0, height: 190 },
  bottomWave: { position: "absolute", left: 0, right: 0, bottom: 0, height: 190 },
  brandLockup: { alignItems: "center", justifyContent: "center", marginTop: -14, paddingHorizontal: 20 },
  illustrationArea: { width: 236, height: 177, alignItems: "center", justifyContent: "center", position: "relative" },
  illustration: { width: 236, height: 177 },
  spark: { position: "absolute", width: 10, height: 10, borderRadius: 5 },
  sparkSaffron: { top: 31, left: 13, backgroundColor: COLORS.saffron },
  sparkGold: { top: 11, right: 47, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold },
  sparkGreen: { bottom: 40, right: 8, width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.green },
  wordmark: { color: COLORS.ink, fontFamily: "NotoSerifBengaliBold", fontSize: 39, lineHeight: 54, textAlign: "center", marginTop: -1 },
  brandDetails: { alignItems: "center" },
  tricolorUnderline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 1 },
  underlineSegment: { width: 24, height: 3, borderRadius: 2 },
  tagline: { color: COLORS.muted, fontFamily: "HindSiliguriLatin", fontSize: 13, marginTop: 8, letterSpacing: 0.15 },
  loadingDots: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 19 },
  loadingDot: { width: 8, height: 8, borderRadius: 4 },
  footer: { position: "absolute", color: COLORS.muted, fontFamily: "HindSiliguriLatin", fontSize: 10, letterSpacing: 0.35 },
});
