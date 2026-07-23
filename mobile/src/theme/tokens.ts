import { DynamicColorIOS, Platform, PlatformColor, type ColorValue } from 'react-native';

function adaptiveColor(light: string, dark: string, androidAttribute: string): ColorValue {
  if (Platform.OS === 'ios') return DynamicColorIOS({ light, dark });
  if (Platform.OS === 'android') return PlatformColor(androidAttribute);
  return dark;
}

export const colors = {
  background: adaptiveColor('#F4F7FA', '#080B13', '?attr/colorBackground'),
  surface: adaptiveColor('#FFFFFF', '#12151C', '?attr/colorBackgroundFloating'),
  surfaceRaised: adaptiveColor('#E8EDF2', '#1B1E27', '?attr/colorButtonNormal'),
  navigation: adaptiveColor('#FFFFFF', '#0D1420', '?attr/colorBackgroundFloating'),
  border: adaptiveColor('#CFD6DE', '#2A2E38', '?attr/colorControlNormal'),
  text: adaptiveColor('#111827', '#F7F8FA', '?attr/textColorPrimary'),
  textMuted: adaptiveColor('#526071', '#969DAC', '?attr/textColorSecondary'),
  textSubtle: adaptiveColor('#667085', '#667085', '?attr/textColorSecondary'),
  safe: '#17C990',
  safeDark: '#117455',
  safeSoft: adaptiveColor('#DDF7EE', '#123B34', '?attr/colorButtonNormal'),
  watch: '#7DD3FC',
  alert: '#FFB547',
  alertSoft: adaptiveColor('#FFF1D6', '#3E2E16', '?attr/colorButtonNormal'),
  danger: '#FF4A55',
  dangerSoft: adaptiveColor('#FDE7EA', '#431C28', '?attr/colorButtonNormal'),
  dangerBorder: '#5D242A',
  dangerPanel: adaptiveColor('#FFF7F8', '#160D13', '?attr/colorBackgroundFloating'),
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
