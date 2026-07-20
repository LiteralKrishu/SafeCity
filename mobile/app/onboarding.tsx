import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import {
  addContact,
  listContacts,
  readSettings,
  verifyContact,
  writeSettings,
} from '@/db/repository';
import { requestCorePermissions } from '@/services/permissions';
import { sendContactVerificationSms } from '@/services/sms';
import { colors, radii, spacing, type } from '@/theme/tokens';
import type { EmergencyContact } from '@/types/domain';

const consentItems = [
  'I understand SafeCity is an assistive tool and cannot guarantee detection or emergency response.',
  'I consent to local audio and motion analysis only while I start a monitoring session.',
  'I consent to one front photo, one rear photo, and 15 seconds of audio being encrypted locally after an SOS.',
] as const;

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [consents, setConsents] = useState([false, false, false]);
  const [permissionsRequested, setPermissionsRequested] = useState(false);
  const [permissionSummary, setPermissionSummary] = useState('Not requested');
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  const refreshContacts = async () => setContacts(await listContacts(db));
  useEffect(() => {
    void refreshContacts();
  }, []);

  const canFinish = useMemo(
    () => consents.every(Boolean) && contacts.some((contact) => contact.verified),
    [consents, contacts],
  );

  const requestPermissions = async () => {
    setBusy(true);
    try {
      const result = await requestCorePermissions();
      await Notifications.requestPermissionsAsync();
      const granted = Object.values(result).filter(Boolean).length;
      setPermissionSummary(`${granted} of ${Object.keys(result).length} safety permissions ready`);
      setPermissionsRequested(true);
    } catch {
      setPermissionSummary('Some permissions were unavailable. You can retry in Settings.');
      setPermissionsRequested(true);
    } finally {
      setBusy(false);
    }
  };

  const addNewContact = async () => {
    if (!name.trim() || phone.trim().length < 5) {
      Alert.alert('Contact needed', 'Enter a name and valid phone number.');
      return;
    }
    await addContact(db, name, phone);
    setName('');
    setPhone('');
    await refreshContacts();
  };

  const testContact = async (contact: EmergencyContact) => {
    const opened = await sendContactVerificationSms(contact.phone);
    if (!opened) {
      Alert.alert('SMS unavailable', 'SMS is not available on this device.');
      return;
    }
    Alert.alert('Confirm test alert', 'After the recipient confirms it arrived, mark this contact verified.', [
      { text: 'Not yet', style: 'cancel' },
      {
        text: 'Confirmed',
        onPress: () => {
          void verifyContact(db, contact.id).then(refreshContacts);
        },
      },
    ]);
  };

  const finish = async () => {
    const settings = await readSettings(db);
    await writeSettings(db, {
      ...settings,
      onboardingComplete: true,
      consentVersion: '2026-07-v1',
    });
    router.replace('/(tabs)');
  };

  return (
    <Screen eyebrow="Private by design" title="Your safety setup">
      <View style={styles.intro}>
        <Text style={styles.hero}>Protection that asks before it watches.</Text>
        <Text style={styles.body}>
          Continuous video has been removed. SafeCity analyzes short-lived audio and motion signals, then
          secures evidence locally only after an SOS.
        </Text>
      </View>

      <Text style={styles.sectionLabel}>1 · Understand and consent</Text>
      <Card>
        <View style={styles.stack}>
          {consentItems.map((item, index) => (
            <Pressable
              key={item}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: consents[index] }}
              onPress={() =>
                setConsents((current) => current.map((value, itemIndex) => (itemIndex === index ? !value : value)))
              }
              style={styles.consentRow}
            >
              <View style={[styles.checkbox, consents[index] && styles.checkboxChecked]}>
                <Text style={styles.check}>{consents[index] ? '✓' : ''}</Text>
              </View>
              <Text style={styles.consentText}>{item}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      <Text style={styles.sectionLabel}>2 · Enable safety sensors</Text>
      <Card title="Permissions" subtitle="Denied sensors degrade protection but never disable manual SOS.">
        <View style={styles.cardAction}>
          <Text style={styles.status}>{permissionSummary}</Text>
          <ActionButton
            label={permissionsRequested ? 'Review permissions again' : 'Grant permissions'}
            onPress={() => void requestPermissions()}
            variant="secondary"
            loading={busy}
          />
        </View>
      </Card>

      <Text style={styles.sectionLabel}>3 · Verify an emergency contact</Text>
      <Card title="Trusted contact" subtitle="SafeCity opens a prefilled SMS; the phone OS requires you to send it.">
        <View style={styles.form}>
          <TextInput
            accessibilityLabel="Contact name"
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          <TextInput
            accessibilityLabel="Phone number"
            placeholder="Phone number with country code"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
          />
          <ActionButton label="Add contact" onPress={() => void addNewContact()} variant="secondary" />
        </View>
        {contacts.map((contact) => (
          <View key={contact.id} style={styles.contactRow}>
            <View style={styles.contactCopy}>
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactPhone}>{contact.phone}</Text>
            </View>
            {contact.verified ? (
              <Text style={styles.verified}>✓ Verified</Text>
            ) : (
              <Pressable onPress={() => void testContact(contact)}>
                <Text style={styles.testLink}>Send test</Text>
              </Pressable>
            )}
          </View>
        ))}
      </Card>

      <View style={styles.finish}>
        <ActionButton label="Finish safety setup" onPress={() => void finish()} disabled={!canFinish} />
        {!canFinish ? (
          <Text style={styles.hint}>Accept all three statements and verify at least one contact.</Text>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { marginBottom: spacing.xl },
  hero: { color: colors.text, fontSize: 34, lineHeight: 39, fontWeight: '800', letterSpacing: -1.2 },
  body: { color: colors.textMuted, fontSize: type.body, lineHeight: 23, marginTop: spacing.md },
  sectionLabel: {
    color: colors.textMuted,
    fontWeight: '800',
    fontSize: type.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  stack: { gap: spacing.md },
  consentRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: colors.safe, borderColor: colors.safe },
  check: { color: colors.background, fontWeight: '900' },
  consentText: { flex: 1, color: colors.text, fontSize: type.body, lineHeight: 22 },
  cardAction: { gap: spacing.md, marginTop: spacing.md },
  status: { color: colors.textMuted, fontSize: type.body },
  form: { gap: spacing.sm, marginTop: spacing.md },
  input: {
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: spacing.md,
    fontSize: type.body,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.md,
    paddingTop: spacing.md,
  },
  contactCopy: { flex: 1 },
  contactName: { color: colors.text, fontWeight: '700' },
  contactPhone: { color: colors.textMuted, fontSize: type.caption, marginTop: 3 },
  verified: { color: colors.safe, fontWeight: '800', fontSize: type.caption },
  testLink: { color: colors.watch, fontWeight: '800' },
  finish: { gap: spacing.sm, marginTop: spacing.xl },
  hint: { color: colors.textMuted, textAlign: 'center', fontSize: type.caption },
});

