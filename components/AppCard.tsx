import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useBrandPalette } from '../hooks/useBrandPalette';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  /** Slightly richer wash for featured cards (e.g. score). */
  featured?: boolean;
}

export function AppCard({ children, style, featured = false }: Props) {
  const palette = useBrandPalette();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: palette.card[1],
          borderColor: featured ? palette.cardBorderFeatured : palette.cardBorder,
          shadowColor: '#0B1C24',
          shadowOpacity: palette.cardShadowOpacity,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
        },
        style,
      ]}
    >
      <LinearGradient
        colors={featured ? palette.cardFeatured : palette.card}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.accentBar,
          featured && styles.accentBarFeatured,
          { backgroundColor: featured ? palette.accentBarFeatured : palette.accentBar },
        ]}
      />
      <View style={styles.inner}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 14,
    bottom: 14,
    width: 3,
    borderRadius: 2,
  },
  accentBarFeatured: {
    width: 4,
  },
  inner: {
    padding: 16,
    paddingLeft: 18,
  },
});
