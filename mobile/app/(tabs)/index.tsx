import { useMemo, useState } from 'react';
import { type Href, useRouter } from 'expo-router';
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

import { LanguagePicker } from '@/components/language-picker';
import { useLocalization } from '@/i18n/localization-provider';
import { useMonitoring } from '@/services/MonitoringProvider';
import { useMonitorStore } from '@/store/monitorStore';
import { colors, radii, spacing, type } from '@/theme/tokens';
import type { HealthState } from '@/types/domain';

type ProtectionIcon = 'microphone' | 'pulse' | 'location' | 'chip';

const statusForHealth = (state: HealthState) => {
  if (state === 'ready') return { key: 'home.status.active' as const, color: colors.safe };
  if (state === 'checking') return { key: 'home.status.checking' as const, color: colors.textMuted };
  if (state === 'degraded') return { key: 'home.status.limited' as const, color: colors.alert };
  return { key: 'home.status.offline' as const, color: colors.danger };
};

function BrandShield() {
  return (
    <View style={styles.brandShield} accessibilityElementsHidden>
      <View style={styles.shieldOutline}>
        <Text style={styles.shieldCheck}>✓</Text>
      </View>
    </View>
  );
}

function ProtectionGlyph({ icon }: { icon: ProtectionIcon }) {
  if (icon === 'microphone') {
    return (
      <View style={styles.glyphCanvas} accessibilityElementsHidden>
        <View style={styles.micBody} />
        <View style={styles.micCradle} />
        <View style={styles.micStem} />
        <View style={styles.micBase} />
      </View>
    );
  }

  if (icon === 'pulse') {
    return <Text style={styles.pulseGlyph}>⌁</Text>;
  }

  if (icon === 'location') {
    return (
      <View style={styles.glyphCanvas} accessibilityElementsHidden>
        <Text style={styles.locationGlyph}>△</Text>
        <View style={styles.locationNeedle} />
      </View>
    );
  }

  return (
    <View style={styles.chipGlyph} accessibilityElementsHidden>
      <View style={styles.chipCore} />
      <View style={[styles.chipPin, styles.chipPinTop]} />
      <View style={[styles.chipPin, styles.chipPinBottom]} />
      <View style={[styles.chipPin, styles.chipPinLeft]} />
      <View style={[styles.chipPin, styles.chipPinRight]} />
    </View>
  );
}

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

