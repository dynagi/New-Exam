import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

export interface GradientTextProps {
  children: string;
  colors?: readonly string[];
  style?: StyleProp<TextStyle>;
}

/**
 * Native fallback: a solid-colored Text (true gradient text needs MaskedView).
 * The web build (GradientText.web.tsx) renders a real CSS gradient clip.
 */
export default function GradientText({ children, colors, style }: GradientTextProps) {
  const color = colors?.[0];
  return <Text style={[style, color ? { color } : null]}>{children}</Text>;
}
