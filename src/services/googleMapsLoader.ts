/// <reference types="vite/client" />
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

// Google Maps Platform browser key. It comes only from the VITE_GOOGLE_MAPS_API_KEY build
// setting (never hard-coded here). Browser keys are visible to every visitor, so restrict this
// key to your site's address (HTTP referrer) in Google Cloud Console.
export const GOOGLE_MAPS_API_KEY: string = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Custom dark industrial tactical theme for commercial fleet telematics
export const DARK_FLEET_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0b1320' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1320' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f59e0b' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0f1f2e' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0f172a' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#cbd5e1' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#334155' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f8fafc' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1e293b' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#f59e0b' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#030712' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#38bdf8' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#030712' }],
  },
];

// High-contrast clean silver & crisp roadway theme for Daytime Workshop bays
export const DAYLIGHT_WORKSHOP_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f8fafc' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'on' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#1e293b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }, { weight: 3 }] },
  {
    featureType: 'administrative.land_parcel',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#64748b' }],
  },
  {
    featureType: 'poi',
    elementType: 'geometry',
    stylers: [{ color: '#f1f5f9' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#475569' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#e2e8f0' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#ffffff' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#cbd5e1' }, { weight: 1.5 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#fef3c7' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#f59e0b' }, { weight: 2 }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#92400e' }, { weight: 1 }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#e2e8f0' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#bae6fd' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#0369a1' }],
  },
];

let isConfigured = false;
let loadPromise: Promise<typeof google> | null = null;

export async function loadGoogleMaps(): Promise<typeof google> {
  // If already fully loaded with Map constructor available, return immediately
  if (
    typeof window !== 'undefined' &&
    window.google?.maps?.Map &&
    typeof window.google.maps.Map === 'function'
  ) {
    return window.google;
  }

  // If a load is already active in-flight, return the shared promise
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async () => {
    try {
      if (!GOOGLE_MAPS_API_KEY) {
        throw new Error('The live map is not set up: add a Google Maps API key (VITE_GOOGLE_MAPS_API_KEY).');
      }
      if (!isConfigured) {
        setOptions({
          key: GOOGLE_MAPS_API_KEY,
          v: 'weekly',
          libraries: ['maps', 'marker', 'core', 'routes'],
        });
        isConfigured = true;
      }

      const [mapsLib, markerLib, coreLib, routesLib] = await Promise.all([
        importLibrary('maps') as Promise<google.maps.MapsLibrary>,
        importLibrary('marker') as Promise<google.maps.MarkerLibrary>,
        importLibrary('core') as Promise<google.maps.CoreLibrary>,
        importLibrary('routes') as Promise<google.maps.RoutesLibrary>,
      ]);

      // Ensure backward compatibility by assigning required constructors to window.google.maps
      if (typeof window !== 'undefined') {
        const win = window as any;
        win.google = win.google || {};
        win.google.maps = win.google.maps || {};

        // Maps Library
        if (mapsLib) {
          win.google.maps.Map = mapsLib.Map;
          win.google.maps.Polyline = mapsLib.Polyline;
          win.google.maps.InfoWindow = mapsLib.InfoWindow;
          win.google.maps.TrafficLayer = mapsLib.TrafficLayer;
          win.google.maps.Circle = mapsLib.Circle;
          Object.assign(win.google.maps, mapsLib);
        }

        // Marker Library
        if (markerLib) {
          win.google.maps.Marker = markerLib.Marker;
          win.google.maps.AdvancedMarkerElement = markerLib.AdvancedMarkerElement;
          win.google.maps.PinElement = markerLib.PinElement;
          Object.assign(win.google.maps, markerLib);
        }

        // Routes Library
        if (routesLib) {
          win.google.maps.DirectionsService = routesLib.DirectionsService;
          win.google.maps.DirectionsRenderer = routesLib.DirectionsRenderer;
        }

        // Core Library
        if (coreLib) {
          win.google.maps.LatLng = coreLib.LatLng;
          win.google.maps.LatLngBounds = coreLib.LatLngBounds;
          win.google.maps.Point = coreLib.Point;
          win.google.maps.Size = coreLib.Size;
          win.google.maps.event = coreLib.event;
          Object.assign(win.google.maps, coreLib);
        }

        // Double check Map constructor
        if (typeof win.google.maps.Map !== 'function') {
          if (mapsLib && typeof (mapsLib as any).Map === 'function') {
            win.google.maps.Map = (mapsLib as any).Map;
          } else {
            throw new Error('Google Maps Map constructor is not available on maps library');
          }
        }
      }

      return window.google;
    } catch (err) {
      // Clear loadPromise on error so subsequent attempts can retry
      loadPromise = null;
      throw err;
    }
  })();

  return loadPromise;
}
