import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleProp, ViewStyle } from 'react-native';

/**
 * Entrance reveal: fade + slide-up (+ optional scale) on mount. Wrap any
 * content; pass `delay` to stagger a list/grid. Uses the native driver, so
 * it stays at 60fps on web and native.
 */
export function Reveal({
  children,
  delay = 0,
  from = 14,
  scale = false,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  from?: number;
  scale?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: 460,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, delay]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [from, 0] });
  const scaleV = progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });
  const transform = scale ? [{ translateY }, { scale: scaleV }] : [{ translateY }];

  return (
    <Animated.View style={[{ opacity: progress, transform }, style]}>{children}</Animated.View>
  );
}

/**
 * Micro-interaction for pressables: scales down on press and lifts on hover
 * (web). Spread `handlers` onto a Pressable and apply `style` to an
 * Animated.View wrapping the visual.
 */
export function usePressableScale(opts?: { pressScale?: number; hoverScale?: number }) {
  const pressScale = opts?.pressScale ?? 0.97;
  const hoverScale = opts?.hoverScale ?? 1.02;
  const scale = useRef(new Animated.Value(1)).current;

  const to = (value: number) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  const handlers = useMemo(
    () => ({
      onPressIn: () => to(pressScale),
      onPressOut: () => to(1),
      onHoverIn: () => to(hoverScale),
      onHoverOut: () => to(1),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return { handlers, style: { transform: [{ scale }] } as Animated.WithAnimatedObject<ViewStyle> };
}

/** Continuous gentle vertical float — returns a transform style. */
export function useFloat(distance = 6, duration = 2600) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration]);
  return { transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, -distance] }) }] };
}

/** Continuous soft pulse (scale) — for live/critical indicators. */
export function usePulse(min = 1, max = 1.25, duration = 1100) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, duration]);
  return { transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [min, max] }) }] };
}

/**
 * Any pressable wrapped with a press/hover scale micro-interaction.
 * Drop-in replacement for a <Pressable onPress style>...</Pressable>.
 */
export function Tappable({
  children,
  onPress,
  disabled,
  style,
  wrapperStyle,
  pressScale = 0.94,
  hoverScale = 1.04,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Applied to the animated wrapper (use for `flex: 1` layout children). */
  wrapperStyle?: StyleProp<ViewStyle>;
  pressScale?: number;
  hoverScale?: number;
}) {
  const { handlers, style: scale } = usePressableScale({ pressScale, hoverScale });
  return (
    <Animated.View style={[scale, wrapperStyle]}>
      <Pressable onPress={onPress} disabled={disabled} {...handlers} style={style}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** A tappable icon with press/hover scale (+ optional spin on press). */
export function PressableIcon({
  name,
  size = 22,
  color,
  onPress,
  style,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  color: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { handlers, style: scale } = usePressableScale({ pressScale: 0.82, hoverScale: 1.15 });
  return (
    <Pressable onPress={onPress} hitSlop={10} {...handlers} style={style}>
      <Animated.View style={scale}>
        <Ionicons name={name} size={size} color={color} />
      </Animated.View>
    </Pressable>
  );
}

/**
 * Animated counter — eases a number from 0 to `value` once it changes.
 * Returns the integer to render.
 */
export function useCountUp(value: number, duration = 900): number {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value, duration, anim]);

  return display;
}
