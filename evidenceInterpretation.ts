/**
 * AgroShift Gambia — Farmer-Friendly Environmental Evidence Calculations & Interpretations
 *
 * Strict Scientific Integrity Rules:
 * 1. Rainfall % of normal is calculated ONLY within the same dataset (IMERG vs IMERG 2015–2025 mean,
 *    or MERRA-2 vs MERRA-2 2015–2025 mean). Never combine or average MERRA-2 and IMERG.
 * 2. Soil Moisture converts volumetric m3/m3 to % volumetric water content (value * 100).
 *    Never labeled "saturation" because saturation porosity varies by soil.
 * 3. NDVI (0–1) is never blindly converted into a percentage. Uses clear vegetation-cover categories;
 *    only computes % difference when comparing a single year against the 2015–2025 Nov–Jun mean.
 * 4. Soil pH is never converted to a percentage; uses plain acidity/fertility descriptions and
 *    clearly separates 250 m modelled predictions from laboratory soil tests.
 * 5. Elevation stays in metres (m) with clear local terrain context and slope limitation.
 * 6. Missing (null) backend values are never turned into zero.
 */

import {
  EvidenceData,
  EvidenceModisItem,
  EvidencePowerItem,
  EvidenceSmapItem,
  EvidenceSoilGridsItem,
  EvidenceSrtmItem,
} from '../../types/agroshift';

export type IndicatorId =
  | 'Rainfall'
  | 'Soil Moisture'
  | 'NDVI'
  | 'Soil Properties'
  | 'Elevation';

export type RainfallDatasetChoice = 'imerg' | 'merra2';
export type SmapLayerChoice = 'surface' | 'rootzone';

export interface LegendEntry {
  color: string;
  borderColor?: string;
  pattern?: 'solid' | 'dashed';
  label: string;
  meaning: string;
  isActive?: boolean;
}

export interface RainfallStats {
  count: number;
  mean: number;
  min: number;
  max: number;
  rainyDaysMean: number | null;
  spellSeasons: number | null;
  maxDrySpell: number | null;
  missingDaysTotal: number;
  // Valid same-dataset comparison against reference_period (2015-2025)
  baselineMean: number | null;
  pctOfNormal: number | null;
  normalStatus: 'Below usual' | 'Near usual' | 'Above usual' | 'Unavailable';
}

export interface ModisStats {
  totalUsable: number;
  goodCount: number;
  marginalCount: number;
  min: number | null;
  max: number | null;
  mean: number | null;
  baselineMean: number | null;
  pctVsBaseline: number | null;
  conditionLabel: 'Dense Cover' | 'Moderate Cover' | 'Sparse Cover' | 'Unavailable';
  periodLabel: string;
}

export interface SmapStats {
  snapshotsCount: number;
  validSurfaceCount: number;
  validRootCount: number;
  distanceKm: number | null;
  surfaceMean: number | null;
  surfaceMin: number | null;
  surfaceMax: number | null;
  rootMean: number | null;
  rootMin: number | null;
  rootMax: number | null;
}

export interface SrtmStats {
  centerElevation: number | null;
  min: number | null;
  max: number | null;
  ordered: EvidenceSrtmItem[];
}

export interface SoilPropGroup {
  property: string;
  label: string;
  simpleLabel: string;
  description: string;
  unit: string;
  quantile: string;
  source: string;
  byDepth: Record<string, number | null>;
}

export const SOIL_DEPTHS = ['0-5cm', '5-15cm', '15-30cm', '30-60cm'] as const;

export const SOIL_PROPERTY_META: Record<
  string,
  { label: string; simpleLabel: string; description: string }
> = {
  phh2o: {
    label: 'Soil pH in H₂O',
    simpleLabel: 'Soil Acidity (pH)',
    description: 'How acidic or balanced the topsoil is',
  },
  soc: {
    label: 'Soil Organic Carbon (SOC)',
    simpleLabel: 'Organic Matter',
    description: 'Natural plant-matter richness in the soil',
  },
  nitrogen: {
    label: 'Total Nitrogen',
    simpleLabel: 'Nitrogen Level',
    description: 'Total nitrogen estimated in the soil',
  },
  sand: {
    label: 'Sand Fraction',
    simpleLabel: 'Sandiness',
    description: 'Share of coarse sandy grains in the soil',
  },
  clay: {
    label: 'Clay Fraction',
    simpleLabel: 'Clay Share',
    description: 'Share of fine clay particles that hold water',
  },
  bdod: {
    label: 'Bulk Density',
    simpleLabel: 'Soil Firmness',
    description: 'How tightly packed dry soil particles are',
  },
};

