import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Navigation,
  MapPin,
  Compass,
  Radio,
  Layers,
  TrafficCone,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Crosshair,
  ExternalLink,
  Copy,
  Check,
  Building2,
  Mountain,
  Gauge,
  Play,
  Pause,
  RotateCcw,
  Truck,
  AlertTriangle,
  ShieldCheck,
  AlertOctagon,
  Eye,
  Route,
  Activity,
  Globe,
} from 'lucide-react';
import { FleetVehicle, VehicleStatus } from '../types';
import {
  loadGoogleMaps,
  DARK_FLEET_MAP_STYLE,
  DAYLIGHT_WORKSHOP_MAP_STYLE,
  GOOGLE_MAPS_API_KEY,
} from '../services/googleMapsLoader';
import { useTheme } from '../context/ThemeContext';

interface GoogleMapsLiveTrackingProps {
  vehicle: FleetVehicle;
  allVehicles?: FleetVehicle[];
  status?: VehicleStatus;
  speedKmh?: number;
  onSelectVehicle?: (vehicleId: string) => void;
  onOpenModal?: () => void;
  className?: string;
  isCompact?: boolean;
}

// Convert decimal degrees to DMS format
function toDMS(deg: number, isLat: boolean): string {
  const absolute = Math.abs(deg);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = ((minutesNotTruncated - minutes) * 60).toFixed(1);
  const direction = isLat ? (deg >= 0 ? 'N' : 'S') : deg >= 0 ? 'E' : 'W';
  return `${degrees}°${minutes}'${seconds}"${direction}`;
}

// Get cardinal heading direction
function getCardinalDirection(heading?: number): string {
  if (heading === undefined) return 'N';
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((heading % 360) / 22.5) % 16;
  return directions[index];
}

// Generate intermediate route path points for the vehicle's corridor
function getCorridorWaypoints(centerLat: number, centerLng: number, heading: number = 90): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  const rad = (heading * Math.PI) / 180;
  // Create 11 sample breadcrumb steps along the corridor vector with natural curves
  for (let i = -5; i <= 5; i++) {
    const distKm = i * 4.5;
    // rough approximation: 1 deg lat ~ 111 km, 1 deg lng ~ 111*cos(lat) km
    const dLat = (distKm * Math.cos(rad)) / 111;
    const dLng = (distKm * Math.sin(rad)) / (111 * Math.cos((centerLat * Math.PI) / 180));
    // slight curve displacement
    const curve = Math.sin(i * 0.6) * 0.008;
    points.push({
      lat: centerLat + dLat + curve,
      lng: centerLng + dLng,
    });
  }
  return points;
}

