import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/Card';
import { LanguagePicker } from '@/components/language-picker';
import { Screen } from '@/components/Screen';
import {
  addContact,
  defaultSettings,
  eraseAllLocalData,
  listContacts,
  readSettings,
  removeContact,
  writeSettings,
} from '@/db/repository';
import { useLocalization } from '@/i18n/localization-provider';
import type { TranslationKey } from '@/i18n/translations';
import { getLanguageDisplayName } from '@/i18n/types';
import { resetDeviceId } from '@/services/deviceIdentity';
import { eraseEvidenceVault } from '@/services/evidence';
import { useMonitoring } from '@/services/MonitoringProvider';
import {
  enableVoiceTrigger,
  getPersistentVoiceTriggerState,
  isPersistentVoiceTriggerAvailable,
  openVoiceTriggerOverlaySettings,
} from '@/services/persistent-voice-trigger';
import {
  isRiskServiceConfigured,
  resetAnonymousRiskIdentity,
} from '@/services/riskZones';
import { useMonitorStore } from '@/store/monitorStore';
import {
  PRIVACY_NOTICE_VERSION,
  TERMS_VERSION,
  legalConfigurationComplete,
} from '@/legal/content';
import { colors, radii, spacing, type } from '@/theme/tokens';
import { type AppearancePreference, useTheme } from '@/theme/theme-provider';
import type { AppSettings, EmergencyContact, VoiceTriggerStatus } from '@/types/domain';

