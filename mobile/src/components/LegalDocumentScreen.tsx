import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import type { LegalSection } from '@/legal/content';
import {
  LEGAL_EFFECTIVE_DATE,
  legalConfigurationComplete,
} from '@/legal/content';
import { colors, spacing, type } from '@/theme/tokens';

export function LegalDocumentScreen({
  eyebrow,
  title,
  version,
  sections,
}: {
  eyebrow: string;
  title: string;
  version: string;
  sections: LegalSection[];
}) {
  const router = useRouter();

  return (
    <Screen
      eyebrow={eyebrow}
      title={title}
      right={
        <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={() => router.back()}>
          <Text style={styles.close}>Close</Text>
        </Pressable>
      }
    >
      <Text style={styles.version}>Version {version} · Effective {LEGAL_EFFECTIVE_DATE}</Text>

      {!legalConfigurationComplete ? (
        <View accessibilityRole="alert" style={styles.releaseBlocker}>
          <Text style={styles.releaseBlockerTitle}>Production release blocked</Text>
          <Text style={styles.releaseBlockerBody}>
            The operator name, address, privacy contact, Grievance Officer and court jurisdiction must be configured before distribution.
          </Text>
        </View>
      ) : null}

      <View style={styles.sections}>
        {sections.map((section) => (
          <Card key={section.title} title={section.title}>
            {section.paragraphs?.map((paragraph) => (
              <Text key={paragraph} style={styles.paragraph}>{paragraph}</Text>
            ))}
            {section.bullets?.map((bullet) => (
              <View key={bullet} style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{bullet}</Text>
              </View>
            ))}
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { color: colors.watch, fontWeight: '800' },
  version: { color: colors.textMuted, fontSize: type.caption, marginBottom: spacing.md },
  releaseBlocker: {
    borderWidth: 1,
    borderColor: colors.alert,
    backgroundColor: colors.alertSoft,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  releaseBlockerTitle: { color: colors.alert, fontWeight: '800', fontSize: type.body },
  releaseBlockerBody: { color: colors.text, fontSize: type.caption, lineHeight: 18, marginTop: spacing.xs },
  sections: { gap: spacing.md },
  paragraph: { color: colors.textMuted, fontSize: type.body, lineHeight: 23, marginTop: spacing.md },
  bulletRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  bullet: { color: colors.safe, fontSize: type.body, fontWeight: '900' },
  bulletText: { flex: 1, color: colors.textMuted, fontSize: type.body, lineHeight: 23 },
});
