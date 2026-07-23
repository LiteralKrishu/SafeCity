import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalization } from '@/i18n/localization-provider';
import { colors, radii, spacing, type } from '@/theme/tokens';

export default function CoverStoryScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <Text style={styles.simulation}>{t('cover.simulation')}</Text>
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View style={styles.statusDot} />
          <Text style={styles.status}>{t('cover.arrived')}</Text>
        </View>
        <View style={styles.carIcon}>
          <Text style={styles.carIconText}>▰</Text>
        </View>
        <Text style={styles.title}>{t('cover.rideTitle')}</Text>
        <Text style={styles.driver}>{t('cover.rideDriver')}</Text>
        <Text style={styles.vehicle}>{t('cover.rideVehicle')}</Text>
        <View style={styles.divider} />
        <Text style={styles.prompt}>{t('cover.ridePrompt')}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('cover.dismiss')} onPress={() => router.back()} style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}>
        <Text style={styles.dismissText}>{t('cover.dismiss')}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EEF2F5', padding: spacing.lg, justifyContent: 'center' },
  simulation: { position: 'absolute', top: 58, alignSelf: 'center', color: '#7B8794', fontSize: type.caption, fontWeight: '700' },
  card: { backgroundColor: colors.white, borderRadius: 30, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: '#DCE3E8' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start' },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#1CAD65' },
  status: { color: '#178A52', fontSize: type.caption, fontWeight: '900' },
  carIcon: { width: 84, height: 84, borderRadius: 26, backgroundColor: '#E6F8EF', alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
  carIconText: { color: '#19A861', fontSize: 38 },
  title: { color: '#111827', fontSize: 30, fontWeight: '900', textAlign: 'center', marginTop: spacing.lg },
  driver: { color: '#344054', fontSize: type.heading, fontWeight: '800', marginTop: spacing.lg },
  vehicle: { color: '#667085', fontSize: type.body, marginTop: spacing.xs, textAlign: 'center' },
  divider: { width: '100%', height: StyleSheet.hairlineWidth, backgroundColor: '#D0D5DD', marginVertical: spacing.lg },
  prompt: { color: '#344054', fontSize: type.body, lineHeight: 23, textAlign: 'center' },
  dismiss: { minHeight: 56, borderRadius: radii.md, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', marginTop: spacing.md },
  pressed: { opacity: 0.72 },
  dismissText: { color: colors.white, fontSize: type.body, fontWeight: '900' },
});
