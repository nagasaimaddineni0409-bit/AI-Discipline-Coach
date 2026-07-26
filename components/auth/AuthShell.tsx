import React, { useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { DMSans_400Regular, DMSans_500Medium, DMSans_700Bold } from '@expo-google-fonts/dm-sans';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { AUTH } from '../../constants/theme';

interface Props {
  children: React.ReactNode;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}

export function AuthShell({
  children,
  eyebrow = 'Behavioural coaching',
  title = 'Discipline AI',
  subtitle = 'Measure behaviour. Build discipline.',
}: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const formWidth = Math.min(width - 40, wide ? 400 : 400);

  const [fontsLoaded] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  const brandOpacity = useSharedValue(0);
  const brandY = useSharedValue(18);
  const panelOpacity = useSharedValue(0);
  const panelY = useSharedValue(28);
  const orb = useSharedValue(0.32);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.title = 'Discipline AI';
    }
  }, []);

  useEffect(() => {
    brandOpacity.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    brandY.value = withTiming(0, { duration: 700, easing: Easing.out(Easing.cubic) });
    panelOpacity.value = withDelay(
      140,
      withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) }),
    );
    panelY.value = withDelay(
      140,
      withTiming(0, { duration: 650, easing: Easing.out(Easing.cubic) }),
    );
    orb.value = withRepeat(
      withTiming(0.5, { duration: 4800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [brandOpacity, brandY, panelOpacity, panelY, orb]);

  const brandStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandY.value }],
  }));

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    transform: [{ translateY: panelY.value }],
  }));

  const orbStyle = useAnimatedStyle(() => ({
    opacity: orb.value,
  }));

  const brandFont = fontsLoaded ? 'Fraunces_700Bold' : undefined;
  const bodyFont = fontsLoaded ? 'DMSans_400Regular' : undefined;
  const mediumFont = fontsLoaded ? 'DMSans_500Medium' : undefined;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[AUTH.ink, AUTH.inkMid, AUTH.tealDeep]}
        start={{ x: 0.08, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[styles.orb, styles.orbTop, orbStyle]} />
      <View style={[styles.orb, styles.orbBottom]} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, wide && styles.scrollWide]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.stage, wide && styles.stageWide]}>
            <Animated.View
              style={[styles.brandBlock, wide && styles.brandWide, brandStyle]}
            >
              <Text style={[styles.eyebrow, mediumFont ? { fontFamily: mediumFont } : null]}>
                {eyebrow}
              </Text>
              <Text style={[styles.brand, brandFont ? { fontFamily: brandFont } : null]}>
                {title}
              </Text>
              <Text style={[styles.subtitle, bodyFont ? { fontFamily: bodyFont } : null]}>
                {subtitle}
              </Text>
            </Animated.View>

            <Animated.View style={[styles.panel, { width: formWidth }, panelStyle]}>
              {children}
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH.ink,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 20,
  },
  scrollWide: {
    paddingHorizontal: 64,
  },
  stage: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'stretch',
  },
  stageWide: {
    maxWidth: 980,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 64,
  },
  brandBlock: {
    marginBottom: 28,
  },
  brandWide: {
    flex: 1,
    marginBottom: 0,
    paddingRight: 24,
    maxWidth: 460,
  },
  eyebrow: {
    color: AUTH.mist,
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 12,
    opacity: 0.88,
  },
  brand: {
    color: AUTH.cream,
    fontSize: 48,
    lineHeight: 52,
    letterSpacing: -1,
    marginBottom: 12,
  },
  subtitle: {
    color: AUTH.mist,
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 360,
    opacity: 0.92,
  },
  panel: {
    backgroundColor: AUTH.panelSolid,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: AUTH.panelBorder,
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 340,
    height: 340,
    top: -100,
    right: -80,
    backgroundColor: AUTH.teal,
  },
  orbBottom: {
    width: 280,
    height: 280,
    bottom: -60,
    left: -90,
    backgroundColor: AUTH.tealSoft,
    opacity: 0.2,
  },
});
