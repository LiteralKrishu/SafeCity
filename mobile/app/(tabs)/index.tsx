import * as Location from 'expo-location';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/BrandLogo';
import { HomeEscapeTools } from '@/components/HomeEscapeTools';
import { LanguagePicker } from '@/components/language-picker';
import { useLocalization } from '@/i18n/localization-provider';
import { getCurrentLocation } from '@/services/backgroundLocation';
import { useMonitoring } from '@/services/MonitoringProvider';
import { useMonitorStore } from '@/store/monitorStore';
import { colors, radii, spacing } from '@/theme/tokens';

function EmergencyCard({
  emoji,
  number,
  label,
  phone,
  tone,
}: {
  emoji: string;
  number: string;
  label: string;
  phone: string;
  tone: 'national' | 'women';
}) {
  const { t } = useLocalization();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.call', { number, label: label.replace('\n', ' ') })}
      onPress={() => void Linking.openURL(`tel:${phone}`)}
      style={({ pressed }) => [
        styles.emergencyCard,
        tone === 'national' ? styles.nationalCard : styles.womenCard,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.emergencyEmoji}>{emoji}</Text>
      <View style={styles.emergencyCopy}>
        <Text style={styles.emergencyNumber}>{number}</Text>
        <Text style={styles.emergencyLabel}>{label}</Text>
      </View>
    </Pressable>
  );
}

function useCurrentPlaceLabel(
  location: { latitude: number; longitude: number; accuracy: number | null } | null,
) {
  const [label, setLabel] = useState('Current location');

  useEffect(() => {
    let active = true;
    void (async () => {
      let coordinates = location;
      if (!coordinates) {
        const fix = await getCurrentLocation().catch(() => null);
        if (fix) {
          coordinates = fix;
          useMonitorStore.getState().setTelemetry({
            location: {
              latitude: fix.latitude,
              longitude: fix.longitude,
              accuracy: fix.accuracy,
            },
            locationUpdatedAt: fix.timestamp,
          });
        }
      }
      if (!coordinates || !active) return;
      const results = await Location.reverseGeocodeAsync({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
      }).catch(() => []);
      if (!active) return;
      const address = results[0];
      const currentPlace =
        address?.district ??
        address?.city ??
        address?.subregion ??
        address?.region ??
        address?.name;
      if (currentPlace) {
        setLabel(currentPlace);
      } else {
        setLabel(
          `${coordinates.latitude.toFixed(3)}, ${coordinates.longitude.toFixed(3)}`,
        );
      }
    })();
    return () => {
      active = false;
    };
  }, [location?.latitude, location?.longitude]);

  return label;
}

