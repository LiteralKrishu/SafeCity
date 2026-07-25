import {
  DynamicColorIOS,
  Platform,
  PlatformColor,
  type ColorValue,
} from 'react-native';

function adaptiveColor(
  light: string,
  dark: string,
  androidResource: string,
  androidThemeFallback: string,
  androidFixedFallback: string,
): ColorValue {
  if (Platform.OS === 'ios') return DynamicColorIOS({ light, dark });
  if (Platform.OS === 'android') {
    return PlatformColor(
      `@color/${androidResource}`,
      androidThemeFallback,
      androidFixedFallback,
    );
  }
  return dark;
}

export const colors = {
  background: adaptiveColor(
    '#F4F7FA',
    '#080B13',
    'safecity_background',
    '?attr/colorBackground',
    '@android:color/black',
  ),
  surface: adaptiveColor(
    '#FFFFFF',
    '#12151C',
    'safecity_surface',
    '?attr/colorBackgroundFloating',
    '@android:color/black',
  ),
  surfaceRaised: adaptiveColor(
    '#E8EDF2',
    '#1B1E27',
    'safecity_surface_raised',
    '?attr/colorButtonNormal',
    '@android:color/black',
  ),
  navigation: adaptiveColor(
    '#FFFFFF',
    '#0D1420',
    'safecity_navigation',
    '?attr/colorBackgroundFloating',
    '@android:color/black',
  ),
  border: adaptiveColor(
    '#CFD6DE',
    '#2A2E38',
    'safecity_border',
    '?attr/colorControlNormal',
    '@android:color/darker_gray',
  ),
  text: adaptiveColor(
    '#111827',
    '#F7F8FA',
    'safecity_text',
    '?attr/colorForeground',
    '@android:color/white',
  ),
  textMuted: adaptiveColor(
    '#526071',
    '#969DAC',
    'safecity_text_muted',
    '?attr/colorForeground',
    '@android:color/darker_gray',
  ),
  textSubtle: adaptiveColor(
    '#667085',
    '#667085',
    'safecity_text_subtle',
    '?attr/colorForeground',
    '@android:color/darker_gray',
  ),
  safe: '#17C990',
  safeDark: '#117455',
  safeSoft: adaptiveColor(
    '#DDF7EE',
    '#123B34',
    'safecity_safe_soft',
    '?attr/colorButtonNormal',
    '@android:color/black',
  ),
  watch: '#7DD3FC',
  watchSoft: adaptiveColor(
    '#E5F4FD',
    '#10283A',
    'safecity_watch_soft',
    '?attr/colorButtonNormal',
    '@android:color/black',
  ),
  watchBorder: adaptiveColor(
    '#78BCE7',
    '#32658A',
    'safecity_watch_border',
    '?attr/colorControlNormal',
    '@android:color/darker_gray',
  ),
  alert: '#FFB547',
  alertSoft: adaptiveColor(
    '#FFF1D6',
    '#3E2E16',
    'safecity_alert_soft',
    '?attr/colorButtonNormal',
    '@android:color/black',
  ),
  danger: '#FF4A55',
  dangerSoft: adaptiveColor(
    '#FDE7EA',
    '#431C28',
    'safecity_danger_soft',
    '?attr/colorButtonNormal',
    '@android:color/black',
  ),
  dangerBorder: '#5D242A',
  dangerPanel: adaptiveColor(
    '#FFF7F8',
    '#160D13',
    'safecity_danger_panel',
    '?attr/colorBackgroundFloating',
    '@android:color/black',
  ),
  white: '#FFFFFF',
  black: '#000000',
} as const;

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 12,
  md: 18,
  lg: 26,
  pill: 999,
} as const;

export const type = {
  display: 36,
  title: 24,
  heading: 18,
  body: 15,
  caption: 12,
} as const;