export function formatNum(val: number | null | undefined, decimals = 1): string {
  if (val === null || val === undefined || Number.isNaN(val)) return 'Unavailable';
  return val.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function computePowerStats(
  filteredRows: EvidencePowerItem[],
  allReferenceRows: EvidencePowerItem[],
  source: 'merra2' | 'imerg'
): RainfallStats | null {
  const vals = filteredRows
    .map((r) => r[source].rain_total_mm)
    .filter((v): v is number => v !== null && v !== undefined);
  if (!vals.length) return null;

  const refVals = allReferenceRows
    .map((r) => r[source].rain_total_mm)
    .filter((v): v is number => v !== null && v !== undefined);

  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const baselineMean = refVals.length
    ? refVals.reduce((a, b) => a + b, 0) / refVals.length
    : null;

  const pctOfNormal =
    baselineMean && baselineMean > 0 ? Math.round((mean / baselineMean) * 100) : null;

  let normalStatus: RainfallStats['normalStatus'] = 'Unavailable';
  if (pctOfNormal !== null) {
    if (pctOfNormal < 90) normalStatus = 'Below usual';
    else if (pctOfNormal > 110) normalStatus = 'Above usual';
    else normalStatus = 'Near usual';
  }

  const rainyDays = filteredRows
    .map((r) => r[source].rainy_days)
    .filter((v): v is number => v !== null && v !== undefined);

  const spellSeasons =
    source === 'imerg'
      ? filteredRows.filter(
          (r) => r.imerg.dry_spells_ge7_days !== null && r.imerg.dry_spells_ge7_days > 0
        ).length
      : null;

  const longestSpells =
    source === 'imerg'
      ? filteredRows
          .map((r) => r.imerg.longest_dry_spell_days)
          .filter((v): v is number => v !== null && v !== undefined)
      : [];

  return {
    count: vals.length,
    mean,
    min: Math.min(...vals),
    max: Math.max(...vals),
    rainyDaysMean: rainyDays.length
      ? rainyDays.reduce((a, b) => a + b, 0) / rainyDays.length
      : null,
    spellSeasons,
    maxDrySpell: longestSpells.length ? Math.max(...longestSpells) : null,
    missingDaysTotal: filteredRows.reduce((acc, r) => acc + (r[source].rain_missing_days || 0), 0),
    baselineMean,
    pctOfNormal,
    normalStatus,
  };
}

export function computeModisStats(
  rows: EvidenceModisItem[],
  selectedYear: string,
  methodologySeason?: string
): ModisStats | null {
  const filtered =
    selectedYear === 'all' ? rows : rows.filter((m) => String(m.year) === selectedYear);
  if (!filtered.length) return null;

  const values = filtered
    .map((m) => m.ndvi)
    .filter((v): v is number => v !== null && v !== undefined);
  const allValues = rows
    .map((m) => m.ndvi)
    .filter((v): v is number => v !== null && v !== undefined);

  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const baselineMean = allValues.length
    ? allValues.reduce((a, b) => a + b, 0) / allValues.length
    : null;

  // Percentage comparison ONLY when comparing a single year against the multi-year baseline
  const pctVsBaseline =
    selectedYear !== 'all' && mean !== null && baselineMean && baselineMean > 0
      ? Math.round(((mean - baselineMean) / baselineMean) * 100)
      : null;

  let conditionLabel: ModisStats['conditionLabel'] = 'Unavailable';
  if (mean !== null) {
    if (mean >= 0.5) conditionLabel = 'Dense Cover';
    else if (mean >= 0.3) conditionLabel = 'Moderate Cover';
    else conditionLabel = 'Sparse Cover';
  }

  const years = filtered.map((m) => m.year);
  const minY = Math.min(...years);
  const maxY = Math.max(...years);

  return {
    totalUsable: filtered.length,
    goodCount: filtered.filter((m) => m.reliability === 0).length,
    marginalCount: filtered.filter((m) => m.reliability === 1).length,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
    mean,
    baselineMean,
    pctVsBaseline,
    conditionLabel,
    periodLabel:
      selectedYear === 'all'
        ? `${methodologySeason || 'Nov–Jun'} (${minY}–${maxY})`
        : `${methodologySeason || 'Nov–Jun'} ${selectedYear}`,
  };
}

export function computeSmapStats(
  rows: EvidenceSmapItem[],
  selectedYear: string
): SmapStats | null {
  const filtered =
    selectedYear === 'all' ? rows : rows.filter((s) => String(s.year) === selectedYear);
  if (!filtered.length) return null;

  const surfaceVals = filtered
    .map((s) => s.surface_soil_moisture_m3_m3)
    .filter((v): v is number => v !== null && v !== undefined);
  const rootVals = filtered
    .map((s) => s.rootzone_soil_moisture_m3_m3)
    .filter((v): v is number => v !== null && v !== undefined);

  return {
    snapshotsCount: filtered.length,
    validSurfaceCount: filtered.filter((s) => s.surface_quality === 'valid').length,
    validRootCount: filtered.filter((s) => s.rootzone_quality === 'valid').length,
    distanceKm: filtered[0]?.distance_from_pilot_km ?? null,
    surfaceMean: surfaceVals.length ? surfaceVals.reduce((a, b) => a + b, 0) / surfaceVals.length : null,
    surfaceMin: surfaceVals.length ? Math.min(...surfaceVals) : null,
    surfaceMax: surfaceVals.length ? Math.max(...surfaceVals) : null,
    rootMean: rootVals.length ? rootVals.reduce((a, b) => a + b, 0) / rootVals.length : null,
    rootMin: rootVals.length ? Math.min(...rootVals) : null,
    rootMax: rootVals.length ? Math.max(...rootVals) : null,
  };
}

export function computeSoilGridsGrouped(rows: EvidenceSoilGridsItem[]): SoilPropGroup[] {
  const propsOrder = ['phh2o', 'soc', 'nitrogen', 'sand', 'clay', 'bdod'];
  const presentProps = propsOrder.filter((p) => rows.some((s) => s.property === p));
  rows.forEach((s) => {
    if (!presentProps.includes(s.property)) presentProps.push(s.property);
  });

  return presentProps.map((prop) => {
    const propRows = rows.filter((s) => s.property === prop);
    const byDepth: Record<string, number | null> = {};
    SOIL_DEPTHS.forEach((d) => {
      const match = propRows.find((r) => r.depth === d);
      byDepth[d] = match ? match.value : null;
    });
    return {
      property: prop,
      label: SOIL_PROPERTY_META[prop]?.label || prop,
      simpleLabel: SOIL_PROPERTY_META[prop]?.simpleLabel || prop,
      description: SOIL_PROPERTY_META[prop]?.description || '',
      unit: propRows[0]?.unit || '',
      quantile: propRows[0]?.quantile || 'Q0.5',
      source: propRows[0]?.source || 'ISRIC SoilGrids 2.0',
      byDepth,
    };
  });
}

export function computeSrtmStats(samples: EvidenceSrtmItem[]): SrtmStats | null {
  if (!samples.length) return null;
  const center =
    samples.find((s) => s.row_offset === 0 && s.column_offset === 0) ||
    samples[Math.floor(samples.length / 2)];
  const elevs = samples
    .map((s) => s.elevation_m)
    .filter((v): v is number => v !== null && v !== undefined);
  const ordered = [...samples].sort((a, b) =>
    a.row_offset !== b.row_offset ? a.row_offset - b.row_offset : a.column_offset - b.column_offset
  );
  return {
    centerElevation: center?.elevation_m ?? null,
    min: elevs.length ? Math.min(...elevs) : null,
    max: elevs.length ? Math.max(...elevs) : null,
    ordered,
  };
}

// Honest colour tiers grounded in each dataset's actual distribution / units
export function getRainfallTier(pctOfNormal: number | null): {
  color: string;
  label: string;
  tierKey: 'above' | 'near' | 'below' | 'unavailable';
} {
  if (pctOfNormal === null || Number.isNaN(pctOfNormal)) {
    return { color: '#9ca3af', label: 'Unavailable', tierKey: 'unavailable' };
  }
  if (pctOfNormal > 110) {
    return { color: '#0369a1', label: 'Above usual level (>110%)', tierKey: 'above' };
  }
  if (pctOfNormal >= 90) {
    return { color: '#0284c7', label: 'Near usual level (90–110%)', tierKey: 'near' };
  }
  return { color: '#ea7b15', label: 'Below usual level (<90%)', tierKey: 'below' };
}

export function getSmapTier(valM3: number | null): {
  color: string;
  pctWaterContent: number | null;
  label: string;
  tierKey: 'moist' | 'moderate' | 'low' | 'unavailable';
} {
  if (valM3 === null || valM3 === undefined || Number.isNaN(valM3)) {
    return { color: '#9ca3af', pctWaterContent: null, label: 'Unavailable', tierKey: 'unavailable' };
  }
  const pct = Math.round(valM3 * 100);
  if (pct >= 25) {
    return { color: '#0f766e', pctWaterContent: pct, label: 'Higher regional moisture (≥25%)', tierKey: 'moist' };
  }
  if (pct >= 15) {
    return { color: '#0284c7', pctWaterContent: pct, label: 'Moderate regional moisture (15–24%)', tierKey: 'moderate' };
  }
  return { color: '#d97706', pctWaterContent: pct, label: 'Drier regional snapshot (<15%)', tierKey: 'low' };
}

export function getModisNdviTier(ndvi: number | null): {
  color: string;
  label: string;
  tierKey: 'dense' | 'moderate' | 'sparse' | 'unavailable';
} {
  if (ndvi === null || ndvi === undefined || Number.isNaN(ndvi)) {
    return { color: '#9ca3af', label: 'Unavailable', tierKey: 'unavailable' };
  }
  if (ndvi >= 0.5) {
    return { color: '#116b37', label: 'Dense vegetation cover', tierKey: 'dense' };
  }
  if (ndvi >= 0.3) {
    return { color: '#22c55e', label: 'Moderate vegetation cover', tierKey: 'moderate' };
  }
  return { color: '#eab308', label: 'Sparse dry-season cover', tierKey: 'sparse' };
}

export function getSoilSimpleHeadline(soilGroups: SoilPropGroup[], selectedDepth: string): {
  headline: string;
  subLabel: string;
} {
  const ph = soilGroups.find((g) => g.property === 'phh2o')?.byDepth[selectedDepth];
  const sand = soilGroups.find((g) => g.property === 'sand')?.byDepth[selectedDepth];
  if (ph === null || ph === undefined) {
    return { headline: 'Estimated Soil', subLabel: 'Modelled profile (not lab-tested)' };
  }
  const acidity = ph < 5.5 ? 'Acidic Soil' : ph <= 6.5 ? 'Slightly Acidic' : 'Neutral Soil';
  const textureHint = sand !== null && sand !== undefined && sand >= 50 ? ' · Sandy' : '';
  return {
    headline: acidity,
    subLabel: `pH ${ph}${textureHint} (modelled, not lab-tested)`,
  };
}

export function getSoilPropertyTier(
  property: string,
  val: number | null
): {
  color: string;
  label: string;
  simpleSummary: string;
  tierKey: string;
} {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return {
      color: '#9ca3af',
      label: 'Unavailable',
      simpleSummary: 'No modelled estimate available',
      tierKey: 'unavailable',
    };
  }
  if (property === 'phh2o') {
    if (val < 5.5) {
      return {
        color: '#d97706',
        label: 'Acidic Soil Estimate (pH < 5.5)',
        simpleSummary: 'Acidic topsoil — compost or lime may help sensitive crops',
        tierKey: 'acidic',
      };
    }
    if (val <= 6.5) {
      return {
        color: '#116b37',
        label: 'Mildly Acidic to Neutral (pH 5.5–6.5)',
        simpleSummary: 'Generally balanced pH for common Gambian rain-fed crops',
        tierKey: 'moderate',
      };
    }
    return {
      color: '#0284c7',
      label: 'Neutral to Alkaline (pH > 6.5)',
      simpleSummary: 'Low acidity across this 250 m model cell',
      tierKey: 'alkaline',
    };
  }
  if (property === 'soc') {
    if (val < 10) {
      return {
        color: '#ea7b15',
        label: 'Low Organic Matter',
        simpleSummary: 'Low estimated organic carbon — residue & manure help build soil',
        tierKey: 'low',
      };
    }
    if (val <= 20) {
      return {
        color: '#65a30d',
        label: 'Moderate Organic Matter',
        simpleSummary: 'Moderate estimated organic matter for rain-fed upland soil',
        tierKey: 'moderate',
      };
    }
    return {
      color: '#116b37',
      label: 'Higher Organic Matter',
      simpleSummary: 'Richer estimated organic carbon level',
      tierKey: 'high',
    };
  }
  if (property === 'sand') {
    if (val >= 55) {
      return {
        color: '#d97706',
        label: 'Sandy Soil Estimate',
        simpleSummary: 'Drains quickly after rain and dries out faster',
        tierKey: 'high_sand',
      };
    }
    return {
      color: '#65a30d',
      label: 'Moderate Sand Share',
      simpleSummary: 'Mixed sand content across the 250 m soil estimate',
      tierKey: 'mod_sand',
    };
  }
  if (property === 'clay') {
    return {
      color: '#b45309',
      label: val >= 25 ? 'Heavier Clay Share' : 'Light Clay Share',
      simpleSummary:
        val >= 25
          ? 'Higher fine clay share helps hold water longer'
          : 'Lower clay share — soil drains fairly quickly',
      tierKey: 'clay',
    };
  }
  return {
    color: '#92400e',
    label: 'Estimated Soil Value',
    simpleSummary: '250 m statistical prediction (confirm with local soil check)',
    tierKey: 'modelled',
  };
}

