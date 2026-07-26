import * as SMS from 'expo-sms';
import * as Battery from 'expo-battery';
import { File } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import SafeCityMms from '../../modules/safecity-mms';
import { decryptEvidenceToCache } from '@/services/evidence';
import type { EmergencyContact, Incident } from '@/types/domain';

interface EvidenceAttachmentSpec {
  encryptedUri: string | null;
  filename: string;
  mimeType: string;
}

export interface AutomaticSosDispatchResult {
  requested: number;
  evidenceAttachments: number;
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

function describeEvidence(status: Incident['evidenceStatus']): string {
  if (status === 'secured') return 'Photos and audio captured and attached.';
  if (status === 'partial') return 'Available emergency evidence is attached.';
  if (status === 'capturing') return 'Emergency evidence capture is still being completed.';
  return 'No emergency evidence was available.';
}

export function buildReadableIncidentSmsMessage(
  incident: Incident,
  batteryPercent: number | null,
): string {
  const location =
    incident.latitude !== null && incident.longitude !== null
      ? `https://maps.google.com/?q=${incident.latitude},${incident.longitude}`
      : 'Location unavailable';
  const battery =
    batteryPercent === null ? 'Battery level unavailable' : `Phone battery: ${batteryPercent}%`;

  return [
    'SafeCity Emergency SOS',
    'I may be in danger and need help.',
    `Trigger: ${incident.summary}`,
    `Time: ${new Date(incident.createdAt).toLocaleString()}`,
    `Location: ${location}`,
    battery,
    `Evidence: ${describeEvidence(incident.evidenceStatus)}`,
    'Please call me immediately and contact local emergency services if needed.',
  ].join('\n');
}

export async function buildIncidentSmsMessage(
  incident: Incident,
): Promise<string> {
  const batteryPercent = await readBatteryPercent();
  return buildReadableIncidentSmsMessage(incident, batteryPercent);
}

function evidenceAttachmentSpecs(incident: Incident): EvidenceAttachmentSpec[] {
  return [
    {
      encryptedUri: incident.rearPhotoUri,
      filename: 'safecity-rear-photo.jpg',
      mimeType: 'image/jpeg',
    },
    {
      encryptedUri: incident.frontPhotoUri,
      filename: 'safecity-front-photo.jpg',
      mimeType: 'image/jpeg',
    },
    {
      encryptedUri: incident.snapshotAudioUri,
      filename: 'safecity-pre-alert-audio.wav',
      mimeType: 'audio/wav',
    },
    {
      encryptedUri: incident.audioUri,
      filename: 'safecity-post-sos-audio.m4a',
      mimeType: 'audio/mp4',
    },
  ];
}

async function prepareEvidenceAttachments(
  incident: Incident,
): Promise<{ attachments: SMS.SMSAttachment[]; temporaryUris: string[] }> {
  const attachments: SMS.SMSAttachment[] = [];
  const temporaryUris: string[] = [];

  for (const spec of evidenceAttachmentSpecs(incident)) {
    if (!spec.encryptedUri) continue;
    try {
      const temporaryUri = await decryptEvidenceToCache(
        spec.encryptedUri,
        `${incident.id}-${spec.filename}`,
      );
      temporaryUris.push(temporaryUri);
      attachments.push({
        uri: Platform.OS === 'android'
          ? await getContentUriAsync(temporaryUri)
          : temporaryUri,
        mimeType: spec.mimeType,
        filename: spec.filename,
      });
    } catch {
      // Continue with any evidence that can be prepared successfully.
    }
  }

  return { attachments, temporaryUris };
}

function deleteTemporaryEvidence(uris: string[]): void {
  for (const uri of uris) {
    const file = new File(uri);
    if (file.exists) file.delete();
  }
}

async function openIncidentMessageComposer(
  addresses: string[],
  message: string,
  attachments: SMS.SMSAttachment[],
): Promise<void> {
  if (Platform.OS === 'android' && attachments.length > 1 && SafeCityMms) {
    await SafeCityMms.sendMmsAsync(
      addresses,
      message,
      attachments.map((attachment) => attachment.uri),
    );
    return;
  }

  await SMS.sendSMSAsync(addresses, message, attachments.length ? { attachments } : undefined);
}

export async function sendIncidentSms(
  contacts: EmergencyContact[],
  incident: Incident,
): Promise<boolean> {
  if (!contacts.length || !(await SMS.isAvailableAsync())) return false;
  const message = await buildIncidentSmsMessage(incident);
  const addresses = contacts.map((contact) => contact.phone);
  const { attachments, temporaryUris } = await prepareEvidenceAttachments(incident);

  try {
    await openIncidentMessageComposer(addresses, message, attachments);
  } catch {
    await SMS.sendSMSAsync(
      addresses,
      message,
      attachments[0] ? { attachments: attachments[0] } : undefined,
    );
  } finally {
    deleteTemporaryEvidence(temporaryUris);
  }
  return true;
}

export async function sendIncidentSosAutomatically(
  contacts: EmergencyContact[],
  incident: Incident,
): Promise<AutomaticSosDispatchResult | null> {
  if (
    Platform.OS !== 'android' ||
    !SafeCityMms ||
    contacts.length === 0 ||
    !(await SafeCityMms.canAutoSendAsync())
  ) {
    return null;
  }

  const message = await buildIncidentSmsMessage(incident);
  const addresses = [...new Set(contacts.map((contact) => contact.phone))];
  const { attachments, temporaryUris } = await prepareEvidenceAttachments(incident);

  try {
    return await SafeCityMms.sendEmergencyMmsAsync(
      addresses,
      message,
      attachments.map((attachment) => attachment.uri),
      attachments.map((attachment) => attachment.mimeType),
      attachments.map((attachment) => attachment.filename),
    );
  } finally {
    deleteTemporaryEvidence(temporaryUris);
  }
}