const voiceStatusKeys = {
  disabled: 'settings.voiceStatus.disabled',
  checking: 'settings.voiceStatus.checking',
  listening: 'settings.voiceStatus.listening',
  unavailable: 'settings.voiceStatus.unavailable',
  error: 'settings.voiceStatus.error',
} satisfies Record<VoiceTriggerStatus, TranslationKey>;

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const monitoring = useMonitoring();
  const { language, preference, t } = useLocalization();
  const { appearance, setAppearance } = useTheme();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [erasing, setErasing] = useState(false);
  const [languagePickerVisible, setLanguagePickerVisible] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [monitoringBusy, setMonitoringBusy] = useState(false);
  const [baselineBusy, setBaselineBusy] = useState(false);
  const sessionState = useMonitorStore((state) => state.sessionState);
  const behaviorBaseline = useMonitorStore(
    (state) => state.telemetry.behaviorBaseline,
  );
  const voiceTriggerStatus = useMonitorStore(
    (state) => state.telemetry.voiceTriggerStatus,
  );

  const refresh = useCallback(async () => {
    const [storedSettings, storedContacts] = await Promise.all([readSettings(db), listContacts(db)]);
    let synchronizedSettings = storedSettings;
    if (storedSettings.voiceKeywordEnabled && isPersistentVoiceTriggerAvailable()) {
      const persistentState = await getPersistentVoiceTriggerState();
      if (persistentState.configured && !persistentState.enabled) {
        synchronizedSettings = { ...storedSettings, voiceKeywordEnabled: false };
        await writeSettings(db, synchronizedSettings);
      }
    }
    setSettings(synchronizedSettings);
    setContacts(storedContacts);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const save = async (next: AppSettings) => {
    const synchronized = { ...next, language: preference };
    await writeSettings(db, synchronized);
    setSettings(synchronized);
  };

  const addNewContact = async () => {
    if (!name.trim() || phone.trim().length < 5) {
      Alert.alert(t('settings.contactNeeded'), t('settings.contactNeededBody'));
      return;
    }
    await addContact(db, name, phone);
    setName('');
    setPhone('');
    await refresh();
  };

  const updateVoiceTrigger = async (enabled: boolean) => {
    setVoiceBusy(true);
    const previousSettings = settings;
    try {
      if (enabled) {
        useMonitorStore.getState().setTelemetry({ voiceTriggerStatus: 'checking' });
        const preparation = await enableVoiceTrigger(
          useMonitorStore.getState().sessionState !== 'monitoring',
        );
        if (!preparation.ready) {
          await monitoring.setVoiceTriggerEnabled(false);
          setSettings(previousSettings);
          Alert.alert(t('settings.voiceSetupTitle'), preparation.message);
          return;
        }
        const nextSettings = { ...settings, voiceKeywordEnabled: true };
        await writeSettings(db, { ...nextSettings, language: preference });
        setSettings({ ...nextSettings, language: preference });
        await monitoring.setVoiceTriggerEnabled(true);
        if (!preparation.fullScreenAllowed) {
          Alert.alert(
            'Allow the SOS countdown overlay',
            'Voice SOS is on. Allow full-screen alerts so the 10-second countdown can open immediately over the lock screen. Without it, Android may show a prominent notification instead.',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Open settings',
                onPress: () => void openVoiceTriggerOverlaySettings(),
              },
            ],
          );
        }
        return;
      }
      await monitoring.setVoiceTriggerEnabled(false);
      const nextSettings = { ...settings, voiceKeywordEnabled: false };
      try {
        await writeSettings(db, { ...nextSettings, language: preference });
      } finally {
        setSettings({ ...nextSettings, language: preference });
      }
    } catch (error) {
      if (enabled) {
        await monitoring.setVoiceTriggerEnabled(false).catch(() => undefined);
        await writeSettings(db, previousSettings).catch(() => undefined);
        setSettings(previousSettings);
      }
      Alert.alert(
        t('settings.voiceSetupTitle'),
        error instanceof Error ? error.message : t('settings.voiceSetupError'),
      );
    } finally {
      setVoiceBusy(false);
    }
  };

  const updateMonitoring = async (enabled: boolean) => {
    setMonitoringBusy(true);
    const previousSettings = settings;
    try {
      if (enabled) {
        if (sessionState === 'paused') {
          await monitoring.resumeMonitoring();
        } else if (sessionState === 'idle') {
          await monitoring.startMonitoring();
        }
      } else {
        await monitoring.stopMonitoring();
      }
      const nextSettings = { ...settings, monitoringEnabled: enabled };
      await writeSettings(db, { ...nextSettings, language: preference });
      setSettings({ ...nextSettings, language: preference });
    } catch (error) {
      await writeSettings(db, previousSettings).catch(() => undefined);
      setSettings(previousSettings);
      Alert.alert(
        t('settings.monitoringErrorTitle'),
        error instanceof Error ? error.message : t('home.tryAgain'),
      );
    } finally {
      setMonitoringBusy(false);
    }
  };

  const applyBehaviorBaseline = async (enabled: boolean) => {
    setBaselineBusy(true);
    const previousSettings = settings;
    const nextSettings = { ...settings, behaviorBaselineEnabled: enabled };
    try {
      await writeSettings(db, { ...nextSettings, language: preference });
      setSettings({ ...nextSettings, language: preference });
      await monitoring.setBehaviorBaselineEnabled(enabled);
    } catch {
      await writeSettings(db, previousSettings).catch(() => undefined);
      setSettings(previousSettings);
      await monitoring
        .setBehaviorBaselineEnabled(previousSettings.behaviorBaselineEnabled)
        .catch(() => undefined);
      Alert.alert('Could not update deviation detection', t('home.tryAgain'));
    } finally {
      setBaselineBusy(false);
    }
  };

  const updateBehaviorBaseline = (enabled: boolean) => {
    if (enabled) {
      void applyBehaviorBaseline(true);
      return;
    }
    Alert.alert(
      t('settings.baselineTurnOffTitle'),
      t('settings.baselineTurnOffBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.baselineOff'),
          style: 'destructive',
          onPress: () => void applyBehaviorBaseline(false),
        },
      ],
    );
  };

  const clearBehaviorBaseline = () => {
    Alert.alert(
      t('settings.baselineClearTitle'),
      t('settings.baselineClearBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.baselineClear'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBaselineBusy(true);
              try {
                await monitoring.setBehaviorBaselineEnabled(false);
                await monitoring.setBehaviorBaselineEnabled(true);
              } catch {
                Alert.alert(
                  'Could not clear the learned baseline',
                  t('home.tryAgain'),
                );
              } finally {
                setBaselineBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const updateAnonymousRiskSharing = (enabled: boolean) => {
    if (!enabled) {
      void (async () => {
        await db.runAsync('DELETE FROM anonymous_risk_queue');
        await resetAnonymousRiskIdentity();
        await save({
          ...settings,
          anonymousRiskSharingEnabled: false,
          anonymousRiskConsentGrantedAt: null,
        });
      })();
      return;
    }
    if (!isRiskServiceConfigured()) {
      Alert.alert(
        'Risk service is not connected',
        'Add the SafeCity risk API address to the production app configuration before enabling anonymous community reporting.',
      );
      return;
    }
    Alert.alert(
      'Share anonymous risk signals?',
      'After an SOS, SafeCity may send an approximately 500-metre area, an hourly time bucket, and the trigger type. It never sends your exact location, evidence, contacts, or a stable device ID. You can turn this off and clear queued reports at any time.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Allow anonymous sharing',
          onPress: () =>
            void save({
              ...settings,
              anonymousRiskSharingEnabled: true,
              anonymousRiskConsentGrantedAt: new Date().toISOString(),
            }),
        },
      ],
    );
  };

  const withdrawConsentAndErase = () => {
    Alert.alert(
      t('settings.withdrawAlertTitle'),
      t('settings.withdrawAlertBody'),
      [
        { text: t('settings.keepData'), style: 'cancel' },
        {
          text: t('settings.withdrawAndErase'),
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setErasing(true);
              try {
                await monitoring.setVoiceTriggerEnabled(false);
                await monitoring.stopMonitoring();
                await eraseEvidenceVault();
                await eraseAllLocalData(db);
                await resetDeviceId();
                await resetAnonymousRiskIdentity();
                router.replace('/onboarding');
                Alert.alert(
                  t('settings.withdrawnTitle'),
                  t('settings.withdrawnBody'),
                );
              } catch {
                Alert.alert(
                  t('settings.eraseErrorTitle'),
                  t('settings.eraseErrorBody'),
                );
              } finally {
                setErasing(false);
              }
            })();
          },
        },
      ],
    );
  };

  const activeLanguage = getLanguageDisplayName(language, language);

  return (
    <Screen eyebrow={t('settings.eyebrow')} title={t('settings.title')}>
      <Text style={styles.sectionLabel}>{t('settings.languageSection')}</Text>
      <Card title={t('settings.languageTitle')} subtitle={t('settings.languageDetail')}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.changeLanguage')}
          onPress={() => setLanguagePickerVisible(true)}
          style={({ pressed }) => [styles.languageRow, pressed && styles.pressed]}
        >
          <View style={styles.languageIcon}>
            <Text style={styles.languageIconText}>文</Text>
          </View>
          <View style={styles.languageCopy}>
            <Text style={styles.languageValue}>
              {preference === 'system' ? t('language.system') : activeLanguage}
            </Text>
            <Text style={styles.languageCurrent}>{t('language.current', { language: activeLanguage })}</Text>
          </View>
          <Text style={styles.languageChevron}>›</Text>
        </Pressable>
      </Card>

      <Text style={styles.sectionLabel}>Appearance</Text>
      <Card title="App theme" subtitle="Follow your phone automatically or choose a theme for SafeCity.">
        <View style={styles.appearanceRow}>
          {(['system', 'dark', 'light'] as AppearancePreference[]).map((option) => {
            const active = appearance === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => void setAppearance(option)}
                style={({ pressed }) => [styles.appearanceOption, active && styles.appearanceOptionActive, pressed && styles.pressed]}
              >
                <Text style={styles.appearanceIcon}>{option === 'system' ? '◐' : option === 'dark' ? '☾' : '☀'}</Text>
                <Text style={[styles.appearanceText, active && styles.appearanceTextActive]}>{option[0]?.toUpperCase()}{option.slice(1)}</Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Text style={styles.sectionLabel}>{t('settings.inferenceSection')}</Text>
      <Card
        title={t('settings.monitoringTitle')}
        subtitle={t('settings.monitoringDetail')}
      >
        <SettingRow
          title={t('settings.monitoringSwitchTitle')}
          description={t('settings.monitoringSwitchDetail')}
          value={settings.monitoringEnabled}
          disabled={monitoringBusy}
          onChange={(monitoringEnabled) => void updateMonitoring(monitoringEnabled)}
        />
      </Card>

      <Card
        title={t('settings.aiTitle')}
        subtitle={t('settings.aiDetail')}
      >
        <View style={styles.localAiList}>
          <View style={styles.localAiRow}>
            <Text style={styles.localAiMark}>✓</Text>
            <Text style={styles.localAiText}>{t('settings.aiOffline')}</Text>
          </View>
          <View style={styles.localAiRow}>
            <Text style={styles.localAiMark}>✓</Text>
            <Text style={styles.localAiText}>{t('settings.aiMemory')}</Text>
          </View>
          <View style={styles.localAiRow}>
            <Text style={styles.localAiMark}>✓</Text>
            <Text style={styles.localAiText}>{t('settings.aiAdaptive')}</Text>
          </View>
        </View>
      </Card>

      <Card
        title={t('settings.baselineTitle')}
        subtitle={t('settings.baselineDetail')}
      >
        <SettingRow
          title={t('settings.baselineSwitchTitle')}
          description={t('settings.baselineSwitchDetail')}
          value={settings.behaviorBaselineEnabled}
          disabled={baselineBusy}
          onChange={updateBehaviorBaseline}
        />
        <View style={styles.baselineMetrics}>
          <View style={styles.baselineMetric}>
            <Text style={styles.baselineMetricLabel}>
              {t('settings.baselineStatus')}
            </Text>
            <Text style={styles.baselineMetricValue}>
              {behaviorBaseline.phase === 'ready'
                ? t('settings.baselineReady')
                : behaviorBaseline.phase === 'limited'
                  ? t('settings.baselineLimited')
                  : behaviorBaseline.phase === 'warming'
                    ? t('settings.baselineWarming', {
                        progress: Math.round(behaviorBaseline.progress * 100),
                      })
                    : t('settings.baselineOff')}
            </Text>
          </View>
          <View style={styles.baselineMetric}>
            <Text style={styles.baselineMetricLabel}>
              {t('settings.baselineSamples')}
            </Text>
            <Text style={styles.baselineMetricValue}>
              {behaviorBaseline.sampleCount} · {behaviorBaseline.dayCount}/3 days
            </Text>
          </View>
          <View style={styles.baselineMetric}>
            <Text style={styles.baselineMetricLabel}>
              {t('settings.baselineDeviation')}
            </Text>
            <Text style={styles.baselineMetricValue}>
              {behaviorBaseline.ready
                ? `${Math.round(behaviorBaseline.deviationScore * 100)}%`
                : '—'}
            </Text>
          </View>
        </View>
        {settings.behaviorBaselineEnabled &&
        behaviorBaseline.sampleCount > 0 ? (
          <View style={styles.baselineAction}>
            <ActionButton
              label={t('settings.baselineClear')}
              loading={baselineBusy}
              variant="secondary"
              onPress={clearBehaviorBaseline}
            />
          </View>
        ) : null}
      </Card>

      <Card
        title={t('settings.voiceTitle')}
        subtitle={t('settings.voiceDetail')}
      >
        <SettingRow
          title={t('settings.voiceSwitchTitle')}
          description={t('settings.voiceSwitchDetail')}
          value={settings.voiceKeywordEnabled}
          disabled={voiceBusy}
          onChange={(voiceKeywordEnabled) => void updateVoiceTrigger(voiceKeywordEnabled)}
        />
        <View style={styles.voiceStatusRow}>
          <View
            style={[
              styles.voiceStatusDot,
              voiceTriggerStatus === 'listening' && styles.voiceStatusDotReady,
            ]}
          />
          <Text style={styles.voiceStatusText}>
            {t(voiceStatusKeys[voiceTriggerStatus])}
          </Text>
        </View>
        <Text style={styles.voiceLimit}>{t('settings.voiceLimit')}</Text>
      </Card>

      <Text style={styles.sectionLabel}>{t('settings.contactsSection')}</Text>
      <Card subtitle={t('settings.contactsDetail')}>
        {contacts.map((contact) => (
          <View key={contact.id} style={styles.contactRow}>
            <View style={styles.contactCopy}>
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactPhone}>{contact.phone}</Text>
            </View>
            <Text style={styles.contactReady}>✓ {t('settings.ready')}</Text>
            <Pressable
              accessibilityLabel={t('settings.removeContact', { name: contact.name })}
              onPress={() => void removeContact(db, contact.id).then(refresh)}
            >
              <Text style={styles.remove}>×</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.form}>
          <TextInput
            placeholder={t('settings.name')}
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          <TextInput
            placeholder={t('settings.phone')}
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
          />
          <ActionButton label={t('settings.addContact')} variant="secondary" onPress={() => void addNewContact()} />
        </View>
      </Card>

      <Text style={styles.sectionLabel}>{t('settings.privacySection')}</Text>
      <Card>
        <SettingRow
          title={t('settings.discreetTitle')}
          description={t('settings.discreetDetail')}
          value={settings.discreetMode}
          onChange={(discreetMode) => void save({ ...settings, discreetMode })}
        />
        <SettingRow
          title={t('settings.backgroundTitle')}
          description={t('settings.backgroundDetail')}
          value={settings.backgroundLocation}
          onChange={(backgroundLocation) => void save({ ...settings, backgroundLocation })}
        />
        <SettingRow
          title="Anonymous community risk zones"
          description="Optionally contribute a coarse area after SOS. Exact GPS, evidence, contacts, and stable identifiers never leave this phone."
          value={settings.anonymousRiskSharingEnabled}
          onChange={updateAnonymousRiskSharing}
        />
        <View style={styles.retentionRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>{t('settings.retentionTitle')}</Text>
            <Text style={styles.settingDescription}>{t('settings.retentionDetail')}</Text>
          </View>
          <TextInput
            accessibilityLabel={t('settings.retentionAccessibility')}
            keyboardType="number-pad"
            value={String(settings.retentionDays)}
            onChangeText={(value) => {
              const retentionDays = Math.min(Math.max(Number(value) || 1, 1), 90);
              setSettings((current) => ({ ...current, retentionDays }));
            }}
            onBlur={() => void writeSettings(db, { ...settings, language: preference })}
            style={styles.daysInput}
          />
        </View>
      </Card>

      <Text style={styles.sectionLabel}>{t('settings.permissionsSection')}</Text>
      <Card
        title={t('settings.sensorTitle')}
        subtitle={t('settings.sensorDetail')}
      >
        <View style={styles.cardAction}>
          <ActionButton
            label={t('settings.reviewPermissions')}
            variant="secondary"
            onPress={() => router.push('/onboarding')}
          />
        </View>
      </Card>

      <Text style={styles.sectionLabel}>{t('settings.legalSection')}</Text>
      <Card
        title={t('settings.privacyControls')}
        subtitle={
          legalConfigurationComplete
            ? t('settings.legalConfigured', { privacy: PRIVACY_NOTICE_VERSION, terms: TERMS_VERSION })
            : t('settings.legalPrototype')
        }
      >
        <View style={styles.legalActions}>
          <ActionButton
            label={t('settings.privacyNotice')}
            variant="secondary"
            onPress={() => router.push('/legal/privacy')}
          />
          <ActionButton
            label={t('settings.terms')}
            variant="secondary"
            onPress={() => router.push('/legal/terms')}
          />
          <ActionButton
            label={t('settings.dataRights')}
            variant="secondary"
            onPress={() => router.push('/legal/rights')}
          />
        </View>
        <View style={styles.erasureBlock}>
          <Text style={styles.erasureTitle}>{t('settings.withdrawTitle')}</Text>
          <Text style={styles.erasureBody}>
            {t('settings.withdrawDetail')}
          </Text>
          <ActionButton
            label={t('settings.withdrawButton')}
            variant="danger"
            onPress={withdrawConsentAndErase}
            loading={erasing}
          />
        </View>
      </Card>

      <Text style={styles.sectionLabel}>{t('settings.limitsSection')}</Text>
      <Card>
        <Text style={styles.warningTitle}>{t('settings.limitsTitle')}</Text>
        <Text style={styles.warningBody}>
          {t('settings.limitsBody')}
        </Text>
      </Card>
      <LanguagePicker visible={languagePickerVisible} onClose={() => setLanguagePickerVisible(false)} />
    </Screen>
  );
}

function SettingRow({
  title,
  description,
  value,
  disabled = false,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingCopy}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.safeSoft }}
        thumbColor={value ? colors.safe : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.72 },
  sectionLabel: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: type.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  languageRow: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  languageIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.safeSoft, alignItems: 'center', justifyContent: 'center' },
  languageIconText: { color: colors.safe, fontSize: 19, fontWeight: '900' },
  languageCopy: { flex: 1 },
  languageValue: { color: colors.text, fontSize: type.body, fontWeight: '800' },
  languageCurrent: { color: colors.textMuted, fontSize: type.caption, marginTop: 4 },
  languageChevron: { color: colors.textMuted, fontSize: 30 },
  appearanceRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  appearanceOption: { flex: 1, minHeight: 84, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  appearanceOptionActive: { borderColor: colors.safe, backgroundColor: colors.safeSoft },
  appearanceIcon: { color: colors.text, fontSize: 23 },
  appearanceText: { color: colors.textMuted, fontSize: type.caption, fontWeight: '800' },
  appearanceTextActive: { color: colors.safe },
  input: {
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    fontSize: type.body,
    marginTop: spacing.md,
  },
  localAiList: { gap: spacing.sm, marginTop: spacing.md },
  localAiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  localAiMark: { color: colors.safe, fontWeight: '900' },
  localAiText: { flex: 1, color: colors.textMuted, fontSize: type.caption, lineHeight: 18 },
  baselineMetrics: { marginTop: spacing.sm },
  baselineMetric: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.sm,
  },
  baselineMetricLabel: { color: colors.textMuted, fontSize: type.caption, flex: 1 },
  baselineMetricValue: {
    color: colors.text,
    fontSize: type.caption,
    fontWeight: '800',
    textAlign: 'right',
    flexShrink: 1,
  },
  baselineAction: { marginTop: spacing.md },
  voiceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    marginTop: spacing.md,
  },
  voiceStatusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.textMuted },
  voiceStatusDotReady: { backgroundColor: colors.safe },
  voiceStatusText: { color: colors.text, fontSize: type.caption, fontWeight: '800' },
  voiceLimit: { color: colors.alert, fontSize: 11, lineHeight: 16, marginTop: spacing.sm },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingVertical: spacing.md,
  },
  contactCopy: { flex: 1 },
  contactName: { color: colors.text, fontWeight: '700' },
  contactPhone: { color: colors.textMuted, fontSize: type.caption, marginTop: 3 },
  contactReady: { color: colors.safe, fontWeight: '800', fontSize: type.caption },
  remove: { color: colors.textMuted, fontSize: 24 },
  form: { gap: spacing.sm },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  retentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  settingCopy: { flex: 1 },
  settingTitle: { color: colors.text, fontWeight: '700' },
  settingDescription: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: 3 },
  daysInput: {
    width: 62,
    height: 46,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '800',
  },
  cardAction: { marginTop: spacing.md },
  legalActions: { gap: spacing.sm, marginTop: spacing.md },
  erasureBlock: {
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
  },
  erasureTitle: { color: colors.danger, fontSize: type.heading, fontWeight: '800' },
  erasureBody: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18 },
  warningTitle: { color: colors.alert, fontSize: type.heading, fontWeight: '800' },
  warningBody: { color: colors.textMuted, fontSize: type.body, lineHeight: 22, marginTop: spacing.sm },
});
