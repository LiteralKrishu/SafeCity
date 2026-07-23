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
import { requestCorePermissions } from '@/services/permissions';
import { resetDeviceId } from '@/services/deviceIdentity';
import { eraseEvidenceVault } from '@/services/evidence';
import { useMonitoring } from '@/services/MonitoringProvider';
import { prepareVoiceTrigger } from '@/services/voice-trigger';
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
  const voiceTriggerStatus = useMonitorStore(
    (state) => state.telemetry.voiceTriggerStatus,
  );

  const refresh = useCallback(async () => {
    const [storedSettings, storedContacts] = await Promise.all([readSettings(db), listContacts(db)]);
    setSettings(storedSettings);
    setContacts(storedContacts);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const save = async (next: AppSettings) => {
    const synchronized = { ...next, language: preference };
    setSettings(synchronized);
    await writeSettings(db, synchronized);
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
    try {
      if (enabled) {
        const preparation = await prepareVoiceTrigger();
        if (!preparation.ready) {
          await save({ ...settings, voiceKeywordEnabled: false });
          await monitoring.setVoiceTriggerEnabled(false);
          Alert.alert(t('settings.voiceSetupTitle'), preparation.message);
          return;
        }
      }
      await save({ ...settings, voiceKeywordEnabled: enabled });
      await monitoring.setVoiceTriggerEnabled(enabled);
    } catch {
      Alert.alert(t('settings.voiceSetupTitle'), t('settings.voiceSetupError'));
    } finally {
      setVoiceBusy(false);
    }
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
                await monitoring.stopMonitoring();
                await eraseEvidenceVault();
                await eraseAllLocalData(db);
                await resetDeviceId();
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
            onPress={() => void requestCorePermissions().then(() => Alert.alert(t('settings.permissionsUpdated')))}
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