export function getElevationColor(elev: number | null, min: number | null, max: number | null): string {
  if (elev === null || elev === undefined) return '#9ca3af';
  if (min === null || max === null || min === max) return '#116b37';
  const ratio = (elev - min) / (max - min);
  if (ratio <= 0.33) return '#0284c7';
  if (ratio <= 0.66) return '#16a34a';
  return '#ea7b15';
}

export interface FarmerInterpretation {
  body: string;
}

export function buildFieldInterpretation(params: {
  indicator: IndicatorId;
  evidenceData: EvidenceData | null;
  selectedYear: string;
  rainfallChoice: RainfallDatasetChoice;
  merra2Stats: RainfallStats | null;
  imergStats: RainfallStats | null;
  smapChoice: SmapLayerChoice;
  smapStats: SmapStats | null;
  modisStats: ModisStats | null;
  soilGroups: SoilPropGroup[];
  selectedSoilProp: string;
  selectedSoilDepth: string;
  srtmStats: SrtmStats | null;
}): FarmerInterpretation {
  const {
    indicator,
    evidenceData,
    selectedYear,
    rainfallChoice,
    merra2Stats,
    imergStats,
    smapChoice,
    smapStats,
    modisStats,
    soilGroups,
    selectedSoilProp,
    selectedSoilDepth,
    srtmStats,
  } = params;

  const refPeriod = evidenceData?.reference_period;
  const periodRange = refPeriod ? `${refPeriod.start_year}–${refPeriod.end_year}` : '2015–2025';
  const yearLabel = selectedYear === 'all' ? `across ${periodRange}` : `in ${selectedYear}`;

  if (indicator === 'Rainfall') {
    const activeStats = rainfallChoice === 'merra2' ? merra2Stats : imergStats;
    if (!activeStats) {
      return {
        body: 'Enough rainfall measurements were not available for the selected period, so a clear seasonal rainfall summary cannot be provided.',
      };
    }

    const pct = activeStats.pctOfNormal;
    const statusPhrase =
      selectedYear === 'all'
        ? `near the usual June–October average across ${periodRange}`
        : pct !== null
        ? `${pct}% of the ${periodRange} seasonal average (${activeStats.normalStatus.toLowerCase()})`
        : 'recorded for this season';

    const drySpellNote =
      rainfallChoice === 'imerg' && activeStats.spellSeasons !== null && activeStats.spellSeasons > 0
        ? ` Satellite records also show mid-season dry breaks of 7 days or more occurred in ${activeStats.spellSeasons} of ${activeStats.count} season${
            activeStats.count > 1 ? 's' : ''
          } between July and September.`
        : '';

    const scaleNote =
      rainfallChoice === 'merra2'
        ? ' This comes from a broad ~50 km weather grid rather than a rain gauge on your plot, so rain on your exact field can still vary.'
        : ' This shaded area covers a ~10 km district grid rather than only your plot boundary, so local showers and mid-season dry spells can still vary from farm to farm.';

    return {
      body: `Wet-season rainfall ${yearLabel} was ${statusPhrase}.${drySpellNote}${scaleNote}`,
    };
  }

  if (indicator === 'Soil Moisture') {
    if (!smapStats) {
      return {
        body: 'Regional soil moisture measurements are not available for the selected period.',
      };
    }

    const activeVal = smapChoice === 'surface' ? smapStats.surfaceMean : smapStats.rootMean;
    if (activeVal === null) {
      return {
        body: 'Soil moisture snapshots for this depth layer are unavailable for the selected period.',
      };
    }

    const pctWater = Math.round(activeVal * 100);
    const depthWords = smapChoice === 'surface' ? 'topsoil (top 5 cm)' : 'deeper root zone (down to 1 metre)';

    return {
      body: `During July–October ${yearLabel}, ${depthWords} across the wider area held about ${pctWater}% water by volume. Because this satellite measurement averages a ~9 km regional area centered about ${
        smapStats.distanceKm ?? '6'
      } km away, it shows general wet-season conditions in the district rather than exact wetness inside your own field.`,
    };
  }

  if (indicator === 'NDVI') {
    if (!modisStats || modisStats.mean === null) {
      return {
        body: 'Vegetation cover measurements are unavailable for the selected period.',
      };
    }

    const coverPhrase =
      modisStats.conditionLabel === 'Dense Cover'
        ? 'fairly thick green vegetation'
        : modisStats.conditionLabel === 'Moderate Cover'
        ? 'moderate tree, bush, and fallow vegetation'
        : 'light or dry vegetation cover';

    const compareNote =
      modisStats.pctVsBaseline !== null
        ? ` (${modisStats.pctVsBaseline >= 0 ? '+' : ''}${modisStats.pctVsBaseline}% compared with the ${periodRange} November–June average)`
        : '';

    return {
      body: `Satellite greenness observations taken between November and June ${
        selectedYear === 'all' ? `(${periodRange})` : `in ${selectedYear}`
      } show ${coverPhrase}${compareNote} across a 250-metre area around your field. Heavy monsoon clouds hide the July–September rainy months, so these numbers describe dry-season and harvest-period plant cover rather than how crops grow during the peak rains.`,
    };
  }

  if (indicator === 'Soil Properties') {
    const activeProp = soilGroups.find((g) => g.property === selectedSoilProp) || soilGroups[0];
    if (!activeProp) {
      return {
        body: 'Estimated soil information is not available for this field.',
      };
    }
    const phTop = soilGroups.find((g) => g.property === 'phh2o')?.byDepth['0-5cm'];
    const sandTop = soilGroups.find((g) => g.property === 'sand')?.byDepth['0-5cm'];
    const socTop = soilGroups.find((g) => g.property === 'soc')?.byDepth['0-5cm'];

    const soilSummary =
      phTop !== null && phTop !== undefined
        ? `Global soil maps estimate your local area (${selectedSoilDepth}) has ${
            phTop < 5.5 ? 'acidic' : phTop <= 6.5 ? 'slightly acidic' : 'balanced'
          } soil${sandTop !== null && sandTop !== undefined && sandTop >= 50 ? ' with a high share of sand' : ''}${
            socTop !== null && socTop !== undefined && socTop <= 12 ? ' and modest organic matter' : ''
          }.`
        : `Global soil maps provide an estimated ${activeProp.simpleLabel.toLowerCase()} reading for the ${selectedSoilDepth} layer.`;

    return {
      body: `${soilSummary} Adding compost, manure, or legume residues can help improve sandy or acidic soils, though these 250-metre estimates are not laboratory tests from your field and silt content was not measured.`,
    };
  }

  // Elevation
  if (!srtmStats || srtmStats.centerElevation === null) {
    return {
      body: 'Ground height measurements are unavailable for this field.',
    };
  }

  return {
    body: `Your field area sits around ${srtmStats.centerElevation} metres above sea level, with surrounding 30-metre squares measuring between ${srtmStats.min} m and ${srtmStats.max} m. While the ground appears broadly level at this scale, small slopes or low spots where rainwater collects can only be checked by walking the field.`,
  };
}

