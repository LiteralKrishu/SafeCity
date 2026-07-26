import { type Href, useRouter } from 'expo-router';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { useLocalization } from '@/i18n/localization-provider';
import { colors, radii, spacing } from '@/theme/tokens';

interface EscapeAction {
  icon: string;
  title: string;
  detail: string;
  onPress: () => void;
}

function EscapeActionTile({
  icon,
  title,
  detail,
  onPress,
}: EscapeAction) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.iconWell}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text numberOfLines={2} style={styles.detail}>{detail}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export function HomeEscapeTools({
  onStartStealth,
}: {
  onStartStealth: () => void;
}) {
  const router = useRouter();
  const { t } = useLocalization();

  const shareCoverText = () => {
    const places = [
      t('escape.locationHome'),
      t('escape.locationOffice'),
      t('escape.locationMetro'),
      t('escape.locationCafe'),
    ];
    Alert.alert(
      t('escape.chooseLocation'),
      t('escape.shareNote'),
      [
        ...places.map((place) => ({
          text: place,
          onPress: () =>
            void Share.share({
              title: t('escape.shareTitle'),
              message: t('escape.locationMessage', { place }),
            }),
        })),
        { text: t('common.cancel'), style: 'cancel' as const },
      ],
    );
  };

  const showExitLines = () => {
    Alert.alert(
      t('escape.scriptsTitle'),
      [
        `• ${t('escape.scriptOne')}`,
        `• ${t('escape.scriptTwo')}`,
        `• ${t('escape.scriptThree')}`,
        `• ${t('escape.scriptFour')}`,
      ].join('\n\n'),
    );
  };

  const actions: EscapeAction[] = [
    {
      icon: '☎',
      title: t('escape.fakeCallTitle'),
      detail: 'Get a realistic call',
      onPress: () => router.push('/fake-call' as Href),
    },
    {
      icon: '◖))',
      title: t('home.siren'),
      detail: 'Play a loud alarm',
      onPress: () => router.push('/siren' as Href),
    },
    {
      icon: '⌖',
      title: 'Safety route',
      detail: 'Pinch map • Google Maps',
      onPress: () => router.push('/safety-navigator' as Href),
    },
    {
      icon: '▰',
      title: t('escape.rideTitle'),
      detail: 'Show ride arrival',
      onPress: () => router.push('/cover-story' as Href),
    },
    {
      icon: '◷',
      title: t('escape.interruptionTitle'),
      detail: 'Choose a call or ride',
      onPress: () => router.push('/timed-interruption' as Href),
    },
    {
      icon: '✉',
      title: 'Cover text',
      detail: 'Share “I arrived”',
      onPress: shareCoverText,
    },
    {
      icon: '“”',
      title: t('escape.scriptsTitle'),
      detail: 'Short reasons to leave',
      onPress: showExitLines,
    },
    {
      icon: '●',
      title: 'Stealth screen',
      detail: 'Dark screen • double-tap out',
      onPress: onStartStealth,
    },
  ];

  return (
    <View>
      <View style={styles.headingRow}>
        <Text style={styles.heading}>QUICK ESCAPE TOOLS</Text>
        <Text style={styles.headingHint}>Tap to open</Text>
      </View>
      <View style={styles.grid}>
        {actions.map((action) => (
          <EscapeActionTile key={action.title} {...action} />
        ))}
      </View>
      <Text style={styles.note}>Escape tools do not send an SOS.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  heading: {
    color: colors.textSubtle,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.75,
  },
  headingHint: {
    color: colors.safe,
    fontSize: 11,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    width: '48%',
    minHeight: 122,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.74,
    transform: [{ scale: 0.985 }],
  },
  iconWell: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.safeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    color: colors.safe,
    fontSize: 18,
    fontWeight: '900',
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginTop: spacing.sm,
    paddingRight: spacing.md,
  },
  detail: {
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
    paddingRight: spacing.sm,
  },
  chevron: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    color: colors.safe,
    fontSize: 24,
  },
  note: {
    color: colors.textSubtle,
    fontSize: 10,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});
