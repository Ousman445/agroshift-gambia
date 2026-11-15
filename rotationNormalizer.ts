/**
 * AgroShift Gambia — Complete 3-Season Agronomic Rotation Normalizer
 *
 * Ensures every candidate strategy (Options A, B, and C) and baseline rotation
 * always represents a complete, sustainable 3-year rain-fed Gambian rotation cycle
 * (Season 1, Season 2, Season 3) with explicit crop type and rainy-season months.
 *
 * Never leaves Season 3 blank ('—') or repeats consecutive identical cereal crops.
 */

import {
  BackendStrategyResponse,
  CropSequenceItem,
  FieldData,
  Strategy,
} from '../types/agroshift';

const MONTH_ABBR: Record<number, string> = {
  1: 'Jan',
  2: 'Feb',
  3: 'Mar',
  4: 'Apr',
  5: 'May',
  6: 'Jun',
  7: 'Jul',
  8: 'Aug',
  9: 'Sep',
  10: 'Oct',
  11: 'Nov',
  12: 'Dec',
};

export function formatMonthWindow(start?: number, end?: number): string {
  if (!start || !end) return 'Jun–Oct';
  return `${MONTH_ABBR[start] || 'Jun'}–${MONTH_ABBR[end] || 'Oct'}`;
}

function inferCropMeta(cropName: string, existingRole?: string): {
  type: string;
  month_start: number;
  month_end: number;
  role: string;
} {
  const low = cropName.toLowerCase();
  if (low.includes('groundnut')) {
    return {
      type: 'Legume',
      month_start: 6,
      month_end: 10,
      role: existingRole || 'Legume / Cash Crop',
    };
  }
  if (low.includes('cowpea')) {
    return {
      type: low.includes('cover') || low.includes('fallow') ? 'Cover / Fallow' : 'Legume',
      month_start: 7,
      month_end: 9,
      role: existingRole || 'Legume / Food & Fodder',
    };
  }
  if (low.includes('millet')) {
    return {
      type: 'Cereal',
      month_start: 6,
      month_end: 10,
      role: existingRole || 'Cereal / Drought-Buffer',
    };
  }
  if (low.includes('sorghum')) {
    return {
      type: 'Cereal',
      month_start: 6,
      month_end: 10,
      role: existingRole || 'Cereal / Grain & Fodder',
    };
  }
  if (low.includes('maize')) {
    return {
      type: 'Cereal',
      month_start: 7,
      month_end: 10,
      role: existingRole || 'Cereal / Staple Grain',
    };
  }
  if (low.includes('sesame')) {
    return {
      type: 'Oilseed',
      month_start: 7,
      month_end: 10,
      role: existingRole || 'Oilseed / Cash Crop',
    };
  }
  return {
    type: 'Legume',
    month_start: 6,
    month_end: 10,
    role: existingRole || 'Rain-fed crop',
  };
}

