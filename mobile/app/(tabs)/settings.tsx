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
import { requestCorePermissions } from '@/services/permissions';
import { resetDeviceId } from '@/services/deviceIdentity';
import { eraseEvidenceVault } from '@/services/evidence';
import { useMonitoring } from '@/services/MonitoringProvider';
import {
  PRIVACY_NOTICE_VERSION,
  TERMS_VERSION,
  legalConfigurationComplete,
} from '@/legal/content';
import { colors, radii, spacing, type } from '@/theme/tokens';
import type { AppSettings, EmergencyContact } from '@/types/domain';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const monitoring = useMonitoring();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [erasing, setErasing] = useState(false);

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
    setSettings(next);
    await writeSettings(db, next);
  };

  const addNewContact = async () => {
    if (!name.trim() || phone.trim().length < 5) {
      Alert.alert('Contact needed', 'Enter a name and valid phone number.');
      return;
    }
    await addContact(db, name, phone);
    setName('');
    setPhone('');
    await refresh();
  };

  const withdrawConsentAndErase = () => {
    Alert.alert(
      'Withdraw consent and erase data?',
      'Monitoring will stop. Contacts, sessions, incidents, locations, consent records and encrypted evidence will be permanently deleted from this device.',
      [
        { text: 'Keep my data', style: 'cancel' },
        {
          text: 'Withdraw and erase',
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
                  'Consent withdrawn',
                  'Monitoring stopped and this installation’s saved personal data was erased.',
                );
              } catch {
                Alert.alert(
                  'Erasure incomplete',
                  'SafeCity could not complete the local deletion. Keep the app installed and try again.',
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

  return (
    <Screen eyebrow="Local controls" title="Settings">
      <Text style={styles.sectionLabel}>Inference</Text>
      <Card
        title="On-device AI"
        subtitle="The audio model and every risk calculation are bundled in the app. Monitoring audio is not sent to a laptop, server or cloud."
      >
        <View style={styles.localAiList}>
          <View style={styles.localAiRow}>
            <Text style={styles.localAiMark}>✓</Text>
            <Text style={styles.localAiText}>Works without internet or a companion computer</Text>
          </View>
          <View style={styles.localAiRow}>
            <Text style={styles.localAiMark}>✓</Text>
            <Text style={styles.localAiText}>Audio is processed in memory and is not cached</Text>
          </View>
          <View style={styles.localAiRow}>
            <Text style={styles.localAiMark}>✓</Text>
            <Text style={styles.localAiText}>Adaptive sampling slows automatically in the background and in battery saver</Text>
          </View>
        </View>
      </Card>

      <Text style={styles.sectionLabel}>Emergency contacts</Text>
      <Card subtitle="Every saved contact is included when SafeCity prepares an SOS message.">
        {contacts.map((contact) => (
          <View key={contact.id} style={styles.contactRow}>
            <View style={styles.contactCopy}>
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactPhone}>{contact.phone}</Text>
            </View>
            <Text style={styles.contactReady}>✓ Ready</Text>
            <Pressable
              accessibilityLabel={`Remove ${contact.name}`}
              onPress={() => void removeContact(db, contact.id).then(refresh)}
            >
              <Text style={styles.remove}>×</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.form}>
          <TextInput
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          <TextInput
            placeholder="Phone number with country code"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
          />
          <ActionButton label="Add contact" variant="secondary" onPress={() => void addNewContact()} />
        </View>
      </Card>

      <Text style={styles.sectionLabel}>Privacy and behavior</Text>
      <Card>
        <SettingRow
          title="Discreet alerts"
          description="Prefer haptics and on-screen checks over audible alarms."
          value={settings.discreetMode}
          onChange={(discreetMode) => void save({ ...settings, discreetMode })}
        />
        <SettingRow
          title="Background location"
          description="Retain only the latest location while a session is active."
          value={settings.backgroundLocation}
          onChange={(backgroundLocation) => void save({ ...settings, backgroundLocation })}
        />
        <View style={styles.retentionRow}>
          <View style={styles.settingCopy}>
            <Text style={styles.settingTitle}>Evidence retention</Text>
            <Text style={styles.settingDescription}>Delete incident records automatically after this many days.</Text>
          </View>
          <TextInput
            accessibilityLabel="Retention days"
            keyboardType="number-pad"
            value={String(settings.retentionDays)}
            onChangeText={(value) => {
              const retentionDays = Math.min(Math.max(Number(value) || 1, 1), 90);
              setSettings((current) => ({ ...current, retentionDays }));
            }}
            onBlur={() => void writeSettings(db, settings)}
            style={styles.daysInput}
          />
        </View>
      </Card>

      <Text style={styles.sectionLabel}>Permissions</Text>
      <Card
        title="Sensor access"
        subtitle="For the most reliable monitoring coverage, choose “Allow all the time” for location. The dashboard always shows when protection is degraded."
      >
        <View style={styles.cardAction}>
          <ActionButton
            label="Review sensor permissions"
            variant="secondary"
            onPress={() => void requestCorePermissions().then(() => Alert.alert('Permissions updated'))}
          />
        </View>
      </Card>

      <Text style={styles.sectionLabel}>Legal and your data</Text>
      <Card
        title="Privacy controls"
        subtitle={
          legalConfigurationComplete
            ? `Privacy ${PRIVACY_NOTICE_VERSION} · Terms ${TERMS_VERSION}`
            : 'Production operator and grievance details are not configured. Do not distribute this build.'
        }
      >
        <View style={styles.legalActions}>
          <ActionButton
            label="Privacy Notice"
            variant="secondary"
            onPress={() => router.push('/legal/privacy')}
          />
          <ActionButton
            label="Terms and Conditions"
            variant="secondary"
            onPress={() => router.push('/legal/terms')}
          />
          <ActionButton
            label="Your data rights"
            variant="secondary"
            onPress={() => router.push('/legal/rights')}
          />
        </View>
        <View style={styles.erasureBlock}>
          <Text style={styles.erasureTitle}>Withdraw consent</Text>
          <Text style={styles.erasureBody}>
            Stops monitoring and erases this installation’s personal data. This cannot be undone.
          </Text>
          <ActionButton
            label="Withdraw consent and erase data"
            variant="danger"
            onPress={withdrawConsentAndErase}
            loading={erasing}
          />
        </View>
      </Card>

      <Text style={styles.sectionLabel}>Safety limits</Text>
      <Card>
        <Text style={styles.warningTitle}>SafeCity assists; it does not guarantee safety.</Text>
        <Text style={styles.warningBody}>
          Models can miss emergencies or raise false alarms. Background sensor access varies by device and OS. Camera evidence can only be captured while SafeCity is visible. The SMS composer requires a person to press Send.
        </Text>
      </Card>
    </Screen>
  );
}

function SettingRow({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description: string;
  value: boolean;
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
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.safeSoft }}
        thumbColor={value ? colors.safe : colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: type.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
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