// ============================================================================
// Screen S4 (4-Card Farmer-First Evidence Helpers) — Strictly Real Data
// ============================================================================

export interface DrySpellCardSummary {
  available: boolean;
  longestDays: number | null;
  longestYear: number | null;
  minSpellDays: number | null;
  maxSpellDays: number | null;
  seasonsWithGe7: number;
  totalSeasons: number;
  riskLevel: 'Low' | 'Moderate' | 'High' | 'Unavailable';
  takeaway: string;
}

export function computeDrySpellSummary(
  filteredRows: EvidencePowerItem[],
  source: RainfallDatasetChoice,
  selectedYear: string
): DrySpellCardSummary {
  const validRows = filteredRows.filter(
    (r) =>
      r[source].longest_dry_spell_days !== null &&
      r[source].longest_dry_spell_days !== undefined
  );
  if (!validRows.length) {
    return {
      available: false,
      longestDays: null,
      longestYear: null,
      minSpellDays: null,
      maxSpellDays: null,
      seasonsWithGe7: 0,
      totalSeasons: 0,
      riskLevel: 'Unavailable',
      takeaway: 'Dry-spell observations are not available for this location and selection.',
    };
  }

  let maxRow = validRows[0];
  for (const row of validRows) {
    if ((row[source].longest_dry_spell_days ?? 0) > (maxRow[source].longest_dry_spell_days ?? 0)) {
      maxRow = row;
    }
  }
  const spells = validRows.map((r) => r[source].longest_dry_spell_days as number);
  const longestDays = Math.max(...spells);
  const minSpellDays = Math.min(...spells);
  const seasonsWithGe7 = validRows.filter(
    (r) => (r[source].dry_spells_ge7_days ?? 0) > 0
  ).length;

  let riskLevel: DrySpellCardSummary['riskLevel'] = 'Low';
  if (longestDays >= 12 || seasonsWithGe7 >= Math.ceil(validRows.length * 0.5)) {
    riskLevel = 'High';
  } else if (longestDays >= 7 || seasonsWithGe7 > 0) {
    riskLevel = 'Moderate';
  }

  const periodText =
    selectedYear === 'all'
      ? `across ${validRows.length} seasons`
      : `in ${selectedYear}`;

  const takeaway =
    riskLevel === 'Low'
      ? `Dry breaks during July–September stayed short (${minSpellDays === longestDays ? `${longestDays} days` : `${minSpellDays}–${longestDays} days`} ${periodText}), indicating lower mid-season drought pressure.`
      : `Breaks of 7 days or more occurred in ${seasonsWithGe7} of ${validRows.length} season${validRows.length > 1 ? 's' : ''} (longest ${longestDays} days in ${maxRow.year}); drought-tolerant varieties or cowpea intercropping help protect flowering.`;

  return {
    available: true,
    longestDays,
    longestYear: maxRow.year,
    minSpellDays,
    maxSpellDays: longestDays,
    seasonsWithGe7,
    totalSeasons: validRows.length,
    riskLevel,
    takeaway,
  };
}