export default function MonitorScreen() {
  const router = useRouter();
  const actions = useMonitoring();
  const { language, t } = useLocalization();
  const [busy, setBusy] = useState(false);
  const [stealthBusy, setStealthBusy] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const {
    sessionState,
    riskLevel,
    score,
    power,
    telemetry: { location, voiceTriggerStatus },
  } = useMonitorStore();
  const currentPlace = useCurrentPlaceLabel(location);

  const safetyLine = useMemo(() => {
    if (riskLevel === 'sos') return t('home.sosProgress');
    if (riskLevel === 'alert' || riskLevel === 'sos_pending') {
      return t('home.helpNeeded');
    }
    if (riskLevel === 'watch') return t('home.watching');
    return t('home.safeScore', {
      score: Math.max(0, 100 - Math.round(score * 100)),
    });
  }, [riskLevel, score, t]);

  const protectionLabel =
    sessionState === 'monitoring'
      ? t('home.status.active')
      : sessionState === 'paused'
        ? t('home.status.paused')
        : t('home.status.start');
  const protectionColor =
    sessionState === 'monitoring'
      ? colors.safe
      : sessionState === 'paused'
        ? colors.alert
        : colors.textMuted;
  const voiceSosReady =
    voiceTriggerStatus === 'listening' || voiceTriggerStatus === 'checking';

  const runMonitoringAction = async () => {
    setBusy(true);
    try {
      if (sessionState === 'idle') await actions.startMonitoring();
      else if (sessionState === 'paused') await actions.resumeMonitoring();
      else await actions.pauseMonitoring();
    } catch (error) {
      Alert.alert(
        t('home.updateErrorTitle'),
        error instanceof Error ? error.message : t('home.tryAgain'),
      );
    } finally {
      setBusy(false);
    }
  };

  const startStealthMode = async () => {
    if (stealthBusy) return;
    setStealthBusy(true);
    try {
      if (sessionState === 'idle') await actions.startMonitoring();
      else if (sessionState === 'paused') await actions.resumeMonitoring();
      useMonitorStore.getState().setStealthModeActive(true);
      router.push('/stealth-mode' as Href);
    } catch (error) {
      useMonitorStore.getState().setStealthModeActive(false);
      Alert.alert(
        'Stealth screen unavailable',
        error instanceof Error ? error.message : t('home.tryAgain'),
      );
    } finally {
      setStealthBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <View style={styles.brandIdentity}>
            <BrandLogo size={54} />
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>SafeCity 🇮🇳</Text>
              <View style={styles.locationRow}>
                <View style={styles.locationDot} />
                <Text numberOfLines={1} style={styles.locationText}>
                  {currentPlace} · {safetyLine}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('language.title')}
            onPress={() => setLanguagePickerVisible(true)}
            style={({ pressed }) => [styles.languageButton, pressed && styles.pressed]}
          >
            <Text style={styles.languageGlobe}>◉</Text>
            <Text style={styles.languageText}>{language.toUpperCase()}</Text>
            <Text style={styles.languageChevron}>⌄</Text>
          </Pressable>
        </View>

        {power.survivalMode ? (
          <View style={styles.batteryBanner}>
            <Text style={styles.batteryIcon}>▰</Text>
            <View style={styles.batteryCopy}>
              <Text style={styles.batteryTitle}>
                Low battery mode · {power.batteryLevel ?? 0}%
              </Text>
              <Text style={styles.batteryText}>GPS + SOS SMS kept ready</Text>
            </View>
            <Text style={styles.batteryBadge}>AUTO</Text>
          </View>
        ) : null}

        <View style={styles.sosPanel}>
          <Text style={styles.sosEyebrow}>{t('home.sosTitle')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.sosAccessibility')}
            accessibilityHint={t('home.sosHint')}
            delayLongPress={900}
            onLongPress={() => router.push('/sos-countdown' as Href)}
            style={({ pressed }) => [styles.sosOuter, pressed && styles.sosPressed]}
          >
            <View style={styles.sosMiddle}>
              <View style={styles.sosInner}>
                <Text style={styles.sosText}>SOS</Text>
                <Text style={styles.sosHint}>{t('home.sosHold')}</Text>
              </View>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              power.survivalMode
                ? 'Voice SOS is paused while low battery survival mode keeps GPS and SOS SMS ready.'
                : voiceSosReady
                ? 'Voice SOS is on. Shout HELP or BACHAO to start the SOS countdown.'
                : 'Voice SOS is off. Open Settings to turn it on.'
            }
            onPress={() => router.push('/(tabs)/settings' as Href)}
            style={({ pressed }) => [
              styles.voiceCallout,
              !voiceSosReady && styles.voiceCalloutOff,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.voiceIcon}>🎙</Text>
            <View style={styles.voiceCopy}>
              <Text style={styles.voiceTitle}>
                {power.survivalMode
                  ? 'Voice SOS paused'
                  : voiceSosReady
                  ? 'Shout “HELP” or “BACHAO”'
                  : 'Voice SOS is off'}
              </Text>
              <Text style={styles.voiceText}>
                {power.survivalMode
                  ? 'Low battery mode keeps GPS + SMS'
                  : voiceSosReady
                  ? 'Soft speech will not trigger SOS'
                  : 'Tap to turn it on in Settings'}
              </Text>
            </View>
            <Text style={styles.voiceChevron}>›</Text>
          </Pressable>
        </View>

        <HomeEscapeTools onStartStealth={() => void startStealthMode()} />

        <View style={styles.emergencyRow}>
          <EmergencyCard
            emoji="🚨"
            number="112"
            label={t('home.nationalHelpline')}
            phone="112"
            tone="national"
          />
          <EmergencyCard
            emoji="👩"
            number="1091"
            label={t('home.womenSafety')}
            phone="1091"
            tone="women"
          />
        </View>

        <View style={styles.protectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>BACKGROUND PROTECTION</Text>
            <Text style={styles.sectionHint}>
              {power.survivalMode ? 'GPS + SMS only' : 'Voice, fall and location'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${protectionLabel}. ${t('home.changeMonitoring')}`}
            disabled={busy}
            onPress={() => void runMonitoringAction()}
            style={({ pressed }) => [
              styles.protectionToggle,
              pressed && styles.pressed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color={protectionColor} size="small" />
            ) : (
              <>
                <View style={[styles.activeDot, { backgroundColor: protectionColor }]} />
                <Text style={[styles.activeText, { color: protectionColor }]}>
                  {protectionLabel}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open protection tests for voice, fall, GPS and phone AI"
          onPress={() => router.push('/protection-tests' as Href)}
          style={({ pressed }) => [styles.testsBanner, pressed && styles.pressed]}
        >
          <View style={styles.testsIcon}>
            <Text style={styles.testsIconText}>✓</Text>
          </View>
          <View style={styles.testsCopy}>
            <Text style={styles.testsTitle}>Protection tests</Text>
            <Text style={styles.testsDetail}>Voice · Fall & throw · GPS · Phone AI</Text>
          </View>
          <Text style={styles.testsChevron}>›</Text>
        </Pressable>

        <Text style={styles.disclaimer}>{t('home.sosDisclaimer')}</Text>
      </ScrollView>
      <LanguagePicker
        visible={languagePickerVisible}
        onClose={() => setLanguagePickerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.985 }],
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  brandIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandCopy: {
    flex: 1,
  },
  brandName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  locationDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.safe,
  },
  locationText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
  },
  languageButton: {
    minWidth: 76,
    minHeight: 46,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: spacing.sm,
  },
  languageGlobe: {
    color: colors.watch,
    fontSize: 13,
  },
  languageText: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 14,
  },
  languageChevron: {
    color: colors.text,
    fontSize: 17,
    marginTop: -4,
  },
  batteryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.watchBorder,
    backgroundColor: colors.watchSoft,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  batteryIcon: {
    color: colors.watch,
    fontSize: 20,
  },
  batteryCopy: {
    flex: 1,
  },
  batteryTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  batteryText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  batteryBadge: {
    color: colors.watch,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  sosPanel: {
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerPanel,
    alignItems: 'center',
    marginTop: spacing.md,
    padding: spacing.md,
    overflow: 'hidden',
  },
  sosEyebrow: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  sosOuter: {
    width: 188,
    height: 188,
    borderRadius: 94,
    backgroundColor: '#6E1E25',
    borderWidth: 6,
    borderColor: '#8D2830',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.danger,
    shadowOpacity: 0.58,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 4 },
    elevation: 16,
    marginTop: spacing.sm,
  },
  sosMiddle: {
    width: 164,
    height: 164,
    borderRadius: 82,
    backgroundColor: '#FF4550',
    borderWidth: 4,
    borderColor: '#F96971',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosInner: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: '#EF3540',
    borderWidth: 2,
    borderColor: '#FF6870',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.96 }],
  },
  sosText: {
    color: colors.white,
    fontSize: 39,
    fontWeight: '900',
    letterSpacing: 3,
  },
  sosHint: {
    color: colors.white,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    marginTop: 3,
    textAlign: 'center',
  },
  voiceCallout: {
    width: '100%',
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.safeDark,
    backgroundColor: colors.safeSoft,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  voiceCalloutOff: {
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  voiceIcon: {
    fontSize: 21,
  },
  voiceCopy: {
    flex: 1,
  },
  voiceTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  voiceText: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  voiceChevron: {
    color: colors.safe,
    fontSize: 25,
  },
  emergencyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  emergencyCard: {
    flex: 1,
    minHeight: 94,
    borderRadius: 22,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  nationalCard: {
    backgroundColor: '#C91F27',
    borderColor: '#EF5960',
  },
  womenCard: {
    backgroundColor: '#4031BD',
    borderColor: '#6556E7',
  },
  emergencyEmoji: {
    fontSize: 24,
  },
  emergencyCopy: {
    flex: 1,
  },
  emergencyNumber: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  emergencyLabel: {
    color: colors.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
  },
  protectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textSubtle,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.65,
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  protectionToggle: {
    minHeight: 38,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: spacing.md,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  testsBanner: {
    minHeight: 80,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  testsIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.safeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testsIconText: {
    color: colors.safe,
    fontSize: 20,
    fontWeight: '900',
  },
  testsCopy: {
    flex: 1,
  },
  testsTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  testsDetail: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  testsChevron: {
    color: colors.safe,
    fontSize: 28,
  },
  disclaimer: {
    color: colors.textSubtle,
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
  },
});
