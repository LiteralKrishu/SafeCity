const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requireText = (source, text, label) => {
  if (!source.includes(text)) throw new Error(`Missing ${label}: ${text}`);
};

const appConfig = JSON.parse(read('app.json')).expo;
const domain = read('src/types/domain.ts');
const migrations = read('src/db/migrations.ts');
const repository = read('src/db/repository.ts');
const capture = read('app/capture.tsx');
const settings = read('app/(tabs)/settings.tsx');
const sms = read('src/services/sms.ts');
const permissions = read('src/services/permissions.ts');
const nativeMms = read(
  'modules/safecity-mms/android/src/main/java/com/safecity/mms/SafeCityMmsModule.kt',
);

if (appConfig.version !== '3.0.1' || appConfig.android.versionCode !== 3) {
  throw new Error('The requested app version must remain name 3.0.1 / code 3.');
}
if (!appConfig.android.permissions.includes('SEND_SMS')) {
  throw new Error('Android SEND_SMS permission is missing.');
}

requireText(domain, "'guardian' | 'police'", 'contact roles');
requireText(migrations, "role TEXT NOT NULL DEFAULT 'guardian'", 'contact-role migration');
requireText(repository, 'automaticSosMessagingEnabled: true', 'guardian auto-send default');
requireText(repository, 'policeSosEnabled: false', 'police off-by-default rule');
requireText(settings, 'Auto-send to guardians', 'guardian delivery switch');
requireText(settings, 'Send to selected police contact', 'police delivery switch');
requireText(settings, 'requestAutomaticSmsPermission', 'explicit SMS permission request');
requireText(capture, 'getPreciseCurrentLocation', 'fresh SOS location');
requireText(capture, 'sendIncidentSosAutomatically', 'automatic post-capture dispatch');
requireText(
  capture,
  "contact.role === 'police' && settings.policeSosEnabled",
  'police recipient gate',
);
requireText(sms, 'https://maps.google.com/?q=', 'clickable GPS link');
requireText(sms, 'incident.rearPhotoUri', 'rear photo attachment');
requireText(sms, 'incident.frontPhotoUri', 'front photo attachment');
requireText(sms, 'incident.audioUri', 'audio attachment');
requireText(sms, 'sendEmergencyMmsAsync', 'native evidence dispatch');
requireText(permissions, 'PermissionsAndroid.PERMISSIONS.SEND_SMS', 'runtime SMS permission');
requireText(nativeMms, 'setUseSystemSending(true)', 'Android system MMS dispatch');
requireText(nativeMms, 'setSave(false)', 'non-default SMS app dispatch');
requireText(nativeMms, 'setMessageUri(Uri.EMPTY)', 'non-persisted MMS request');
requireText(nativeMms, 'emergencyMessage.addImage', 'native image attachment');
requireText(nativeMms, 'emergencyMessage.addMedia', 'native audio attachment');

console.log(
  JSON.stringify(
    {
      versionName: appConfig.version,
      versionCode: appConfig.android.versionCode,
      guardianAutoSend: true,
      currentLocationAttached: true,
      imagesAndAudioAttached: true,
      policeOffByDefault: true,
      policeRequiresContactRoleAndToggle: true,
    },
    null,
    2,
  ),
);