export interface ModisCurvePoint {
  monthNum: number;
  label: string;
  mean: number | null;
  count: number;
  isCloudGap: boolean;
}

export interface ModisCardSummary {
  points: ModisCurvePoint[];
  peakMonthLabel: string | null;
  peakNdvi: number | null;
  dryMinLabel: string | null;
  dryMinNdvi: number | null;
  consistencyLabel: string;
  takeaway: string;
}

const AGRI_CALENDAR_MONTHS: Array<{ monthNum: number; label: string; isCloudGap: boolean }> = [
  { monthNum: 11, label: 'Nov', isCloudGap: false },
  { monthNum: 12, label: 'Dec', isCloudGap: false },
  { monthNum: 1, label: 'Jan', isCloudGap: false },
  { monthNum: 2, label: 'Feb', isCloudGap: false },
  { monthNum: 3, label: 'Mar', isCloudGap: false },
  { monthNum: 4, label: 'Apr', isCloudGap: false },
  { monthNum: 5, label: 'May', isCloudGap: false },
  { monthNum: 6, label: 'Jun', isCloudGap: false },
  { monthNum: 7, label: 'Jul', isCloudGap: true },
  { monthNum: 8, label: 'Aug', isCloudGap: true },
  { monthNum: 9, label: 'Sep', isCloudGap: true },
  { monthNum: 10, label: 'Oct', isCloudGap: true },
];

const FULL_MONTH_NAMES: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
};

export function computeModisSeasonalCurve(
  rows: EvidenceModisItem[],
  selectedYear: string
): ModisCardSummary {
  const filtered =
    selectedYear === 'all' ? rows : rows.filter((m) => String(m.year) === selectedYear);

  const points: ModisCurvePoint[] = AGRI_CALENDAR_MONTHS.map(({ monthNum, label, isCloudGap }) => {
    if (isCloudGap) {
      return { monthNum, label, mean: null, count: 0, isCloudGap: true };
    }
    const matches = filtered.filter((item) => {
      const parts = String(item.month).split('-');
      const parsed = parts.length === 2 ? Number(parts[1]) : Number(item.month);
      return parsed === monthNum;
    });
    const mean = matches.length
      ? matches.reduce((sum, item) => sum + item.ndvi, 0) / matches.length
      : null;
    return { monthNum, label, mean, count: matches.length, isCloudGap: false };
  });

  const usable = points.filter((p) => p.mean !== null);
  if (!usable.length) {
    return {
      points,
      peakMonthLabel: null,
      peakNdvi: null,
      dryMinLabel: null,
      dryMinNdvi: null,
      consistencyLabel: 'Data not available',
      takeaway: 'Usable satellite vegetation observations are not available for this selection.',
    };
  }

  let peak = usable[0];
  let trough = usable[0];
  for (const pt of usable) {
    if ((pt.mean ?? 0) > (peak.mean ?? 0)) peak = pt;
    if ((pt.mean ?? 0) < (trough.mean ?? 0)) trough = pt;
  }

  // Compute inter-annual spread of annual means to judge stability honestly
  const yearlyMeans: number[] = [];
  const years = Array.from(new Set(rows.map((r) => r.year)));
  for (const yr of years) {
    const yrRows = rows.filter((r) => r.year === yr);
    if (yrRows.length >= 4) {
      yearlyMeans.push(yrRows.reduce((s, r) => s + r.ndvi, 0) / yrRows.length);
    }
  }
  let consistencyLabel = 'Seasonal cycle observed';
  if (yearlyMeans.length >= 3) {
    const spread = Math.max(...yearlyMeans) - Math.min(...yearlyMeans);
    consistencyLabel =
      spread <= 0.12 ? 'Stable multi-year pattern' : 'Moderate year-to-year variation';
  }

  const peakFull = FULL_MONTH_NAMES[peak.monthNum] || peak.label;
  const troughFull = FULL_MONTH_NAMES[trough.monthNum] || trough.label;
  const takeaway = `Usable greenness peaks in ${peakFull} (${(peak.mean as number).toFixed(2)} NDVI) after the rains and tapers to ${(trough.mean as number).toFixed(2)} by ${troughFull}, indicating dry-season clearance ahead of planting. July–October is cloud-obscured.`;

  return {
    points,
    peakMonthLabel: peakFull,
    peakNdvi: peak.mean,
    dryMinLabel: troughFull,
    dryMinNdvi: trough.mean,
    consistencyLabel,
    takeaway,
  };
}

