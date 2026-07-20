import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';

const EVIDENCE_KEY_NAME = 'safecity.evidence-key.v1';

async function getEvidenceKey(): Promise<AESEncryptionKey> {
  const encoded = await SecureStore.getItemAsync(EVIDENCE_KEY_NAME, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (encoded) return AESEncryptionKey.import(encoded, 'hex');

  const key = await AESEncryptionKey.generate();
  const keyHex = await key.encoded('hex');
  await SecureStore.setItemAsync(EVIDENCE_KEY_NAME, keyHex, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return key;
}

function incidentDirectory(incidentId: string): Directory {
  const directory = new Directory(Paths.document, 'evidence', incidentId);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

export async function encryptEvidenceFile(
  sourceUri: string,
  incidentId: string,
  outputName: string,
): Promise<string> {
  const source = new File(sourceUri);
  const plaintext = await source.bytes();
  const key = await getEvidenceKey();
  const sealed = await aesEncryptAsync(plaintext, key);
  const encryptedBytes = await sealed.combined();

  const output = new File(incidentDirectory(incidentId), `${outputName}.safe`);
  output.create({ overwrite: true, intermediates: true });
  output.write(encryptedBytes);
  if (source.exists) source.delete();
  return output.uri;
}

export async function decryptEvidenceToCache(
  encryptedUri: string,
  outputName: string,
): Promise<string> {
  const encrypted = new File(encryptedUri);
  const sealed = AESSealedData.fromCombined(await encrypted.bytes());
  const key = await getEvidenceKey();
  const plaintext = await aesDecryptAsync(sealed, key, { output: 'bytes' });
  const output = new File(Paths.cache, outputName);
  output.create({ overwrite: true });
  output.write(plaintext);
  return output.uri;
}

export function deleteEvidenceFiles(uris: Array<string | null>): void {
  for (const uri of uris) {
    if (!uri) continue;
    const file = new File(uri);
    if (file.exists) file.delete();
  }
}