function ProtectionCard({
  icon,
  title,
  detail,
  status,
  statusOverride,
  onPress,
}: {
  icon: ProtectionIcon;
  title: string;
  detail: string;
  status: HealthState;
  statusOverride?: string;
  onPress: () => void;
}) {
  const { t } = useLocalization();
  const presentation = statusForHealth(status);
  const badgeColor = statusOverride ? colors.safe : presentation.color;
  const statusLabel = statusOverride ?? t(presentation.key);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${statusLabel}. ${detail}`}
      accessibilityHint="Opens live sensor details and diagnostics."
      onPress={onPress}
      style={({ pressed }) => [styles.protectionCard, pressed && styles.pressed]}
    >
      <View style={styles.protectionTopRow}>
        <View style={styles.iconWell}>
          <ProtectionGlyph icon={icon} />
        </View>
        <View style={[styles.statusBadge, { backgroundColor: colors.surfaceRaised }]}>
          <Text style={[styles.statusBadgeText, { color: badgeColor }]}>
            {statusLabel}
          </Text>
        </View>
      </View>
      <Text style={styles.protectionTitle}>{title}</Text>
      <Text style={styles.protectionDetail}>{detail}</Text>
      <Text style={styles.cardOpenHint}>Open live details ›</Text>
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label.replace('\n', ' ')}
      onPress={onPress}
      style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}
    >
      <Text style={styles.quickActionIcon}>{icon}</Text>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </Pressable>
  );
}

export default function MonitorScreen() {
  const router = useRouter();
  const actions = useMonitoring();
  const { language, t } = useLocalization();
  const [busy, setBusy] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const { sessionState, riskLevel, score, health } = useMonitorStore();

  const safetyLine = useMemo(() => {
    if (riskLevel === 'sos') return t('home.sosProgress');
    if (riskLevel === 'alert') return t('home.helpNeeded');
    if (riskLevel === 'watch') return t('home.watching');
    const safeScore = Math.max(0, 100 - Math.round(score * 100));
    return t('home.safeScore', { score: safeScore });
  }, [riskLevel, score, t]);

  const protectionLabel =
    sessionState === 'monitoring'
      ? t('home.status.active')
      : sessionState === 'paused'
        ? t('home.status.paused')
        : t('home.status.checking');
  const protectionColor =
    sessionState === 'monitoring'
      ? colors.safe
      : sessionState === 'paused'
        ? colors.alert
        : colors.textMuted;

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

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandRow}>
          <View style={styles.brandIdentity}>
            <BrandShield />
            <View style={styles.brandCopy}>
              <Text style={styles.brandName}>SafeCity 🇮🇳</Text>
              <View style={styles.locationRow}>
                <View style={styles.locationDot} />
                <Text style={styles.locationText}>{t('home.location')} · {safetyLine}</Text>
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

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.protectionHealth')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${protectionLabel}. ${t('home.changeMonitoring')}`}
            disabled={busy}
            onPress={() => void runMonitoringAction()}
            style={({ pressed }) => [styles.protectionToggle, pressed && styles.pressed]}
          >
            {busy ? (
              <ActivityIndicator color={protectionColor} size="small" />
            ) : (
              <>
                <View style={[styles.activeDot, { backgroundColor: protectionColor }]} />
                <Text style={[styles.activeText, { color: protectionColor }]}>{protectionLabel}</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.protectionGrid}>
          <View style={styles.protectionRow}>
            <ProtectionCard
              icon="microphone"
              title={t('home.screamTitle')}
              detail={t('home.screamDetail')}
              status={health.microphone}
              onPress={() => router.push('/sensor/audio' as Href)}
            />
            <ProtectionCard
              icon="pulse"
              title={t('home.fallTitle')}
              detail={t('home.fallDetail')}
              status={health.motion}
              onPress={() => router.push('/sensor/motion' as Href)}
            />
          </View>
          <View style={styles.protectionRow}>
            <ProtectionCard
              icon="location"
              title={t('home.locationTitle')}
              detail={t('home.locationDetail')}
              status={health.location}
              onPress={() => router.push('/sensor/location' as Href)}
            />
            <ProtectionCard
              icon="chip"
              title={t('home.aiTitle')}
              detail={t('home.aiDetail')}
              status={health.inference}
              statusOverride={t('home.status.private')}
              onPress={() => router.push('/sensor/ai' as Href)}
            />
          </View>
        </View>

        <View style={styles.quickActionRow}>
          <QuickAction
            icon="☎"
            label={t('home.fakeCall')}
            onPress={() => router.push('/fake-call' as Href)}
          />
          <QuickAction
            icon="◖))"
            label={t('home.siren')}
            onPress={() => router.push('/siren' as Href)}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open Safety Navigator"
          onPress={() => router.push('/safety-navigator' as Href)}
          style={({ pressed }) => [styles.navigatorBanner, pressed && styles.pressed]}
        >
          <View style={styles.navigatorBannerIcon}>
            <Text style={styles.navigatorBannerIconText}>⌖</Text>
          </View>
          <View style={styles.escapeBannerCopy}>
            <Text style={styles.escapeBannerTitle}>Safety Navigator</Text>
            <Text style={styles.escapeBannerDetail}>Use your real location to find nearby staffed public places</Text>
          </View>
          <Text style={styles.escapeBannerChevron}>›</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.escapeTools')}
          onPress={() => router.push('/escape-tools' as Href)}
          style={({ pressed }) => [styles.escapeBanner, pressed && styles.pressed]}
        >
          <View style={styles.escapeBannerIcon}>
            <Text style={styles.escapeBannerIconText}>↗</Text>
          </View>
          <View style={styles.escapeBannerCopy}>
            <Text style={styles.escapeBannerTitle}>{t('home.escapeTools')}</Text>
            <Text style={styles.escapeBannerDetail}>{t('home.escapeToolsDetail')}</Text>
          </View>
          <Text style={styles.escapeBannerChevron}>›</Text>
        </Pressable>

        <View style={styles.sosPanel}>
          <Text style={styles.sosEyebrow}>{t('home.sosTitle')}</Text>
          <View style={styles.sosMarker} />
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
          <Text style={styles.sosDisclaimer}>
            {t('home.sosDisclaimer')}
          </Text>
        </View>
      </ScrollView>
      <LanguagePicker visible={languagePickerVisible} onClose={() => setLanguagePickerVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  brandIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  brandShield: {
    width: 58,
    height: 58,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.safeDark,
    backgroundColor: colors.safeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldOutline: {
    width: 29,
    height: 34,
    borderColor: colors.safe,
    borderWidth: 3,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    borderBottomLeftRadius: 13,
    borderBottomRightRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shieldCheck: { color: colors.safe, fontSize: 17, fontWeight: '900', marginTop: -2 },
  brandCopy: { flex: 1 },
  brandName: { color: colors.text, fontSize: 25, fontWeight: '900' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 2 },
  locationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.safe },
  locationText: { color: colors.textMuted, fontSize: 14, flexShrink: 1 },
  languageButton: {
    minWidth: 84,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
  },
  languageGlobe: { color: colors.watch, fontSize: 14 },
  languageText: { color: colors.text, fontWeight: '900', fontSize: 16 },
  languageChevron: { color: colors.text, fontSize: 18, marginTop: -4 },
  emergencyRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  emergencyCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 25,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  nationalCard: {
    backgroundColor: '#C91F27',
    borderColor: '#EF5960',
    shadowColor: '#F13D45',
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  womenCard: {
    backgroundColor: '#4031BD',
    borderColor: '#6556E7',
    shadowColor: '#5847E2',
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  emergencyEmoji: { fontSize: 28 },
  emergencyCopy: { flex: 1 },
  emergencyNumber: { color: colors.white, fontSize: 24, fontWeight: '900', fontVariant: ['tabular-nums'] },
  emergencyLabel: { color: colors.white, fontSize: 13, lineHeight: 17, fontWeight: '700' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: { color: colors.textSubtle, fontSize: 14, fontWeight: '900', letterSpacing: 0.65, flex: 1 },
  protectionToggle: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  activeText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.6 },
  protectionGrid: { gap: spacing.sm },
  protectionRow: { flexDirection: 'row', gap: spacing.sm },
  protectionCard: {
    flex: 1,
    minHeight: 147,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  protectionTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  iconWell: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: colors.safeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: { borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 5 },
  statusBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.45 },
  protectionTitle: { color: colors.text, fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 12 },
  protectionDetail: { color: colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 5 },
  cardOpenHint: { color: colors.safe, fontSize: 10, fontWeight: '900', marginTop: 8 },
  glyphCanvas: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  micBody: { width: 10, height: 17, borderRadius: 6, borderWidth: 2, borderColor: colors.safe, marginTop: -6 },
  micCradle: {
    position: 'absolute',
    top: 10,
    width: 18,
    height: 11,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderColor: colors.safe,
    borderBottomLeftRadius: 9,
    borderBottomRightRadius: 9,
  },
  micStem: { position: 'absolute', top: 21, width: 2, height: 5, backgroundColor: colors.safe },
  micBase: { position: 'absolute', bottom: 0, width: 12, height: 2, borderRadius: 1, backgroundColor: colors.safe },
  pulseGlyph: { color: colors.safe, fontSize: 34, lineHeight: 38, transform: [{ rotate: '-8deg' }] },
  locationGlyph: { color: colors.safe, fontSize: 33, lineHeight: 35, transform: [{ rotate: '-16deg' }] },
  locationNeedle: { position: 'absolute', width: 2, height: 20, backgroundColor: colors.safe, transform: [{ rotate: '21deg' }] },
  chipGlyph: { width: 25, height: 25, borderWidth: 2, borderRadius: 4, borderColor: colors.safe, alignItems: 'center', justifyContent: 'center' },
  chipCore: { width: 11, height: 11, borderWidth: 2, borderRadius: 2, borderColor: colors.safe },
  chipPin: { position: 'absolute', backgroundColor: colors.safe },
  chipPinTop: { width: 2, height: 5, top: -6 },
  chipPinBottom: { width: 2, height: 5, bottom: -6 },
  chipPinLeft: { width: 5, height: 2, left: -6 },
  chipPinRight: { width: 5, height: 2, right: -6 },
  quickActionRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  quickAction: {
    flex: 1,
    minHeight: 84,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  quickActionIcon: { color: colors.textMuted, fontSize: 21 },
  quickActionLabel: { color: colors.text, fontSize: 14, lineHeight: 19, textAlign: 'center', fontWeight: '900', flexShrink: 1 },
  escapeBanner: {
    minHeight: 82,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.safeDark,
    backgroundColor: colors.safeSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  navigatorBanner: {
    minHeight: 82,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.watchBorder,
    backgroundColor: colors.watchSoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  navigatorBannerIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.watch, alignItems: 'center', justifyContent: 'center' },
  navigatorBannerIconText: { color: colors.black, fontSize: 25, fontWeight: '900' },
  escapeBannerIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.safe, alignItems: 'center', justifyContent: 'center' },
  escapeBannerIconText: { color: colors.black, fontSize: 24, fontWeight: '900' },
  escapeBannerCopy: { flex: 1 },
  escapeBannerTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  escapeBannerDetail: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  escapeBannerChevron: { color: colors.safe, fontSize: 30 },
  sosPanel: {
    minHeight: 378,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerPanel,
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    overflow: 'hidden',
  },
  sosEyebrow: { color: colors.danger, fontSize: 13, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' },
  sosMarker: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.danger, marginTop: 24, marginBottom: -4 },
  sosOuter: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#6E1E25',
    borderWidth: 7,
    borderColor: '#8D2830',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.danger,
    shadowOpacity: 0.58,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 4 },
    elevation: 16,
  },
  sosMiddle: {
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: '#FF4550',
    borderWidth: 5,
    borderColor: '#F96971',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosInner: {
    width: 169,
    height: 169,
    borderRadius: 85,
    backgroundColor: '#EF3540',
    borderWidth: 2,
    borderColor: '#FF6870',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosPressed: { opacity: 0.88, transform: [{ scale: 0.96 }] },
  sosText: { color: colors.white, fontSize: 43, fontWeight: '900', letterSpacing: 3 },
  sosHint: { color: colors.white, fontSize: 11, lineHeight: 16, fontWeight: '900', marginTop: 5, textAlign: 'center', paddingHorizontal: 16 },
  sosDisclaimer: { color: colors.textSubtle, fontSize: 10, lineHeight: 15, textAlign: 'center', marginTop: spacing.lg, maxWidth: 310 },
});
