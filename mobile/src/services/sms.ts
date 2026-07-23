import * as SMS from 'expo-sms';
import * as Battery from 'expo-battery';

import type { EmergencyContact, Incident } from '@/types/domain';

export type EmergencySmsFormat = 'compact' | 'standard';

function encodeBase36Signed(value: number, scale: number): string {
  const scaled = Math.round(value * scale);
  const digits = Math.abs(scaled).toString(36);
  return scaled < 0 ? `-${digits}` : digits;
}

function encodeBase36Unsigned(value: number): string {
  return Math.max(0, Math.round(value)).toString(36);
}

function evidenceCode(status: Incident['evidenceStatus']): string {
  if (status === 'secured') return 's';
  if (status === 'capturing') return 'c';
  if (status === 'partial') return 'p';
  return 'u';
}

function sourceCode(summary: string): string {
  const normalized = summary.toLowerCase();
  if (normalized.includes('manual')) return 'm';
  if (normalized.includes('voice')) return 'v';
  return 'a';
}

async function readBatteryPercent(): Promise<number | null> {
  try {
    const level = await Battery.getBatteryLevelAsync();
    if (level < 0) return null;
    return Math.round(level * 100);
  } catch {
    return null;
  }
}

export function buildCompactIncidentSmsMessage(
  incident: Incident,
  batteryPercent: number | null,
): string {
  const timestamp = encodeBase36Unsigned(
    Math.floor(new Date(incident.createdAt).getTime() / 1_000),
  );
  const risk = encodeBase36Unsigned(incident.riskScore * 100);
  const latitude =
    incident.latitude === null ? '-' : encodeBase36Signed(incident.latitude, 100_000);
  const longitude =
    incident.longitude === null ? '-' : encodeBase36Signed(incident.longitude, 100_000);
  const battery = batteryPercent === null ? '-' : encodeBase36Unsigned(batteryPercent);

  return [
    'SafeCity SOS',
    `SC1|t=${timestamp}|s=${sourceCode(incident.summary)}|r=${risk}|g=${latitude}.${longitude}|b=${battery}|e=${evidenceCode(incident.evidenceStatus)}`,
    'Reply or call if you can.',
  ].join('\n');
}

function buildStandardIncidentSmsMessage(incident: Incident): string {
  const location =
    incident.latitude !== null && incident.longitude !== null
      ? `https://maps.google.com/?q=${incident.latitude},${incident.longitude}`
      : 'Location unavailable';
  return [
    'SafeCity: possible distress detected.',
    `Time: ${new Date(incident.createdAt).toLocaleString()}`,
    `Location: ${location}`,
    'Please contact the user and local emergency services if needed.',
  ].join('\n');
}

export async function buildIncidentSmsMessage(
  incident: Incident,
  format: EmergencySmsFormat = 'compact',
): Promise<string> {
  if (format === 'standard') return buildStandardIncidentSmsMessage(incident);
  const batteryPercent = await readBatteryPercent();
  return buildCompactIncidentSmsMessage(incident, batteryPercent);
}

export async function sendIncidentSms(
  contacts: EmergencyContact[],
  incident: Incident,
  format: EmergencySmsFormat = 'compact',
): Promise<boolean> {
  if (!contacts.length || !(await SMS.isAvailableAsync())) return false;
  const message = await buildIncidentSmsMessage(incident, format);
  await SMS.sendSMSAsync(
    contacts.map((contact) => contact.phone),
    message,
  );
  return true;
}