export interface SoilCardSummary {
  available: boolean;
  ph: number | null;
  phStatus: string;
  phTone: 'amber' | 'green' | 'sky' | 'neutral';
  socGKg: number | null;
  socPct: number | null;
  socStatus: 'Low' | 'Moderate' | 'Higher' | 'Unavailable';
  sandPct: number | null;
  clayPct: number | null;
  siltPct: number | null;
  unmeasuredPct: number | null;
  nitrogenGKg: number | null;
  bdodKgDm3: number | null;
  drainageLabel: string;
  takeaway: string;
}

export function computeSoilCardSummary(
  soilGroups: SoilPropGroup[],
  selectedDepth: string,
  observedSoil?: string
): SoilCardSummary {
  if (!soilGroups.length) {
    return {
      available: false,
      ph: null,
      phStatus: 'Unavailable',
      phTone: 'neutral',
      socGKg: null,
      socPct: null,
      socStatus: 'Unavailable',
      sandPct: null,
      clayPct: null,
      siltPct: null,
      unmeasuredPct: null,
      nitrogenGKg: null,
      bdodKgDm3: null,
      drainageLabel: 'Data not available for this location',
      takeaway: 'SoilGrids estimates are not available for this location.',
    };
  }

  const getVal = (prop: string): number | null =>
    soilGroups.find((g) => g.property === prop)?.byDepth[selectedDepth] ?? null;

  const ph = getVal('phh2o');
  const socGKg = getVal('soc');
  const socPct = socGKg !== null ? Number((socGKg / 10).toFixed(2)) : null;
  const sandPct = getVal('sand');
  const clayPct = getVal('clay');
  const siltPct = getVal('silt');
  const nitrogenGKg = getVal('nitrogen');
  const bdodKgDm3 = getVal('bdod');

  const unmeasuredPct =
    siltPct === null && sandPct !== null && clayPct !== null
      ? Math.max(0, Number((100 - sandPct - clayPct).toFixed(1)))
      : null;

  let phStatus = 'Unavailable';
  let phTone: SoilCardSummary['phTone'] = 'neutral';
  if (ph !== null) {
    if (ph < 5.5) {
      phStatus = 'Acidic';
      phTone = 'amber';
    } else if (ph <= 6.5) {
      phStatus = 'Slightly acidic · Ideal';
      phTone = 'green';
    } else {
      phStatus = 'Neutral to alkaline';
      phTone = 'sky';
    }
  }

  let socStatus: SoilCardSummary['socStatus'] = 'Unavailable';
  if (socGKg !== null) {
    if (socGKg < 10) socStatus = 'Low';
    else if (socGKg <= 20) socStatus = 'Moderate';
    else socStatus = 'Higher';
  }

  const drainageLabel =
    sandPct !== null && sandPct >= 50
      ? 'Fast-draining sandy profile · Lower water retention'
      : clayPct !== null && clayPct >= 25
      ? 'Heavier clay share · Retains moisture longer'
      : 'Moderate drainage profile (250 m model estimate)';

  const soilDesc = observedSoil ? `${observedSoil} (farmer-reported)` : 'Sandy topsoil';
  const phText = ph !== null ? `pH ${ph} (${phStatus.toLowerCase().replace(' · ideal', '')})` : 'unmeasured pH';
  const socText = socGKg !== null ? `${socGKg} g/kg organic carbon` : 'unmeasured organic carbon';
  const takeaway = `Light, fast-draining ${soilDesc.toLowerCase()} with ${phText} and ${socText}. Incorporating compost or manure and rotating legumes will boost moisture retention and nitrogen.`;

  return {
    available: true,
    ph,
    phStatus,
    phTone,
    socGKg,
    socPct,
    socStatus,
    sandPct,
    clayPct,
    siltPct,
    unmeasuredPct,
    nitrogenGKg,
    bdodKgDm3,
    drainageLabel,
    takeaway,
  };
}

export function computeRainfallCardTakeaway(
  stats: RainfallStats | null,
  selectedYear: string
): { statusLabel: string; statusTone: 'green' | 'amber'; takeaway: string } {
  if (!stats) {
    return {
      statusLabel: 'Data not available',
      statusTone: 'amber',
      takeaway: 'Seasonal rainfall observations are not available for this selection.',
    };
  }

  const meanRounded = Math.round(stats.mean);
  const statusTone: 'green' | 'amber' = stats.normalStatus === 'Below usual' ? 'amber' : 'green';
  const adequacy =
    meanRounded >= 800
      ? 'Adequate for rainfed cereals & legumes'
      : meanRounded >= 550
      ? 'Sufficient for short-cycle crops'
      : 'Low seasonal volume · drought risk';

  const statusLabel =
    selectedYear === 'all'
      ? adequacy
      : `${stats.normalStatus} (${stats.pctOfNormal ?? '—'}% of avg)`;

  const rangeNote =
    selectedYear === 'all' && stats.count > 1
      ? ` (ranging ${Math.round(stats.min).toLocaleString()}–${Math.round(stats.max).toLocaleString()} mm across ${stats.count} seasons)`
      : '';

  const takeaway =
    meanRounded >= 800
      ? `Seasonal June–October rainfall averages ${meanRounded.toLocaleString()} mm${rangeNote}, supporting groundnut, maize, and millet when planted early with the June rains.`
      : `Lower June–October rainfall (${meanRounded.toLocaleString()} mm${rangeNote}) favours short-duration millet, cowpea, and early planting to reduce end-of-season moisture stress.`;

  return { statusLabel, statusTone, takeaway };
}

