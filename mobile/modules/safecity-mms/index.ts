import { requireOptionalNativeModule } from 'expo-modules-core';

interface SafeCityMmsModule {
  sendMmsAsync(
    addresses: string[],
    message: string,
    attachmentUris: string[],
  ): Promise<void>;
}

export default requireOptionalNativeModule<SafeCityMmsModule>('SafeCityMms');
