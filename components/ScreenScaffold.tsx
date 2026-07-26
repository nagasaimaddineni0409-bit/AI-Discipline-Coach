import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useBrandPalette } from '../hooks/useBrandPalette';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
}

/** Soft branded canvas used behind all main app screens. */
export function ScreenScaffold({ children, style }: Props) {
  const palette = useBrandPalette();

  return (
    <View style={[styles.root, { backgroundColor: palette.canvas[0] }, style]}>
      <LinearGradient
        colors={palette.canvas}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.orb,
          styles.orbTop,
          { backgroundColor: palette.orbPrimary, opacity: palette.orbPrimaryOpacity },
        ]}
        pointerEvents="none"
      />
      <View
        style={[
          styles.orb,
          styles.orbBottom,
          { backgroundColor: palette.orbSecondary, opacity: palette.orbSecondaryOpacity },
        ]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 220,
    height: 220,
    top: -70,
    right: -50,
  },
  orbBottom: {
    width: 180,
    height: 180,
    bottom: 40,
    left: -60,
  },
});