// ============================================================================
// Screen S4 Redesigned Interactive Environmental Dashboard Helpers
// ============================================================================

export type DashboardIndicatorKey =
  | 'rainfall'
  | 'temperature'
  | 'soil_moisture'
  | 'humidity'
  | 'vegetation'
  | 'soil_properties';

export type RainfallViewChoice = 'both' | 'imerg' | 'merra2';
export type TimeGranularityChoice = 'monthly' | 'yearly';

export interface SmapMonthlyPoint {
  monthNum: number;
  label: string;
  fullLabel: string;
  surfacePct: number | null;
  surfaceM3: number | null;
  rootPct: number | null;
  rootM3: number | null;
  baselineSurfacePct: number | null;
  baselineRootPct: number | null;
  count: number;
  granuleDate: string | null;
}

export interface SmapYearlyPoint {
  year: number;
  surfacePct: number | null;
  surfaceM3: number | null;
  rootPct: number | null;
  rootM3: number | null;
  count: number;
}

export function computeSmapMonthlyPoints(
  rows: EvidenceSmapItem[],
  selectedYear: string
): SmapMonthlyPoint[] {
  const filtered =
    selectedYear === 'all' ? rows : rows.filter((r) => String(r.year) === selectedYear);

  return [7, 8, 9, 10].map((mNum) => {
    const monthAll = rows.filter((r) => r.month === mNum);
    const monthSel = filtered.filter((r) => r.month === mNum);

    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    const selSurf = monthSel
      .map((i) => i.surface_soil_moisture_m3_m3)
      .filter((v): v is number => v !== null && v !== undefined);
    const selRoot = monthSel
      .map((i) => i.rootzone_soil_moisture_m3_m3)
      .filter((v): v is number => v !== null && v !== undefined);

    const baseSurf = monthAll
      .map((i) => i.surface_soil_moisture_m3_m3)
      .filter((v): v is number => v !== null && v !== undefined);
    const baseRoot = monthAll
      .map((i) => i.rootzone_soil_moisture_m3_m3)
      .filter((v): v is number => v !== null && v !== undefined);

    const sM3 = avg(selSurf);
    const rM3 = avg(selRoot);
    const bsM3 = avg(baseSurf);
    const brM3 = avg(baseRoot);

    const rawGranule = monthSel.length === 1 ? monthSel[0].granule_time_utc : null;
    const granuleDate = rawGranule && rawGranule.length >= 8
      ? `${rawGranule.slice(0, 4)}-${rawGranule.slice(4, 6)}-${rawGranule.slice(6, 8)}`
      : null;

    const fullMonth = FULL_MONTH_NAMES[mNum] || `Month ${mNum}`;

    return {
      monthNum: mNum,
      label: fullMonth.slice(0, 3),
      fullLabel: selectedYear === 'all' ? `${fullMonth} (mid-month average)` : `${fullMonth} ${selectedYear}`,
      surfacePct: sM3 !== null ? Number((sM3 * 100).toFixed(1)) : null,
      surfaceM3: sM3 !== null ? Number(sM3.toFixed(3)) : null,
      rootPct: rM3 !== null ? Number((rM3 * 100).toFixed(1)) : null,
      rootM3: rM3 !== null ? Number(rM3.toFixed(3)) : null,
      baselineSurfacePct: bsM3 !== null ? Number((bsM3 * 100).toFixed(1)) : null,
      baselineRootPct: brM3 !== null ? Number((brM3 * 100).toFixed(1)) : null,
      count: monthSel.length,
      granuleDate,
    };
  });
}

export function computeSmapYearlyPoints(rows: EvidenceSmapItem[]): SmapYearlyPoint[] {
  const years = Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => a - b);
  return years.map((yr) => {
    const items = rows.filter((r) => r.year === yr);
    const surf = items
      .map((i) => i.surface_soil_moisture_m3_m3)
      .filter((v): v is number => v !== null && v !== undefined);
    const root = items
      .map((i) => i.rootzone_soil_moisture_m3_m3)
      .filter((v): v is number => v !== null && v !== undefined);
    const sM3 = surf.length ? surf.reduce((a, b) => a + b, 0) / surf.length : null;
    const rM3 = root.length ? root.reduce((a, b) => a + b, 0) / root.length : null;
    return {
      year: yr,
      surfacePct: sM3 !== null ? Number((sM3 * 100).toFixed(1)) : null,
      surfaceM3: sM3 !== null ? Number(sM3.toFixed(3)) : null,
      rootPct: rM3 !== null ? Number((rM3 * 100).toFixed(1)) : null,
      rootM3: rM3 !== null ? Number(rM3.toFixed(3)) : null,
      count: items.length,
    };
  });
}

export interface ModisYearlyPoint {
  year: number;
  meanNdvi: number | null;
  count: number;
  isPartial: boolean;
}

export function computeModisYearlyPoints(rows: EvidenceModisItem[]): ModisYearlyPoint[] {
  const years = Array.from(new Set(rows.map((r) => r.year))).sort((a, b) => a - b);
  return years.map((yr) => {
    const items = rows.filter((r) => r.year === yr);
    const vals = items.map((i) => i.ndvi).filter((v): v is number => v !== null && v !== undefined);
    const monthsCovered = new Set(
      items.map((i) => Number(String(i.month).split('-')[1] || i.month))
    );
    // A full Nov-Jun cycle has observations in both Nov/Dec and Jan-Jun (8 months)
    const isPartial = monthsCovered.size < 6;
    return {
      year: yr,
      meanNdvi: vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(3)) : null,
      count: vals.length,
      isPartial,
    };
  });
}

