/**
 * AgroShift Gambia — Screen S4: What the Data Says
 *
 * Interactive, farmer-first environmental intelligence dashboard:
 * - Prominent single chart area matching the paired-bar & dashed-baseline reference
 * - Horizontal selectable indicator cards (Rainfall, Temperature, Soil Moisture,
 *   Humidity when available, Vegetation, Soil Properties)
 * - Plain-English farmer labels in the main dashboard; technical acronyms &
 *   resolutions tucked cleanly inside a collapsed-by-default "About This Information" drawer
 * - Preserves all underlying scientific integrity and existing insights
 */

import React, { useMemo, useState } from 'react';
import { useAgroShift } from '../../context/AgroShiftContext';
import {
  CloudRain,
  Thermometer,
  Droplets,
  Wind,
  Sprout,
  Layers,
  MapPin,
  Calendar,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { AlertBanner } from '../common/AlertBanner';
import {
  InteractiveChartDataset,
  InteractiveEnvironmentalChart,
} from '../evidence/InteractiveEnvironmentalChart';
import { SoilPropertiesVisual } from '../evidence/SoilPropertiesVisual';
import {
  DashboardIndicatorKey,
  RainfallViewChoice,
  TimeGranularityChoice,
  buildWhatThisMeansText,
  computeDrySpellSummary,
  computeModisSeasonalCurve,
  computeModisStats,
  computeModisYearlyPoints,
  computePowerStats,
  computeSmapMonthlyPoints,
  computeSmapStats,
  computeSmapYearlyPoints,
  computeSoilCardSummary,
  computeSoilGridsGrouped,
} from '../evidence/evidenceInterpretation';

export const DataEvidenceScreen: React.FC = () => {
  const {
    selectedFieldId,
    setSelectedFieldId,
    location,
    fieldDetails,
    evidenceData,
    isLoadingEvidence,
    evidenceError,
    isEvidenceNotFound,
    loadEvidence,
    fieldDataSource,
    goToStep,
    nextStep,
  } = useAgroShift();

  const [activeIndicator, setActiveIndicator] = useState<DashboardIndicatorKey>('rainfall');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [rainfallView, setRainfallView] = useState<RainfallViewChoice>('both');
  const [soilMoistureView, setSoilMoistureView] = useState<TimeGranularityChoice>('monthly');
  const [vegetationView, setVegetationView] = useState<TimeGranularityChoice>('monthly');
  const [selectedSoilDepth, setSelectedSoilDepth] = useState<string>('0-5cm');

  const powerAnnual = evidenceData?.evidence?.power_annual || [];
  const soilgrids = evidenceData?.evidence?.soilgrids || [];
  const smapSnapshots = evidenceData?.evidence?.smap_monthly_snapshots || [];
  const modisSeries = evidenceData?.evidence?.modis_ndvi_nov_jun_usable || [];
  const methodology = evidenceData?.methodology;
  const refPeriod = evidenceData?.reference_period;

  const periodRangeLabel = refPeriod ? `${refPeriod.start_year}–${refPeriod.end_year}` : '2015–2025';

  const availableYears = useMemo(
    () => Array.from(new Set(powerAnnual.map((p) => p.year))).sort((a, b) => b - a),
    [powerAnnual]
  );

  const chronologicalPower = useMemo(
    () => [...powerAnnual].sort((a, b) => a.year - b.year),
    [powerAnnual]
  );

  const displayPower = useMemo(
    () => (selectedYear === 'all' ? powerAnnual : powerAnnual.filter((p) => String(p.year) === selectedYear)),
    [powerAnnual, selectedYear]
  );

  const referencePowerRows = useMemo(() => {
    if (!refPeriod) return powerAnnual;
    return powerAnnual.filter(
      (p) => p.year >= refPeriod.start_year && p.year <= refPeriod.end_year
    );
  }, [powerAnnual, refPeriod]);

  // Rainfall statistics (kept strictly separate — never combined or averaged)
  const imergStats = useMemo(
    () => computePowerStats(displayPower, referencePowerRows, 'imerg'),
    [displayPower, referencePowerRows]
  );
  const merra2Stats = useMemo(
    () => computePowerStats(displayPower, referencePowerRows, 'merra2'),
    [displayPower, referencePowerRows]
  );

  // Dry-spell summary (IMERG daily satellite grid when available, else MERRA-2)
  const drySpellSource = rainfallView === 'merra2' ? 'merra2' : 'imerg';
  const drySpellSummary = useMemo(
    () => computeDrySpellSummary(displayPower, drySpellSource, selectedYear),
    [displayPower, drySpellSource, selectedYear]
  );

  // Check honestly whether Temperature or Humidity exist anywhere in backend features
  const temperatureFeature = useMemo(() => {
    const f = evidenceData?.features;
    if (!f) return null;
    const candidate = f.temperature_c || f.temp_mean_c || f.hot_days_gt35c;
    if (candidate && candidate.value !== null && candidate.value !== undefined) {
      return candidate;
    }
    return null;
  }, [evidenceData?.features]);

  const humidityFeature = useMemo(() => {
    const f = evidenceData?.features;
    if (!f) return null;
    const candidate = f.relative_humidity_pct || f.humidity_pct || f.rh_pct;
    if (candidate && candidate.value !== null && candidate.value !== undefined) {
      return candidate;
    }
    return null;
  }, [evidenceData?.features]);

  const hasTemperatureData = temperatureFeature !== null;
  const hasHumidityData = humidityFeature !== null;

  // Soil Moisture (SMAP 44 mid-month snapshots across Jul-Oct, 2015-2025)
  const smapStats = useMemo(
    () => computeSmapStats(smapSnapshots, selectedYear),
    [smapSnapshots, selectedYear]
  );
  const smapMonthly = useMemo(
    () => computeSmapMonthlyPoints(smapSnapshots, selectedYear),
    [smapSnapshots, selectedYear]
  );
  const smapYearly = useMemo(
    () => computeSmapYearlyPoints(smapSnapshots),
    [smapSnapshots]
  );

  // Vegetation (MODIS Nov-Jun usable composites)
  const modisCurve = useMemo(
    () => computeModisSeasonalCurve(modisSeries, selectedYear),
    [modisSeries, selectedYear]
  );
  const modisBaselineCurve = useMemo(
    () => computeModisSeasonalCurve(modisSeries, 'all'),
    [modisSeries]
  );
  const modisStats = useMemo(
    () => computeModisStats(modisSeries, selectedYear, methodology?.modis_season),
    [modisSeries, selectedYear, methodology?.modis_season]
  );
  const modisYearly = useMemo(
    () => computeModisYearlyPoints(modisSeries),
    [modisSeries]
  );

  // Soil Properties (SoilGrids across 4 separate depths)
  const soilGroups = useMemo(() => computeSoilGridsGrouped(soilgrids), [soilgrids]);
  const soilSummary = useMemo(
    () => computeSoilCardSummary(soilGroups, selectedSoilDepth, fieldDetails.observed_soil),
    [soilGroups, selectedSoilDepth, fieldDetails.observed_soil]
  );

  // Field metadata formatting
  const latVal = evidenceData?.location?.latitude ?? location.latitude ?? 13.24890667;
  const lngVal = evidenceData?.location?.longitude ?? location.longitude ?? -16.61527333;
  const formattedCoords = `${Math.abs(latVal).toFixed(4)}° ${latVal >= 0 ? 'N' : 'S'}, ${Math.abs(lngVal).toFixed(4)}° ${lngVal >= 0 ? 'E' : 'W'}`;
  const locationDisplayName =
    location.district && location.region
      ? `${location.district}, ${location.region}`
      : evidenceData?.location?.name || 'Brikama Manduar, West Coast Region';
  const fieldTitleName = fieldDetails.name || evidenceData?.location?.name || 'Brikama Manduar Pilot Field';

  // Horizontal indicator cards definition (strictly farmer-friendly labels)
  const indicatorCards = useMemo(() => {
    const repRain = imergStats ? Math.round(imergStats.mean).toLocaleString() : '—';
    const repSoilWater =
      smapStats?.surfaceMean !== null && smapStats?.surfaceMean !== undefined
        ? `${(smapStats.surfaceMean * 100).toFixed(1)}`
        : '—';
    const repNdvi =
      modisStats?.mean !== null && modisStats?.mean !== undefined
        ? modisStats.mean.toFixed(2)
        : '—';
    const repPh = soilSummary.ph !== null ? String(soilSummary.ph) : '—';

    const cards: Array<{
      key: DashboardIndicatorKey;
      label: string;
      value: string;
      unit: string;
      description: string;
      icon: React.ReactNode;
      available: boolean;
    }> = [
      {
        key: 'rainfall',
        label: 'Rainfall',
        value: repRain,
        unit: imergStats ? 'mm' : '',
        description: selectedYear === 'all' ? 'Seasonal average (Jun–Oct)' : `${selectedYear} wet season`,
        icon: <CloudRain className="w-5 h-5" />,
        available: Boolean(imergStats || merra2Stats),
      },
      {
        key: 'temperature',
        label: 'Temperature',
        value: hasTemperatureData ? String(temperatureFeature?.value) : 'No data',
        unit: hasTemperatureData ? '°C' : '',
        description: hasTemperatureData ? 'Observed air temperature' : 'Not cached for this field',
        icon: <Thermometer className="w-5 h-5" />,
        available: hasTemperatureData,
      },
      {
        key: 'soil_moisture',
        label: 'Soil Moisture',
        value: repSoilWater,
        unit: repSoilWater !== '—' ? '%' : '',
        description: 'Topsoil water content (Jul–Oct)',
        icon: <Droplets className="w-5 h-5" />,
        available: smapStats !== null && smapStats.surfaceMean !== null,
      },
    ];

    // Section 1B: "4. Humidity, only if actual data is available."
    if (hasHumidityData) {
      cards.push({
        key: 'humidity',
        label: 'Humidity',
        value: String(humidityFeature?.value ?? '—'),
        unit: '%',
        description: 'Observed relative humidity',
        icon: <Wind className="w-5 h-5" />,
        available: true,
      });
    }

    cards.push(
      {
        key: 'vegetation',
        label: 'Vegetation',
        value: repNdvi,
        unit: repNdvi !== '—' ? 'index' : '',
        description: 'Dry-season cover (Nov–Jun)',
        icon: <Sprout className="w-5 h-5" />,
        available: modisStats !== null && modisStats.mean !== null,
      },
      {
        key: 'soil_properties',
        label: 'Soil Properties',
        value: repPh !== '—' ? `pH ${repPh}` : '—',
        unit: '',
        description: `Acidity & carbon (${selectedSoilDepth.replace('cm', ' cm')})`,
        icon: <Layers className="w-5 h-5" />,
        available: soilSummary.available,
      }
    );

    return cards;
  }, [
    imergStats,
    merra2Stats,
    selectedYear,
    hasTemperatureData,
    temperatureFeature,
    hasHumidityData,
    humidityFeature,
    smapStats,
    modisStats,
    soilSummary.ph,
    soilSummary.available,
    selectedSoilDepth,
  ]);

  // Build active chart dataset for the main graph card
  const activeChartDataset: InteractiveChartDataset | null = useMemo(() => {
    if (activeIndicator === 'rainfall') {
      const showSatellite = rainfallView === 'both' || rainfallView === 'imerg';
      const showNasa = rainfallView === 'both' || rainfallView === 'merra2';

      const maxVal = chronologicalPower.reduce(
        (mx, row) =>
          Math.max(
            mx,
            showSatellite ? row.imerg.rain_total_mm ?? 0 : 0,
            showNasa ? row.merra2.rain_total_mm ?? 0 : 0
          ),
        0
      );
      const yMax = Math.max(1500, Math.ceil(maxVal / 300) * 300);
      const step = yMax / 5;

      const highlightedIdx =
        selectedYear === 'all'
          ? null
          : chronologicalPower.findIndex((r) => String(r.year) === selectedYear);

      const series = [];
      if (showSatellite) {
        series.push({
          id: 'satellite_rainfall',
          label: 'Satellite rainfall estimate',
          sourceLabel: 'Satellite rainfall estimate',
          valueLabel: 'Rainfall estimate',
          color: '#2563EB', // Blue matching reference screenshot
          unit: 'mm',
          points: chronologicalPower.map((r) => {
            const spells = r.imerg.dry_spells_ge7_days ?? 0;
            return {
              value: r.imerg.rain_total_mm,
              secondaryText:
                r.imerg.rainy_days !== null ? `Rainy days: ${r.imerg.rainy_days} days (Jun–Oct)` : undefined,
              highlightRing: spells > 0,
              meta: spells > 0 ? `${spells} dry break${spells > 1 ? 's' : ''} of 7+ days (Jul–Sep)` : undefined,
            };
          }),
        });
      }
      if (showNasa) {
        series.push({
          id: 'nasa_climate_rainfall',
          label: 'NASA climate-data estimate',
          sourceLabel: 'NASA climate-data estimate',
          valueLabel: 'Rainfall estimate',
          color: '#EC4899', // Pink matching reference screenshot
          unit: 'mm',
          points: chronologicalPower.map((r) => ({
            value: r.merra2.rain_total_mm,
            secondaryText:
              r.merra2.rainy_days !== null ? `Rainy days: ${r.merra2.rainy_days} days (Jun–Oct)` : undefined,
          })),
        });
      }

      // Valid same-dataset historical comparison dashed line (never averaged between sources)
      const refLine =
        rainfallView === 'merra2' && merra2Stats?.baselineMean
          ? {
              label: `Usual ${periodRangeLabel} average (NASA climate-data)`,
              value: merra2Stats.baselineMean,
              unit: 'mm',
            }
          : imergStats?.baselineMean
          ? {
              label: `Usual ${periodRangeLabel} average (Satellite rainfall)`,
              value: imergStats.baselineMean,
              unit: 'mm',
            }
          : null;

      return {
        metric: 'Rainfall',
        mode: 'bar',
        title: 'How Much Rain Fell?',
        subtitle:
          selectedYear === 'all'
            ? `Total June–October wet-season rainfall for each year (${periodRangeLabel})`
            : `Highlighting ${selectedYear} wet-season rainfall alongside ${periodRangeLabel} seasons (June–October)`,
        contextNote:
          'Each pair of bars compares two separate rainfall estimates without combining them. Monthly rainfall breakdowns are not included in this record, so seasonal June–October totals are shown by year.',
        xLabels: chronologicalPower.map((r) => String(r.year)),
        xFullLabels: chronologicalPower.map((r) => `${r.year} Wet Season (June–October)`),
        highlightedIndex: highlightedIdx !== null && highlightedIdx >= 0 ? highlightedIdx : null,
        yMin: 0,
        yMax,
        yTicks: [0, step, step * 2, step * 3, step * 4, yMax],
        yUnit: 'mm',
        formatValue: (v: number) => Math.round(v).toLocaleString(),
        series,
        referenceLine: refLine,
      };
    }

    if (activeIndicator === 'temperature') {
      return {
        metric: 'Temperature',
        mode: 'line',
        title: 'How Temperatures Changed',
        subtitle: 'Air temperature (°C) observations for your field',
        contextNote:
          'Daily or monthly temperature records in °C are not supplied in the current environmental evidence response for this field.',
        xLabels: [],
        yMin: 0,
        yMax: 45,
        yTicks: [0, 15, 30, 45],
        yUnit: '°C',
        formatValue: (v: number) => v.toFixed(1),
        series: [],
        unavailableMessage:
          'Daily or seasonal air temperature measurements (°C) are not included in the cached environmental records for this location. No temperature data has been estimated or filled in.',
      };
    }

    if (activeIndicator === 'soil_moisture') {
      if (soilMoistureView === 'yearly') {
        const highlightedIdx =
          selectedYear === 'all'
            ? null
            : smapYearly.findIndex((p) => String(p.year) === selectedYear);

        const allYearTopVals = smapYearly
          .map((p) => p.surfacePct)
          .filter((v): v is number => v !== null);
        const topAvg = allYearTopVals.length
          ? allYearTopVals.reduce((a, b) => a + b, 0) / allYearTopVals.length
          : null;

        return {
          metric: 'Soil Moisture',
          mode: 'line',
          title: 'How Much Water Is in the Soil?',
          subtitle: `Average July–October mid-month soil moisture by year (${periodRangeLabel})`,
          contextNote: `Converted accurately from volumetric water content (m³/m³ × 100 = %). Regional area estimates cover ~9 km centered ~${
            smapStats?.distanceKm?.toFixed(1) ?? '6.2'
          } km away—useful for district wetness, not an in-field probe.`,
          xLabels: smapYearly.map((p) => String(p.year)),
          xFullLabels: smapYearly.map((p) => `${p.year} (Jul–Oct mid-month snapshots)`),
          highlightedIndex: highlightedIdx !== null && highlightedIdx >= 0 ? highlightedIdx : null,
          yMin: 0,
          yMax: 40,
          yTicks: [0, 10, 20, 30, 40],
          yUnit: '% water',
          formatValue: (v: number) => v.toFixed(1),
          series: [
            {
              id: 'smap_topsoil',
              label: 'Topsoil moisture (0–5 cm)',
              sourceLabel: 'Soil moisture estimate (regional ~9 km)',
              valueLabel: 'Topsoil water',
              color: '#2563EB',
              unit: '%',
              points: smapYearly.map((p) => ({
                value: p.surfacePct,
                secondaryText: p.surfaceM3 !== null ? `Original reading: ${p.surfaceM3} m³/m³` : undefined,
              })),
            },
            {
              id: 'smap_root',
              label: 'Root-zone moisture (0–100 cm)',
              sourceLabel: 'Soil moisture estimate (regional ~9 km)',
              valueLabel: 'Root-zone water',
              color: '#EC4899',
              unit: '%',
              points: smapYearly.map((p) => ({
                value: p.rootPct,
                secondaryText: p.rootM3 !== null ? `Original reading: ${p.rootM3} m³/m³` : undefined,
              })),
            },
          ],
          referenceLine:
            topAvg !== null
              ? {
                  label: `Topsoil ${periodRangeLabel} average`,
                  value: topAvg,
                  unit: '%',
                }
              : null,
        };
      }

      // Monthly (Jul-Oct) real mid-month snapshots
      return {
        metric: 'Soil Moisture',
        mode: 'line',
        title: 'How Much Water Is in the Soil?',
        subtitle:
          selectedYear === 'all'
            ? `Mid-month July–October water content (${periodRangeLabel} average)`
            : `Mid-month July–October water content in ${selectedYear} vs ${periodRangeLabel} topsoil average`,
        contextNote: `Only July–October mid-month snapshots exist in this archive (dry-season months Nov–Jun are not measured or interpolated). Regional ~9 km reading centered ~${
          smapStats?.distanceKm?.toFixed(1) ?? '6.2'
        } km from your field.`,
        xLabels: smapMonthly.map((m) => m.label),
        xFullLabels: smapMonthly.map((m) => m.fullLabel),
        yMin: 0,
        yMax: 40,
        yTicks: [0, 10, 20, 30, 40],
        yUnit: '% water',
        formatValue: (v: number) => v.toFixed(1),
        series: [
          {
            id: 'smap_topsoil',
            label: 'Topsoil moisture (0–5 cm)',
            sourceLabel: 'Soil moisture estimate (regional ~9 km)',
            valueLabel: 'Topsoil water',
            color: '#2563EB',
            unit: '%',
            points: smapMonthly.map((m) => ({
              value: m.surfacePct,
              secondaryText:
                m.surfaceM3 !== null
                  ? `Original: ${m.surfaceM3} m³/m³${m.granuleDate ? ` · Date: ${m.granuleDate}` : ''}`
                  : undefined,
            })),
          },
          {
            id: 'smap_root',
            label: 'Root-zone moisture (0–100 cm)',
            sourceLabel: 'Soil moisture estimate (regional ~9 km)',
            valueLabel: 'Root-zone water',
            color: '#EC4899',
            unit: '%',
            points: smapMonthly.map((m) => ({
              value: m.rootPct,
              secondaryText:
                m.rootM3 !== null
                  ? `Original: ${m.rootM3} m³/m³${m.granuleDate ? ` · Date: ${m.granuleDate}` : ''}`
                  : undefined,
            })),
          },
        ],
        referenceSeries:
          selectedYear !== 'all'
            ? {
                label: `Topsoil ${periodRangeLabel} monthly average`,
                points: smapMonthly.map((m) => m.baselineSurfacePct),
              }
            : null,
      };
    }

    if (activeIndicator === 'humidity') {
      return {
        metric: 'Humidity',
        mode: 'line',
        title: 'Relative Humidity',
        subtitle: 'Relative humidity (%) observations',
        contextNote: 'Relative humidity observations are not cached for this field.',
        xLabels: [],
        yMin: 0,
        yMax: 100,
        yTicks: [0, 25, 50, 75, 100],
        yUnit: '%',
        formatValue: (v: number) => Math.round(v).toString(),
        series: [],
        unavailableMessage:
          'Relative humidity data is not available for this location.',
      };
    }

    if (activeIndicator === 'vegetation') {
      if (vegetationView === 'yearly') {
        const highlightedIdx =
          selectedYear === 'all'
            ? null
            : modisYearly.findIndex((p) => String(p.year) === selectedYear);

        const completeYears = modisYearly.filter((p) => !p.isPartial && p.meanNdvi !== null);
        const baselineAvg = completeYears.length
          ? completeYears.reduce((sum, p) => sum + (p.meanNdvi as number), 0) / completeYears.length
          : null;

        return {
          metric: 'Vegetation',
          mode: 'line',
          title: 'How Vegetation Has Changed?',
          subtitle: 'Average dry-season greenness index (November–June) by year',
          contextNote:
            'Vegetation greenness is measured on a 0.00–1.00 index (not percentage of ground covered). Notice 2026 only covers January–June so far and is marked as partial.',
          xLabels: modisYearly.map((p) => (p.isPartial ? `${p.year}*` : String(p.year))),
          xFullLabels: modisYearly.map((p) =>
            p.isPartial ? `${p.year} (Partial cycle: Jan–Jun only)` : `${p.year} (Nov–Jun usable composites)`
          ),
          highlightedIndex: highlightedIdx !== null && highlightedIdx >= 0 ? highlightedIdx : null,
          yMin: 0,
          yMax: 0.7,
          yTicks: [0, 0.2, 0.4, 0.6],
          yUnit: 'index',
          formatValue: (v: number) => v.toFixed(2),
          series: [
            {
              id: 'ndvi_yearly',
              label: 'Vegetation cover (Nov–Jun index)',
              sourceLabel: 'Vegetation cover (250 m satellite area)',
              valueLabel: 'Greenness index',
              color: '#1E5631',
              unit: 'index',
              points: modisYearly.map((p) => ({
                value: p.meanNdvi,
                secondaryText: `${p.count} usable observations`,
                meta: p.isPartial ? 'Partial year (Jan–Jun only)' : undefined,
              })),
            },
          ],
          referenceLine:
            baselineAvg !== null
              ? {
                  label: 'Complete-season multi-year average',
                  value: baselineAvg,
                  unit: 'index',
                }
              : null,
        };
      }

      // Monthly cycle (Nov–Jun usable + Jul–Oct Cloud Gap)
      return {
        metric: 'Vegetation',
        mode: 'line',
        title: 'How Vegetation Has Changed?',
        subtitle:
          selectedYear === 'all'
            ? `Monthly vegetation cycle from November to June (${periodRangeLabel} usable observations)`
            : `Monthly vegetation cycle in ${selectedYear} compared with ${periodRangeLabel} average`,
        contextNote:
          'Measured as a 0.00–1.00 vegetation greenness index (not a percentage of land cover). Heavy clouds obscure satellite views from July through October, so those rainy-season months are never guessed or filled in.',
        xLabels: modisCurve.points.map((p) => p.label),
        xFullLabels: modisCurve.points.map((p) =>
          p.isCloudGap
            ? `${p.label} — Rainy-season cloud gap`
            : `${p.label}${selectedYear !== 'all' ? ` ${selectedYear}` : ''}`
        ),
        gapIndices: [8, 9, 10, 11], // Jul, Aug, Sep, Oct in AGRI_CALENDAR_MONTHS
        gapLabel: 'Cloud gap (Jul–Oct)',
        yMin: 0,
        yMax: 0.7,
        yTicks: [0, 0.2, 0.4, 0.6],
        yUnit: 'index',
        formatValue: (v: number) => v.toFixed(2),
        series: [
          {
            id: 'ndvi_monthly',
            label:
              selectedYear === 'all'
                ? 'Vegetation cover (Nov–Jun average)'
                : `Vegetation cover (${selectedYear})`,
            sourceLabel: 'Vegetation cover (250 m satellite area)',
            valueLabel: 'Greenness index',
            color: '#1E5631',
            unit: 'index',
            points: modisCurve.points.map((p) => ({
              value: p.mean,
              secondaryText: p.count > 0 ? `Based on ${p.count} clear composite${p.count > 1 ? 's' : ''}` : undefined,
            })),
          },
        ],
        referenceSeries:
          selectedYear !== 'all'
            ? {
                label: `Usual ${periodRangeLabel} cycle`,
                points: modisBaselineCurve.points.map((p) => p.mean),
              }
            : null,
      };
    }

    return null;
  }, [
    activeIndicator,
    rainfallView,
    chronologicalPower,
    selectedYear,
    periodRangeLabel,
    imergStats,
    merra2Stats,
    soilMoistureView,
    smapYearly,
    smapMonthly,
    smapStats,
    vegetationView,
    modisYearly,
    modisCurve,
    modisBaselineCurve,
  ]);

  // "What This Means for Your Field" plain-English paragraph
  const whatThisMeansText = useMemo(
    () =>
      buildWhatThisMeansText({
        activeIndicator,
        selectedYear,
        periodRangeLabel,
        rainfallView,
        imergStats,
        merra2Stats,
        drySpellSummary,
        smapStats,
        smapDistanceKm: smapStats?.distanceKm ?? null,
        modisCurve,
        modisStats,
        soilSummary,
        selectedSoilDepth,
        hasTemperatureData,
        hasHumidityData,
      }),
    [
      activeIndicator,
      selectedYear,
      periodRangeLabel,
      rainfallView,
      imergStats,
      merra2Stats,
      drySpellSummary,
      smapStats,
      modisCurve,
      modisStats,
      soilSummary,
      selectedSoilDepth,
      hasTemperatureData,
      hasHumidityData,
    ]
  );

  // Loading & Error States
  if (isLoadingEvidence && !evidenceData) {
    return (
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center space-y-4 w-full">
        <Loader2 className="w-8 h-8 text-[#1E5631] animate-spin mx-auto" />
        <div>
          <h2 className="text-xl font-semibold text-[#111827]">Loading Field Environmental Data</h2>
          <p className="text-base text-[#4B5563] mt-1">
            Gathering environmental observations for{' '}
            <span className="font-semibold text-[#111827]">{selectedFieldId}</span>...
          </p>
        </div>
      </div>
    );
  }

  if (evidenceError && !evidenceData) {
    return (
      <div className="space-y-6 w-full">
        <AlertBanner
          type={isEvidenceNotFound ? 'warning' : 'error'}
          title={
            isEvidenceNotFound
              ? `No Environmental Data Cached for "${selectedFieldId}"`
              : 'Unable to Load Environmental Data'
          }
          action={
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => loadEvidence(selectedFieldId, true)}
                className="min-h-[44px] px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-[#111827] rounded-lg text-sm font-semibold flex items-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Retry</span>
              </button>
              {isEvidenceNotFound && selectedFieldId !== 'field-001' && (
                <button
                  type="button"
                  onClick={() => setSelectedFieldId('field-001')}
                  className="min-h-[44px] px-4 py-2 bg-[#1E5631] hover:bg-[#15803D] text-white rounded-lg text-sm font-semibold cursor-pointer"
                >
                  Load Pilot Field (field-001)
                </button>
              )}
            </div>
          }
        >
          <p className="text-base">{evidenceError}</p>
        </AlertBanner>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-[#E5E7EB]">
          <button
            type="button"
            onClick={() => goToStep('field-details')}
            className="min-h-[44px] px-5 py-2.5 bg-white hover:bg-gray-50 text-[#111827] border border-[#E5E7EB] rounded-xl text-base font-medium transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Field Details</span>
          </button>
          <button
            type="button"
            onClick={nextStep}
            className="min-h-[48px] px-6 py-3 bg-[#1E5631] hover:bg-[#15803D] text-white rounded-xl text-base font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>View Rotation Options</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full text-[#111827]">
      {fieldDataSource === 'fallback' && (
        <AlertBanner type="warning" title="Fallback Metadata Active">
          Live field metadata could not be reached, so demonstration field labels are shown alongside cached environmental observations.
        </AlertBanner>
      )}

      {/* ====================================================================
          A. FIELD INFORMATION & OBSERVATION PERIOD CONTROLS
         ==================================================================== */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#4B5563]">
          <span className="inline-flex items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] text-[#111827] font-semibold px-3 py-1 rounded-lg uppercase tracking-wide tabular-nums">
            <MapPin className="w-4 h-4 text-[#1E5631]" />
            <span>{selectedFieldId}</span>
          </span>
          <span className="font-semibold text-[#111827]">{fieldTitleName}</span>
          <span aria-hidden="true">·</span>
          <span>{locationDisplayName}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{formattedCoords}</span>
          <span aria-hidden="true">·</span>
          <span
            className={`inline-flex items-center gap-1.5 font-medium ${
              fieldDataSource === 'fallback' ? 'text-[#C2410C]' : 'text-[#15803D]'
            }`}
          >
            {fieldDataSource === 'fallback' ? (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>
              {fieldDataSource === 'fallback'
                ? 'Modelled fallback metadata'
                : `Verified coverage (${periodRangeLabel})`}
            </span>
          </span>
        </div>

        <div className="relative shrink-0 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#4B5563] hidden sm:block shrink-0" />
          <div className="relative w-full sm:w-auto">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              aria-label="Select observation period"
              className="min-h-[44px] w-full sm:w-auto appearance-none pl-3.5 pr-10 py-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl text-sm font-semibold text-[#111827] focus:outline-none focus:border-[#1E5631] cursor-pointer"
            >
              <option value="all">All Seasons ({periodRangeLabel})</option>
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  {yr} Season
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-[#4B5563] pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </div>

      {/* ====================================================================
          B. ENVIRONMENTAL INDICATOR SELECTOR (HORIZONTAL CARDS)
         ==================================================================== */}
      <div
        role="tablist"
        aria-label="Environmental indicator selector"
        className={`flex lg:grid gap-3 overflow-x-auto pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0 ${
          indicatorCards.length === 6 ? 'lg:grid-cols-6' : 'lg:grid-cols-5'
        }`}
      >
        {indicatorCards.map((card) => {
          const isSelected = activeIndicator === card.key;
          return (
            <button
              key={card.key}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setActiveIndicator(card.key)}
              className={`min-w-[205px] lg:min-w-0 min-h-[116px] text-left rounded-2xl p-4 transition cursor-pointer flex flex-col justify-between gap-2 shrink-0 ${
                isSelected
                  ? 'bg-[#F0FDF4] border-2 border-[#1E5631] shadow-xs'
                  : 'bg-white border border-[#E5E7EB] hover:border-gray-300 hover:bg-[#F9FAFB]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-[#111827]">{card.label}</span>
                <span
                  className={`p-1.5 rounded-lg ${
                    isSelected
                      ? 'bg-[#1E5631] text-white'
                      : card.available
                      ? 'bg-[#F3F4F6] text-[#4B5563]'
                      : 'bg-amber-50 text-[#D97706]'
                  }`}
                >
                  {card.icon}
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-1.5">
                  <span
                    className={`text-xl font-bold tabular-nums ${
                      card.available ? 'text-[#111827]' : 'text-[#4B5563]'
                    }`}
                  >
                    {card.value}
                  </span>
                  {card.unit && (
                    <span className="text-sm font-medium text-[#4B5563]">{card.unit}</span>
                  )}
                </div>
                <p className="text-sm text-[#4B5563] mt-0.5 leading-snug">{card.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ====================================================================
          2. MAIN INTERACTIVE GRAPH / SOIL VISUALISATION
         ==================================================================== */}
      {activeIndicator === 'soil_properties' ? (
        <SoilPropertiesVisual
          soilGroups={soilGroups}
          soilSummary={soilSummary}
          selectedDepth={selectedSoilDepth}
          onSelectDepth={setSelectedSoilDepth}
          observedSoil={fieldDetails.observed_soil}
        />
      ) : (
        activeChartDataset && (
          <InteractiveEnvironmentalChart
            dataset={activeChartDataset}
            headerActions={
              <>
                {activeIndicator === 'rainfall' && (
                  <div
                    className="inline-flex flex-wrap bg-[#F9FAFB] border border-[#E5E7EB] p-1 rounded-xl gap-1"
                    role="group"
                    aria-label="Rainfall estimate source selector"
                  >
                    {(
                      [
                        { id: 'both', label: 'Both rainfall estimates' },
                        { id: 'imerg', label: 'Satellite rainfall estimate' },
                        { id: 'merra2', label: 'NASA climate-data estimate' },
                      ] as Array<{ id: RainfallViewChoice; label: string }>
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setRainfallView(opt.id)}
                        aria-pressed={rainfallView === opt.id}
                        className={`min-h-[44px] px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                          rainfallView === opt.id
                            ? 'bg-[#1E5631] text-white'
                            : 'text-[#4B5563] hover:text-[#111827]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {activeIndicator === 'soil_moisture' && (
                  <div
                    className="inline-flex bg-[#F9FAFB] border border-[#E5E7EB] p-1 rounded-xl gap-1"
                    role="group"
                    aria-label="Soil moisture chart view"
                  >
                    <button
                      type="button"
                      onClick={() => setSoilMoistureView('monthly')}
                      aria-pressed={soilMoistureView === 'monthly'}
                      className={`min-h-[44px] px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                        soilMoistureView === 'monthly'
                          ? 'bg-[#1E5631] text-white'
                          : 'text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      Monthly (Jul–Oct)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSoilMoistureView('yearly')}
                      aria-pressed={soilMoistureView === 'yearly'}
                      className={`min-h-[44px] px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                        soilMoistureView === 'yearly'
                          ? 'bg-[#1E5631] text-white'
                          : 'text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      Yearly ({periodRangeLabel})
                    </button>
                  </div>
                )}

                {activeIndicator === 'vegetation' && (
                  <div
                    className="inline-flex bg-[#F9FAFB] border border-[#E5E7EB] p-1 rounded-xl gap-1"
                    role="group"
                    aria-label="Vegetation chart view"
                  >
                    <button
                      type="button"
                      onClick={() => setVegetationView('monthly')}
                      aria-pressed={vegetationView === 'monthly'}
                      className={`min-h-[44px] px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                        vegetationView === 'monthly'
                          ? 'bg-[#1E5631] text-white'
                          : 'text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      Monthly cycle (Nov–Jun)
                    </button>
                    <button
                      type="button"
                      onClick={() => setVegetationView('yearly')}
                      aria-pressed={vegetationView === 'yearly'}
                      className={`min-h-[44px] px-3 py-1.5 rounded-lg text-sm font-semibold transition cursor-pointer ${
                        vegetationView === 'yearly'
                          ? 'bg-[#1E5631] text-white'
                          : 'text-[#4B5563] hover:text-[#111827]'
                      }`}
                    >
                      Yearly (2015–2026)
                    </button>
                  </div>
                )}
              </>
            }
          />
        )
      )}

      {/* ====================================================================
          5. EXPLANATION UNDERNEATH THE GRAPH: WHAT THIS MEANS FOR YOUR FIELD
         ==================================================================== */}
      <section
        aria-labelledby="what-this-means-heading"
        className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 space-y-2"
      >
        <h2 id="what-this-means-heading" className="text-lg sm:text-[20px] font-semibold text-[#111827]">
          What This Means for Your Field
        </h2>
        <p className="text-base text-[#374151] leading-relaxed">{whatThisMeansText}</p>
      </section>

      {/* ====================================================================
          BOTTOM NAVIGATION BAR
         ==================================================================== */}
      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-[#E5E7EB]">
        <button
          type="button"
          onClick={() => goToStep('field-details')}
          className="min-h-[44px] px-5 py-2.5 bg-white hover:bg-[#F9FAFB] text-[#111827] border border-[#E5E7EB] rounded-xl text-base font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Field Details</span>
        </button>

        <button
          type="button"
          onClick={nextStep}
          className="min-h-[48px] px-6 py-3 bg-[#1E5631] hover:bg-[#15803D] text-white rounded-xl text-base font-semibold transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>View Rotation Options</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
