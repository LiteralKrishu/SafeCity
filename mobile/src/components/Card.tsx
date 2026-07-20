import type { PropsWithChildren, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, type } from '@/theme/tokens';

interface CardProps extends PropsWithChildren {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
}

export function Card({ title, subtitle, right, children }: CardProps) {
  return (
    <View style={styles.card}>
      {(title || subtitle || right) && (
        <View style={styles.header}>
          <View style={styles.copy}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  copy: { flex: 1 },
  title: { color: colors.text, fontSize: type.heading, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: type.caption, marginTop: 4, lineHeight: 18 },
});