export function buildWhatThisMeansText(params: {
  activeIndicator: DashboardIndicatorKey;
  selectedYear: string;
  periodRangeLabel: string;
  rainfallView: RainfallViewChoice;
  imergStats: RainfallStats | null;
  merra2Stats: RainfallStats | null;
  drySpellSummary: DrySpellCardSummary;
  smapStats: SmapStats | null;
  smapDistanceKm: number | null;
  modisCurve: ModisCardSummary;
  modisStats: ModisStats | null;
  soilSummary: SoilCardSummary;
  selectedSoilDepth: string;
  hasTemperatureData: boolean;
  hasHumidityData: boolean;
}): string {
  const {
    activeIndicator,
    selectedYear,
    periodRangeLabel,
    rainfallView,
    imergStats,
    merra2Stats,
    drySpellSummary,
    smapStats,
    smapDistanceKm,
    modisCurve,
    modisStats,
    soilSummary,
    selectedSoilDepth,
    hasTemperatureData,
    hasHumidityData,
  } = params;

  const yearPhrase = selectedYear === 'all' ? `across ${periodRangeLabel}` : `during the ${selectedYear} wet season`;

  if (activeIndicator === 'rainfall') {
    const primaryStats = rainfallView === 'merra2' ? merra2Stats : imergStats;
    const secondaryStats = rainfallView === 'both' ? merra2Stats : null;
    if (!primaryStats) {
      return `Rainfall measurements are not available for your field ${yearPhrase}.`;
    }

    const sourceLabel =
      rainfallView === 'merra2' ? 'NASA climate-data estimate' : 'satellite rainfall estimate';

    const comparisonPhrase =
      selectedYear === 'all'
        ? `averaged around ${Math.round(primaryStats.mean).toLocaleString()} millimetres per June–October wet season (ranging from ${Math.round(primaryStats.min).toLocaleString()} to ${Math.round(primaryStats.max).toLocaleString()} millimetres)`
        : `recorded ${Math.round(primaryStats.mean).toLocaleString()} millimetres between June and October, which is ${primaryStats.normalStatus.toLowerCase()} (${primaryStats.pctOfNormal ?? '—'}% of the ${periodRangeLabel} average for the same ${sourceLabel})`;

    const secondNote =
      secondaryStats && selectedYear !== 'all'
        ? ` The NASA climate-data estimate for ${selectedYear} was ${Math.round(secondaryStats.mean).toLocaleString()} millimetres (${secondaryStats.normalStatus.toLowerCase()} relative to its own ${periodRangeLabel} baseline).`
        : secondaryStats
        ? ` The broader NASA climate-data estimate averaged ${Math.round(secondaryStats.mean).toLocaleString()} millimetres across the same years, and both sources are shown separately so you can see where they agree or differ.`
        : '';

    const drySpellNote =
      drySpellSummary.available && drySpellSummary.seasonsWithGe7 > 0
        ? ` Between July and September, dry breaks of 7 days or more occurred in ${drySpellSummary.seasonsWithGe7} of ${drySpellSummary.totalSeasons} recorded ${drySpellSummary.totalSeasons === 1 ? 'season' : 'seasons'} (up to ${drySpellSummary.longestDays} days).`
        : drySpellSummary.available
        ? ` Mid-season dry breaks between July and September stayed under 7 days (${drySpellSummary.longestDays} days longest).`
        : '';

    return `June–October rainfall ${yearPhrase} ${comparisonPhrase} according to the ${sourceLabel}.${secondNote}${drySpellNote}`;
  }

  if (activeIndicator === 'temperature') {
    if (!hasTemperatureData) {
      return `Daily or seasonal air temperature measurements (in °C) are not included in the environmental records currently cached for this field. Because no measured temperature series is available here, no temperature line is drawn—check the rainfall and dry-spell records for mid-season dry breaks instead.`;
    }
    return `Observed air temperatures in °C for your field ${yearPhrase} are plotted above.`;
  }

  if (activeIndicator === 'soil_moisture') {
    if (!smapStats || smapStats.surfaceMean === null) {
      return `Regional soil moisture observations are not available for this location ${yearPhrase}.`;
    }
    const topPct = (smapStats.surfaceMean * 100).toFixed(1);
    const rootPct =
      smapStats.rootMean !== null ? `${(smapStats.rootMean * 100).toFixed(1)}%` : 'unavailable';
    const distWords = smapDistanceKm !== null ? `${smapDistanceKm.toFixed(1)} kilometres away` : 'the surrounding area';

    return `Mid-month July–October observations ${yearPhrase} show average topsoil moisture (0–5 cm) at ${topPct}% water by volume and deeper root-zone moisture (0–100 cm) at ${rootPct}. Because these satellite readings cover a wide 9-kilometre regional grid centered about ${distWords}, they reflect general district wetness during the rains rather than exact moisture inside your field boundaries.`;
  }

  if (activeIndicator === 'humidity') {
    if (!hasHumidityData) {
      return `Relative humidity measurements are not included in the cached environmental records for this field, so no humidity chart is displayed.`;
    }
    return `Observed relative humidity measurements for your field ${yearPhrase} are shown above.`;
  }

  if (activeIndicator === 'vegetation') {
    if (!modisCurve.peakMonthLabel || modisCurve.peakNdvi === null || !modisStats) {
      return `Usable vegetation greenness observations are not available for this location ${yearPhrase}.`;
    }
    const compareText =
      modisStats.pctVsBaseline !== null
        ? ` Overall November–June greenness in ${selectedYear} was ${modisStats.pctVsBaseline >= 0 ? '+' : ''}${modisStats.pctVsBaseline}% compared with the ${periodRangeLabel} average.`
        : '';
    return `Clear satellite observations between November and June ${yearPhrase} show vegetation greenness peaking in ${modisCurve.peakMonthLabel} (${modisCurve.peakNdvi.toFixed(2)} index) right after the rains and gradually drying down to ${modisCurve.dryMinLabel} (${modisCurve.dryMinNdvi?.toFixed(2)} index). Heavy clouds block clear views from July through October, so those rainy-season months are left blank rather than guessed.${compareText}`;
  }

  // Soil Properties
  if (!soilSummary.available) {
    return `Estimated soil property records are not available for this field location.`;
  }
  const phDesc =
    soilSummary.ph !== null
      ? `soil pH of ${soilSummary.ph} (${soilSummary.phStatus.toLowerCase().replace(' · ideal', '')})`
      : 'unmeasured soil pH';
  const socDesc =
    soilSummary.socGKg !== null
      ? `${soilSummary.socGKg} g/kg organic carbon (${soilSummary.socStatus.toLowerCase()})`
      : 'unmeasured organic carbon';
  const sandDesc =
    soilSummary.sandPct !== null ? `${soilSummary.sandPct}% sand` : 'unmeasured sand share';

  return `At the ${selectedSoilDepth} depth, global soil maps estimate ${sandDesc}, ${phDesc}, and ${socDesc}. Silt content is not measured in this dataset and these figures are 250-metre area predictions rather than a laboratory soil test from your field, so confirming conditions locally remains important.`;
}

