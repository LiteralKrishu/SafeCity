import * as SMS from 'expo-sms';

import type { EmergencyContact, Incident } from '@/types/domain';

export async function sendIncidentSms(
  contacts: EmergencyContact[],
  incident: Incident,
  isTest = false,
): Promise<boolean> {
  if (!(await SMS.isAvailableAsync())) return false;
  const location =
    incident.latitude !== null && incident.longitude !== null
      ? `https://maps.google.com/?q=${incident.latitude},${incident.longitude}`
      : 'Location unavailable';
  const prefix = isTest ? 'SafeCity test alert — no emergency.' : 'SafeCity: possible distress detected.';
  const message = `${prefix}\nTime: ${new Date(incident.createdAt).toLocaleString()}\nLocation: ${location}\nPlease contact the user and local emergency services if needed.`;
  await SMS.sendSMSAsync(
    contacts.filter((contact) => contact.verified).map((contact) => contact.phone),
    message,
  );
  return true;
}

export async function sendContactVerificationSms(phone: string): Promise<boolean> {
  if (!(await SMS.isAvailableAsync())) return false;
  await SMS.sendSMSAsync(
    [phone],
    'SafeCity test alert — no emergency. Please confirm with the SafeCity user that this message arrived.',
  );
  return true;
}

