import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandLogo } from '@/components/BrandLogo';
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
  allSetupPermissionsGranted,
  getCorePermissionSnapshot,
  requestCorePermissions,
  type PermissionSnapshot,
} from '@/services/permissions';
import {
  enablePersistentProtection,
  enableVoiceTrigger,
  openVoiceTriggerOverlaySettings,
} from '@/services/persistent-voice-trigger';
import type { EmergencyContact } from '@/types/domain';

type SetupStep = 1 | 2 | 3;

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const monitoring = useMonitoring();
  const { t } = useLocalization();
  const consentItems = [t('onboarding.consentOne'), t('onboarding.consentTwo'), t('onboarding.consentThree')];
  const legalItems = [t('onboarding.legalOne'), t('onboarding.legalTwo'), t('onboarding.legalThree')];
  const [currentStep, setCurrentStep] = useState<SetupStep>(1);
  const [consents, setConsents] = useState([false, false, false]);
  const [legalAcceptances, setLegalAcceptances] = useState([false, false, false]);
  const [setupComplete, setSetupComplete] = useState(false);
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
    permissionSnapshot !== null && allSetupPermissionsGranted(permissionSnapshot);
  const canFinish = useMemo(
    () => permissionsComplete && consentComplete && contacts.length > 0,
    [consentComplete, contacts.length, permissionsComplete],
  );
  const hasContactDraft = name.trim().length > 0 || phone.trim().length > 0;
  const newContactReady = name.trim().length > 0 && phone.trim().length >= 5;
  const canContinueContact = newContactReady || (contacts.length > 0 && !hasContactDraft);

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
    {
      key: 'automaticSms' as const,
      title: 'Automatic SOS messages',
      instruction: 'Choose Allow so SafeCity can send the SOS and location when the countdown ends.',
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
    router.push(path);
  };

  const continueFromContact = async () => {
    if (contacts.length > 0 && !hasContactDraft) {
      setCurrentStep(3);
      return;
    }

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
      setCurrentStep(3);
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
      if (!allSetupPermissionsGranted(verifiedPermissions)) {
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
      setSetupComplete(true);
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
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.root}
      >
        <ScrollView
          contentContainerStyle={styles.page}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.setupContainer}>
            <View style={styles.setupHeader}>
              <View style={styles.headerTitleRow}>
                <View style={styles.headerCopy}>
                  <Text style={styles.headerMeta}>{t('onboarding.eyebrow')}</Text>
                  <Text style={styles.setupTitle}>{t('onboarding.title')}</Text>
                </View>
                <View style={styles.logoBadge}>
                  <BrandLogo size={50} />
                </View>
              </View>
              <Text style={styles.stepIndicator}>
                {t('onboarding.stepCount', { current: currentStep, total: 3 })}
              </Text>
              <View style={styles.tagContainer}>
                <StepPill
                  label={t('onboarding.sensors')}
                  active={currentStep === 1}
                  complete={permissionsComplete}
                />
                <StepPill
                  label={t('onboarding.contact')}
                  active={currentStep === 2}
                  complete={contacts.length > 0}
                />
                <StepPill
                  label={t('onboarding.consent')}
                  active={currentStep === 3}
                  complete={consentComplete}
                />
              </View>
            </View>

            {currentStep === 1 ? (
              <View style={styles.stepPage}>
                <View style={styles.stepCard}>
                  <View style={styles.cardHeadingGroup}>
                    <Text style={styles.cardHeading}>{t('onboarding.accessTitle')}</Text>
                    <Text style={styles.cardDescription}>{t('onboarding.accessDetail')}</Text>
                  </View>

                  <View style={styles.infoBox}>
                    <Text style={styles.infoTitle}>{t('onboarding.locationTitle')}</Text>
                    <Text style={styles.infoDescription}>{t('onboarding.locationBody')}</Text>
                  </View>

                  <View style={styles.statusCounterRow}>
                    <Text style={styles.statusCounterTitle}>{t('onboarding.currentStatus')}</Text>
                    <Text style={[styles.statusCounterValue, permissionsComplete && styles.successText]}>
                      {permissionSummary}
                    </Text>
                  </View>

                  {permissionsComplete ? (
                    <View accessibilityRole="alert" style={styles.readyPanel}>
                      <Text style={styles.readyPanelIcon}>✓</Text>
                      <Text style={styles.readyPanelText}>{permissionSummary}</Text>
                    </View>
                  ) : (
                    <View accessibilityRole="alert" style={styles.warningPanel}>
                      <Text style={styles.warningHeading}>
                        {t('onboarding.permissionsMissingTitle')}
                      </Text>
                      <View style={styles.permissionList}>
                        {missingPermissions.map(({ key, title, instruction }) => (
                          <View key={key} style={styles.permissionItem}>
                            <View style={styles.permissionStatusDot}>
                              <Text style={styles.permissionStatusMark}>!</Text>
                            </View>
                            <View style={styles.permissionCopy}>
                              <Text style={styles.permissionName}>{title}</Text>
                              <Text style={styles.permissionInstruction}>{instruction}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}

                  <View style={styles.actionStack}>
                    <WizardButton
                      label={
                        permissionsRequested
                          ? t('onboarding.reviewPermissions')
                          : t('onboarding.choosePermissions')
                      }
                      onPress={() => void requestPermissions()}
                      loading={permissionsBusy}
                    />
                    {permissionsRequested && missingPermissions.length > 0 ? (
                      <WizardButton
                        label={t('onboarding.openPhoneSettings')}
                        onPress={() => void openPermissionSettings()}
                        variant="secondary"
                      />
                    ) : null}
                  </View>
                </View>

                <WizardButton
                  disabled={!permissionsComplete}
                  label={`${t('onboarding.contact')}  →`}
                  onPress={() => setCurrentStep(2)}
                />
              </View>
            ) : null}

            {currentStep === 2 ? (
              <View style={styles.stepPage}>
                <View style={styles.stepCard}>
                  <View style={styles.cardHeadingGroup}>
                    <Text style={styles.cardHeading}>{t('onboarding.contactTitle')}</Text>
                    <Text style={styles.cardDescription}>{t('onboarding.contactDetail')}</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('onboarding.contactName')}</Text>
                    <TextInput
                      accessibilityLabel="Emergency contact name"
                      autoCapitalize="words"
                      placeholder={t('onboarding.contactNamePlaceholder')}
                      placeholderTextColor={palette.textDim}
                      value={name}
                      onChangeText={(value) => {
                        setName(value);
                        setContactError('');
                      }}
                      style={styles.textInput}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>{t('onboarding.phone')}</Text>
                    <TextInput
                      accessibilityLabel="Emergency contact phone number"
                      keyboardType="phone-pad"
                      onChangeText={(value) => {
                        setPhone(value);
                        setContactError('');
                      }}
                      onSubmitEditing={() => void continueFromContact()}
                      placeholder={t('onboarding.phonePlaceholder')}
                      placeholderTextColor={palette.textDim}
                      textContentType="telephoneNumber"
                      value={phone}
                      style={styles.textInput}
                    />
                  </View>

                  {contactError ? (
                    <Text accessibilityRole="alert" style={styles.errorText}>{contactError}</Text>
                  ) : null}

                  {contacts.length > 0 ? (
                    <View style={styles.savedContacts}>
                      <Text style={styles.savedHeading}>{t('onboarding.readyForSos')}</Text>
                      {contacts.map((contact) => (
                        <View key={contact.id} style={styles.contactRow}>
                          <View style={styles.contactAvatar}>
                            <Text style={styles.contactInitial}>
                              {contact.name.slice(0, 1).toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.contactCopy}>
                            <Text style={styles.contactName}>{contact.name}</Text>
                            <Text style={styles.contactPhone}>{contact.phone}</Text>
                          </View>
                          <Text style={styles.savedBadge}>{t('onboarding.saved')}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                <View style={styles.buttonRow}>
                  <WizardButton
                    fill
                    label={`←  ${t('common.back')}`}
                    onPress={() => setCurrentStep(1)}
                    variant="secondary"
                  />
                  <WizardButton
                    disabled={!canContinueContact}
                    fill
                    label={
                      newContactReady
                        ? t('onboarding.saveContact')
                        : `${t('onboarding.consent')}  →`
                    }
                    loading={contactBusy}
                    onPress={() => void continueFromContact()}
                  />
                </View>
              </View>
            ) : null}

            {currentStep === 3 ? (
              <View style={styles.stepPage}>
                <View style={styles.stepCard}>
                  <View style={styles.cardHeadingGroup}>
                    <Text style={styles.cardHeading}>{t('onboarding.finalConfirmation')}</Text>
                    <Text style={styles.cardDescription}>{t('onboarding.understandBody')}</Text>
                  </View>

                  {!legalConfigurationComplete ? (
                    <View accessibilityRole="alert" style={styles.legalWarning}>
                      <Text style={styles.legalWarningTitle}>{t('onboarding.prototypeTitle')}</Text>
                      <Text style={styles.legalWarningBody}>{t('onboarding.prototypeBody')}</Text>
                    </View>
                  ) : null}

                  <View style={styles.legalLinks}>
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => openLegalDocument('/legal/privacy')}
                      style={({ pressed }) => [
                        styles.legalLinkButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.legalLinkText}>{t('onboarding.readPrivacy')}</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => openLegalDocument('/legal/terms')}
                      style={({ pressed }) => [
                        styles.legalLinkButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.legalLinkText}>{t('onboarding.readTerms')}</Text>
                    </Pressable>
                  </View>

                  <View style={styles.consentList}>
                    {consentItems.map((item, index) => (
                      <ConsentRow
                        checked={Boolean(consents[index])}
                        key={item}
                        label={item}
                        onPress={() =>
                          setConsents((current) =>
                            current.map((value, itemIndex) =>
                              itemIndex === index ? !value : value,
                            ),
                          )
                        }
                      />
                    ))}
                  </View>

                  <Text style={styles.legalHeading}>{t('onboarding.ageLegal')}</Text>
                  <View style={styles.consentList}>
                    {legalItems.map((item, index) => (
                      <ConsentRow
                        checked={Boolean(legalAcceptances[index])}
                        key={item}
                        label={item}
                        onPress={() =>
                          setLegalAcceptances((current) =>
                            current.map((value, itemIndex) =>
                              itemIndex === index ? !value : value,
                            ),
                          )
                        }
                      />
                    ))}
                  </View>
                </View>

                {permissionError ? (
                  <Text accessibilityRole="alert" style={styles.errorText}>{permissionError}</Text>
                ) : null}
                <View style={styles.buttonRow}>
                  <WizardButton
                    fill
                    label={`←  ${t('common.back')}`}
                    onPress={() => setCurrentStep(2)}
                    variant="secondary"
                  />
                  <WizardButton
                    disabled={!canFinish}
                    fill
                    label={t('onboarding.finish')}
                    loading={finishBusy}
                    onPress={() => void finish()}
                  />
                </View>
              </View>
            ) : null}

            <Text style={[styles.bottomHint, canFinish && styles.successText]}>
              {canFinish
                ? t('onboarding.ready')
                : permissionsComplete
                  ? t('onboarding.finishHint')
                  : t('onboarding.finishPermissionsHint')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal animationType="fade" transparent visible={setupComplete}>
        <SafeAreaView style={styles.celebrationOverlay}>
          <View style={styles.celebrationCard}>
            <BrandLogo size={88} />
            <Text style={styles.celebrationTitle}>{t('onboarding.activeTitle')}</Text>
            <Text style={styles.celebrationBody}>{t('onboarding.ready')}</Text>
            <WizardButton
              label={`${t('onboarding.openDashboard')}  →`}
              onPress={() => router.replace('/(tabs)')}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function StepPill({
  label,
  active,
  complete,
}: {
  label: string;
  active: boolean;
  complete: boolean;
}) {
  return (
    <View
      style={[
        styles.stepPill,
        complete && styles.stepPillComplete,
        active && styles.stepPillActive,
      ]}
    >
      <Text
        style={[
          styles.stepPillText,
          complete && styles.stepPillTextComplete,
          active && styles.stepPillTextActive,
        ]}
      >
        {complete ? '✓ ' : ''}{label}
      </Text>
    </View>
  );
}

function ConsentRow({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [styles.consentRow, pressed && styles.pressed]}
    >
      <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
        <Text style={styles.check}>{checked ? '✓' : ''}</Text>
      </View>
      <Text style={styles.consentText}>{label}</Text>
    </Pressable>
  );
}

function WizardButton({
  disabled = false,
  fill = false,
  label,
  loading = false,
  onPress,
  variant = 'primary',
}: {
  disabled?: boolean;
  fill?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}) {
  const unavailable = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' ? styles.buttonPrimary : styles.buttonSecondary,
        fill && styles.buttonFill,
        unavailable && styles.buttonDisabled,
        pressed && !unavailable && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? palette.white : palette.emerald} />
      ) : (
        <Text
          numberOfLines={2}
          style={[
            styles.buttonText,
            variant === 'primary' ? styles.buttonPrimaryText : styles.buttonSecondaryText,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const palette = {
  background: '#05080E',
  card: '#0F131A',
  input: 'rgba(0, 0, 0, 0.25)',
  border: 'rgba(255, 255, 255, 0.07)',
  borderStrong: 'rgba(255, 255, 255, 0.13)',
  emerald: '#10B981',
  emeraldSoft: 'rgba(16, 185, 129, 0.08)',
  emeraldBorder: 'rgba(16, 185, 129, 0.30)',
  crimson: '#EF4444',
  crimsonSoft: 'rgba(239, 68, 68, 0.05)',
  crimsonBorder: 'rgba(239, 68, 68, 0.30)',
  amber: '#F59E0B',
  text: '#F8FAFC',
  textMuted: '#94A3B8',
  textDim: '#64748B',
  white: '#FFFFFF',
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: palette.background,
  },
  page: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 26,
    paddingBottom: 32,
  },
  setupContainer: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: 24,
  },
  setupHeader: {
    borderBottomWidth: 1,
    borderBottomColor: palette.border,
    paddingBottom: 20,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerCopy: {
    flex: 1,
  },
  headerMeta: {
    color: palette.emerald,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  setupTitle: {
    color: palette.white,
    fontSize: 29,
    lineHeight: 35,
    fontWeight: '800',
    marginTop: 4,
  },
  logoBadge: {
    width: 54,
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: palette.white,
  },
  stepIndicator: {
    color: palette.emerald,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  tagContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  stepPill: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  stepPillActive: {
    backgroundColor: palette.emeraldSoft,
    borderColor: palette.emeraldBorder,
  },
  stepPillComplete: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  stepPillText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  stepPillTextActive: {
    color: palette.emerald,
  },
  stepPillTextComplete: {
    color: palette.white,
  },
  stepPage: {
    gap: 16,
  },
  stepCard: {
    gap: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.card,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  cardHeadingGroup: {
    gap: 8,
  },
  cardHeading: {
    color: palette.white,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
  },
  cardDescription: {
    color: palette.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  infoBox: {
    gap: 5,
    borderLeftWidth: 3,
    borderLeftColor: palette.emerald,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.03)',
    padding: 14,
  },
  infoTitle: {
    color: palette.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
  },
  infoDescription: {
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  statusCounterRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  statusCounterTitle: {
    color: palette.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statusCounterValue: {
    flex: 1,
    color: palette.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  warningPanel: {
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.crimsonBorder,
    backgroundColor: palette.crimsonSoft,
    padding: 17,
  },
  warningHeading: {
    color: palette.crimson,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '900',
  },
  permissionList: {
    gap: 10,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minHeight: 58,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.input,
    padding: 12,
  },
  permissionStatusDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.crimson,
  },
  permissionStatusMark: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '900',
  },
  permissionCopy: {
    flex: 1,
  },
  permissionName: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '800',
  },
  permissionInstruction: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  readyPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.emeraldBorder,
    backgroundColor: palette.emeraldSoft,
    padding: 16,
  },
  readyPanelIcon: {
    color: palette.emerald,
    fontSize: 20,
    fontWeight: '900',
  },
  readyPanelText: {
    flex: 1,
    color: palette.emerald,
    fontSize: 13,
    fontWeight: '800',
  },
  actionStack: {
    gap: 10,
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  button: {
    minHeight: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  buttonFill: {
    flex: 1,
  },
  buttonPrimary: {
    borderWidth: 1,
    borderColor: palette.emerald,
    backgroundColor: palette.emerald,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: palette.borderStrong,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  buttonDisabled: {
    opacity: 0.3,
  },
  buttonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  buttonPrimaryText: {
    color: palette.white,
  },
  buttonSecondaryText: {
    color: palette.white,
  },
  inputGroup: {
    gap: 7,
  },
  inputLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  textInput: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.input,
    color: palette.white,
    fontSize: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  savedContacts: {
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 16,
  },
  savedHeading: {
    color: palette.textDim,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
  },
  contactAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.emeraldSoft,
    borderWidth: 1,
    borderColor: palette.emeraldBorder,
  },
  contactInitial: {
    color: palette.emerald,
    fontWeight: '900',
  },
  contactCopy: {
    flex: 1,
  },
  contactName: {
    color: palette.white,
    fontSize: 13,
    fontWeight: '800',
  },
  contactPhone: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  savedBadge: {
    color: palette.emerald,
    fontSize: 11,
    fontWeight: '900',
  },
  legalWarning: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    padding: 14,
  },
  legalWarningTitle: {
    color: palette.amber,
    fontSize: 13,
    fontWeight: '900',
  },
  legalWarningBody: {
    color: palette.textMuted,
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },
  legalLinks: {
    flexDirection: 'row',
    gap: 10,
  },
  legalLinkButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.emeraldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  legalLinkText: {
    color: palette.emerald,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  consentList: {
    gap: 10,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.input,
    padding: 13,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: palette.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    borderColor: palette.emerald,
    backgroundColor: palette.emerald,
  },
  check: {
    color: palette.white,
    fontSize: 14,
    fontWeight: '900',
  },
  consentText: {
    flex: 1,
    color: palette.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  legalHeading: {
    color: palette.white,
    fontSize: 15,
    fontWeight: '800',
  },
  errorText: {
    color: palette.crimson,
    fontSize: 12,
    lineHeight: 18,
  },
  bottomHint: {
    color: palette.textDim,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  successText: {
    color: palette.emerald,
  },
  pressed: {
    opacity: 0.76,
  },
  celebrationOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 8, 14, 0.97)',
    padding: 20,
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.emeraldBorder,
    backgroundColor: palette.card,
    padding: 32,
  },
  celebrationTitle: {
    color: palette.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
  },
  celebrationBody: {
    color: palette.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
