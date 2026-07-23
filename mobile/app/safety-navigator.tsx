import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { useLocalization } from '@/i18n/localization-provider';
import { colors, radii, spacing, type } from '@/theme/tokens';
import {
  fetchNearbySafetyRadar,
  formatDistance,
  makeMapsDirectionUrl,
  radarPosition,
  summarizeSafeCorridor,
  type SafeHavenPin,
} from '@/utils/safeRoute';

type DestinationCategory = 'police' | 'hospital' | 'metro' | 'pharmacy';

const categories: Array<{
  id: DestinationCategory;
  icon: string;
  title: string;
  query: string;
  detail: string;
}> = [
  { id: 'police', icon: '🚨', title: 'Police station', query: 'police station', detail: 'For immediate danger, call 112 first.' },
  { id: 'hospital', icon: '🏥', title: 'Hospital', query: 'hospital emergency', detail: 'Find a staffed emergency department.' },
  { id: 'metro', icon: '🚇', title: 'Metro or transit', query: 'metro station', detail: 'Find a public, staffed transport point.' },
  { id: 'pharmacy', icon: '✚', title: '24-hour pharmacy', query: '24 hour pharmacy', detail: 'Find a nearby late-hours business.' },
];

export default function SafetyNavigatorScreen() {
  const router = useRouter();
  const { t } = useLocalization();
  const [selected, setSelected] = useState<DestinationCategory>('police');
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [loading, setLoading] = useState(false);
  const [safeHavens, setSafeHavens] = useState<SafeHavenPin[]>([]);
  const [havensLoading, setHavensLoading] = useState(false);
  const [havensLoaded, setHavensLoaded] = useState(false);
  const [havensError, setHavensError] = useState<string | null>(null);
  const [mappedContext, setMappedContext] = useState({
    mappedLitPathSegments: 0,
    emergencyPhones: 0,
  });
  const corridor = useMemo(() => summarizeSafeCorridor(safeHavens), [safeHavens]);
  const safestHaven = safeHavens[0] ?? null;

  const chosenCategory = useMemo(
    () => categories.find((category) => category.id === selected) ?? categories[0]!,
    [selected],
  );

  const refreshLocation = async (requestPermission = true) => {
    setLoading(true);
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && requestPermission) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!permission.granted) throw new Error('Location permission is required to search near you.');
      const nextLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLocation(nextLocation);
      setSafeHavens([]);
      setMappedContext({ mappedLitPathSegments: 0, emergencyPhones: 0 });
      setHavensLoaded(false);
      setHavensError(null);
    } catch (error) {
      Alert.alert('Location unavailable', error instanceof Error ? error.message : 'Try again from phone settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshLocation(false);
  }, []);

  const loadNearbyHavens = async () => {
    if (!location) {
      await refreshLocation();
      return;
    }
    setHavensLoading(true);
    setHavensError(null);
    try {
      const radarData = await fetchNearbySafetyRadar(
        location.coords.latitude,
        location.coords.longitude,
      );
      const pins = radarData.safeHavens;
      setSafeHavens(pins);
      setMappedContext(radarData.context);
      setHavensLoaded(true);
      if (!pins.length) {
        setHavensError('No mapped police, hospital, metro, or pharmacy records were found within 3 km.');
      }
    } catch (error) {
      setSafeHavens([]);
      setMappedContext({ mappedLitPathSegments: 0, emergencyPhones: 0 });
      setHavensLoaded(true);
      setHavensError(
        error instanceof Error
          ? error.message
          : 'Nearby place data is unavailable. Use Maps search instead.',
      );
    } finally {
      setHavensLoading(false);
    }
  };

  const openNearbySearch = async () => {
    if (!location) {
      await refreshLocation();
      return;
    }
    const { latitude, longitude } = location.coords;
    const query = encodeURIComponent(`${chosenCategory.query} near ${latitude},${longitude}`);
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const shareWalkCheckIn = async () => {
    if (!location) return;
    const { latitude, longitude } = location.coords;
    await Share.share({
      message: `SafeCity walk check-in: I am at https://maps.google.com/?q=${latitude},${longitude}. Please check on me.`,
    });
  };

  const openSafestCorridor = async () => {
    if (!location || !safestHaven) {
      await refreshLocation();
      return;
    }
    const { latitude, longitude } = location.coords;
    await Linking.openURL(
      makeMapsDirectionUrl(latitude, longitude, safestHaven.latitude, safestHaven.longitude),
    );
  };

  return (
    <Screen
      eyebrow="Real-location safety tools"
      title="Safety Navigator"
      right={
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.doneButton}>
          <Text style={styles.doneText}>{t('common.done')}</Text>
        </Pressable>
      }
    >
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>⌖</Text>
        <Text style={styles.heroTitle}>{location ? 'Current location ready' : 'Location needed'}</Text>
        <Text style={styles.heroBody}>
          {location
            ? `${location.coords.latitude.toFixed(5)}, ${location.coords.longitude.toFixed(5)} · ±${Math.round(location.coords.accuracy ?? 0)} m`
            : 'Allow location to find staffed public places near your actual position.'}
        </Text>
      </View>

      <Card
        title="Nearby staffed-place radar"
        subtitle="Load mapped police, hospital, metro, pharmacy, lighting, and emergency-phone records. Priority uses place type, distance, listed hours, time of day, and nearby mapped lighting."
      >
        {location && havensLoaded && safeHavens.length ? (
          <>
            <View style={styles.corridorSummary}>
              <View>
                <Text style={styles.corridorScore}>{corridor.score}%</Text>
                <Text style={styles.corridorLabel}>{corridor.label}</Text>
              </View>
              <Text style={styles.corridorDetail}>{corridor.detail}</Text>
            </View>
            <View style={styles.contextRow}>
              <View style={styles.contextMetric}>
                <Text style={styles.contextValue}>{mappedContext.mappedLitPathSegments}</Text>
                <Text style={styles.contextLabel}>mapped lit path segments</Text>
              </View>
              <View style={styles.contextMetric}>
                <Text style={styles.contextValue}>{mappedContext.emergencyPhones}</Text>
                <Text style={styles.contextLabel}>mapped emergency phones</Text>
              </View>
            </View>
            <View style={styles.radar}>
              <View style={styles.radarHalo} />
              <View style={styles.radarRing} />
              <View style={styles.radarCenter} />
              {safeHavens.map((haven) => {
                const position = radarPosition(
                  location.coords.latitude,
                  location.coords.longitude,
                  haven.latitude,
                  haven.longitude,
                );
                return (
                  <Pressable
                    key={haven.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${haven.name}. ${formatDistance(haven.distanceMeters)} away.`}
                    onPress={async () => {
                      if (!location) return;
                      await Linking.openURL(
                        makeMapsDirectionUrl(
                          location.coords.latitude,
                          location.coords.longitude,
                          haven.latitude,
                          haven.longitude,
                        ),
                      );
                    }}
                    style={[
                      styles.radarPin,
                      {
                        left: `${position.left}%`,
                        top: `${position.top}%`,
                        backgroundColor: haven.category === 'police' ? colors.dangerSoft : colors.safeSoft,
                      },
                    ]}
                  >
                    <Text style={styles.radarPinIcon}>{haven.icon}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.havenList}>
              {safeHavens.map((haven) => (
                <Pressable
                  key={haven.id}
                  accessibilityRole="button"
                  onPress={async () => {
                    if (!location) return;
                    await Linking.openURL(
                      makeMapsDirectionUrl(
                        location.coords.latitude,
                        location.coords.longitude,
                        haven.latitude,
                        haven.longitude,
                      ),
                    );
                  }}
                  style={({ pressed }) => [styles.havenRow, pressed && styles.pressed]}
                >
                  <View style={styles.havenIcon}>
                    <Text style={styles.havenIconText}>{haven.icon}</Text>
                  </View>
                  <View style={styles.havenCopy}>
                    <Text style={styles.havenName}>{haven.name}</Text>
                    <Text style={styles.havenDetail}>
                      {haven.corridorLabel} · {formatDistance(haven.distanceMeters)} away
                    </Text>
                    {haven.openingHours ? (
                      <Text style={styles.havenHours}>{haven.openingHours}</Text>
                    ) : null}
                    {haven.mappedLitSegmentsNearby > 0 ? (
                      <Text style={styles.havenHours}>
                        {haven.mappedLitSegmentsNearby} mapped lit path segment
                        {haven.mappedLitSegmentsNearby === 1 ? '' : 's'} nearby
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.havenScore}>{Math.round(haven.corridorScore * 100)}%</Text>
                </Pressable>
              ))}
            </View>
            <ActionButton
              label="Walk to highest-priority place"
              variant="secondary"
              onPress={() => void openSafestCorridor()}
            />
            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}
              style={({ pressed }) => [styles.attribution, pressed && styles.pressed]}
            >
              <Text style={styles.attributionText}>Nearby place data © OpenStreetMap contributors</Text>
            </Pressable>
          </>
        ) : location ? (
          <View style={styles.loadHavens}>
            <Text style={styles.corridorEmpty}>
              {havensError
                ? havensError
                : 'Loading nearby places sends this location to the OpenStreetMap Overpass service. SafeCity does not retain the response after you leave this screen.'}
            </Text>
            <ActionButton
              label={havensLoaded ? 'Retry real nearby places' : 'Load real nearby places'}
              loading={havensLoading}
              variant="secondary"
              onPress={() => void loadNearbyHavens()}
            />
            {havensLoaded ? (
              <Pressable
                accessibilityRole="link"
                onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}
              >
                <Text style={styles.attributionText}>Place data © OpenStreetMap contributors</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Text style={styles.corridorEmpty}>Allow location to load nearby public places.</Text>
        )}
      </Card>

      <Text style={styles.sectionLabel}>Choose a nearby destination</Text>
      <View style={styles.categoryGrid}>
        {categories.map((category) => {
          const active = category.id === selected;
          return (
            <Pressable
              key={category.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              onPress={() => setSelected(category.id)}
              style={({ pressed }) => [styles.category, active && styles.categoryActive, pressed && styles.pressed]}
            >
              <Text style={styles.categoryIcon}>{category.icon}</Text>
              <Text style={[styles.categoryTitle, active && styles.categoryTitleActive]}>{category.title}</Text>
              <Text style={styles.categoryDetail}>{category.detail}</Text>
            </Pressable>
          );
        })}
      </View>

      <Card
        title={`Find ${chosenCategory.title.toLowerCase()}`}
        subtitle="Maps will show real nearby results. Choose a destination there and review the route before walking."
      >
        <View style={styles.actions}>
          <ActionButton label="Open nearby results in Maps" loading={loading} onPress={() => void openNearbySearch()} />
          <ActionButton label="Share walk check-in" disabled={!location} variant="secondary" onPress={() => void shareWalkCheckIn()} />
          <ActionButton label="Call emergency 112" variant="danger" onPress={() => void Linking.openURL('tel:112')} />
        </View>
      </Card>

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Route safety is not guaranteed</Text>
        <Text style={styles.noticeBody}>
          SafeCity does not invent CCTV, crime, or “safe” zones. OpenStreetMap lighting and facility tags may be missing or outdated; missing data does not mean an area is unsafe. Maps routes may not follow mapped lighting. Stay in visible public areas and call 112 in immediate danger.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  doneButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  doneText: { color: colors.watch, fontWeight: '900' },
  hero: { borderRadius: radii.lg, borderWidth: 1, borderColor: colors.safeDark, backgroundColor: colors.safeSoft, padding: spacing.lg, alignItems: 'center' },
  heroIcon: { color: colors.safe, fontSize: 45, fontWeight: '900' },
  heroTitle: { color: colors.text, fontSize: type.heading, fontWeight: '900', marginTop: spacing.sm },
  heroBody: { color: colors.textMuted, fontSize: type.caption, lineHeight: 19, textAlign: 'center', marginTop: spacing.xs },
  corridorSummary: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  corridorScore: { color: colors.safe, fontSize: 32, fontWeight: '900', lineHeight: 34 },
  corridorLabel: { color: colors.text, fontSize: type.body, fontWeight: '800', marginTop: 2 },
  corridorDetail: { flex: 1, color: colors.textMuted, fontSize: type.caption, lineHeight: 18, textAlign: 'right' },
  contextRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  contextMetric: { flex: 1, borderRadius: radii.md, backgroundColor: colors.surfaceRaised, padding: spacing.md },
  contextValue: { color: colors.safe, fontSize: type.heading, fontWeight: '900' },
  contextLabel: { color: colors.textMuted, fontSize: 10, lineHeight: 15, marginTop: 2 },
  radar: {
    height: 210,
    borderRadius: radii.lg,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  radarHalo: {
    position: 'absolute',
    top: '10%',
    left: '10%',
    right: '10%',
    bottom: '10%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.safeSoft,
  },
  radarRing: {
    position: 'absolute',
    top: '24%',
    left: '24%',
    right: '24%',
    bottom: '24%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.safeSoft,
  },
  radarCenter: {
    position: 'absolute',
    left: '48%',
    top: '48%',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.safe,
    borderWidth: 3,
    borderColor: colors.background,
  },
  radarPin: {
    position: 'absolute',
    width: 42,
    height: 42,
    marginLeft: -21,
    marginTop: -21,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarPinIcon: { fontSize: 20 },
  havenList: { gap: spacing.sm, marginBottom: spacing.md },
  havenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
  },
  havenIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.safeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  havenIconText: { fontSize: 20 },
  havenCopy: { flex: 1 },
  havenName: { color: colors.text, fontSize: type.body, fontWeight: '800' },
  havenDetail: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: 3 },
  havenHours: { color: colors.textSubtle, fontSize: 10, lineHeight: 15, marginTop: 2 },
  havenScore: { color: colors.safe, fontSize: type.body, fontWeight: '900' },
  corridorEmpty: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: spacing.md },
  loadHavens: { gap: spacing.md },
  attribution: { alignSelf: 'center', padding: spacing.sm },
  attributionText: { color: colors.textSubtle, fontSize: 10, lineHeight: 15, textAlign: 'center' },
  sectionLabel: { color: colors.textMuted, fontSize: type.caption, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.lg, marginBottom: spacing.sm },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  category: { width: '48%', minHeight: 152, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md },
  categoryActive: { borderColor: colors.safe, backgroundColor: colors.safeSoft },
  pressed: { opacity: 0.75 },
  categoryIcon: { fontSize: 24 },
  categoryTitle: { color: colors.text, fontSize: type.body, fontWeight: '900', marginTop: spacing.sm },
  categoryTitleActive: { color: colors.safe },
  categoryDetail: { color: colors.textMuted, fontSize: 11, lineHeight: 16, marginTop: spacing.xs },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  notice: { borderRadius: radii.md, borderWidth: 1, borderColor: colors.dangerBorder, backgroundColor: colors.dangerPanel, padding: spacing.md, marginTop: spacing.md },
  noticeTitle: { color: colors.danger, fontSize: type.body, fontWeight: '900' },
  noticeBody: { color: colors.textMuted, fontSize: type.caption, lineHeight: 18, marginTop: spacing.xs },
});
