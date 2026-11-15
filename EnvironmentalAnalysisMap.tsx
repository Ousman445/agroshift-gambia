/**
 * AgroShift Gambia — Interactive Environmental Analysis Map (Leaflet)
 *
 * Farmer-Focused Visual Design & Scientific Honesty:
 * - Shows the selected field boundary clearly on every indicator.
 * - Shows ONLY one clean spatial footprint matching the active indicator's true scale
 *   (no unexplained extra rectangles, fake continuous heatmaps, or cluttered markers):
 *   1. Rainfall: Uniform ~10 km GPM IMERG OR ~50 km NASA POWER MERRA-2 coverage area.
 *   2. Soil Moisture: Coarse ~9 km regional coverage circle around the pilot area.
 *   3. Vegetation (NDVI): 250 m local pixel covering the field area.
 *   4. Soil Properties: 250 m local soil estimate cell (dashed border = modelled, not lab test).
 *   5. Elevation: Actual 3x3 georeferenced 30 m SRTM pixels from backend coordinates.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { EvidenceSrtmItem, LocationData } from '../../types/agroshift';
import {
  IndicatorId,
  RainfallDatasetChoice,
  SmapLayerChoice,
  getElevationColor,
} from './evidenceInterpretation';
import { Plus, Minus, Layers, MapPin } from 'lucide-react';

const PILOT_DEFAULT_POLYGON: [number, number][] = [
  [13.2501, -16.6165],
  [13.2505, -16.6142],
  [13.2478, -16.6139],
  [13.2474, -16.6161],
];

function cellBoundsKm(lat: number, lng: number, sizeKm: number): L.LatLngBoundsExpression {
  const halfLatDeg = sizeKm / 2 / 111.32;
  const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const halfLngDeg = sizeKm / 2 / (111.32 * cosLat);
  return [
    [lat - halfLatDeg, lng - halfLngDeg],
    [lat + halfLatDeg, lng + halfLngDeg],
  ];
}

export interface EnvironmentalAnalysisMapProps {
  activeIndicator: IndicatorId;
  fieldLocation: LocationData;
  evidenceLocation?: { name: string; latitude: number; longitude: number } | null;
  fieldName: string;
  fieldSizeHa: number;
  // Rainfall props
  rainfallChoice: RainfallDatasetChoice;
  rainfallPctOfNormal: number | null;
  rainfallStatusLabel: string;
  rainfallColor: string;
  rainfallPeriodLabel: string;
  // Soil Moisture props
  smapChoice: SmapLayerChoice;
  smapPctWater: number | null;
  smapDistanceKm: number | null;
  smapColor: string;
  smapPeriodLabel: string;
  // NDVI props
  modisConditionLabel: string;
  modisColor: string;
  modisPeriodLabel: string;
  // Soil Properties props
  soilHeadline: string;
  soilDepth: string;
  soilColor: string;
  // SRTM Elevation props
  srtmSamples: EvidenceSrtmItem[];
  srtmMin: number | null;
  srtmMax: number | null;
}

export const EnvironmentalAnalysisMap: React.FC<EnvironmentalAnalysisMapProps> = ({
  activeIndicator,
  fieldLocation,
  evidenceLocation,
  fieldName,
  fieldSizeHa,
  rainfallChoice,
  rainfallPctOfNormal,
  rainfallStatusLabel,
  rainfallColor,
  rainfallPeriodLabel,
  smapChoice,
  smapPctWater,
  smapDistanceKm,
  smapColor,
  smapPeriodLabel,
  modisConditionLabel,
  modisColor,
  modisPeriodLabel,
  soilHeadline,
  soilDepth,
  soilColor,
  srtmSamples,
  srtmMin,
  srtmMax,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseTileRef = useRef<L.TileLayer | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const fieldLayerRef = useRef<L.LayerGroup | null>(null);

  const [baseStyle, setBaseStyle] = useState<'osm' | 'satellite'>('osm');
  const [viewFocus, setViewFocus] = useState<'auto' | 'field' | 'coverage'>('auto');

  const centerLat = evidenceLocation?.latitude ?? fieldLocation.latitude ?? 13.24890667;
  const centerLng = evidenceLocation?.longitude ?? fieldLocation.longitude ?? -16.61527333;

  const fieldPolygon = useMemo<[number, number][]>(() => {
    const coords = fieldLocation.boundary_geojson?.geometry?.coordinates?.[0];
    if (Array.isArray(coords) && coords.length >= 4) {
      return coords
        .slice(0, -1)
        .map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
    }
    return PILOT_DEFAULT_POLYGON;
  }, [fieldLocation.boundary_geojson]);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [centerLat, centerLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
    });

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    });
    osmLayer.addTo(map);
    baseTileRef.current = osmLayer;

    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

    overlayLayerRef.current = L.layerGroup().addTo(map);
    fieldLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      baseTileRef.current = null;
      overlayLayerRef.current = null;
      fieldLayerRef.current = null;
    };
  }, []);

  // Switch Street Map vs Satellite
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (baseTileRef.current) {
      map.removeLayer(baseTileRef.current);
    }

    const nextTile =
      baseStyle === 'satellite'
        ? L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
              attribution: '&copy; Esri World Imagery',
              maxZoom: 19,
            }
          )
        : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap',
            maxZoom: 19,
          });

    nextTile.addTo(map);
    nextTile.bringToBack();
    baseTileRef.current = nextTile;
  }, [baseStyle]);

  // Persistent Field Boundary & Location Pin
  useEffect(() => {
    const fieldGroup = fieldLayerRef.current;
    if (!fieldGroup) return;

    fieldGroup.clearLayers();

    const boundaryPoly = L.polygon(fieldPolygon, {
      color: '#116b37',
      weight: 3,
      opacity: 1,
      fillColor: '#116b37',
      fillOpacity: 0.16,
    });

    boundaryPoly.bindPopup(
      `<div style="font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.45; min-width: 170px;">
        <div style="font-weight: 600; font-size: 14px; color: #111827;">${fieldName}</div>
        <div style="color: #4b5563; margin-top: 3px;">Field area: ${fieldSizeHa.toFixed(2)} hectares</div>
      </div>`
    );
    boundaryPoly.addTo(fieldGroup);

    const pilotIcon = L.divIcon({
      className: 'agroshift-pilot-pin',
      html: `<div style="
        width: 13px;
        height: 13px;
        border-radius: 9999px;
        background: #ea7b15;
        border: 2.5px solid #ffffff;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [13, 13],
      iconAnchor: [6.5, 6.5],
    });

    const marker = L.marker([centerLat, centerLng], { icon: pilotIcon });
    marker.bindTooltip(`${fieldName} (${fieldSizeHa.toFixed(1)} ha)`, {
      direction: 'top',
      offset: [0, -8],
    });
    marker.addTo(fieldGroup);
  }, [fieldPolygon, centerLat, centerLng, fieldName, fieldSizeHa]);

  // Clean Single-Overlay Rendering per Indicator
  useEffect(() => {
    const map = mapRef.current;
    const overlayGroup = overlayLayerRef.current;
    if (!map || !overlayGroup) return;

    overlayGroup.clearLayers();
    let coverageBounds: L.LatLngBounds | null = null;

    if (activeIndicator === 'Rainfall') {
      const cellKm = rainfallChoice === 'merra2' ? 50 : 10;
      const cellBounds = cellBoundsKm(centerLat, centerLng, cellKm);
      const rect = L.rectangle(cellBounds, {
        color: rainfallColor,
        weight: 2.5,
        dashArray: rainfallChoice === 'merra2' ? '6 5' : undefined,
        fillColor: rainfallColor,
        fillOpacity: 0.2,
      });

      rect.bindPopup(
        `<div style="font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.45; max-width: 245px;">
          <div style="font-weight: 600; font-size: 14px; color: #111827;">Wider Rainfall Area (~${cellKm} km)</div>
          <div style="margin-top: 4px; color: #111827;"><strong>${
            rainfallPctOfNormal !== null ? `${rainfallPctOfNormal}% of usual` : 'Unavailable'
          }</strong> · ${rainfallStatusLabel}</div>
          <div style="color: #4b5563; font-size: 12px; margin-top: 4px;">${rainfallPeriodLabel}. Shown as one uniform area — not measured meter-by-meter inside your field.</div>
        </div>`
      );
      rect.bindTooltip(
        `Wider area (~${cellKm} km): ${
          rainfallPctOfNormal !== null ? `${rainfallPctOfNormal}% of usual` : 'Unavailable'
        }`,
        { sticky: true }
      );
      rect.addTo(overlayGroup);
      coverageBounds = rect.getBounds();
    } else if (activeIndicator === 'Soil Moisture') {
      // Single clean regional coverage circle (~4.5 km radius ≈ 9 km wide cell)
      const radiusMeters = Math.max(4500, (smapDistanceKm ?? 4.5) * 1000);
      const regionCircle = L.circle([centerLat, centerLng], {
        radius: radiusMeters,
        color: smapColor,
        weight: 2.5,
        dashArray: '6 5',
        fillColor: smapColor,
        fillOpacity: 0.2,
      });

      const layerWords = smapChoice === 'surface' ? 'Topsoil (top 5 cm)' : 'Root zone (0–100 cm)';
      regionCircle.bindPopup(
        `<div style="font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.45; max-width: 245px;">
          <div style="font-weight: 600; font-size: 14px; color: #111827;">Regional Soil Moisture Area (~9 km scale)</div>
          <div style="margin-top: 4px; color: #111827;">${layerWords}: <strong>${
            smapPctWater !== null ? `${smapPctWater}% water by volume` : 'Unavailable'
          }</strong></div>
          <div style="color: #4b5563; font-size: 12px; margin-top: 4px;">${smapPeriodLabel}. Regional satellite average, not a soil sensor inside your plot.</div>
        </div>`
      );
      regionCircle.bindTooltip(
        `Regional moisture (~9 km area): ${
          smapPctWater !== null ? `${smapPctWater}% water` : 'Unavailable'
        }`,
        { sticky: true }
      );
      regionCircle.addTo(overlayGroup);
      coverageBounds = regionCircle.getBounds();
    } else if (activeIndicator === 'NDVI') {
      // Single 250 m local vegetation pixel covering the field
      const modisRect = L.rectangle(cellBoundsKm(centerLat, centerLng, 0.25), {
        color: modisColor,
        weight: 2.5,
        fillColor: modisColor,
        fillOpacity: 0.28,
      });
      modisRect.bindPopup(
        `<div style="font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.45; max-width: 245px;">
          <div style="font-weight: 600; font-size: 14px; color: #111827;">Local Vegetation Area (250 m square)</div>
          <div style="margin-top: 4px; color: #111827;">Condition: <strong>${modisConditionLabel}</strong></div>
          <div style="color: #4b5563; font-size: 12px; margin-top: 4px;">Observed ${modisPeriodLabel}. Shows surrounding dry-season plant cover, not rainy-season crops.</div>
        </div>`
      );
      modisRect.bindTooltip(`250 m area: ${modisConditionLabel}`, { sticky: true });
      modisRect.addTo(overlayGroup);
      coverageBounds = modisRect.getBounds().pad(0.45);
    } else if (activeIndicator === 'Soil Properties') {
      // Single 250 m local soil estimate cell (dashed = modelled)
      const soilRect = L.rectangle(cellBoundsKm(centerLat, centerLng, 0.25), {
        color: soilColor,
        weight: 2.5,
        dashArray: '6 5',
        fillColor: soilColor,
        fillOpacity: 0.24,
      });
      soilRect.bindPopup(
        `<div style="font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.45; max-width: 245px;">
          <div style="font-weight: 600; font-size: 14px; color: #111827;">Estimated Soil Area (250 m)</div>
          <div style="margin-top: 4px; color: #111827;"><strong>${soilHeadline}</strong> (${soilDepth})</div>
          <div style="color: #4b5563; font-size: 12px; margin-top: 4px;">Global soil map estimate — not a laboratory test from your field.</div>
        </div>`
      );
      soilRect.bindTooltip(`250 m estimate (${soilDepth}): ${soilHeadline}`, { sticky: true });
      soilRect.addTo(overlayGroup);
      coverageBounds = soilRect.getBounds().pad(0.45);
    } else if (activeIndicator === 'Elevation') {
      if (srtmSamples.length > 0) {
        const halfLat = 1 / 7200;
        const halfLng = 1 / 7200;
        let combined: L.LatLngBounds | null = null;

        for (const sample of srtmSamples) {
          const fillColor = getElevationColor(sample.elevation_m, srtmMin, srtmMax);
          const isCenter = sample.row_offset === 0 && sample.column_offset === 0;
          const bounds: L.LatLngBoundsExpression = [
            [sample.latitude - halfLat, sample.longitude - halfLng],
            [sample.latitude + halfLat, sample.longitude + halfLng],
          ];
          const rect = L.rectangle(bounds, {
            color: isCenter ? '#111827' : fillColor,
            weight: isCenter ? 2.5 : 1.5,
            fillColor,
            fillOpacity: 0.42,
          });
          rect.bindPopup(
            `<div style="font-family: Inter, system-ui, sans-serif; font-size: 13px; line-height: 1.45;">
              <div style="font-weight: 600; font-size: 14px; color: #111827;">Ground Height (30 m square)</div>
              <div style="margin-top: 4px;">Elevation: <strong>${
                sample.elevation_m !== null ? `${sample.elevation_m} m` : 'Unavailable'
              }</strong> above sea level</div>
            </div>`
          );
          rect.bindTooltip(`${sample.elevation_m !== null ? `${sample.elevation_m} m` : 'N/A'}`, {
            permanent: true,
            direction: 'center',
            className: 'srtm-pixel-label',
          });
          rect.addTo(overlayGroup);
          combined = combined ? combined.extend(rect.getBounds()) : rect.getBounds();
        }

        if (combined) {
          coverageBounds = combined.pad(0.7);
        }
      }
    }

    const fieldBounds = L.polygon(fieldPolygon).getBounds().pad(0.45);
    if (viewFocus === 'field') {
      map.fitBounds(fieldBounds, { animate: true, maxZoom: 17 });
    } else if (viewFocus === 'coverage' && coverageBounds) {
      map.fitBounds(coverageBounds, { animate: true, maxZoom: 17 });
    } else {
      if ((activeIndicator === 'Rainfall' || activeIndicator === 'Soil Moisture') && coverageBounds) {
        map.fitBounds(coverageBounds.pad(0.08), { animate: true, maxZoom: 12 });
      } else if (coverageBounds) {
        map.fitBounds(coverageBounds, { animate: true, maxZoom: 17 });
      } else {
        map.fitBounds(fieldBounds, { animate: true, maxZoom: 16 });
      }
    }
  }, [
    activeIndicator,
    viewFocus,
    centerLat,
    centerLng,
    fieldPolygon,
    rainfallChoice,
    rainfallPctOfNormal,
    rainfallStatusLabel,
    rainfallColor,
    rainfallPeriodLabel,
    smapChoice,
    smapPctWater,
    smapDistanceKm,
    smapColor,
    smapPeriodLabel,
    modisConditionLabel,
    modisColor,
    modisPeriodLabel,
    soilHeadline,
    soilDepth,
    soilColor,
    srtmSamples,
    srtmMin,
    srtmMax,
  ]);

  const plainScaleLabel = useMemo(() => {
    if (activeIndicator === 'Rainfall') {
      const km = rainfallChoice === 'merra2' ? 50 : 10;
      return `Your field inside a ~${km} km rainfall area`;
    }
    if (activeIndicator === 'Soil Moisture') {
      return 'Your field inside a ~9 km regional moisture area';
    }
    if (activeIndicator === 'NDVI') {
      return 'Your field & 250 m surrounding vegetation area';
    }
    if (activeIndicator === 'Soil Properties') {
      return 'Your field & 250 m estimated soil area';
    }
    return 'Your field & 30 m ground height squares';
  }, [activeIndicator, rainfallChoice]);

  return (
    <div className="relative rounded-2xl border border-gray-200 bg-white overflow-hidden">
      {/* Clean Top Controls Bar */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto inline-flex items-center gap-2 bg-white/95 backdrop-blur-xs border border-[#E5E7EB] rounded-xl px-3.5 py-2 shadow-xs text-sm font-medium text-[#111827]">
          <MapPin className="w-4 h-4 text-[#D97706] shrink-0" />
          <span>{plainScaleLabel}</span>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          <div className="inline-flex bg-white/95 backdrop-blur-xs border border-[#E5E7EB] rounded-xl p-1 shadow-xs text-sm font-medium">
            <button
              type="button"
              onClick={() => setViewFocus('field')}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg transition cursor-pointer ${
                viewFocus === 'field' ? 'bg-[#1E5631] text-white' : 'text-[#111827] hover:bg-gray-100'
              }`}
            >
              My Field
            </button>
            <button
              type="button"
              onClick={() => setViewFocus('auto')}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg transition cursor-pointer ${
                viewFocus === 'auto' || viewFocus === 'coverage'
                  ? 'bg-[#D97706] text-white'
                  : 'text-[#111827] hover:bg-gray-100'
              }`}
            >
              Area View
            </button>
          </div>

          <button
            type="button"
            onClick={() => setBaseStyle((s) => (s === 'osm' ? 'satellite' : 'osm'))}
            className="min-h-[44px] inline-flex items-center gap-2 bg-white/95 backdrop-blur-xs border border-[#E5E7EB] hover:bg-gray-50 rounded-xl px-3.5 py-2 shadow-xs text-sm font-medium text-[#111827] cursor-pointer"
          >
            <Layers className="w-4 h-4 text-[#1E5631]" />
            <span>{baseStyle === 'osm' ? 'Satellite' : 'Map'}</span>
          </button>
        </div>
      </div>

      {/* Minimal Zoom Controls */}
      <div className="absolute bottom-4 left-3 z-[400] flex flex-col bg-white/95 backdrop-blur-xs border border-[#E5E7EB] rounded-xl shadow-xs overflow-hidden">
        <button
          type="button"
          onClick={() => mapRef.current?.zoomIn()}
          aria-label="Zoom in map"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#111827] hover:bg-gray-50 border-b border-[#E5E7EB] transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => mapRef.current?.zoomOut()}
          aria-label="Zoom out map"
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#111827] hover:bg-gray-50 transition cursor-pointer"
        >
          <Minus className="w-4 h-4" />
        </button>
      </div>

      {/* Map Canvas */}
      <div
        ref={containerRef}
        className="w-full h-[430px] sm:h-[490px] bg-gray-100"
        aria-label="Interactive environmental analysis map"
      />
    </div>
  );
};
