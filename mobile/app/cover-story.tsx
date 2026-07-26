import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useLocalization } from '@/i18n/localization-provider';
import { dismissTimedInterruption } from '@/services/timed-interruption';
import { radii, spacing, type } from '@/theme/tokens';

const rideYellow = '#FFD428';
const rideYellowDeep = '#F0BE00';
const rideBlack = '#171717';
const rideCream = '#FFFDF2';
const rideMuted = '#6F6B5E';

export default function CoverStoryScreen() {
  const router = useRouter();
  const { interruption } = useLocalSearchParams<{
    interruption?: string | string[];
  }>();
  const { t } = useLocalization();
  const openedByTimer = (Array.isArray(interruption) ? interruption[0] : interruption) === '1';

  useEffect(() => {
    if (!openedByTimer) return;
    void dismissTimedInterruption().catch(() => undefined);
    const timeout = setTimeout(() => {
      Alert.alert(
        t('cover.rideTitle'),
        `${t('cover.rideDriver')} · ${t('cover.pickupPoint')}`,
        [{ text: t('escape.open') }],
      );
    }, 350);
    return () => clearTimeout(timeout);
  }, [openedByTimer, t]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar style="dark" />

      <View style={styles.topBar}>
        <View style={styles.brand}>
          <View style={styles.brandMark}>
            <Text style={styles.brandBolt}>↗</Text>
          </View>
          <Text style={styles.brandName}>RIDE</Text>
        </View>
        <View style={styles.privatePill}>
          <View style={styles.privateDot} />
          <Text style={styles.privateText}>{t('cover.simulation')}</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.status}>{t('cover.arrived')}</Text>
        </View>
        <Text style={styles.title}>{t('cover.rideTitle')}</Text>
        <Text style={styles.heroPrompt}>{t('cover.ridePrompt')}</Text>

        <View style={styles.vehicleStage}>
          <View style={styles.pulseOuter} />
          <View style={styles.pulseInner} />
          <View style={styles.scooterBadge}>
            <Text style={styles.scooter}>🛵</Text>
          </View>
          <View style={styles.road}>
            <View style={styles.roadDash} />
            <View style={styles.roadDash} />
            <View style={styles.roadDash} />
          </View>
        </View>
      </View>

      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />

        <View style={styles.driverRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
            <View style={styles.onlineDot} />
          </View>
          <View style={styles.driverCopy}>
            <Text style={styles.driver}>{t('cover.rideDriver')}</Text>
            <Text style={styles.driverStatus}>
              {t('cover.arrived')} · {t('cover.pickupPoint')}
            </Text>
          </View>
          <View style={styles.rating}>
            <Text style={styles.ratingStar}>★</Text>
            <Text style={styles.ratingText}>4.9</Text>
          </View>
        </View>

        <View style={styles.detailGrid}>
          <View style={styles.vehicleCard}>
            <View style={styles.detailIcon}>
              <Text style={styles.detailIconText}>🛵</Text>
            </View>
            <View style={styles.vehicleCopy}>
              <Text style={styles.detailLabel}>{t('cover.vehicleLabel')}</Text>
              <Text style={styles.vehicle}>{t('cover.rideVehicle')}</Text>
            </View>
          </View>

          <View style={styles.otpCard}>
            <Text style={styles.otpLabel}>{t('cover.otpLabel')}</Text>
            <Text style={styles.otp}>4826</Text>
          </View>
        </View>

        <View style={styles.pickupRow}>
          <View style={styles.pin}>
            <View style={styles.pinCore} />
          </View>
          <Text style={styles.prompt}>{t('cover.ridePrompt')}</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('cover.dismiss')}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.dismiss, pressed && styles.pressed]}
        >
          <Text style={styles.dismissText}>{t('cover.dismiss')}</Text>
          <Text style={styles.dismissArrow}>→</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: rideYellow,
  },
  topBar: {
    minHeight: 66,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: rideBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBolt: {
    color: rideYellow,
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 27,
  },
  brandName: {
    color: rideBlack,
    fontSize: type.heading,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  privatePill: {
    position: 'absolute',
    right: 78,
    maxWidth: '58%',
    minHeight: 34,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(23, 23, 23, 0.1)',
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  privateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: rideBlack,
  },
  privateText: {
    flexShrink: 1,
    color: rideBlack,
    fontSize: 10,
    fontWeight: '800',
  },
  hero: {
    flex: 1,
    minHeight: 310,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  statusPill: {
    alignSelf: 'flex-start',
    minHeight: 34,
    borderRadius: radii.pill,
    backgroundColor: rideBlack,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: rideYellow,
  },
  status: {
    color: rideYellow,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  title: {
    maxWidth: 340,
    color: rideBlack,
    fontSize: 40,
    lineHeight: 43,
    fontWeight: '900',
    letterSpacing: -1.2,
    marginTop: spacing.md,
  },
  heroPrompt: {
    maxWidth: 330,
    color: 'rgba(23, 23, 23, 0.72)',
    fontSize: type.body,
    lineHeight: 22,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  vehicleStage: {
    flex: 1,
    minHeight: 150,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pulseOuter: {
    position: 'absolute',
    width: 184,
    height: 184,
    borderRadius: 92,
    borderWidth: 1,
    borderColor: 'rgba(23, 23, 23, 0.12)',
  },
  pulseInner: {
    position: 'absolute',
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: 'rgba(255, 253, 242, 0.36)',
  },
  scooterBadge: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 4,
    borderColor: rideBlack,
    backgroundColor: rideCream,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  scooter: {
    fontSize: 52,
  },
  road: {
    position: 'absolute',
    bottom: 8,
    width: '100%',
    height: 7,
    borderRadius: 4,
    backgroundColor: rideBlack,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  roadDash: {
    width: 42,
    height: 2,
    borderRadius: 1,
    backgroundColor: rideYellow,
  },
  sheet: {
    backgroundColor: rideCream,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    shadowColor: rideBlack,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 18,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D7D1BC',
    marginBottom: spacing.md,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: rideBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: rideYellow,
    fontSize: 25,
    fontWeight: '900',
  },
  onlineDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: rideCream,
    backgroundColor: '#22B573',
  },
  driverCopy: {
    flex: 1,
  },
  driver: {
    color: rideBlack,
    fontSize: type.heading,
    fontWeight: '900',
  },
  driverStatus: {
    color: rideMuted,
    fontSize: type.caption,
    marginTop: 3,
  },
  rating: {
    minHeight: 38,
    borderRadius: radii.pill,
    backgroundColor: '#F2ECCC',
    paddingHorizontal: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingStar: {
    color: rideYellowDeep,
    fontSize: 14,
  },
  ratingText: {
    color: rideBlack,
    fontSize: type.caption,
    fontWeight: '900',
  },
  detailGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  vehicleCard: {
    flex: 1,
    minHeight: 92,
    borderRadius: radii.md,
    backgroundColor: '#F3EED8',
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: rideYellow,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailIconText: {
    fontSize: 20,
  },
  vehicleCopy: {
    flex: 1,
  },
  detailLabel: {
    color: rideMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  vehicle: {
    color: rideBlack,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '800',
    marginTop: 3,
  },
  otpCard: {
    width: 94,
    minHeight: 92,
    borderRadius: radii.md,
    backgroundColor: rideYellow,
    padding: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  otpLabel: {
    color: 'rgba(23, 23, 23, 0.62)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  otp: {
    color: rideBlack,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    marginTop: 3,
  },
  pickupRow: {
    minHeight: 58,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: '#E3DCC1',
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  pin: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: rideBlack,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCore: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: rideYellowDeep,
  },
  prompt: {
    flex: 1,
    color: rideBlack,
    fontSize: type.caption,
    lineHeight: 18,
    fontWeight: '700',
  },
  dismiss: {
    minHeight: 58,
    borderRadius: radii.md,
    backgroundColor: rideBlack,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  dismissText: {
    color: rideCream,
    fontSize: type.body,
    fontWeight: '900',
  },
  dismissArrow: {
    color: rideYellow,
    fontSize: 24,
    fontWeight: '900',
  },
});
