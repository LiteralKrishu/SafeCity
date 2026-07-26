const {
  AndroidConfig,
  withAndroidColors,
  withAndroidColorsNight,
  withAndroidManifest,
} = require('expo/config-plugins');

const lightColors = {
  safecity_background: '#F4F7FA',
  safecity_surface: '#FFFFFF',
  safecity_surface_raised: '#E8EDF2',
  safecity_navigation: '#FFFFFF',
  safecity_border: '#CFD6DE',
  safecity_text: '#111827',
  safecity_text_muted: '#526071',
  safecity_text_subtle: '#667085',
  safecity_watch_soft: '#E5F4FD',
  safecity_watch_border: '#78BCE7',
  safecity_safe_soft: '#DDF7EE',
  safecity_alert_soft: '#FFF1D6',
  safecity_danger_soft: '#FDE7EA',
  safecity_danger_panel: '#FFF7F8',
};

const darkColors = {
  safecity_background: '#080B13',
  safecity_surface: '#12151C',
  safecity_surface_raised: '#1B1E27',
  safecity_navigation: '#0D1420',
  safecity_border: '#2A2E38',
  safecity_text: '#F7F8FA',
  safecity_text_muted: '#969DAC',
  safecity_text_subtle: '#667085',
  safecity_watch_soft: '#10283A',
  safecity_watch_border: '#32658A',
  safecity_safe_soft: '#123B34',
  safecity_alert_soft: '#3E2E16',
  safecity_danger_soft: '#431C28',
  safecity_danger_panel: '#160D13',
};

function applyColors(config, colors) {
  for (const [name, value] of Object.entries(colors)) {
    config.modResults = AndroidConfig.Colors.assignColorValue(config.modResults, {
      name,
      value,
    });
  }
  return config;
}

module.exports = function withSafeCityThemeColors(config) {
  config = withAndroidColors(config, (colorConfig) => applyColors(colorConfig, lightColors));
  config = withAndroidColorsNight(config, (colorConfig) => applyColors(colorConfig, darkColors));
  config = withAndroidManifest(config, (manifestConfig) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      manifestConfig.modResults,
    );
    const mainActivity = application.activity?.find((activity) =>
      activity.$['android:name']?.endsWith('.MainActivity'),
    );
    if (mainActivity) {
      mainActivity.$['android:showWhenLocked'] = 'true';
      mainActivity.$['android:turnScreenOn'] = 'true';
    }
    return manifestConfig;
  });
  return config;
};
