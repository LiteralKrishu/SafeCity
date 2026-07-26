import { useEffect, useRef, useState } from 'react';
import {
  type GestureResponderEvent,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';
import type { RiskZone } from '@/services/riskZones';
import type { RouteCoordinate, SafeHavenPin } from '@/utils/safeRoute';

interface MapCoordinate {
  latitude: number;
  longitude: number;
}

interface SafetyMapProps {
  center: MapCoordinate;
  height?: number;
  onSelectPin: (pin: SafeHavenPin) => void;
  pins: SafeHavenPin[];
  riskZones?: RiskZone[];
  route?: RouteCoordinate[];
  routeLoading?: boolean;
  selectedPinId?: string;
}

interface PixelCoordinate {
  x: number;
  y: number;
}

interface Tile {
  key: string;
  left: number;
  size: number;
  top: number;
  url: string;
}

const TILE_SIZE = 256;
const MIN_ZOOM = 11;
const MAX_ZOOM = 19;
const DEFAULT_ZOOM = 13;

function coordinateToWorldPixel(
  latitude: number,
  longitude: number,
  zoom: number,
): PixelCoordinate {
  const scale = TILE_SIZE * 2 ** zoom;
  const clippedLatitude = Math.min(Math.max(latitude, -85.05112878), 85.05112878);
  const latitudeRadians = (clippedLatitude * Math.PI) / 180;
  return {
    x: ((longitude + 180) / 360) * scale,
    y:
      (0.5 -
        Math.log((1 + Math.sin(latitudeRadians)) / (1 - Math.sin(latitudeRadians))) /
          (4 * Math.PI)) *
      scale,
  };
}

function buildTiles(
  center: PixelCoordinate,
  width: number,
  height: number,
  sourceZoom: number,
  displayZoom: number,
  mapStyle: 'dark_all' | 'light_all',
): Tile[] {
  if (!width || !height) return [];
  const worldTileCount = 2 ** sourceZoom;
  const displayScale = 2 ** (displayZoom - sourceZoom);
  const displayedTileSize = TILE_SIZE * displayScale;
  const displayedCenter = {
    x: center.x * displayScale,
    y: center.y * displayScale,
  };
  const left = displayedCenter.x - width / 2;
  const top = displayedCenter.y - height / 2;
  const firstTileX = Math.floor(left / displayedTileSize);
  const lastTileX = Math.floor((left + width) / displayedTileSize);
  const firstTileY = Math.max(0, Math.floor(top / displayedTileSize));
  const lastTileY = Math.min(
    worldTileCount - 1,
    Math.floor((top + height) / displayedTileSize),
  );
  const tiles: Tile[] = [];

  for (let tileX = firstTileX; tileX <= lastTileX; tileX += 1) {
    for (let tileY = firstTileY; tileY <= lastTileY; tileY += 1) {
      const wrappedTileX = ((tileX % worldTileCount) + worldTileCount) % worldTileCount;
      tiles.push({
        key: `${sourceZoom}-${tileX}-${tileY}`,
        left: tileX * displayedTileSize - left,
        size: displayedTileSize + 0.75,
        top: tileY * displayedTileSize - top,
        url: `https://a.basemaps.cartocdn.com/${mapStyle}/${sourceZoom}/${wrappedTileX}/${tileY}.png`,
      });
    }
  }

  return tiles;
}

function coordinateBoundsCenter(
  fallback: MapCoordinate,
  coordinates: RouteCoordinate[],
): MapCoordinate {
  if (coordinates.length < 2) return fallback;
  const latitudes = coordinates.map((coordinate) => coordinate.latitude);
  const longitudes = coordinates.map((coordinate) => coordinate.longitude);
  return {
    latitude: (Math.min(...latitudes) + Math.max(...latitudes)) / 2,
    longitude: (Math.min(...longitudes) + Math.max(...longitudes)) / 2,
  };
}

function fitCoordinatesZoom(
  center: MapCoordinate,
  coordinates: RouteCoordinate[],
  width: number,
  height: number,
): number {
  if (coordinates.length < 2 || !width || !height) return DEFAULT_ZOOM;
  for (let candidate = MAX_ZOOM; candidate >= MIN_ZOOM; candidate -= 1) {
    const centerPixel = coordinateToWorldPixel(center.latitude, center.longitude, candidate);
    const positions = coordinates.map((coordinate) => {
      const point = coordinateToWorldPixel(
        coordinate.latitude,
        coordinate.longitude,
        candidate,
      );
      return {
        x: width / 2 + point.x - centerPixel.x,
        y: height / 2 + point.y - centerPixel.y,
      };
    });
    const xs = positions.map((position) => position.x);
    const ys = positions.map((position) => position.y);
    if (
      Math.min(...xs) >= 42 &&
      Math.max(...xs) <= width - 42 &&
      Math.min(...ys) >= 62 &&
      Math.max(...ys) <= height - 46
    ) {
      return candidate;
    }
  }
  return MIN_ZOOM;
}

export function SafetyMap({
  center,
  height = 310,
  onSelectPin,
  pins,
  riskZones = [],
  route = [],
  routeLoading = false,
  selectedPinId,
}: SafetyMapProps) {
  const mapStyle = useColorScheme() === 'light' ? 'light_all' : 'dark_all';
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [viewport, setViewport] = useState({ width: 0, height });
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const zoomRef = useRef(DEFAULT_ZOOM);
  const zoomAnimation = useRef<number | null>(null);
  const focusCoordinates: RouteCoordinate[] = [
    center,
    ...route,
    ...pins.map((pin) => ({ latitude: pin.latitude, longitude: pin.longitude })),
  ];
  const displayCenter = coordinateBoundsCenter(center, focusCoordinates);
  const centerPixel = coordinateToWorldPixel(
    displayCenter.latitude,
    displayCenter.longitude,
    zoom,
  );
  const tileZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(zoom)));
  const tileCenterPixel = coordinateToWorldPixel(
    displayCenter.latitude,
    displayCenter.longitude,
    tileZoom,
  );
  const tiles = buildTiles(
    tileCenterPixel,
    viewport.width,
    viewport.height,
    tileZoom,
    zoom,
    mapStyle,
  );
  const firstRoutePoint = route[0];
  const lastRoutePoint = route[route.length - 1];
  const routeKey = [
    center.latitude.toFixed(5),
    center.longitude.toFixed(5),
    route.length,
    firstRoutePoint?.latitude.toFixed(5),
    firstRoutePoint?.longitude.toFixed(5),
    lastRoutePoint?.latitude.toFixed(5),
    lastRoutePoint?.longitude.toFixed(5),
    ...pins.map((pin) => pin.id),
  ].join(':');

  const mapPosition = (latitude: number, longitude: number): PixelCoordinate => {
    const point = coordinateToWorldPixel(latitude, longitude, zoom);
    return {
      x: viewport.width / 2 + point.x - centerPixel.x,
      y: viewport.height / 2 + point.y - centerPixel.y,
    };
  };
  const routePositions = route.map((coordinate) =>
    mapPosition(coordinate.latitude, coordinate.longitude),
  );
  const routeSegments = routePositions.slice(1).map((end, index) => {
    const start = routePositions[index]!;
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    return {
      angle: `${Math.atan2(deltaY, deltaX)}rad`,
      key: `${index}-${start.x.toFixed(1)}-${start.y.toFixed(1)}`,
      left: (start.x + end.x) / 2 - Math.hypot(deltaX, deltaY) / 2,
      length: Math.hypot(deltaX, deltaY),
      top: (start.y + end.y) / 2 - 3,
    };
  });
  const visibleRiskZones = riskZones
    .map((zone) => {
      const position = mapPosition(zone.latitude, zone.longitude);
      const metersPerPixel =
        (156_543.03392 * Math.max(0.05, Math.cos((zone.latitude * Math.PI) / 180))) /
        2 ** zoom;
      const diameter = Math.min(
        150,
        Math.max(34, (zone.radiusMeters * 2) / metersPerPixel),
      );
      return { zone, position, diameter };
    })
    .filter(
      ({ position, diameter }) =>
        position.x >= -diameter &&
        position.x <= viewport.width + diameter &&
        position.y >= -diameter &&
        position.y <= viewport.height + diameter,
    );

  useEffect(() => {
    const fittedZoom = fitCoordinatesZoom(
      displayCenter,
      focusCoordinates,
      viewport.width,
      viewport.height,
    );
    zoomRef.current = fittedZoom;
    setZoom(fittedZoom);
  }, [routeKey, viewport.height, viewport.width]);

  useEffect(
    () => () => {
      if (zoomAnimation.current !== null) {
        cancelAnimationFrame(zoomAnimation.current);
      }
    },
    [],
  );

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height: measuredHeight } = event.nativeEvent.layout;
    setViewport((current) =>
      current.width === width && current.height === measuredHeight
        ? current
        : { width, height: measuredHeight },
    );
  };

  const pinchDistance = (event: GestureResponderEvent): number | null => {
    const [first, second] = event.nativeEvent.touches;
    if (!first || !second) return null;
    return Math.hypot(first.pageX - second.pageX, first.pageY - second.pageY);
  };

  const startPinch = (event: GestureResponderEvent) => {
    const distance = pinchDistance(event);
    if (distance === null) return;
    if (zoomAnimation.current !== null) {
      cancelAnimationFrame(zoomAnimation.current);
      zoomAnimation.current = null;
    }
    pinchStart.current = { distance, zoom: zoomRef.current };
  };

  const movePinch = (event: GestureResponderEvent) => {
    const distance = pinchDistance(event);
    const start = pinchStart.current;
    if (distance === null || !start || start.distance <= 0) return;
    const zoomDelta = Math.log2(distance / start.distance);
    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, start.zoom + zoomDelta),
    );
    zoomRef.current = nextZoom;
    setZoom(nextZoom);
  };

  const endPinch = () => {
    pinchStart.current = null;
  };

  const animateZoomTo = (requestedZoom: number) => {
    if (zoomAnimation.current !== null) {
      cancelAnimationFrame(zoomAnimation.current);
    }
    const startZoom = zoomRef.current;
    const targetZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, requestedZoom));
    const startedAt = Date.now();
    const duration = 240;
    const tick = () => {
      const progress = Math.min(1, (Date.now() - startedAt) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const nextZoom = startZoom + (targetZoom - startZoom) * eased;
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      if (progress < 1) {
        zoomAnimation.current = requestAnimationFrame(tick);
      } else {
        zoomAnimation.current = null;
      }
    };
    zoomAnimation.current = requestAnimationFrame(tick);
  };

  return (
    <View
      accessibilityLabel="Interactive in-app safety map"
      onLayout={handleLayout}
      onMoveShouldSetResponderCapture={(event) =>
        event.nativeEvent.touches.length === 2
      }
      onResponderGrant={startPinch}
      onResponderMove={movePinch}
      onResponderRelease={endPinch}
      onResponderTerminate={endPinch}
      onStartShouldSetResponderCapture={(event) =>
        event.nativeEvent.touches.length === 2
      }
      style={[styles.map, { height }]}
    >
      {tiles.map((tile) => (
        <Image
          key={tile.key}
          accessibilityIgnoresInvertColors
          source={{
            uri: tile.url,
          }}
          style={[
            styles.tile,
            {
              left: tile.left,
              height: tile.size,
              top: tile.top,
              width: tile.size,
            },
          ]}
        />
      ))}

      <View pointerEvents="none" style={styles.mapTint} />

      <View pointerEvents="none" style={styles.riskLayer}>
        {visibleRiskZones.map(({ zone, position, diameter }) => {
          const high = zone.riskBand === 'high';
          const elevated = zone.riskBand === 'elevated';
          const outerColor = high
            ? 'rgba(255, 59, 92, 0.30)'
            : elevated
              ? 'rgba(255, 143, 64, 0.25)'
              : 'rgba(255, 200, 87, 0.20)';
          const innerColor = high
            ? 'rgba(255, 59, 92, 0.62)'
            : elevated
              ? 'rgba(255, 143, 64, 0.52)'
              : 'rgba(255, 200, 87, 0.42)';
          const innerDiameter = diameter * (0.32 + zone.intensity * 0.3);
          return (
            <View
              key={zone.cellId}
              style={[
                styles.riskZone,
                {
                  backgroundColor: outerColor,
                  borderColor: innerColor,
                  height: diameter,
                  left: position.x - diameter / 2,
                  top: position.y - diameter / 2,
                  width: diameter,
                },
              ]}
            >
              <View
                style={[
                  styles.riskZoneCore,
                  {
                    backgroundColor: innerColor,
                    borderRadius: innerDiameter / 2,
                    height: innerDiameter,
                    width: innerDiameter,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.routeLayer]}>
        {routeSegments.map((segment) => (
          <View
            key={segment.key}
            style={[
              styles.routeSegment,
              {
                left: segment.left,
                top: segment.top,
                width: segment.length,
                transform: [{ rotateZ: segment.angle }],
              },
            ]}
          />
        ))}
        {routePositions.map((position, index) => (
          <View
            key={`route-point-${index}`}
            style={[
              styles.routePoint,
              {
                left: position.x - 4,
                top: position.y - 4,
              },
            ]}
          />
        ))}
      </View>

      {pins.map((pin) => {
        const position = mapPosition(pin.latitude, pin.longitude);
        const isVisible =
          position.x >= -30 &&
          position.x <= viewport.width + 30 &&
          position.y >= -30 &&
          position.y <= viewport.height + 30;
        if (!isVisible) return null;
        const selected = pin.id === selectedPinId;
        return (
          <Pressable
            key={pin.id}
            accessibilityLabel={`${pin.name}. Select this safe haven.`}
            accessibilityRole="button"
            onPress={() => onSelectPin(pin)}
            style={[
              styles.pin,
              {
                left: position.x - 21,
                top: position.y - 42,
              },
              pin.category === 'police' && styles.policePin,
              selected && styles.selectedPin,
            ]}
          >
            <Text style={styles.pinIcon}>{pin.icon}</Text>
          </Pressable>
        );
      })}

      <View
        accessibilityLabel="Your current location"
        pointerEvents="none"
        style={[
          styles.currentLocation,
          {
            left: mapPosition(center.latitude, center.longitude).x - 10,
            top: mapPosition(center.latitude, center.longitude).y - 10,
          },
        ]}
      >
        <View style={styles.currentLocationCore} />
      </View>

      <View style={styles.zoomControls}>
        <Pressable
          accessibilityLabel="Zoom in"
          accessibilityRole="button"
          disabled={zoom >= MAX_ZOOM}
          onPress={() => animateZoomTo(zoomRef.current + 1)}
          style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}
        >
          <Text style={styles.zoomText}>+</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Zoom out"
          accessibilityRole="button"
          disabled={zoom <= MIN_ZOOM}
          onPress={() => animateZoomTo(zoomRef.current - 1)}
          style={({ pressed }) => [styles.zoomButton, pressed && styles.pressed]}
        >
          <Text style={styles.zoomText}>-</Text>
        </Pressable>
      </View>

      <View pointerEvents="none" style={styles.mapBadge}>
        <View style={[styles.liveDot, routeLoading && styles.loadingDot]} />
        <Text style={styles.mapBadgeText}>
          {routeLoading
            ? 'FINDING WALKING ROUTE'
            : route.length
              ? riskZones.length
                ? 'WALKING ROUTE + RISK'
                : 'WALKING ROUTE'
              : riskZones.length
                ? 'RISK ZONES + PLACES'
                : 'NEARBY PLACES'}
        </Text>
      </View>

      <View pointerEvents="none" style={styles.pinchHint}>
        <Text style={styles.pinchHintText}>PINCH TO ZOOM</Text>
      </View>

      <Pressable
        accessibilityRole="link"
        onPress={() => void Linking.openURL('https://www.openstreetmap.org/copyright')}
        style={({ pressed }) => [styles.attribution, pressed && styles.pressed]}
      >
        <Text style={styles.attributionText}>© OSM · © CARTO</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  tile: {
    position: 'absolute',
  },
  mapTint: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(8, 11, 19, 0.08)',
  },
  riskLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
  },
  riskZone: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  riskZoneCore: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.42)',
  },
  routeSegment: {
    position: 'absolute',
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.safe,
  },
  routeLayer: {
    zIndex: 2,
  },
  routePoint: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.white,
    backgroundColor: colors.safe,
  },
  pin: {
    position: 'absolute',
    zIndex: 3,
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: colors.safe,
    backgroundColor: colors.safeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policePin: {
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  selectedPin: {
    width: 50,
    height: 50,
    marginLeft: -4,
    marginTop: -4,
    borderRadius: 25,
    borderWidth: 4,
  },
  pinIcon: {
    fontSize: 19,
  },
  currentLocation: {
    position: 'absolute',
    zIndex: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.watch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentLocationCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.black,
  },
  zoomControls: {
    position: 'absolute',
    zIndex: 5,
    top: spacing.sm,
    right: spacing.sm,
    gap: 2,
  },
  zoomButton: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.navigation,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomText: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 26,
  },
  mapBadge: {
    position: 'absolute',
    zIndex: 5,
    top: spacing.sm,
    left: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: colors.navigation,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.safe,
  },
  loadingDot: {
    backgroundColor: colors.alert,
  },
  mapBadgeText: {
    color: colors.text,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  pinchHint: {
    position: 'absolute',
    zIndex: 5,
    left: spacing.xs,
    bottom: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.navigation,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
  },
  pinchHintText: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  attribution: {
    position: 'absolute',
    zIndex: 5,
    right: spacing.xs,
    bottom: spacing.xs,
    borderRadius: radii.sm,
    backgroundColor: colors.navigation,
    paddingHorizontal: spacing.xs,
    paddingVertical: 3,
  },
  attributionText: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.72,
  },
});
