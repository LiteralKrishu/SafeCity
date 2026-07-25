export type SafeHavenCategory = 'police' | 'hospital' | 'metro' | 'pharmacy';

export interface SafeHavenPin {
  id: string;
  name: string;
  icon: string;
  category: SafeHavenCategory;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  corridorScore: number;
  corridorLabel: string;
  openingHours: string | null;
  open24h: boolean;
  mappedLitSegmentsNearby: number;
}

export interface SafetyRadarData {
  safeHavens: SafeHavenPin[];
  context: {
    mappedLitPathSegments: number;
    emergencyPhones: number;
  };
}

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

export interface WalkingRoute {
  coordinates: RouteCoordinate[];
  distanceMeters: number;
  durationSeconds: number;
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface WalkingRouteResponse {
  code?: string;
  message?: string;
  routes?: Array<{
    distance?: number;
    duration?: number;
    geometry?: {
      type?: string;
      coordinates?: number[][];
    };
  }>;
}

const OVERPASS_ENDPOINTS = [
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
] as const;
const WALKING_ROUTE_ENDPOINT = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving';
const SEARCH_RADIUS_METERS = 3_000;
const MAX_HAVENS_PER_CATEGORY = 8;
const safeHavenCategories: SafeHavenCategory[] = [
  'police',
  'hospital',
  'metro',
  'pharmacy',
];
const baseScore: Record<SafeHavenCategory, number> = {
  police: 0.97,
  hospital: 0.9,
  metro: 0.83,
  pharmacy: 0.77,
};
const categoryIcon: Record<SafeHavenCategory, string> = {
  police: '🚨',
  hospital: '🏥',
  metro: '🚇',
  pharmacy: '✚',
};
const fallbackName: Record<SafeHavenCategory, string> = {
  police: 'Police station',
  hospital: 'Hospital',
  metro: 'Metro or transit station',
  pharmacy: 'Pharmacy',
};

function clip(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

function isNight(hour: number): boolean {
  return hour >= 20 || hour <= 6;
}

function categoryForTags(tags: Record<string, string>): SafeHavenCategory | null {
  if (tags.amenity === 'police') return 'police';
  if (tags.amenity === 'hospital' || tags.emergency === 'yes') return 'hospital';
  if (tags.amenity === 'pharmacy') return 'pharmacy';
  if (
    tags.railway === 'subway_entrance' ||
    tags.station === 'subway' ||
    tags.public_transport === 'station'
  ) {
    return 'metro';
  }
  return null;
}

function isAlwaysOpen(openingHours: string | undefined): boolean {
  if (!openingHours) return false;
  return /(^|\s)(24\/7|24x7)(\s|$)/i.test(openingHours);
}

function makeOverpassQuery(latitude: number, longitude: number, radius: number): string {
  const around = `(around:${radius},${latitude},${longitude})`;
  return `[out:json][timeout:12];
(
  nwr${around}["amenity"="police"];
  nwr${around}["amenity"="hospital"];
  nwr${around}["amenity"="pharmacy"];
  nwr${around}["railway"="subway_entrance"];
  nwr${around}["railway"="station"]["station"="subway"];
  nwr${around}["public_transport"="station"];
  way${around}["highway"]["lit"="yes"];
  nwr${around}["emergency"="phone"];
);
out center tags;`;
}

export function haversineMeters(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): number {
  const earthRadiusMeters = 6_371_000;
  const deltaLat = ((endLat - startLat) * Math.PI) / 180;
  const deltaLng = ((endLng - startLng) * Math.PI) / 180;
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos((startLat * Math.PI) / 180) *
      Math.cos((endLat * Math.PI) / 180) *
      Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistance(meters: number): string {
  if (meters < 1_000) return `${Math.round(meters)} m`;
  return `${(meters / 1_000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

export function formatWalkingDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} hr ${remainingMinutes} min` : `${hours} hr`;
}

export function nearestSafeHavens(
  pins: SafeHavenPin[],
  category?: SafeHavenCategory,
  limit?: number,
): SafeHavenPin[] {
  const matchingPins = category
    ? pins.filter((pin) => pin.category === category)
    : pins;
  const sortedPins = [...matchingPins].sort(
    (left, right) =>
      left.distanceMeters - right.distanceMeters ||
      right.corridorScore - left.corridorScore ||
      left.name.localeCompare(right.name),
  );
  return limit === undefined ? sortedPins : sortedPins.slice(0, limit);
}

export function retainNearestHavensByCategory(
  pins: SafeHavenPin[],
  limitPerCategory = MAX_HAVENS_PER_CATEGORY,
): SafeHavenPin[] {
  return nearestSafeHavens(
    safeHavenCategories.flatMap((category) =>
      nearestSafeHavens(pins, category, limitPerCategory),
    ),
  );
}

export async function fetchWalkingRoute(
  startLat: number,
  startLng: number,
  destinationLat: number,
  destinationLng: number,
): Promise<WalkingRoute> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  const coordinates = `${startLng},${startLat};${destinationLng},${destinationLat}`;

  try {
    // This host is backed by a foot-specific graph even though OSRM keeps "driving" in the URL slot.
    const response = await fetch(
      `${WALKING_ROUTE_ENDPOINT}/${coordinates}?overview=simplified&geometries=geojson&steps=false`,
      {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(`Walking-route service returned ${response.status}.`);
    }

    const payload = (await response.json()) as WalkingRouteResponse;
    const route = payload.routes?.[0];
    const routeCoordinates = route?.geometry?.coordinates
      ?.filter(
        (coordinate) =>
          coordinate.length >= 2 &&
          Number.isFinite(coordinate[0]) &&
          Number.isFinite(coordinate[1]),
      )
      .map(([longitude, latitude]) => ({ latitude: latitude!, longitude: longitude! }));

    if (
      payload.code !== 'Ok' ||
      route?.geometry?.type !== 'LineString' ||
      !routeCoordinates ||
      routeCoordinates.length < 2 ||
      route.distance === undefined ||
      route.duration === undefined
    ) {
      throw new Error(payload.message || 'No walking route was found for this destination.');
    }

    return {
      coordinates: routeCoordinates,
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchNearbySafetyRadar(
  centerLat: number,
  centerLng: number,
  currentHour = new Date().getHours(),
): Promise<SafetyRadarData> {
  const query = makeOverpassQuery(centerLat, centerLng, SEARCH_RADIUS_METERS);
  let response: Response | null = null;
  let lastError: unknown = null;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const candidate = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          'User-Agent': 'SafeCity/2.0 (mobile safety navigator)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (candidate.ok) {
        response = candidate;
        break;
      }
      lastError = new Error(`Nearby-place service returned ${candidate.status}.`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }

  if (!response) {
    throw lastError instanceof Error
      ? lastError
      : new Error('Nearby-place services are temporarily unavailable.');
  }

  const payload = (await response.json()) as OverpassResponse;
  const night = isNight(currentHour);
  const elements = payload.elements ?? [];
  const litPathCenters = elements.flatMap((element) => {
    const tags = element.tags ?? {};
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    return tags.highway && tags.lit === 'yes' && latitude !== undefined && longitude !== undefined
      ? [{ latitude, longitude }]
      : [];
  });
  const emergencyPhones = elements.filter(
    (element) => element.tags?.emergency === 'phone',
  ).length;
  const uniqueCoordinates = new Set<string>();
  const pins: SafeHavenPin[] = [];

  for (const element of elements) {
    const tags = element.tags ?? {};
    const category = categoryForTags(tags);
    const latitude = element.lat ?? element.center?.lat;
    const longitude = element.lon ?? element.center?.lon;
    if (!category || latitude === undefined || longitude === undefined) continue;

    const coordinateKey = `${category}:${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
    if (uniqueCoordinates.has(coordinateKey)) continue;
    uniqueCoordinates.add(coordinateKey);

    const distanceMeters = haversineMeters(centerLat, centerLng, latitude, longitude);
    const open24h = isAlwaysOpen(tags.opening_hours);
    const mappedLitSegmentsNearby = litPathCenters.filter(
      (path) => haversineMeters(latitude, longitude, path.latitude, path.longitude) <= 500,
    ).length;
    const distancePenalty = clip(distanceMeters / SEARCH_RADIUS_METERS) * 0.34;
    const timeAdjustment = night && open24h ? 0.05 : night ? -0.025 : 0;
    const lightingBonus = Math.min(mappedLitSegmentsNearby, 3) * 0.012;
    const corridorScore = clip(
      baseScore[category] - distancePenalty + timeAdjustment + lightingBonus,
    );
    const corridorLabel =
      category === 'police'
        ? 'Police contact point'
        : open24h
          ? 'Listed as open 24/7'
          : corridorScore >= 0.78
            ? 'Nearby staffed destination'
            : 'Public destination';

    pins.push({
      id: `${element.type}-${element.id}`,
      name: tags.name || tags.operator || fallbackName[category],
      icon: categoryIcon[category],
      category,
      latitude,
      longitude,
      distanceMeters,
      corridorScore,
      corridorLabel,
      openingHours: tags.opening_hours ?? null,
      open24h,
      mappedLitSegmentsNearby,
    });
  }

  return {
    // A dense service type (for example, hospitals) must not crowd every
    // police, transit, or pharmacy result out of the nearby-place response.
    safeHavens: retainNearestHavensByCategory(pins),
    context: {
      mappedLitPathSegments: litPathCenters.length,
      emergencyPhones,
    },
  };
}

export async function fetchNearbySafeHavens(
  centerLat: number,
  centerLng: number,
  currentHour = new Date().getHours(),
): Promise<SafeHavenPin[]> {
  return (await fetchNearbySafetyRadar(centerLat, centerLng, currentHour)).safeHavens;
}

export function summarizeSafeCorridor(pins: SafeHavenPin[]): {
  score: number;
  label: string;
  detail: string;
} {
  if (!pins.length) {
    return {
      score: 0,
      label: 'No nearby places loaded',
      detail: 'Load real nearby facilities or use Maps search.',
    };
  }

  const topPins = pins.slice(0, 3);
  const average = topPins.reduce((sum, pin) => sum + pin.corridorScore, 0) / topPins.length;
  const score = Math.round(average * 100);
  const label =
    score >= 88 ? 'Strong public-place access' : score >= 76 ? 'Moderate access' : 'Limited access';
  const detail = topPins.map((pin) => pin.name).join(' · ');
  return { score, label, detail };
}

export function radarPosition(
  centerLat: number,
  centerLng: number,
  targetLat: number,
  targetLng: number,
): { left: number; top: number } {
  const northMeters = (targetLat - centerLat) * 111_320;
  const eastMeters =
    (targetLng - centerLng) *
    111_320 *
    Math.cos((centerLat * Math.PI) / 180);
  return {
    left: 50 + clip(eastMeters / SEARCH_RADIUS_METERS / 2 + 0.5) * 80 - 40,
    top: 50 - (clip(northMeters / SEARCH_RADIUS_METERS / 2 + 0.5) * 80 - 40),
  };
}

export function makeMapsDirectionUrl(
  originLat: number,
  originLng: number,
  destinationLat: number,
  destinationLng: number,
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destinationLat},${destinationLng}&travelmode=walking`;
}
