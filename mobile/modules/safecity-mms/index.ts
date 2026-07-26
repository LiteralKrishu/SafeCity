import { requireOptionalNativeModule } from 'expo-modules-core';

interface SafeCityMmsModule {
  canAutoSendAsync(): Promise<boolean>;
  sendEmergencyMmsAsync(
    addresses: string[],
    message: string,
    attachmentUris: string[],
    attachmentMimeTypes: string[],
    attachmentFileNames: string[],
  ): Promise<{
    requested: number;
    evidenceAttachments: number;
  }>;
  sendMmsAsync(
    addresses: string[],
    message: string,
    attachmentUris: string[],
  ): Promise<void>;
}

export default requireOptionalNativeModule<SafeCityMmsModule>('SafeCityMms');