function capitalizeCrop(name: string): string {
  if (!name) return name;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function normalizeExistingSequence(rawSeq: any[]): CropSequenceItem[] {
  return (rawSeq || []).map((item, idx) => {
    const cropLabel = capitalizeCrop(String(item?.crop || '').trim());
    const meta = inferCropMeta(cropLabel, item?.role);
    return {
      season: `Season ${idx + 1}`,
      year: item?.year ?? idx + 1,
      crop: cropLabel || 'Groundnut',
      type: item?.type || meta.type,
      month_start: item?.month_start ?? meta.month_start,
      month_end: item?.month_end ?? meta.month_end,
      role: item?.role || meta.role,
    };
  });
}

const OPTION_A_SEQUENCE: CropSequenceItem[] = [
  {
    season: 'Season 1',
    year: 1,
    crop: 'Groundnut',
    type: 'Legume',
    month_start: 6,
    month_end: 10,
    role: 'Legume / Cash Crop',
  },
  {
    season: 'Season 2',
    year: 2,
    crop: 'Maize',
    type: 'Cereal',
    month_start: 7,
    month_end: 10,
    role: 'Cereal / Staple Grain',
  },
  {
    season: 'Season 3',
    year: 3,
    crop: 'Cowpea (Dual-Purpose)',
    type: 'Legume',
    month_start: 7,
    month_end: 9,
    role: 'Legume / Food & Fodder',
  },
];

const OPTION_B_SEQUENCE: CropSequenceItem[] = [
  {
    season: 'Season 1',
    year: 1,
    crop: 'Maize',
    type: 'Cereal',
    month_start: 7,
    month_end: 10,
    role: 'Cereal / Food Staple',
  },
  {
    season: 'Season 2',
    year: 2,
    crop: 'Cowpea',
    type: 'Legume',
    month_start: 7,
    month_end: 9,
    role: 'Legume / Soil Restorer',
  },
  {
    season: 'Season 3',
    year: 3,
    crop: 'Early Millet (Souna)',
    type: 'Cereal',
    month_start: 6,
    month_end: 10,
    role: 'Cereal / Drought-Buffer',
  },
];

const OPTION_C_SEQUENCE: CropSequenceItem[] = [
  {
    season: 'Season 1',
    year: 1,
    crop: 'Sorghum (Grain & Fodder)',
    type: 'Cereal',
    month_start: 6,
    month_end: 10,
    role: 'Cereal / Drought Buffer',
  },
  {
    season: 'Season 2',
    year: 2,
    crop: 'Groundnut',
    type: 'Legume',
    month_start: 6,
    month_end: 10,
    role: 'Legume / Nitrogen Fixer',
  },
  {
    season: 'Season 3',
    year: 3,
    crop: 'Cowpea / Green Cover Rest',
    type: 'Cover / Fallow',
    month_start: 7,
    month_end: 9,
    role: 'Legume / Cover Rest',
  },
];

function appendReasonIfMissing(why: string, addition: string): string {
  const cleanWhy = (why || '').trim();
  if (!cleanWhy) return addition;
  if (cleanWhy.toLowerCase().includes(addition.slice(0, 24).toLowerCase())) {
    return cleanWhy;
  }
  return `${cleanWhy} ${addition}`;
}

export function ensureThreeSeasonStrategy(strategy: Strategy): Strategy {
  if (!strategy) return strategy;

  if (strategy.id === 'A') {
    return {
      ...strategy,
      name: 'Groundnut–Maize–Cowpea Soil Health Cycle',
      sequence: OPTION_A_SEQUENCE,
      why: appendReasonIfMissing(
        strategy.why,
        'Introducing dual-purpose cowpea in Season 3 breaks cereal pest build-up while restoring nitrogen reserves before returning to groundnut.'
      ),
    };
  }

  if (strategy.id === 'B') {
    return {
      ...strategy,
      name: 'Maize–Cowpea–Millet Resilient Diversification',
      sequence: OPTION_B_SEQUENCE,
      why: appendReasonIfMissing(
        strategy.why,
        'Finishing with Souna millet leverages the nitrogen fixed by cowpea, withstands late-season dry spells, and leaves high stover biomass for dry-season soil protection.'
      ),
    };
  }

  if (strategy.id === 'C') {
    return {
      ...strategy,
      name: 'Sorghum–Groundnut–Cowpea Balance',
      sequence: OPTION_C_SEQUENCE,
      why: appendReasonIfMissing(
        strategy.why,
        'Completing Season 3 with cowpea / green cover rest restores soil cover and breaks continuous cereal pressure after sorghum and groundnut.'
      ),
    };
  }

  // Baseline or generic strategy: normalize existing items and enforce a 3-season agronomic loop
  const normalized = normalizeExistingSequence(strategy.sequence || []);
  if (normalized.length >= 3) {
    return {
      ...strategy,
      sequence: normalized.slice(0, 3),
    };
  }

  const s1 = normalized[0] || {
    season: 'Season 1',
    year: 1,
    crop: 'Groundnut',
    type: 'Legume',
    month_start: 6,
    month_end: 10,
    role: 'Legume / Cash Crop',
  };
  const s2 = normalized[1] || {
    season: 'Season 2',
    year: 2,
    crop: s1.type === 'Legume' ? 'Maize' : 'Groundnut',
    type: s1.type === 'Legume' ? 'Cereal' : 'Legume',
    month_start: s1.type === 'Legume' ? 7 : 6,
    month_end: 10,
    role: s1.type === 'Legume' ? 'Cereal / Staple Grain' : 'Legume / Nitrogen Fixer',
  };

  // Never leave Season 3 blank or repeat Season 2 cereal
  const s3: CropSequenceItem =
    s2.type === 'Cereal'
      ? {
          season: 'Season 3',
          year: 3,
          crop: 'Cowpea (Dual-Purpose)',
          type: 'Legume',
          month_start: 7,
          month_end: 9,
          role: 'Legume / Food & Fodder',
        }
      : {
          season: 'Season 3',
          year: 3,
          crop: 'Early Millet (Souna)',
          type: 'Cereal',
          month_start: 6,
          month_end: 10,
          role: 'Cereal / Drought-Buffer',
        };

  return {
    ...strategy,
    sequence: [s1, s2, s3],
  };
}

export function normalizeThreeSeasonResponse(
  response: BackendStrategyResponse
): BackendStrategyResponse {
  return {
    ...response,
    reference_rotation: response.reference_rotation
      ? ensureThreeSeasonStrategy(response.reference_rotation)
      : null,
    strategies: (response.strategies || []).map(ensureThreeSeasonStrategy),
  };
}

export function normalizeThreeSeasonFieldData(field: FieldData): FieldData {
  if (!field.strategies) return field;
  return {
    ...field,
    strategies: field.strategies.map(ensureThreeSeasonStrategy),
  };
}
