import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLocalization } from '@/i18n/localization-provider';
import { colors, radii, spacing, type } from '@/theme/tokens';

export function EscapeToolCard({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: string;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const { t } = useLocalization();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${detail}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconWell}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <View style={styles.action}>
        <Text style={styles.actionText}>{t('escape.open')}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 132,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  pressed: { opacity: 0.74, transform: [{ scale: 0.99 }] },
  iconWell: { width: 48, height: 48, borderRadius: 15, backgroundColor: colors.safeSoft, alignItems: 'center', justifyContent: 'center' },
  icon: { color: colors.safe, fontSize: 23, fontWeight: '900' },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: type.heading, fontWeight: '900' },
  detail: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: 5 },
  action: { position: 'absolute', right: spacing.md, bottom: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { color: colors.safe, fontSize: type.caption, fontWeight: '800' },
  chevron: { color: colors.safe, fontSize: 22 },
});
