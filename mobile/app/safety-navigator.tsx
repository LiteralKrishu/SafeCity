import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/ActionButton';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { SafetyMap } from '@/components/SafetyMap';
import { useLocalization } from '@/i18n/localization-provider';
import {
  getCurrentLocation,
  getPreciseCurrentLocation,
  type SafeCityLocationFix,
} from '@/services/backgroundLocation';
import {
  fetchRiskZones,
  isRiskServiceConfigured,
  type RiskZoneSnapshot,
} from '@/services/riskZones';
import { colors, radii, spacing, type } from '@/theme/tokens';
import {
  fetchNearbySafetyRadar,
  fetchWalkingRoute,
  formatDistance,
  formatWalkingDuration,
  makeMapsDirectionUrl,
  nearestSafeHavens,
  summarizeSafeCorridor,
  type SafeHavenPin,
  type WalkingRoute,
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
  const { height: windowHeight } = useWindowDimensions();
  const [selected, setSelected] = useState<DestinationCategory>('police');
  const [location, setLocation] = useState<SafeCityLocationFix | null>(null);
  const [loading, setLoading] = useState(false);
  const [safeHavens, setSafeHavens] = useState<SafeHavenPin[]>([]);
  const [selectedHavenId, setSelectedHavenId] = useState<string | null>(null);
  const [mapExpanded, setMapExpanded] = useState(false);
  const [havensLoading, setHavensLoading] = useState(false);
  const [havensError, setHavensError] = useState<string | null>(null);
  const [walkingRoute, setWalkingRoute] = useState<WalkingRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [riskSnapshot, setRiskSnapshot] = useState<RiskZoneSnapshot | null>(null);
  const [riskZonesLoading, setRiskZonesLoading] = useState(false);
  const [riskZonesError, setRiskZonesError] = useState<string | null>(null);
  const routeRequestId = useRef(0);
  const locationRequestId = useRef(0);
  const [mappedContext, setMappedContext] = useState({
    mappedLitPathSegments: 0,
    emergencyPhones: 0,
  });
  const nearestHavens = useMemo(
    () => nearestSafeHavens(safeHavens, selected),
    [safeHavens, selected],
  );
  const corridor = useMemo(() => summarizeSafeCorridor(nearestHavens), [nearestHavens]);
  const nearestHaven = nearestHavens[0] ?? null;
  const selectedHaven =
    nearestHavens.find((haven) => haven.id === selectedHavenId) ?? nearestHaven;
  const mappedHavens = useMemo(() => {
    const visibleRadius = Math.max(700, (selectedHaven?.distanceMeters ?? 0) * 1.15);
    const nearestWithinRadius = nearestHavens
      .filter((haven) => haven.distanceMeters <= visibleRadius)
      .slice(0, 5);
    if (selectedHaven && !nearestWithinRadius.some((haven) => haven.id === selectedHaven.id)) {
      nearestWithinRadius.push(selectedHaven);
    }
    return nearestWithinRadius.length ? nearestWithinRadius : nearestHavens.slice(0, 1);
  }, [nearestHavens, selectedHaven]);

  const chosenCategory = useMemo(
    () => categories.find((category) => category.id === selected) ?? categories[0]!,
    [selected],
  );

  const refreshLocation = async (
    requestPermission = true,
  ): Promise<SafeCityLocationFix | null> => {
    const requestId = locationRequestId.current + 1;
    locationRequestId.current = requestId;
    setLoading(true);
    try {
      let permission = await Location.getForegroundPermissionsAsync();
      if (!permission.granted && requestPermission) {
        permission = await Location.requestForegroundPermissionsAsync();
      }
      if (!permission.granted) throw new Error('Location permission is required to search near you.');
      const nextLocation = await getCurrentLocation();
      if (!nextLocation) throw new Error('A current GPS location could not be obtained.');
      setLocation(nextLocation);
      setSafeHavens([]);
      setSelectedHavenId(null);
      setMapExpanded(false);
      setMappedContext({ mappedLitPathSegments: 0, emergencyPhones: 0 });
      setHavensError(null);
      setWalkingRoute(null);
      setRouteError(null);
      setRiskZonesError(null);
      void getPreciseCurrentLocation()
        .then((preciseLocation) => {
          if (!preciseLocation || locationRequestId.current !== requestId) return;
          setLocation((currentLocation) =>
            currentLocation && preciseLocation.timestamp < currentLocation.timestamp
              ? currentLocation
              : preciseLocation,
          );
        })
        .catch(() => undefined);
      return nextLocation;
    } catch (error) {
      Alert.alert('Location unavailable', error instanceof Error ? error.message : 'Try again from phone settings.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadNearbyHavens = async (
    providedLocation?: SafeCityLocationFix,
  ): Promise<SafeHavenPin[]> => {
    const activeLocation = providedLocation ?? location ?? (await refreshLocation());
    if (!activeLocation) return [];
    setHavensLoading(true);
    setHavensError(null);
    try {
      const radarData = await fetchNearbySafetyRadar(
        activeLocation.latitude,
        activeLocation.longitude,
      );
      const pins = radarData.safeHavens;
      setSafeHavens(pins);
      const nearestPin = nearestSafeHavens(pins, selected, 1)[0];
      setSelectedHavenId(nearestPin?.id ?? null);
      setMappedContext(radarData.context);
      if (!pins.length) {
        setHavensError('No mapped police, hospital, metro, or pharmacy records were found within 3 km.');
      }
      return pins;
    } catch (error) {
      setSafeHavens([]);
      setMappedContext({ mappedLitPathSegments: 0, emergencyPhones: 0 });
      setHavensError(
        error instanceof Error
          ? error.message
          : 'Nearby place data is unavailable. Use Maps search instead.',
      );
      return [];
    } finally {
      setHavensLoading(false);
    }
  };

  const loadRiskZoneLayer = async (
    activeLocation: SafeCityLocationFix,
  ): Promise<void> => {
    if (!isRiskServiceConfigured()) {
      setRiskSnapshot(null);
      return;
    }
    setRiskZonesLoading(true);
    setRiskZonesError(null);
    try {
      setRiskSnapshot(await fetchRiskZones(activeLocation));
    } catch (error) {
      setRiskSnapshot(null);
      setRiskZonesError(
        error instanceof Error
          ? error.message
          : 'Community risk zones are temporarily unavailable.',
      );
    } finally {
      setRiskZonesLoading(false);
    }
  };

  useEffect(() => {
    void (async () => {
      const activeLocation = await refreshLocation(true);
      if (activeLocation) {
        await Promise.all([
          loadNearbyHavens(activeLocation),
          loadRiskZoneLayer(activeLocation),
        ]);
      }
    })();
  }, []);

  useEffect(() => {
    const selectedIsVisible = nearestHavens.some(
      (haven) => haven.id === selectedHavenId,
    );
    if (!selectedIsVisible) {
      setSelectedHavenId(nearestHaven?.id ?? null);
    }
  }, [nearestHaven?.id, nearestHavens, selectedHavenId]);

  useEffect(() => {
    const requestId = routeRequestId.current + 1;
    routeRequestId.current = requestId;
    if (!location || !selectedHaven) {
      setWalkingRoute(null);
      setRouteLoading(false);
      setRouteError(null);
      return;
    }

    setWalkingRoute(null);
    setRouteLoading(true);
    setRouteError(null);
    void fetchWalkingRoute(
      location.latitude,
      location.longitude,
      selectedHaven.latitude,
      selectedHaven.longitude,
    )
      .then((route) => {
        if (routeRequestId.current === requestId) setWalkingRoute(route);
      })
      .catch((error) => {
        if (routeRequestId.current !== requestId) return;
        setRouteError(
          error instanceof Error
            ? error.message
            : 'A walking route could not be loaded for this destination.',
        );
      })
      .finally(() => {
        if (routeRequestId.current === requestId) setRouteLoading(false);
      });
  }, [location, selectedHaven]);

  const refreshNearbyMap = async () => {
    const activeLocation = await refreshLocation();
    if (activeLocation) {
      await Promise.all([
        loadNearbyHavens(activeLocation),
        loadRiskZoneLayer(activeLocation),
      ]);
    }
  };

  const selectCategory = (category: DestinationCategory) => {
    setSelected(category);
    const nearestMatch = nearestSafeHavens(safeHavens, category, 1)[0];
    setSelectedHavenId(nearestMatch?.id ?? null);
  };

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Maps unavailable', 'No compatible maps app could open this destination.');
    }
  };

  const openNearbySearch = async () => {
    const activeLocation = location ?? (await refreshLocation());
    if (!activeLocation) return;
    const { latitude, longitude } = activeLocation;
    const query = `${chosenCategory.query} near ${latitude},${longitude}`;
    const deviceMapsUrl =
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?q=${encodeURIComponent(query)}`
        : `geo:${latitude},${longitude}?q=${encodeURIComponent(query)}`;
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    Alert.alert('Open outside SafeCity', `Search for ${chosenCategory.title.toLowerCase()} using:`, [
      {
        text: Platform.OS === 'ios' ? 'Apple Maps' : 'Device Maps',
        onPress: () => void openUrl(deviceMapsUrl),
      },
      {
        text: 'Google Maps',
        onPress: () => void openUrl(googleMapsUrl),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const shareWalkCheckIn = async () => {
    if (!location) return;
    const { latitude, longitude } = location;
    await Share.share({
      message: `SafeCity walk check-in: I am at https://maps.google.com/?q=${latitude},${longitude}. Please check on me.`,
    });
  };

  const openGoogleDirections = (haven: SafeHavenPin | null) => {
    if (!location || !haven) return;
    const { latitude, longitude } = location;
    void openUrl(
      makeMapsDirectionUrl(
        latitude,
        longitude,
        haven.latitude,
        haven.longitude,
      ),
    );
  };

  const openInAppMap = async (category?: DestinationCategory) => {
    const activeLocation = location ?? (await refreshLocation());
    if (!activeLocation) return;
    let pins = safeHavens;
    if (!pins.length) pins = await loadNearbyHavens(activeLocation);
    const activeCategory = category ?? selected;
    const nextPin = nearestSafeHavens(pins, activeCategory, 1)[0] ?? null;
    setSelectedHavenId(nextPin?.id ?? null);
    if (!nextPin) {
      Alert.alert(
        `No mapped ${chosenCategory.title.toLowerCase()} nearby`,
        'SafeCity found no matching OpenStreetMap record within 3 km. You can still search in your maps app.',
      );
      return;
    }
    setMapExpanded(true);
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
      <Card
        title="Live safe-walk map"
        subtitle="SafeCity automatically finds nearby staffed places and draws a walking route to the selected pin."
      >
        {location ? (
          <>
            <View style={styles.locationBar}>
              <View style={styles.locationStatus}>
                <View style={styles.locationDot} />
                <View style={styles.locationCopy}>
                  <Text style={styles.locationLabel}>LIVE LOCATION</Text>
                  <Text style={styles.locationValue}>
                    {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
                    {' · '}±{Math.round(location.accuracy ?? 0)} m
                  </Text>
                </View>
              </View>
              <Pressable
                accessibilityLabel="Refresh location and nearby places"
                accessibilityRole="button"
                onPress={() => void refreshNearbyMap()}
                style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed]}
              >
                <Text style={styles.refreshText}>↻</Text>
              </Pressable>
            </View>

            <SafetyMap
              center={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              height={360}
              onSelectPin={(haven) => setSelectedHavenId(haven.id)}
              pins={mappedHavens}
              riskZones={riskSnapshot?.zones}
              route={walkingRoute?.coordinates}
              routeLoading={routeLoading}
              selectedPinId={selectedHaven?.id}
            />

            <View style={styles.riskSummary}>
              <View style={styles.riskLegend}>
                <View style={[styles.riskLegendDot, styles.riskLegendEmerging]} />
                <View style={[styles.riskLegendDot, styles.riskLegendElevated]} />
                <View style={[styles.riskLegendDot, styles.riskLegendHigh]} />
              </View>
              <View style={styles.riskSummaryCopy}>
                <Text style={styles.riskSummaryTitle}>Anonymous community risk zones</Text>
                <Text style={styles.riskSummaryText}>
                  {!isRiskServiceConfigured()
                    ? 'Connect the risk aggregation service to show privacy-protected zones.'
                    : riskZonesLoading
                      ? 'Refreshing recent community distress patterns…'
                      : riskZonesError
                        ? riskZonesError
                        : riskSnapshot?.zones.length
                          ? `${riskSnapshot.zones.length} recent coarse zone${riskSnapshot.zones.length === 1 ? '' : 's'} shown. Exact locations and report counts stay hidden.`
                          : `No area nearby reached the minimum crowd threshold${riskSnapshot ? ` of ${riskSnapshot.privacy.minimumReports} reports` : ''}.`}
                </Text>
              </View>
            </View>

            {havensLoading && !safeHavens.length ? (
              <View style={styles.inlineStatus}>
                <View style={styles.statusPulse} />
                <Text style={styles.inlineStatusText}>Finding the nearest safe places...</Text>
              </View>
            ) : null}

            {havensError ? (
              <View style={styles.mapError}>
                <Text style={styles.mapErrorTitle}>Nearby places could not be refreshed</Text>
                <Text style={styles.mapErrorText}>{havensError}</Text>
                <ActionButton
                  label="Retry nearby places"
                  loading={havensLoading}
                  variant="secondary"
                  onPress={() => void loadNearbyHavens()}
                />
              </View>
            ) : null}

            {!havensLoading &&
            !havensError &&
            safeHavens.length > 0 &&
            nearestHavens.length === 0 ? (
              <View style={styles.filterEmpty}>
                <Text style={styles.filterEmptyTitle}>
                  No mapped {chosenCategory.title.toLowerCase()} within 3 km
                </Text>
                <Text style={styles.filterEmptyText}>
                  Choose another service or use “Search outside SafeCity” below.
                </Text>
              </View>
            ) : null}

            <View style={styles.mapPrivacy}>
              <Text style={styles.mapPrivacyTitle}>Route stays inside SafeCity</Text>
              <Text style={styles.mapPrivacyText}>
                Tap any nearby pin to redraw the pedestrian route. SafeCity does not store your map
                history.
              </Text>
            </View>

            {selectedHaven ? (
              <View style={styles.selectedHaven}>
                <View style={styles.selectedHavenCopy}>
                  <Text style={styles.selectedHavenLabel}>ACTIVE WALKING DESTINATION</Text>
                  <Text style={styles.selectedHavenName}>{selectedHaven.name}</Text>
                  <Text style={styles.selectedHavenDetail}>
                    {routeLoading
                      ? 'Calculating a pedestrian route...'
                      : walkingRoute
                        ? `${formatWalkingDuration(walkingRoute.durationSeconds)} walk · ${formatDistance(walkingRoute.distanceMeters)}`
                        : `${formatDistance(selectedHaven.distanceMeters)} away`}
                  </Text>
                  {routeError ? <Text style={styles.routeError}>{routeError}</Text> : null}
                </View>
                <Text style={styles.selectedHavenIcon}>{selectedHaven.icon}</Text>
              </View>
            ) : null}

            <View style={styles.mapActions}>
              <ActionButton
                label="Open this route in Google Maps"
                disabled={!selectedHaven}
                onPress={() => openGoogleDirections(selectedHaven)}
              />
              <ActionButton
                label="Expand the in-app map"
                disabled={!selectedHaven}
                variant="secondary"
                onPress={() => void openInAppMap()}
              />
            </View>

            {nearestHavens.length ? (
              <>
                <Text style={styles.nearestTitle}>
                  NEAREST {chosenCategory.title.toUpperCase()}
                </Text>
                <View style={styles.havenList}>
                  {nearestHavens.slice(0, 6).map((haven, index) => (
                    <Pressable
                      key={haven.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: haven.id === selectedHaven?.id }}
                      onPress={() => setSelectedHavenId(haven.id)}
                      style={({ pressed }) => [
                        styles.havenRow,
                        haven.id === selectedHaven?.id && styles.havenRowSelected,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.havenRank}>
                        <Text style={styles.havenRankText}>{index + 1}</Text>
                      </View>
                      <View style={styles.havenIcon}>
                        <Text style={styles.havenIconText}>{haven.icon}</Text>
                      </View>
                      <View style={styles.havenCopy}>
                        <Text style={styles.havenName}>{haven.name}</Text>
                        <Text style={styles.havenDetail}>
                          {formatDistance(haven.distanceMeters)} away · {haven.corridorLabel}
                        </Text>
                        {haven.openingHours ? (
                          <Text style={styles.havenHours}>{haven.openingHours}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.routeChevron}>›</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {nearestHavens.length ? (
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
              </>
            ) : null}

            <Pressable
              accessibilityRole="link"
              onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}
              style={({ pressed }) => [styles.attribution, pressed && styles.pressed]}
            >
              <Text style={styles.attributionText}>
                Map, nearby place and route data © OpenStreetMap contributors
              </Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.loadHavens}>
            <Text style={styles.corridorEmpty}>
              {loading
                ? 'Getting your current location and preparing the map...'
                : 'Allow location access to open the live map and find nearby safe places.'}
            </Text>
            <ActionButton
              label="Allow location and open map"
              loading={loading}
              onPress={() => void refreshNearbyMap()}
            />
          </View>
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
              onPress={() => selectCategory(category.id)}
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
        subtitle="Stay inside SafeCity to compare mapped safe havens, or continue in an external maps app for turn-by-turn directions."
      >
        <View style={styles.actions}>
          <ActionButton
            label="Open nearest match in SafeCity"
            disabled={!nearestHaven}
            loading={havensLoading}
            onPress={() => void openInAppMap(selected)}
          />
          <ActionButton
            label="Search outside SafeCity"
            loading={loading}
            variant="secondary"
            onPress={() => void openNearbySearch()}
          />
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

      <Modal
        animationType="slide"
        onRequestClose={() => setMapExpanded(false)}
        presentationStyle="fullScreen"
        visible={mapExpanded}
      >
        <SafeAreaView style={styles.mapModal}>
          <View style={styles.mapModalHeader}>
            <View>
              <Text style={styles.mapModalEyebrow}>SAFE-WALK CORRIDOR</Text>
              <Text style={styles.mapModalTitle}>In-app safety map</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMapExpanded(false)}
              style={({ pressed }) => [styles.mapCloseButton, pressed && styles.pressed]}
            >
              <Text style={styles.mapCloseText}>Done</Text>
            </Pressable>
          </View>

          {location ? (
            <SafetyMap
              center={{
                latitude: location.latitude,
                longitude: location.longitude,
              }}
              height={Math.max(360, windowHeight - 390)}
              onSelectPin={(haven) => setSelectedHavenId(haven.id)}
              pins={mappedHavens}
              riskZones={riskSnapshot?.zones}
              route={walkingRoute?.coordinates}
              routeLoading={routeLoading}
              selectedPinId={selectedHaven?.id}
            />
          ) : null}

          {selectedHaven ? (
            <View style={styles.mapModalDestination}>
              <View style={styles.mapModalDestinationIcon}>
                <Text style={styles.selectedHavenIcon}>{selectedHaven.icon}</Text>
              </View>
              <View style={styles.selectedHavenCopy}>
                <Text style={styles.selectedHavenName}>{selectedHaven.name}</Text>
                <Text style={styles.selectedHavenDetail}>
                  {selectedHaven.corridorLabel} ·{' '}
                  {formatDistance(selectedHaven.distanceMeters)} away
                </Text>
              </View>
            </View>
          ) : null}

          <ActionButton
            label="Continue in Google Maps"
            disabled={!selectedHaven}
            onPress={() => openGoogleDirections(selectedHaven)}
          />
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  doneButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  doneText: { color: colors.watch, fontWeight: '900' },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  locationStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.safe,
  },
  locationCopy: { flex: 1 },
  locationLabel: {
    color: colors.safe,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  locationValue: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  refreshButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshText: { color: colors.text, fontSize: 24, fontWeight: '800', lineHeight: 26 },
  inlineStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  statusPulse: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.alert,
  },
  inlineStatusText: { flex: 1, color: colors.textMuted, fontSize: type.caption },
  mapError: {
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
    backgroundColor: colors.dangerPanel,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  mapErrorTitle: { color: colors.danger, fontSize: type.caption, fontWeight: '900' },
  mapErrorText: { color: colors.textMuted, fontSize: 10, lineHeight: 15 },
  filterEmpty: {
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  filterEmptyTitle: { color: colors.text, fontSize: type.caption, fontWeight: '900' },
  filterEmptyText: { color: colors.textMuted, fontSize: 10, lineHeight: 15 },
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
  mapPrivacy: {
    borderRadius: radii.md,
    backgroundColor: colors.watchSoft,
    borderWidth: 1,
    borderColor: colors.watchBorder,
    padding: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  riskSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    padding: spacing.sm,
    marginTop: spacing.sm,
  },
  riskLegend: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskLegendDot: {
    position: 'absolute',
    borderRadius: 999,
  },
  riskLegendEmerging: {
    width: 32,
    height: 32,
    backgroundColor: 'rgba(255, 200, 87, 0.20)',
  },
  riskLegendElevated: {
    width: 22,
    height: 22,
    backgroundColor: 'rgba(255, 143, 64, 0.34)',
  },
  riskLegendHigh: {
    width: 10,
    height: 10,
    backgroundColor: 'rgba(255, 59, 92, 0.72)',
  },
  riskSummaryCopy: { flex: 1 },
  riskSummaryTitle: { color: colors.text, fontSize: type.caption, fontWeight: '900' },
  riskSummaryText: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  mapPrivacyTitle: { color: colors.text, fontSize: type.caption, fontWeight: '900' },
  mapPrivacyText: {
    color: colors.textMuted,
    fontSize: 10,
    lineHeight: 15,
    marginTop: 2,
  },
  selectedHaven: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.safe,
    backgroundColor: colors.safeSoft,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  selectedHavenCopy: { flex: 1 },
  selectedHavenLabel: {
    color: colors.safe,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  selectedHavenName: {
    color: colors.text,
    fontSize: type.body,
    fontWeight: '900',
    marginTop: 3,
  },
  selectedHavenDetail: {
    color: colors.textMuted,
    fontSize: type.caption,
    lineHeight: 18,
    marginTop: 2,
  },
  routeError: {
    color: colors.alert,
    fontSize: 10,
    lineHeight: 15,
    marginTop: spacing.xs,
  },
  selectedHavenIcon: { fontSize: 24 },
  mapActions: { gap: spacing.sm, marginBottom: spacing.lg },
  nearestTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
  },
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
  havenRowSelected: { borderColor: colors.safe, backgroundColor: colors.safeSoft },
  havenRank: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.navigation,
    alignItems: 'center',
    justifyContent: 'center',
  },
  havenRankText: { color: colors.textMuted, fontSize: 10, fontWeight: '900' },
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
  routeChevron: { color: colors.safe, fontSize: 28, fontWeight: '700' },
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
  mapModal: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
    gap: spacing.md,
  },
  mapModalHeader: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  mapModalEyebrow: {
    color: colors.safe,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  mapModalTitle: {
    color: colors.text,
    fontSize: type.title,
    fontWeight: '900',
    marginTop: 2,
  },
  mapCloseButton: {
    minWidth: 64,
    minHeight: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  mapCloseText: { color: colors.text, fontSize: type.body, fontWeight: '900' },
  mapModalDestination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  mapModalDestinationIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.safeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
