import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * Soft animated mesh-gradient backdrop: three slow-drifting colored blobs.
 * Cross-platform (Animated + expo-linear-gradient), native-driver, low
 * opacity so foreground content stays readable. Render it absolutely behind
 * page content.
 */
export function Aurora({
  intensity = 1,
  scrollY,
}: {
  intensity?: number;
  scrollY?: Animated.Value;
}) {
  const { colors } = useTheme();
  const { width, height } = Dimensions.get('window');
  const size = Math.max(width, height) * 0.9;

  const blobs = [
    { color: colors.mesh[0], x: -size * 0.25, y: -size * 0.2, dur: 9000, dx: 40, dy: 30, parallax: 60 },
    { color: colors.mesh[1], x: width - size * 0.6, y: height * 0.1, dur: 11000, dx: -50, dy: 40, parallax: -90 },
    { color: colors.mesh[2], x: width * 0.1, y: height - size * 0.55, dur: 13000, dx: 35, dy: -45, parallax: 120 },
  ];

  return (
    <View style={[StyleSheet.absoluteFill, { opacity: intensity, overflow: 'hidden' }]} pointerEvents="none">
      {blobs.map((b, i) => (
        <Blob key={i} {...b} size={size} scrollY={scrollY} />
      ))}
    </View>
  );
}

function Blob({
  color,
  x,
  y,
  size,
  dur,
  dx,
  dy,
  parallax,
  scrollY,
}: {
  color: string;
  x: number;
  y: number;
  size: number;
  dur: number;
  dx: number;
  dy: number;
  parallax: number;
  scrollY?: Animated.Value;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, dur]);

  const translateX = t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
  const driftY = t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] });
  const scale = t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  // Scroll-driven parallax (each blob drifts at a different rate).
  const parY = scrollY
    ? scrollY.interpolate({ inputRange: [0, 1200], outputRange: [0, parallax], extrapolate: 'clamp' })
    : 0;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        transform: [{ translateX }, { translateY: driftY }, { translateY: parY }, { scale }],
      }}
    >
      <LinearGradient
        colors={[color, 'transparent']}
        start={{ x: 0.3, y: 0.2 }}
        end={{ x: 0.8, y: 1 }}
        style={{ flex: 1, borderRadius: size / 2 }}
      />
    </Animated.View>
  );
}
