import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  AppState,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { addContact, listContacts, readSettings, writeSettings } from '@/db/repository';
import { useLocalization } from '@/i18n/localization-provider';
import {
  PRIVACY_NOTICE_VERSION,
  PROCESSING_CONSENT_VERSION,
  TERMS_VERSION,
  legalConfigurationComplete,
} from '@/legal/content';
import { useMonitoring } from '@/services/MonitoringProvider';
import {
  allCorePermissionsGranted,
  getCorePermissionSnapshot,
  requestCorePermissions,
  type PermissionSnapshot,
} from '@/services/permissions';
import {
  enablePersistentProtection,
  enableVoiceTrigger,
  openVoiceTriggerOverlaySettings,
} from '@/services/persistent-voice-trigger';
import { colors, radii, spacing, type } from '@/theme/tokens';
import type { EmergencyContact } from '@/types/domain';

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const monitoring = useMonitoring();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();
  const consentItems = [t('onboarding.consentOne'), t('onboarding.consentTwo'), t('onboarding.consentThree')];
  const legalItems = [t('onboarding.legalOne'), t('onboarding.legalTwo'), t('onboarding.legalThree')];
  const [consents, setConsents] = useState([false, false, false]);
  const [legalAcceptances, setLegalAcceptances] = useState([false, false, false]);
  const [consentVisible, setConsentVisible] = useState(false);
  const [permissionsRequested, setPermissionsRequested] = useState(false);
  const [permissionSummary, setPermissionSummary] = useState(() => t('onboarding.notReviewed'));
  const [permissionSnapshot, setPermissionSnapshot] = useState<PermissionSnapshot | null>(null);
  const [permissionError, setPermissionError] = useState('');
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [contactError, setContactError] = useState('');
  const [permissionsBusy, setPermissionsBusy] = useState(false);
  const [contactBusy, setContactBusy] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);

  const refreshContacts = async () => setContacts(await listContacts(db));

  const updatePermissionState = (snapshot: PermissionSnapshot) => {
    const granted = Object.values(snapshot).filter(Boolean).length;
    setPermissionSnapshot(snapshot);
    setPermissionSummary(
      t('onboarding.permissionsCount', {
        granted,
        total: Object.keys(snapshot).length,
      }),
    );
    setPermissionsRequested(true);
  };

  useEffect(() => {
    let active = true;
    void Promise.all([
      listContacts(db),
      readSettings(db),
      getCorePermissionSnapshot(),
    ]).then(([storedContacts, settings, snapshot]) => {
      if (!active) return;
      setContacts(storedContacts);
      updatePermissionState(snapshot);
      const consentAlreadyRecorded =
        settings.onboardingComplete &&
        settings.adultConfirmed &&
        settings.consentVersion === PROCESSING_CONSENT_VERSION &&
        settings.privacyNoticeVersion === PRIVACY_NOTICE_VERSION &&
        settings.termsVersion === TERMS_VERSION;
      if (consentAlreadyRecorded) {
        setConsents([true, true, true]);
        setLegalAcceptances([true, true, true]);
      }
    }).catch(() => {
      if (!active) return;
      setPermissionSummary(t('onboarding.permissionsUnavailable'));
      setPermissionsRequested(true);
    });
    return () => {
      active = false;
    };
  }, [db, t]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' || !permissionsRequested) return;
      void getCorePermissionSnapshot()
        .then(updatePermissionState)
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, [permissionsRequested, t]);

  const consentComplete = consents.every(Boolean) && legalAcceptances.every(Boolean);
  const permissionsComplete =
    permissionSnapshot !== null && allCorePermissionsGranted(permissionSnapshot);
  const canFinish = useMemo(
    () => permissionsComplete && consentComplete && contacts.length > 0,
    [consentComplete, contacts.length, permissionsComplete],
  );

  const permissionGuidance = [
    {
      key: 'camera' as const,
      title: t('onboarding.permissionCamera'),
      instruction: t('onboarding.permissionCameraChoice'),
    },
    {
      key: 'microphone' as const,
      title: t('onboarding.permissionMicrophone'),
      instruction: t('onboarding.permissionMicrophoneChoice'),
    },
    {
      key: 'motion' as const,
      title: t('onboarding.permissionMotion'),
      instruction: t('onboarding.permissionMotionChoice'),
    },
    {
      key: 'locationForeground' as const,
      title: t('onboarding.permissionLocation'),
      instruction: t('onboarding.permissionLocationChoice'),
    },
    {
      key: 'locationPrecise' as const,
      title: t('onboarding.permissionPrecise'),
      instruction: t('onboarding.permissionPreciseChoice'),
    },
    {
      key: 'locationBackground' as const,
      title: t('onboarding.permissionBackgroundLocation'),
      instruction: t('onboarding.permissionBackgroundLocationChoice'),
    },
    {
      key: 'notifications' as const,
      title: t('onboarding.permissionNotifications'),
      instruction: t('onboarding.permissionNotificationsChoice'),
    },
    {
      key: 'fullScreenAlerts' as const,
      title: t('onboarding.permissionFullScreen'),
      instruction: t('onboarding.permissionFullScreenChoice'),
    },
  ];
  const missingPermissions = permissionSnapshot
    ? permissionGuidance.filter(({ key }) => !permissionSnapshot[key])
    : permissionGuidance;

  const requestPermissions = async () => {
    setPermissionsBusy(true);
    setPermissionError('');
    try {
      const result = await requestCorePermissions();
      updatePermissionState(result);
    } catch {
      setPermissionSummary(t('onboarding.permissionsUnavailable'));
      setPermissionsRequested(true);
    } finally {
      setPermissionsBusy(false);
    }
  };

  const openPermissionSettings = async () => {
    if (
      missingPermissions.some(({ key }) => key === 'fullScreenAlerts') &&
      missingPermissions.every(({ key }) => key === 'fullScreenAlerts')
    ) {
      await openVoiceTriggerOverlaySettings();
      return;
    }
    await Linking.openSettings();
  };

  const openLegalDocument = (path: '/legal/privacy' | '/legal/terms') => {
    setConsentVisible(false);
    router.push(path);
  };

  const addNewContact = async () => {
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName) {
      setContactError(t('onboarding.nameError'));
      return;
    }
    if (cleanPhone.length < 5) {
      setContactError(t('onboarding.phoneError'));
      return;
    }

    setContactBusy(true);
    setContactError('');
    try {
      await addContact(db, cleanName, cleanPhone);
      setName('');
      setPhone('');
      await refreshContacts();
      setConsentVisible(true);
    } catch {
      setContactError(t('onboarding.contactSaveError'));
    } finally {
      setContactBusy(false);
    }
  };

  const finish = async () => {
    setFinishBusy(true);
    setPermissionError('');
    try {
      const verifiedPermissions = await getCorePermissionSnapshot();
      updatePermissionState(verifiedPermissions);
      if (!allCorePermissionsGranted(verifiedPermissions)) {
        setPermissionError(t('onboarding.fixPermissionsFirst'));
        return;
      }
      const voicePreparation = await enableVoiceTrigger(false);
      if (!voicePreparation.ready) {
        setPermissionError(voicePreparation.message);
        return;
      }
      if (!voicePreparation.fullScreenAllowed) {
        updatePermissionState({
          ...verifiedPermissions,
          fullScreenAlerts: false,
        });
        setPermissionError(t('onboarding.fixPermissionsFirst'));
        return;
      }
      await enablePersistentProtection();
      const settings = await readSettings(db);
      const acceptedAt = new Date().toISOString();
      await writeSettings(db, {
        ...settings,
        onboardingComplete: true,
        monitoringEnabled: true,
        backgroundLocation: true,
        voiceKeywordEnabled: true,
        behaviorBaselineEnabled: true,
        consentVersion: PROCESSING_CONSENT_VERSION,
        consentGrantedAt: acceptedAt,
        privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
        termsVersion: TERMS_VERSION,
        termsAcceptedAt: acceptedAt,
        adultConfirmed: true,
      });
      await monitoring.startMonitoring();
      router.replace('/(tabs)');
    } catch (error) {
      setPermissionError(
        error instanceof Error
          ? error.message
          : t('onboarding.protectionSetupError'),
      );
    } finally {
      setFinishBusy(false);
    }
  };

  return (
    <>
      <Screen eyebrow={t('onboarding.eyebrow')} title={t('onboarding.title')}>
        <View style={styles.intro}>
          <Text style={styles.hero}>{t('onboarding.hero')}</Text>
          <Text style={styles.body}>
            {t('onboarding.body')}
          </Text>
          <View style={styles.progressRow}>
            <StepPill label={t('onboarding.sensors')} complete={permissionsComplete} />
            <StepPill label={t('onboarding.contact')} complete={contacts.length > 0} />
            <StepPill label={t('onboarding.consent')} complete={consentComplete} />
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t('onboarding.stepSensors')}</Text>
        <Card title={t('onboarding.accessTitle')} subtitle={t('onboarding.accessDetail')}>
          <View style={styles.locationCallout}>
            <Text style={styles.locationTitle}>{t('onboarding.locationTitle')}</Text>
            <Text style={styles.locationBody}>
              {t('onboarding.locationBody')}
            </Text>
          </View>
          <View style={styles.cardAction}>
            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>{t('onboarding.currentStatus')}</Text>
              <Text style={[styles.status, permissionsComplete && styles.statusReady]}>
                {permissionSummary}
              </Text>
            </View>
            {permissionsRequested && missingPermissions.length > 0 ? (
              <View accessibilityRole="alert" style={styles.permissionGuide}>
                <Text style={styles.permissionGuideTitle}>
                  {t('onboarding.permissionsMissingTitle')}
                </Text>
                {missingPermissions.map(({ key, title, instruction }) => (
                  <View key={key} style={styles.permissionGuideRow}>
                    <Text style={styles.permissionGuideMark}>!</Text>
                    <View style={styles.permissionGuideCopy}>
                      <Text style={styles.permissionGuideName}>{title}</Text>
                      <Text style={styles.permissionGuideInstruction}>{instruction}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
            <ActionButton
              label={permissionsRequested ? t('onboarding.reviewPermissions') : t('onboarding.choosePermissions')}
              onPress={() => void requestPermissions()}
              variant="secondary"
              loading={permissionsBusy}
            />
            {permissionsRequested && missingPermissions.length > 0 ? (
              <ActionButton
                label={t('onboarding.openPhoneSettings')}
                onPress={() => void openPermissionSettings()}
                variant="secondary"
              />
            ) : null}
          </View>
        </Card>

        <Text style={styles.sectionLabel}>{t('onboarding.stepContact')}</Text>
        <Card
          title={t('onboarding.contactTitle')}
          subtitle={t('onboarding.contactDetail')}
        >
          <View style={styles.form}>
            <View>
              <Text style={styles.inputLabel}>{t('onboarding.contactName')}</Text>
              <TextInput
                accessibilityLabel="Emergency contact name"
                autoCapitalize="words"
                placeholder={t('onboarding.contactNamePlaceholder')}
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={(value) => {
                  setName(value);
                  setContactError('');
                }}
                style={styles.input}
              />
            </View>
            <View>
              <Text style={styles.inputLabel}>{t('onboarding.phone')}</Text>
              <TextInput
                accessibilityLabel="Emergency contact phone number"
                placeholder={t('onboarding.phonePlaceholder')}
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                value={phone}
                onChangeText={(value) => {
                  setPhone(value);
                  setContactError('');
                }}
                onSubmitEditing={() => void addNewContact()}
                style={styles.input}
              />
            </View>
            {contactError ? (
              <Text accessibilityRole="alert" style={styles.errorText}>{contactError}</Text>
            ) : null}
            <ActionButton
              label={t('onboarding.saveContact')}
              onPress={() => void addNewContact()}
              variant="secondary"
              loading={contactBusy}
            />
          </View>

          {contacts.length > 0 ? (
            <View style={styles.savedContacts}>
              <Text style={styles.savedHeading}>{t('onboarding.readyForSos')}</Text>
              {contacts.map((contact) => (
                <View key={contact.id} style={styles.contactRow}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactInitial}>{contact.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={styles.contactCopy}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactPhone}>{contact.phone}</Text>
                  </View>
                  <Text style={styles.readyBadge}>{t('onboarding.saved')}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        <Text style={styles.sectionLabel}>{t('onboarding.stepConsent')}</Text>
        <Card>
          <View style={styles.consentSummary}>
            <View style={[styles.summaryIcon, consentComplete && styles.summaryIconComplete]}>
              <Text style={styles.summaryIconText}>{consentComplete ? '✓' : '3'}</Text>
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryTitle}>{consentComplete ? t('onboarding.consentConfirmed') : t('onboarding.finalConfirmation')}</Text>
              <Text style={styles.summaryBody}>
                {contacts.length > 0
                  ? t('onboarding.consentReadyBody')
                  : t('onboarding.consentLockedBody')}
              </Text>
            </View>
          </View>
          {contacts.length > 0 ? (
            <View style={styles.cardAction}>
              <ActionButton
                label={consentComplete ? t('onboarding.reviewConsent') : t('onboarding.reviewConfirm')}
                onPress={() => setConsentVisible(true)}
                variant="secondary"
              />
            </View>
          ) : null}
        </Card>

        <View style={styles.finish}>
          {permissionError ? (
            <Text accessibilityRole="alert" style={styles.errorText}>{permissionError}</Text>
          ) : null}
          <ActionButton
            label={t('onboarding.finish')}
            onPress={() => void finish()}
            disabled={!canFinish}
            loading={finishBusy}
          />
          {!canFinish ? (
            <Text style={styles.hint}>
              {permissionsComplete
                ? t('onboarding.finishHint')
                : t('onboarding.finishPermissionsHint')}
            </Text>
          ) : (
            <Text style={styles.readyHint}>{t('onboarding.ready')}</Text>
          )}
        </View>
      </Screen>

      <Modal
        transparent
        visible={consentVisible}
        onRequestClose={() => setConsentVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalRoot}
        >
          <Pressable
            accessibilityLabel="Close consent confirmation"
            onPress={() => setConsentVisible(false)}
            style={styles.backdrop}
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
            <View style={styles.sheetHandle} />
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetEyebrow}>{t('onboarding.finalStep')}</Text>
              <Text style={styles.sheetTitle}>{t('onboarding.understandTitle')}</Text>
              <Text style={styles.sheetBody}>
                {t('onboarding.understandBody')}
              </Text>

              {!legalConfigurationComplete ? (
                <View accessibilityRole="alert" style={styles.legalWarning}>
                  <Text style={styles.legalWarningTitle}>{t('onboarding.prototypeTitle')}</Text>
                  <Text style={styles.legalWarningBody}>
                    {t('onboarding.prototypeBody')}
                  </Text>
                </View>
              ) : null}

              <View style={styles.legalLinks}>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => openLegalDocument('/legal/privacy')}
                  style={styles.legalLinkButton}
                >
                  <Text style={styles.legalLinkText}>{t('onboarding.readPrivacy')}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="link"
                  onPress={() => openLegalDocument('/legal/terms')}
                  style={styles.legalLinkButton}
                >
                  <Text style={styles.legalLinkText}>{t('onboarding.readTerms')}</Text>
                </Pressable>
              </View>

              <View style={styles.consentList}>
                {consentItems.map((item, index) => (
                  <Pressable
                    key={item}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: consents[index] }}
                    onPress={() =>
                      setConsents((current) =>
                        current.map((value, itemIndex) => (itemIndex === index ? !value : value)),
                      )
                    }
                    style={({ pressed }) => [styles.consentRow, pressed && styles.consentRowPressed]}
                  >
                    <View style={[styles.checkbox, consents[index] && styles.checkboxChecked]}>
                      <Text style={styles.check}>{consents[index] ? '✓' : ''}</Text>
                    </View>
                    <Text style={styles.consentText}>{item}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.legalHeading}>{t('onboarding.ageLegal')}</Text>
              <View style={styles.consentList}>
                {legalItems.map((item, index) => (
                  <Pressable
                    key={item}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: legalAcceptances[index] }}
                    onPress={() =>
                      setLegalAcceptances((current) =>
                        current.map((value, itemIndex) => (itemIndex === index ? !value : value)),
                      )
                    }
                    style={({ pressed }) => [styles.consentRow, pressed && styles.consentRowPressed]}
                  >
                    <View style={[styles.checkbox, legalAcceptances[index] && styles.checkboxChecked]}>
                      <Text style={styles.check}>{legalAcceptances[index] ? '✓' : ''}</Text>
                    </View>
                    <Text style={styles.consentText}>{item}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.sheetActions}>
                <ActionButton
                  label={t('onboarding.confirmConsent')}
                  onPress={() => setConsentVisible(false)}
                  disabled={!consentComplete}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConsentVisible(false)}
                  style={styles.notNowButton}
                >
                  <Text style={styles.notNowText}>{t('onboarding.notNow')}</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

function StepPill({ label, complete }: { label: string; complete: boolean }) {
  return (
    <View style={[styles.stepPill, complete && styles.stepPillComplete]}>
      <Text style={[styles.stepPillText, complete && styles.stepPillTextComplete]}>
        {complete ? '✓ ' : ''}{label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: spacing.lg },
  hero: { color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: '800' },
  body: { color: colors.textMuted, fontSize: type.body, lineHeight: 23, marginTop: spacing.sm },
  progressRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
  stepPill: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  stepPillComplete: { borderColor: colors.safe, backgroundColor: colors.safeSoft },
  stepPillText: { color: colors.textMuted, fontSize: type.caption, fontWeight: '700' },
  stepPillTextComplete: { color: colors.safe },
  sectionLabel: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: type.caption,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  locationCallout: {
    borderLeftWidth: 3,
    borderLeftColor: colors.watch,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  locationTitle: { color: colors.text, fontSize: type.body, fontWeight: '800' },
  locationBody: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: spacing.xs },
  cardAction: { gap: spacing.md, marginTop: spacing.md },
  statusRow: { gap: spacing.xs },
  statusLabel: { color: colors.textMuted, fontSize: type.caption, fontWeight: '700' },
  status: { color: colors.text, fontSize: type.body, fontWeight: '700' },
  statusReady: { color: colors.safe },
  permissionGuide: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    borderRadius: radii.md,
    backgroundColor: colors.dangerSoft,
    padding: spacing.md,
  },
  permissionGuideTitle: {
    color: colors.danger,
    fontSize: type.body,
    fontWeight: '900',
  },
  permissionGuideRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  permissionGuideMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    textAlign: 'center',
    color: colors.white,
    backgroundColor: colors.danger,
    fontWeight: '900',
  },
  permissionGuideCopy: { flex: 1 },
  permissionGuideName: { color: colors.text, fontSize: type.caption, fontWeight: '800' },
  permissionGuideInstruction: {
    color: colors.textMuted,
    fontSize: type.caption,
    lineHeight: 18,
    marginTop: 2,
  },
  form: { gap: spacing.md, marginTop: spacing.lg },
  inputLabel: { color: colors.text, fontSize: type.caption, fontWeight: '700', marginBottom: spacing.xs },
  input: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    fontSize: type.body,
  },
  errorText: { color: colors.danger, fontSize: type.caption, lineHeight: 18 },
  savedContacts: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  savedHeading: { color: colors.textMuted, fontSize: type.caption, fontWeight: '800', marginBottom: spacing.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.safeSoft,
  },
  contactInitial: { color: colors.safe, fontWeight: '900' },
  contactCopy: { flex: 1 },
  contactName: { color: colors.text, fontWeight: '700' },
  contactPhone: { color: colors.textMuted, fontSize: type.caption, marginTop: 3 },
  readyBadge: { color: colors.safe, fontSize: type.caption, fontWeight: '800' },
  consentSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryIconComplete: { backgroundColor: colors.safeSoft, borderColor: colors.safe },
  summaryIconText: { color: colors.safe, fontWeight: '900', fontSize: type.heading },
  summaryCopy: { flex: 1 },
  summaryTitle: { color: colors.text, fontWeight: '800', fontSize: type.body },
  summaryBody: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: spacing.xs },
  finish: { gap: spacing.sm, marginTop: spacing.xl },
  hint: { color: colors.textMuted, textAlign: 'center', fontSize: type.caption, lineHeight: 18 },
  readyHint: { color: colors.safe, textAlign: 'center', fontSize: type.caption, fontWeight: '700' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
  },
  sheet: {
    maxHeight: '88%',
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  sheetHandle: {
    width: 42,
    height: 4,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  sheetEyebrow: { color: colors.watch, fontSize: type.caption, fontWeight: '800', textTransform: 'uppercase' },
  sheetTitle: { color: colors.text, fontSize: type.title, fontWeight: '800', marginTop: spacing.xs },
  sheetBody: { color: colors.textMuted, fontSize: type.body, lineHeight: 22, marginTop: spacing.sm },
  legalWarning: {
    borderWidth: 1,
    borderColor: colors.alert,
    backgroundColor: colors.alertSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  legalWarningTitle: { color: colors.alert, fontWeight: '800', fontSize: type.body },
  legalWarningBody: { color: colors.text, fontSize: type.caption, lineHeight: 18, marginTop: spacing.xs },
  legalLinks: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  legalLinkButton: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.watch,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  legalLinkText: { color: colors.watch, fontSize: type.caption, fontWeight: '800', textAlign: 'center' },
  consentList: { gap: spacing.sm, marginTop: spacing.lg },
  legalHeading: { color: colors.text, fontSize: type.heading, fontWeight: '800', marginTop: spacing.lg },
  consentRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
  },
  consentRowPressed: { opacity: 0.78 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.safe, borderColor: colors.safe },
  check: { color: colors.background, fontWeight: '900' },
  consentText: { flex: 1, color: colors.text, fontSize: type.body, lineHeight: 22 },
  sheetActions: { gap: spacing.sm, marginTop: spacing.lg },
  notNowButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  notNowText: { color: colors.textMuted, fontSize: type.body, fontWeight: '700' },
});