export const GoogleMapsLiveTracking: React.FC<GoogleMapsLiveTrackingProps> = ({
  vehicle,
  allVehicles = [],
  status = 'HEALTHY',
  speedKmh,
  onSelectVehicle,
  onOpenModal,
  className = '',
  isCompact = false,
}) => {
  const { isDaytime } = useTheme();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const trafficLayerRef = useRef<google.maps.TrafficLayer | null>(null);
  const markersRef = useRef<{ [key: string]: any }>({});
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const geofenceCircleRef = useRef<google.maps.Circle | null>(null);
  const depotMarkersRef = useRef<any[]>([]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mapStyleType, setMapStyleType] = useState<'dark' | 'roadmap' | 'satellite' | 'hybrid'>('dark');
  const [showTraffic, setShowTraffic] = useState(true);
  const [showAllUnits, setShowAllUnits] = useState(true);
  const [showDepots, setShowDepots] = useState(true);
  const [showGeofence, setShowGeofence] = useState(true);
  const [isLiveStreaming, setIsLiveStreaming] = useState(true);

  // Real road route snapping state
  const [routePath, setRoutePath] = useState<{lat: number, lng: number}[]>([]);
  const routeDistanceRef = useRef(0);

  // Dynamic live coordinates state that advances when live streaming is active
  const baseCoords = vehicle.coordinates || {
    lat: 18.7546,
    lng: 73.3426,
    heading: 118,
    altitude_m: 595,
    landmark: 'Bhor Ghat Viaduct Section (KM 64)',
    route_corridor: 'Mumbai-Pune Expressway (NH-48)',
  };

  const [liveCoords, setLiveCoords] = useState<{
    lat: number;
    lng: number;
    heading: number;
    speed: number;
    altitude_m: number;
  }>({
    lat: baseCoords.lat,
    lng: baseCoords.lng,
    heading: baseCoords.heading ?? 90,
    speed: speedKmh ?? vehicle.telemetry.speed_kmh,
    altitude_m: baseCoords.altitude_m ?? 500,
  });

  // Sync with prop changes if vehicle changes
  useEffect(() => {
    if (vehicle.coordinates) {
      setLiveCoords({
        lat: vehicle.coordinates.lat,
        lng: vehicle.coordinates.lng,
        heading: vehicle.coordinates.heading ?? 90,
        speed: speedKmh ?? vehicle.telemetry.speed_kmh,
        altitude_m: vehicle.coordinates.altitude_m ?? 500,
      });
      if (mapInstanceRef.current) {
        mapInstanceRef.current.panTo({
          lat: vehicle.coordinates.lat,
          lng: vehicle.coordinates.lng,
        });
      }
    }
  }, [vehicle.vehicle_id, vehicle.coordinates]);

  // Fetch real Google Maps driving directions for road snapping
  useEffect(() => {
    if (!mapLoaded || !window.google?.maps?.DirectionsService) return;
    const directionsService = new window.google.maps.DirectionsService();

    // Create a destination point ~15km away in the general heading direction
    const rad = (baseCoords.heading ?? 90) * Math.PI / 180;
    const destLat = baseCoords.lat + (15 * Math.cos(rad) / 111);
    const destLng = baseCoords.lng + (15 * Math.sin(rad) / (111 * Math.cos(baseCoords.lat * Math.PI / 180)));

    directionsService.route({
      origin: { lat: baseCoords.lat, lng: baseCoords.lng },
      destination: { lat: destLat, lng: destLng },
      travelMode: window.google.maps.TravelMode.DRIVING
    })
    .then((response) => {
      if (response && response.routes && response.routes[0]) {
        const path = response.routes[0].overview_path.map(p => ({ lat: p.lat(), lng: p.lng() }));
        setRoutePath(path);
        routeDistanceRef.current = 0;
      }
    })
    .catch((e) => {
      // Suppress Directions API errors (like UNKNOWN_ERROR) when route not found
      console.warn('Directions route not found, falling back to straight-line simulation.');
    });
  }, [vehicle.vehicle_id, mapLoaded]);

  // Helper to get distance between two lat/lng points in km
  const getDistKm = (p1, p2) => {
    const R = 6371; // km
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  };

  // Helper to get heading between two points
  const getHeading = (p1, p2) => {
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const lat1 = p1.lat * Math.PI / 180;
    const lat2 = p2.lat * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  // Live stream telematics simulation step
  useEffect(() => {
    if (!isLiveStreaming) return;

    // This allows the map to pan smoothly without stuttering while traversing faster
    const updateIntervalMs = 500;
    const interval = setInterval(() => {
      let nextLat = 0;
      let nextLng = 0;
      setLiveCoords((prev) => {
        // Speed micro-variations
        const speedJitter = Math.floor((Math.random() - 0.5) * 3);
        const newSpeed = Math.max(30, Math.min(105, prev.speed + speedJitter));

        const speedMps = (newSpeed * 1000) / 3600;
        // 1x = standard real-time speed. 2x/4x jumps further ahead per tick.
        const deltaKm = (speedMps * (updateIntervalMs / 1000)) / 1000;

        let newLat = prev.lat;
        let newLng = prev.lng;
        let newHeading = prev.heading;

        if (routePath.length > 1) {
          // Move along real route
          routeDistanceRef.current += deltaKm;
          const nextDist = routeDistanceRef.current;
          let accumulated = 0;
          let found = false;

          for (let i = 0; i < routePath.length - 1; i++) {
            const segLen = getDistKm(routePath[i], routePath[i + 1]);
            if (accumulated + segLen >= nextDist) {
              // We are in this segment. Interpolate.
              const ratio = (nextDist - accumulated) / segLen;
              newLat = routePath[i].lat + (routePath[i + 1].lat - routePath[i].lat) * ratio;
              newLng = routePath[i].lng + (routePath[i + 1].lng - routePath[i].lng) * ratio;
              newHeading = getHeading(routePath[i], routePath[i + 1]);
              found = true;
              break;
            }
            accumulated += segLen;
          }

          if (!found) {
            // Reached end of path, just stay at the last point
            const last = routePath[routePath.length - 1];
            newLat = last.lat;
            newLng = last.lng;
          }
        } else {
          // Fallback if route failed to load
          const rad = (prev.heading * Math.PI) / 180;
          newLat = prev.lat + (deltaKm * Math.cos(rad)) / 111;
          newLng = prev.lng + (deltaKm * Math.sin(rad)) / (111 * Math.cos((prev.lat * Math.PI) / 180));
          const headingJitter = (Math.random() - 0.5) * 1.2;
          newHeading = (prev.heading + headingJitter + 360) % 360;
        }

        nextLat = newLat;
        nextLng = newLng;
        return {
          lat: newLat,
          lng: newLng,
          heading: Math.round(newHeading),
          speed: newSpeed,
          altitude_m: prev.altitude_m + (Math.random() > 0.5 ? 1 : -1),
        };
      });
      
      if (mapInstanceRef.current && nextLat !== 0) {
        mapInstanceRef.current.panTo({ lat: nextLat, lng: nextLng });
      }
    }, updateIntervalMs);

    return () => clearInterval(interval);
  }, [isLiveStreaming, routePath]);

  // Initialize Google Maps instance
  useEffect(() => {
    let isCancelled = false;

    loadGoogleMaps()
      .then((googleObj) => {
        if (isCancelled || !mapContainerRef.current) return;

        if (!mapInstanceRef.current) {
          const googleMaps = googleObj?.maps || (typeof window !== 'undefined' ? (window as any).google?.maps : null);
          const MapClass = googleMaps?.Map;
          if (typeof MapClass !== 'function') {
            throw new Error('Google Maps Map constructor is not available.');
          }

          
          const map = new MapClass(mapContainerRef.current, {
            center: { lat: liveCoords.lat, lng: liveCoords.lng },
            zoom: isCompact ? 13 : 14,
            
            mapId: 'DEMO_MAP_ID', // Required for AdvancedMarkerElement
            mapTypeId:
              mapStyleType === 'satellite'
                ? 'satellite'
                : mapStyleType === 'hybrid'
                ? 'hybrid'
                : 'roadmap',
            disableDefaultUI: true,
            zoomControl: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: 'cooperative',
            // AI Studio attribution
            internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
          } as any);

          // Traffic layer
          if (typeof googleMaps.TrafficLayer === 'function') {
            const trafficLayer = new googleMaps.TrafficLayer();
            if (showTraffic) {
              trafficLayer.setMap(map);
            }
            trafficLayerRef.current = trafficLayer;
          }

          mapInstanceRef.current = map;
          setMapLoaded(true);

          // If multiple fleet units exist, auto-fit bounds so all Tata trucks on Indian roads are simultaneously visible
          if (allVehicles.length > 1 && showAllUnits && typeof googleMaps.LatLngBounds === 'function') {
            const bounds = new googleMaps.LatLngBounds();
            bounds.extend({ lat: liveCoords.lat, lng: liveCoords.lng });
            allVehicles.forEach((v) => {
              if (v.coordinates?.lat && v.coordinates?.lng) {
                bounds.extend({ lat: v.coordinates.lat, lng: v.coordinates.lng });
              }
            });
            if (!bounds.isEmpty()) {
              setTimeout(() => {
                map.fitBounds(bounds, { top: 60, right: 60, bottom: 80, left: 60 });
              }, 150);
            }
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load Google Maps Platform API:', err);
        setLoadError('Unable to load Google Maps Platform API. Check network or API configuration.');
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // Update map style and traffic layer when toggled
  useEffect(() => {
    if (!mapInstanceRef.current || !window.google) return;
    const map = mapInstanceRef.current;

    if (mapStyleType === 'dark') {
      map.setOptions({
            mapTypeId: 'roadmap',
      });
    } else if (mapStyleType === 'roadmap') {
      map.setOptions({
            mapTypeId: 'roadmap',
      });
    } else if (mapStyleType === 'satellite') {
      map.setOptions({
            mapTypeId: 'satellite',
      });
    } else if (mapStyleType === 'hybrid') {
      map.setOptions({
            mapTypeId: 'hybrid',
      });
    }
  }, [mapStyleType, isDaytime]);

  useEffect(() => {
    if (!trafficLayerRef.current || !mapInstanceRef.current) return;
    if (showTraffic) {
      trafficLayerRef.current.setMap(mapInstanceRef.current);
    } else {
      trafficLayerRef.current.setMap(null);
    }
  }, [showTraffic]);

  // Update Markers, Route Polyline, and Geofence Circle
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !window.google?.maps) return;
    const googleMaps = window.google.maps;
    const AdvancedMarkerElement = (googleMaps as any).marker?.AdvancedMarkerElement || (googleMaps as any).AdvancedMarkerElement;
    if (typeof AdvancedMarkerElement !== 'function' || typeof googleMaps.InfoWindow !== 'function') return;
    const map = mapInstanceRef.current;

    // Primary Active Vehicle Marker icon setup
    const isCritical = status === 'CRITICAL_STOP';
    const isWarning = status === 'WARNING';
    const markerColor = isCritical ? '#f43f5e' : isWarning ? '#f59e0b' : '#10b981';

    // SVG Truck / Directional Pin with Heading
    const truckSvg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r="18" fill="#0f172a" stroke="${markerColor}" stroke-width="3" />
        <circle cx="22" cy="22" r="8" fill="${markerColor}" fill-opacity="0.3" />
        <g transform="rotate(${liveCoords.heading}, 22, 22)">
          <path d="M 22 8 L 29 28 L 22 23 L 15 28 Z" fill="${markerColor}" />
        </g>
      </svg>
    `;

    const primaryPosition = { lat: liveCoords.lat, lng: liveCoords.lng };

    if (!markersRef.current[vehicle.vehicle_id]) {
      const img = document.createElement('img');
      img.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(truckSvg)}`;
      img.width = 44;
      img.height = 44;

      const marker = new AdvancedMarkerElement({
        position: primaryPosition,
        map,
        title: `${vehicle.vehicle_id} - ${vehicle.unit_name}`,
        content: img,
        zIndex: 999,
      });

      const infoWindow = new googleMaps.InfoWindow({
        content: `
          <div style="background:#090d16; color:#f1f5f9; padding:8px 12px; border-radius:8px; font-family:monospace; font-size:12px; border:1px solid #334155;">
            <div style="font-weight:bold; color:#f59e0b; margin-bottom:4px;">${vehicle.vehicle_id} · ${vehicle.unit_name}</div>
            ${vehicle.state ? `<div style="color:#38bdf8; font-size:11px; margin-bottom:3px;">State: <b>${vehicle.state}</b></div>` : ''}
            <div>Driver: <b>${vehicle.driver}</b></div>
            <div>Speed: <b style="color:#38bdf8;">${liveCoords.speed} KMPH</b> · Heading: <b>${liveCoords.heading}°</b></div>
            <div>Status: <span style="color:${markerColor}; font-weight:bold;">${status}</span></div>
            <div style="font-size:10px; color:#94a3b8; margin-top:4px;">${vehicle.coordinates?.route_corridor || 'Commercial Transit Corridor'}</div>
          </div>
        `,
      });

      marker.addEventListener('gmp-click', () => {
        infoWindow.open(map, marker);
      });

      markersRef.current[vehicle.vehicle_id] = marker as any;
    } else {
      const marker = markersRef.current[vehicle.vehicle_id] as any;
      marker.position = primaryPosition;
      if (marker.content && (marker.content as HTMLImageElement).src) {
        (marker.content as HTMLImageElement).src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(truckSvg)}`;
      }
    }

    // Other Fleet Vehicles on the Map (if showAllUnits is enabled)
    const activeVehicles = showAllUnits ? allVehicles.filter((v) => v.vehicle_id !== vehicle.vehicle_id) : [];

    // Clean up markers of unshown units
    Object.keys(markersRef.current).forEach((vId) => {
      if (vId !== vehicle.vehicle_id && !activeVehicles.find((av) => av.vehicle_id === vId)) {
        const marker = markersRef.current[vId] as any;
        marker.map = null;
        if (typeof marker.setMap === 'function') marker.setMap(null);
        delete markersRef.current[vId];
      }
    });

    activeVehicles.forEach((otherV) => {
      if (!otherV.coordinates) return;
      const otherPos = { lat: otherV.coordinates.lat, lng: otherV.coordinates.lng };
      const hasFaults = otherV.telemetry.active_dtc_codes.length > 0;
      const otherColor = hasFaults ? '#f59e0b' : '#38bdf8';
      const shortModel = otherV.vehicle_id.replace('TATA-', '');

      const otherSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38">
          <circle cx="19" cy="19" r="16" fill="#090d16" stroke="${otherColor}" stroke-width="2.5" />
          <circle cx="19" cy="19" r="6.5" fill="${otherColor}" fill-opacity="0.25" />
          <g transform="rotate(${otherV.coordinates.heading ?? 0}, 19, 19)">
            <path d="M 19 6 L 25 24 L 19 20 L 13 24 Z" fill="${otherColor}" />
          </g>
        </svg>
      `;

      if (!markersRef.current[otherV.vehicle_id]) {
        const img = document.createElement('img');
        img.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(otherSvg)}`;
        img.width = 38;
        img.height = 38;

        const marker = new AdvancedMarkerElement({
          position: otherPos,
          map,
          title: `${otherV.vehicle_id} - ${otherV.unit_name}`,
          content: img,
          zIndex: 100,
        });

        const otherInfoWindow = new googleMaps.InfoWindow({
          content: `
            <div style="background:#090d16; color:#f1f5f9; padding:10px 14px; border-radius:10px; font-family:monospace; font-size:12px; border:1px solid #334155; min-width:210px;">
              <div style="font-weight:bold; color:#38bdf8; margin-bottom:3px; font-size:13px;">${otherV.vehicle_id} · ${otherV.unit_name}</div>
              <div style="color:#cbd5e1; font-size:11px; margin-bottom:4px;">${otherV.make_model}</div>
              ${otherV.state ? `<div style="color:#38bdf8; font-size:11px; margin-bottom:3px;">Region: <b>${otherV.state}</b></div>` : ''}
              <div style="color:#94a3b8;">Driver: <b style="color:#f1f5f9;">${otherV.driver || otherV.driver_name || 'Fleet Operator'}</b></div>
              ${otherV.payload ? `<div style="color:#fbbf24; font-size:11px; margin-top:2px;">Load: <b>${otherV.payload}</b></div>` : ''}
              ${otherV.gvw_tons ? `<div style="color:#94a3b8; font-size:11px;">GVW: <b>${otherV.gvw_tons} Tonnes</b></div>` : ''}
              <div style="margin-top:4px;">Speed: <b style="color:#38bdf8;">${otherV.telemetry.speed_kmh} km/h</b> · Faults: <b style="color:${hasFaults ? '#f59e0b' : '#10b981'};">${otherV.telemetry.active_dtc_codes.length} active</b></div>
              <div style="font-size:10px; color:#64748b; margin-top:4px;">${otherV.coordinates?.landmark || otherV.location}</div>
            </div>
          `,
        });

        marker.addEventListener('gmp-click', () => {
          otherInfoWindow.open(map, marker);
          if (onSelectVehicle) {
            onSelectVehicle(otherV.vehicle_id);
          }
        });

        markersRef.current[otherV.vehicle_id] = marker as any;
      } else {
        const marker = markersRef.current[otherV.vehicle_id] as any;
        marker.position = otherPos;
        if (marker.content && (marker.content as HTMLImageElement).src) {
          (marker.content as HTMLImageElement).src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(otherSvg)}`;
        }
      }
    });

    // Corridor Route Polyline (use real route if available)
    const corridorPoints = routePath.length > 0 ? routePath : getCorridorWaypoints(liveCoords.lat, liveCoords.lng, liveCoords.heading);
    if (!polylineRef.current) {
      polylineRef.current = new googleMaps.Polyline({
        path: corridorPoints,
        geodesic: true,
        strokeColor: '#0ea5e9',
        strokeOpacity: 0.85,
        strokeWeight: 4,
        map,
      });
    } else {
      polylineRef.current.setPath(corridorPoints);
    }

    // Geofence Buffer Circle (5 km radius delivery zone)
    if (showGeofence) {
      if (!geofenceCircleRef.current) {
        geofenceCircleRef.current = new googleMaps.Circle({
          strokeColor: '#f59e0b',
          strokeOpacity: 0.4,
          strokeWeight: 2,
          fillColor: '#f59e0b',
          fillOpacity: 0.06,
          map,
          center: primaryPosition,
          radius: 4800, // meters
        });
      } else {
        geofenceCircleRef.current.setCenter(primaryPosition);
        geofenceCircleRef.current.setMap(map);
      }
    } else if (geofenceCircleRef.current) {
      geofenceCircleRef.current.setMap(null);
    }

    // Nearby Commercial Service Bays Markers
    depotMarkersRef.current.forEach((m) => {
      m.map = null;
      if (typeof m.setMap === 'function') m.setMap(null);
    });
    depotMarkersRef.current = [];

    if (showDepots) {
      const isIndia = liveCoords.lng > 60;
      const depots = isIndia
        ? [
            {
              name: 'Tata Motors Commercial Workshop & Spares',
              lat: liveCoords.lat + 0.018,
              lng: liveCoords.lng + 0.012,
              type: 'OEM Authorized Workshop',
              phone: '+91 1800 209 7979',
            },
            {
              name: 'National Highway Highway Safety Bay (KM 68)',
              lat: liveCoords.lat - 0.024,
              lng: liveCoords.lng - 0.015,
              type: 'Emergency Breakout & Nitrogen Station',
              phone: '1033 (NHAI Helpline)',
            },
          ]
        : [
            {
              name: 'Freightliner / Detroit Authorized Service Bay',
              lat: liveCoords.lat + 0.022,
              lng: liveCoords.lng + 0.018,
              type: 'OEM Heavy Duty Service',
              phone: '1-800-547-0712',
            },
            {
              name: 'Commercial Truck Stop & Scale Facility',
              lat: liveCoords.lat - 0.025,
              lng: liveCoords.lng - 0.014,
              type: 'Fuel, Scale & Brake Inspection',
              phone: '1-800-438-8637',
            },
          ];

      depots.forEach((depot) => {
        const depotSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
            <circle cx="14" cy="14" r="11" fill="#1e1b4b" stroke="#818cf8" stroke-width="2" />
            <path d="M 9 10 L 19 10 L 19 18 L 9 18 Z" fill="#a5b4fc" />
            <circle cx="11" cy="19" r="1.5" fill="#38bdf8" />
            <circle cx="17" cy="19" r="1.5" fill="#38bdf8" />
          </svg>
        `;

        const img = document.createElement('img');
        img.src = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(depotSvg)}`;
        img.width = 28;
        img.height = 28;

        
        
        const dMarker = new AdvancedMarkerElement({
          position: { lat: depot.lat, lng: depot.lng },
          map,
          title: depot.name,
          content: img,
        });

        const dInfoWindow = new googleMaps.InfoWindow({
          content: `
            <div style="background:#090d16; color:#f1f5f9; padding:8px 12px; border-radius:8px; font-family:monospace; font-size:11px; border:1px solid #4338ca;">
              <div style="font-weight:bold; color:#a5b4fc;">${depot.name}</div>
              <div style="color:#94a3b8; margin:2px 0;">${depot.type}</div>
              <div style="color:#38bdf8;">Helpline: ${depot.phone}</div>
            </div>
          `,
        });

        dMarker.addEventListener('gmp-click', () => {
          dInfoWindow.open(map, dMarker);
        });

        depotMarkersRef.current.push(dMarker);
      });
    }
  }, [
    mapLoaded,
    liveCoords.lat,
    liveCoords.lng,
    liveCoords.heading,
    liveCoords.speed,
    vehicle.vehicle_id,
    vehicle.unit_name,
    status,
    showAllUnits,
    showGeofence,
    showDepots,
    allVehicles,
  ]);

  // Recenter map on active vehicle
  const handleRecenter = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: liveCoords.lat, lng: liveCoords.lng });
      mapInstanceRef.current.setZoom(14);
    }
  }, [liveCoords.lat, liveCoords.lng]);

  // Fit all fleet units simultaneously on map view
  const handleFitAllUnits = useCallback(() => {
    if (!mapInstanceRef.current || !window.google?.maps?.LatLngBounds) return;
    const bounds = new window.google.maps.LatLngBounds();
    bounds.extend({ lat: liveCoords.lat, lng: liveCoords.lng });
    allVehicles.forEach((v) => {
      if (v.coordinates?.lat && v.coordinates?.lng) {
        bounds.extend({ lat: v.coordinates.lat, lng: v.coordinates.lng });
      }
    });
    if (!bounds.isEmpty()) {
      mapInstanceRef.current.fitBounds(bounds, { top: 60, right: 60, bottom: 80, left: 60 });
    }
  }, [liveCoords.lat, liveCoords.lng, allVehicles]);

  // Zoom helpers
  const handleZoom = (delta: number) => {
    if (mapInstanceRef.current) {
      const currZoom = mapInstanceRef.current.getZoom() || 14;
      mapInstanceRef.current.setZoom(currZoom + delta);
    }
  };

  // Copy GPS Coordinates
  const handleCopyCoords = () => {
    navigator.clipboard.writeText(`${liveCoords.lat.toFixed(6)}, ${liveCoords.lng.toFixed(6)}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const latFormatted = `${Math.abs(liveCoords.lat).toFixed(4)}° ${liveCoords.lat >= 0 ? 'N' : 'S'}`;
  const lngFormatted = `${Math.abs(liveCoords.lng).toFixed(4)}° ${liveCoords.lng >= 0 ? 'E' : 'W'}`;
  const dmsCoords = `${toDMS(liveCoords.lat, true)} ${toDMS(liveCoords.lng, false)}`;
  const cardinal = getCardinalDirection(liveCoords.heading);

  const statusColor =
    status === 'CRITICAL_STOP'
      ? { text: 'text-rose-400', bg: 'bg-rose-500', border: 'border-rose-500/50', badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40' }
      : status === 'WARNING'
      ? { text: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500/50', badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40' }
      : { text: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500/50', badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };

  return (
    <div
      id={`google-maps-live-tracking-${vehicle.vehicle_id}`}
      className={`bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col relative ${className}`}
    >
      {/* Top Header Bar with Live Feed Status and Controls */}
      <div className="bg-slate-950/95 border-b border-slate-800/90 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <Radio className="w-4 h-4 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-slate-100 font-mono tracking-tight">
                {vehicle.vehicle_id} • {vehicle.unit_name}
              </span>
              {vehicle.state && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold flex items-center gap-1">
                  <MapPin className="w-2.5 h-2.5 text-sky-400" />
                  {vehicle.state}
                </span>
              )}
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                GOOGLE MAPS LIVE FEED
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {vehicle.location}
            </p>
          </div>
        </div>

        {/* Action Controls: Live Stream Play/Pause, Speed multiplier, Copy, External */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {/* Live Feed Stream Toggle Button */}
          <button
            onClick={() => setIsLiveStreaming(!isLiveStreaming)}
            title={isLiveStreaming ? 'Pause GPS Live Feed' : 'Resume GPS Live Feed'}
            className={`px-2.5 py-1 rounded-2xl text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all border ${
              isLiveStreaming
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
            }`}
          >
            {isLiveStreaming ? (
              <>
                <Pause className="w-3 h-3" />
                <span>Live Feed</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3" />
                <span>Paused</span>
              </>
            )}
          </button>



          {/* Copy Coordinates */}
          <button
            onClick={handleCopyCoords}
            title="Copy GPS coordinates"
            className="p-1.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1 text-[11px] font-mono"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-amber-400" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Coords'}</span>
          </button>

          {/* External Google Maps link */}
          <a
            href={`https://www.google.com/maps?q=${liveCoords.lat},${liveCoords.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Google Maps web viewer"
            className="p-1.5 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1 text-[11px] font-mono"
          >
            <ExternalLink className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Google Maps</span>
          </a>

          {/* Dedicated Fullscreen Live Tracking Modal Trigger */}
          {onOpenModal && (
            <button
              onClick={onOpenModal}
              title="Expand into full-screen Live Tracking Modal"
              className="p-1.5 rounded-2xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-all flex items-center gap-1 text-[11px] font-mono font-semibold active:scale-95"
            >
              <Maximize2 className="w-3 h-3 text-amber-400" />
              <span>Expand</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Map Canvas Area */}
      <div className={`relative w-full bg-slate-950 overflow-hidden ${isCompact ? 'h-64 sm:h-80' : 'h-80 sm:h-[420px] lg:h-[480px]'}`}>
        {/* Google Map Container Element */}
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Fallback loading indicator while Google Maps JS loads */}
        {!mapLoaded && !loadError && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-3 z-10">
            <Radio className="w-8 h-8 text-amber-400 animate-spin" />
            <div className="text-center font-mono">
              <p className="text-xs font-bold text-slate-200">Connecting to Google Maps Platform API...</p>
              <p className="text-[11px] text-slate-500 mt-1">Provisioning live commercial fleet tracking feed</p>
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-4 sm:p-6 text-center z-10 font-mono space-y-2 sm:space-y-3">
            <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-rose-400 shrink-0" />
            <p className="text-xs sm:text-sm font-bold text-slate-200 px-2 leading-snug break-words max-w-[90%] sm:max-w-md">{loadError}</p>
            <p className="text-[10px] sm:text-xs text-slate-400 max-w-[90%] sm:max-w-md leading-tight">
              Falling back to local high-precision telemetry coordinates:
              <br />
              {latFormatted}, {lngFormatted}
            </p>
          </div>
        )}

        {/* Floating Telematics Glass HUD Overlay (Top-Left) */}
        <div className="absolute top-3 left-3 z-20 bg-slate-950/90 backdrop-blur-md px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-3xl border border-slate-800/80 text-[10px] sm:text-[11px] font-mono text-slate-300 space-y-1 shadow-xl max-w-[200px] sm:max-w-xs pointer-events-none">
          <div className="flex items-center justify-between gap-2 sm:gap-3 text-amber-400 font-bold border-b border-slate-800/80 pb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <Compass className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">HDG: {liveCoords.heading}° <span className="hidden sm:inline">({cardinal})</span></span>
            </div>
            <span className="text-emerald-400 text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-xl bg-emerald-500/20 shrink-0">
              {liveCoords.speed} KMPH
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 text-slate-400 text-[9px] sm:text-[10px] pt-0.5">
            <span className="text-slate-300 font-semibold truncate">{latFormatted}, {lngFormatted}</span>
            <span className="shrink-0 hidden sm:inline">Alt: {liveCoords.altitude_m}m</span>
          </div>
          
          <div className="flex items-center justify-between gap-2 text-slate-400 text-[9px] sm:text-[10px] border-b border-slate-800/80 pb-1">
            <span className="text-slate-300 font-semibold truncate">RPM: {vehicle.telemetry.engine_rpm ?? Math.round((liveCoords.speed) * 22.5)}</span>
            <span className="shrink-0">TPMS: {vehicle.telemetry.tire_pressure_psi ?? 100} psi</span>
          </div>

          {vehicle.coordinates?.route_corridor && (
            <div className="text-[9px] sm:text-[10px] text-cyan-400/90 font-medium truncate pt-0.5 hidden sm:block">
              {vehicle.coordinates.route_corridor}
            </div>
          )}
        </div>

        {/* Floating Map Controls (Top-Right): Traffic, Multi-unit, Geofence, Re-center, Zoom */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
          {/* Recenter button */}
          <button
            onClick={handleRecenter}
            title="Recenter on active vehicle"
            className="w-8 h-8 rounded-2xl bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-amber-400 flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95 touch-manipulation shrink-0"
          >
            <Crosshair className="w-4 h-4" />
          </button>

          {/* Traffic Layer Toggle */}
          <button
            onClick={() => setShowTraffic(!showTraffic)}
            title={showTraffic ? 'Disable Google Live Traffic' : 'Enable Google Live Traffic'}
            className={`w-8 h-8 rounded-2xl border flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95 touch-manipulation shrink-0 ${
              showTraffic
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-900/95 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <TrafficCone className="w-4 h-4" />
          </button>

          {/* Fit All Fleet Units View */}
          {allVehicles.length > 1 && (
            <button
              onClick={handleFitAllUnits}
              title="Fit all Tata fleet trucks simultaneously on map"
              className="w-8 h-8 rounded-2xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95 touch-manipulation shrink-0"
            >
              <Layers className="w-4 h-4" />
            </button>
          )}

          {/* Multi-Fleet Units Toggle */}
          {allVehicles.length > 1 && (
            <button
              onClick={() => setShowAllUnits(!showAllUnits)}
              title={showAllUnits ? 'Hide other fleet units' : 'Show all fleet units on map'}
              className={`w-8 h-8 rounded-2xl border flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95 touch-manipulation shrink-0 ${
                showAllUnits
                  ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                  : 'bg-slate-900/95 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Truck className="w-4 h-4" />
            </button>
          )}

          {/* Geofence Corridor Toggle */}
          <button
            onClick={() => setShowGeofence(!showGeofence)}
            title={showGeofence ? 'Hide Geofence Corridor' : 'Show Geofence Corridor'}
            className={`w-8 h-8 rounded-2xl border flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95 touch-manipulation shrink-0 hidden sm:flex ${
              showGeofence
                ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                : 'bg-slate-900/95 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <Route className="w-4 h-4" />
          </button>

          {/* Zoom In & Out */}
          <button
            onClick={() => handleZoom(1)}
            title="Zoom In"
            className="w-8 h-8 rounded-2xl bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-slate-200 hidden sm:flex items-center justify-center transition-all shadow-lg touch-manipulation shrink-0"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleZoom(-1)}
            title="Zoom Out"
            className="w-8 h-8 rounded-2xl bg-slate-900/95 hover:bg-slate-800 border border-slate-700 text-slate-200 hidden sm:flex items-center justify-center transition-all shadow-lg touch-manipulation shrink-0"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          {/* Fullscreen / Popout Modal button in floating toolbar */}
          {onOpenModal && (
            <button
              onClick={onOpenModal}
              title="Expand into full-screen Live Tracking Modal"
              className="w-8 h-8 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 hidden sm:flex items-center justify-center transition-all shadow-lg hover:scale-105 active:scale-95 touch-manipulation shrink-0"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Map Style Selector (Bottom-Left) - touch-friendly 44px buttons on mobile */}
        <div 
          id="map-style-selector"
          className="absolute bottom-3 left-3 z-20 flex items-center gap-0.5 sm:gap-0.5 bg-slate-950/95 backdrop-blur-md p-0.5 rounded-2xl border border-slate-700/90 font-mono shadow-2xl max-w-[calc(100%-24px)] overflow-x-auto no-scrollbar scrollbar-none hide-scrollbar ring-1 ring-slate-800/50"
        >
          <button
            onClick={() => setMapStyleType('dark')}
            title={isDaytime ? 'High-contrast Daytime Workshop clean roadways' : 'Tactical Dark Ops mode'}
            className={`px-2 py-1.5 sm:px-2 sm:py-1 rounded-xl transition-all font-semibold touch-manipulation min-h-[32px] sm:min-h-[24px] flex items-center gap-1 justify-center shrink-0 active:scale-95 ${
              mapStyleType === 'dark'
                ? 'bg-cyan-500/25 text-cyan-300 font-bold border border-cyan-500/50 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Activity className="w-3 h-3 shrink-0" />
            <span className="text-[9px] sm:text-[10px]">{isDaytime ? 'Workshop' : 'Tactical'}</span>
          </button>
          <button
            onClick={() => setMapStyleType('roadmap')}
            title="Standard clean roadways layout"
            className={`px-2 py-1.5 sm:px-2 sm:py-1 rounded-xl transition-all font-semibold touch-manipulation min-h-[32px] sm:min-h-[24px] flex items-center gap-1 justify-center shrink-0 active:scale-95 ${
              mapStyleType === 'roadmap'
                ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/50 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Compass className="w-3 h-3 shrink-0" />
            <span className="text-[9px] sm:text-[10px]">Roads</span>
          </button>
          <button
            onClick={() => setMapStyleType('satellite')}
            title="High-resolution satellite imagery"
            className={`px-2 py-1.5 sm:px-2 sm:py-1 rounded-xl transition-all font-semibold touch-manipulation min-h-[32px] sm:min-h-[24px] flex items-center gap-1 justify-center shrink-0 active:scale-95 ${
              mapStyleType === 'satellite'
                ? 'bg-blue-500/25 text-blue-300 font-bold border border-blue-500/50 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Globe className="w-3 h-3 shrink-0" />
            <span className="text-[9px] sm:text-[10px] hidden sm:inline">Satellite</span>
            <span className="text-[9px] sm:hidden">Sat</span>
          </button>
          <button
            onClick={() => setMapStyleType('hybrid')}
            title="Satellite imagery with road and corridor overlays"
            className={`px-2 py-1.5 sm:px-2 sm:py-1 rounded-xl transition-all font-semibold touch-manipulation min-h-[32px] sm:min-h-[24px] flex items-center gap-1 justify-center shrink-0 active:scale-95 ${
              mapStyleType === 'hybrid'
                ? 'bg-purple-500/25 text-purple-300 font-bold border border-purple-500/50 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3 h-3 shrink-0" />
            <span className="text-[9px] sm:text-[10px]">Hybrid</span>
          </button>
        </div>

        {/* Traffic Indicator Legend - Positioned at top-auto bottom-14 on phones so it doesn't overlap HUD or style selector */}
        {showTraffic && (
          <div 
            id="map-traffic-legend"
            className="absolute bottom-14 left-3 sm:top-auto sm:bottom-3 sm:left-auto sm:right-3 z-30 bg-slate-950/95 backdrop-blur-md px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-2xl border border-slate-700/80 sm:border-slate-800 text-[10px] sm:text-[9px] font-mono text-slate-300 flex items-center gap-2 sm:gap-2.5 shadow-xl max-w-[calc(100%-24px)] overflow-x-auto no-scrollbar scrollbar-none hide-scrollbar animate-in fade-in duration-200"
          >
            <span className="text-slate-400 uppercase font-semibold text-[9px]">Traffic:</span>
            <span className="flex items-center gap-1 font-medium"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" /> Fast</span>
            <span className="flex items-center gap-1 font-medium"><span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" /> Slow</span>
            <span className="flex items-center gap-1 font-medium"><span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" /> Congested</span>
          </div>
        )}
      </div>

      {/* Corridor Telematics Details & Service Stations Footer */}
      <div className="bg-slate-950/95 border-t border-slate-800/80 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="text-slate-100">{latFormatted}, {lngFormatted}</span>
            </div>
            <span className="text-slate-500 hidden sm:inline">•</span>
            <span className="text-[11px] text-slate-400">{dmsCoords}</span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
            {vehicle.coordinates?.route_corridor && (
              <span className="text-cyan-400/90 font-semibold">{vehicle.coordinates.route_corridor}</span>
            )}
            {vehicle.coordinates?.landmark && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-slate-300">{vehicle.coordinates.landmark}</span>
              </>
            )}
          </div>
        </div>

        {/* Toggle Service Stations */}
        <div className="shrink-0 flex items-center gap-2">
          <button
            onClick={() => setShowDepots(!showDepots)}
            className="text-[11px] px-2.5 py-1.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Building2 className="w-3.5 h-3.5 text-amber-400" />
            <span>{showDepots ? 'Hide Authorized Bays' : 'Show Authorized Bays'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
