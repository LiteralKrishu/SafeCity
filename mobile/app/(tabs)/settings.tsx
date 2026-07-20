import { useFocusEffect } from 'expo-router';
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
  listContacts,
  readSettings,
  removeContact,
  verifyContact,
  writeSettings,
} from '@/db/repository';
import { checkInferenceHealth } from '@/services/inferenceApi';
import { requestCorePermissions } from '@/services/permissions';
import { sendContactVerificationSms } from '@/services/sms';
import { colors, radii, spacing, type } from '@/theme/tokens';
import type { AppSettings, EmergencyContact } from '@/types/domain';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [serviceState, setServiceState] = useState<'unknown' | 'ready' | 'offline'>('unknown');

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

  const verify = async (contact: EmergencyContact) => {
    if (!(await sendContactVerificationSms(contact.phone))) {
      Alert.alert('SMS unavailable', 'SMS is not available on this device.');
      return;
    }
    Alert.alert('Did the test arrive?', 'Confirm only after the recipient tells you it arrived.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, verify',
        onPress: () => void verifyContact(db, contact.id).then(refresh),
      },
    ]);
  };

  const testService = async () => {
    setServiceState('unknown');
    const ready = await checkInferenceHealth(settings.serviceUrl);
    setServiceState(ready ? 'ready' : 'offline');
  };

  return (
    <Screen eyebrow="Local controls" title="Settings">
      <Text style={styles.sectionLabel}>Inference</Text>
      <Card title="Private AI service" subtitle="Use the computer's LAN address on a physical phone, for example http://192.168.1.10:8000.">
        <TextInput
          accessibilityLabel="Local inference service URL"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          value={settings.serviceUrl}
          onChangeText={(serviceUrl) => setSettings((current) => ({ ...current, serviceUrl }))}
          onBlur={() => void writeSettings(db, settings)}
          style={styles.input}
        />
        <View style={styles.serviceRow}>
          <Text
            style={[
              styles.serviceState,
              serviceState === 'ready' && styles.ready,
              serviceState === 'offline' && styles.offline,
            ]}
          >
            {serviceState === 'unknown' ? 'Not checked' : serviceState === 'ready' ? '● Service ready' : '● Service offline'}
          </Text>
          <Pressable onPress={() => void testService()}>
            <Text style={styles.link}>Test connection</Text>
          </Pressable>
        </View>
      </Card>

      <Text style={styles.sectionLabel}>Emergency contacts</Text>
      <Card subtitle="Only verified contacts are included in the SOS message composer.">
        {contacts.map((contact) => (
          <View key={contact.id} style={styles.contactRow}>
            <View style={styles.contactCopy}>
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactPhone}>{contact.phone}</Text>
            </View>
            {!contact.verified ? (
              <Pressable onPress={() => void verify(contact)}>
                <Text style={styles.link}>Verify</Text>
              </Pressable>
            ) : (
              <Text style={styles.verified}>✓ Verified</Text>
            )}
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
      <Card title="Sensor access" subtitle="The dashboard always shows when protection is degraded.">
        <View style={styles.cardAction}>
          <ActionButton
            label="Review sensor permissions"
            variant="secondary"
            onPress={() => void requestCorePermissions().then(() => Alert.alert('Permissions updated'))}
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
  serviceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  serviceState: { color: colors.textMuted, fontSize: type.caption, fontWeight: '700' },
  ready: { color: colors.safe },
  offline: { color: colors.danger },
  link: { color: colors.watch, fontWeight: '800', fontSize: type.caption },
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
  verified: { color: colors.safe, fontWeight: '800', fontSize: type.caption },
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
  warningTitle: { color: colors.alert, fontSize: type.heading, fontWeight: '800' },
  warningBody: { color: colors.textMuted, fontSize: type.body, lineHeight: 22, marginTop: spacing.sm },
});

