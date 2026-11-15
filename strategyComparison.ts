/**
 * AgroShift Gambia — Shared Strategy Comparison & Evidence Presentation Helpers
 * Single authoritative data builder consumed by BOTH:
 *   - CompareTakeAwayScreen (PDF Page 4)
 *   - PrintableFarmerReportModal (PDF Page 5)
 *   - StrategyDetailScreen (PDF Pages 1–3)
 *
 * Strictly derives every label, badge, risk detail, and score from live FastAPI backend data.
 * Never fabricates yields, prices, months of grain, crop varieties, or missing scores.
 */

import {
  BackendStrategyResponse,
  EvidenceData,
  Strategy,
  StrategyCriterion,
} from '../../types/agroshift';

export type CellTone = 'positive' | 'neutral' | 'warning' | 'negative' | 'muted';

export interface ComparisonCell {
  label: string;
  sublabel?: string;
  tone: CellTone;
  score: number | null;
  stars?: number; // 1..3 for income fit
  barPct?: number; // 0..100 for food-role fit
}

export interface ComparisonCriterionRow {
  key:
    | 'water'
    | 'soil_nitrogen'
    | 'erosion'
    | 'income'
    | 'food'
    | 'labour';
  label: string;
  helper?: string;
  cells: Record<string, ComparisonCell>;
}

export interface ComparisonColumn {
  key: string;
  roleLabel: string; // e.g., "Recommended", "Top Candidate", "Alternative", "Current Practice"
  optionLabel: string; // e.g., "Option A", "Option C", "Current"
  isHighlighted: boolean;
  isConditional: boolean;
  strategy: Strategy | null;
}

export interface StrategyComparisonModel {
  primaryColumns: ComparisonColumn[]; // 3 columns matching PDF Pages 4 & 5
  allColumns: ComparisonColumn[]; // Includes all returned options (Current, A, B, C)
  rows: ComparisonCriterionRow[];
  extraStrategies: Strategy[]; // Any candidate not shown in primary 3 columns
  recommendedStrategy: Strategy | null;
}

function getCriterion(strategy: Strategy | null | undefined, name: string): StrategyCriterion | undefined {
  if (!strategy || strategy.score === null || strategy.score === undefined) return undefined;
  return strategy.criteria?.find((c) => c.name === name);
}

function isUnscored(strategy: Strategy | null | undefined): boolean {
  return (
    !strategy ||
    strategy.score === null ||
    strategy.score === undefined ||
    strategy.recommendation_status === 'not_recommended'
  );
}

function buildWaterCell(strategy: Strategy | null | undefined): ComparisonCell {
  if (!strategy) {
    return { label: 'Information unavailable', tone: 'muted', score: null };
  }
  if (isUnscored(strategy)) {
    return {
      label: 'Not assessed',
      sublabel: strategy.recommendation_status === 'not_recommended' ? 'Limit violated' : undefined,
      tone: 'muted',
      score: null,
    };
  }
  const crit = getCriterion(strategy, 'water');
  if (!crit) return { label: 'Not assessed', tone: 'muted', score: null };

  const s = Math.round(crit.score);
  // Higher backend water score = lower water demand / better dry-spell resilience
  if (s >= 65) {
    return { label: 'Low Demand', sublabel: `Score ${s}/100`, tone: 'positive', score: s };
  }
  if (s >= 45) {
    return { label: 'Moderate', sublabel: `Score ${s}/100`, tone: 'neutral', score: s };
  }
  return { label: 'High Sensitivity', sublabel: `Score ${s}/100`, tone: 'warning', score: s };
}

function buildSoilNitrogenCell(strategy: Strategy | null | undefined): ComparisonCell {
  if (!strategy) {
    return { label: 'Information unavailable', tone: 'muted', score: null };
  }
  if (isUnscored(strategy)) {
    return { label: 'Not assessed', tone: 'muted', score: null };
  }

  const nComp = strategy.soil_health_components?.nitrogen;
  const soilCrit = getCriterion(strategy, 'soil_health');

  if (nComp !== undefined && nComp !== null) {
    const pct = Math.round(nComp * 100);
    if (nComp >= 0.58) {
      return { label: 'Building', sublabel: `N balance ${pct}%`, tone: 'positive', score: pct };
    }
    if (nComp >= 0.45) {
      return { label: 'Neutral', sublabel: `N balance ${pct}%`, tone: 'neutral', score: pct };
    }
    return { label: 'Depleting', sublabel: `N balance ${pct}%`, tone: 'negative', score: pct };
  }

  if (soilCrit) {
    const s = Math.round(soilCrit.score);
    if (s >= 60) return { label: 'Building', sublabel: `Score ${s}/100`, tone: 'positive', score: s };
    if (s >= 45) return { label: 'Neutral', sublabel: `Score ${s}/100`, tone: 'neutral', score: s };
    return { label: 'Depleting', sublabel: `Score ${s}/100`, tone: 'negative', score: s };
  }

  return { label: 'Not assessed', tone: 'muted', score: null };
}

function buildErosionCell(strategy: Strategy | null | undefined): ComparisonCell {
  if (!strategy) {
    return { label: 'Information unavailable', tone: 'muted', score: null };
  }
  if (isUnscored(strategy)) {
    return { label: 'Not assessed', tone: 'muted', score: null };
  }

  const eComp = strategy.soil_health_components?.erosion;
  if (eComp !== undefined && eComp !== null) {
    const pct = Math.round(eComp * 100);
    if (eComp >= 0.55) {
      return { label: 'Strong', sublabel: `Cover ${pct}/100`, tone: 'positive', score: pct };
    }
    if (eComp >= 0.45) {
      return { label: 'Moderate', sublabel: `Cover ${pct}/100`, tone: 'neutral', score: pct };
    }
    return { label: 'Weak', sublabel: `Cover ${pct}/100`, tone: 'negative', score: pct };
  }

  return { label: 'Not assessed', tone: 'muted', score: null };
}

function buildIncomeCell(strategy: Strategy | null | undefined): ComparisonCell {
  if (!strategy) {
    return { label: 'Information unavailable', tone: 'muted', score: null };
  }
  if (isUnscored(strategy)) {
    return { label: 'Not assessed', tone: 'muted', score: null };
  }
  const crit = getCriterion(strategy, 'income');
  if (!crit) return { label: 'Not assessed', tone: 'muted', score: null };

  const s = Math.round(crit.score);
  if (s >= 62) {
    return {
      label: 'Higher Market Fit',
      sublabel: `Score ${s}/100`,
      tone: 'positive',
      score: s,
      stars: 3,
    };
  }
  if (s >= 48) {
    return {
      label: 'Moderate Cash Fit',
      sublabel: `Score ${s}/100`,
      tone: 'neutral',
      score: s,
      stars: 2,
    };
  }
  return {
    label: 'Lower Cash Fit',
    sublabel: `Score ${s}/100`,
    tone: 'warning',
    score: s,
    stars: 1,
  };
}

function buildFoodCell(strategy: Strategy | null | undefined): ComparisonCell {
  if (!strategy) {
    return { label: 'Information unavailable', tone: 'muted', score: null };
  }
  if (isUnscored(strategy)) {
    return { label: 'Not assessed', tone: 'muted', score: null };
  }
  const crit = getCriterion(strategy, 'food');
  if (!crit) return { label: 'Not assessed', tone: 'muted', score: null };

  const s = Math.round(crit.score);
  // Backend food score reflects crop food roles, NOT quantified yield/months of grain
  const fitText =
    s >= 78 ? 'Strong Food-Role Fit' : s >= 60 ? 'Good Food-Role Fit' : 'Moderate Food-Role Fit';
  return {
    label: fitText,
    sublabel: `Score ${s}/100 · yield not estimated`,
    tone: s >= 70 ? 'positive' : 'neutral',
    score: s,
    barPct: Math.max(8, Math.min(100, s)),
  };
}

function buildLabourCell(strategy: Strategy | null | undefined): ComparisonCell {
  if (!strategy) {
    return { label: 'Information unavailable', tone: 'muted', score: null };
  }
  if (isUnscored(strategy)) {
    return { label: 'Not assessed', tone: 'muted', score: null };
  }
  const crit = getCriterion(strategy, 'labour');
  if (!crit) return { label: 'Not assessed', tone: 'muted', score: null };

  const s = Math.round(crit.score);
  // Higher backend labour score = less labour required
  if (s >= 55) {
    return { label: 'Manageable', sublabel: `Ease ${s}/100`, tone: 'positive', score: s };
  }
  if (s >= 38) {
    return { label: 'Moderate', sublabel: `Ease ${s}/100`, tone: 'neutral', score: s };
  }
  return { label: 'Heavy', sublabel: `Ease ${s}/100`, tone: 'warning', score: s };
}

export function buildStrategyComparison(
  evaluationResult: BackendStrategyResponse | null | undefined
): StrategyComparisonModel {
  const strategies = evaluationResult?.strategies || [];
  const reference = evaluationResult?.reference_rotation || null;
  const readyId = evaluationResult?.suggestion?.ready_option;

  // Order candidates strictly by backend readiness first, then score (preserving backend ranking)
  const rankValue = (s: Strategy): number => {
    if (readyId && s.id === readyId) return 1000 + (s.score ?? 0);
    if (s.recommendation_status === 'feasible_candidate') return 800 + (s.score ?? 0);
    if (s.recommendation_status === 'conditional_candidate') return 500 + (s.score ?? 0);
    if (s.recommendation_status === 'not_recommended' || s.score === null) return -100;
    return s.score ?? 0;
  };

  const rankedCandidates = [...strategies].sort((a, b) => rankValue(b) - rankValue(a));
  const topCandidate = rankedCandidates[0] || null;
  const secondCandidate = rankedCandidates[1] || null;
  const extraStrategies = rankedCandidates.slice(2);

  const isTopReady = Boolean(
    topCandidate &&
      ((readyId && topCandidate.id === readyId) ||
        topCandidate.recommendation_status === 'feasible_candidate')
  );

  const primaryColumns: ComparisonColumn[] = [
    {
      key: topCandidate ? topCandidate.id : 'primary',
      roleLabel: isTopReady ? 'Recommended' : 'Top Candidate',
      optionLabel: topCandidate ? `Option ${topCandidate.id}` : 'Option A',
      isHighlighted: true,
      isConditional: !isTopReady && topCandidate?.recommendation_status === 'conditional_candidate',
      strategy: topCandidate,
    },
    {
      key: secondCandidate ? secondCandidate.id : 'alternative',
      roleLabel: 'Alternative',
      optionLabel: secondCandidate ? `Option ${secondCandidate.id}` : 'Option B',
      isHighlighted: false,
      isConditional: secondCandidate?.recommendation_status === 'conditional_candidate',
      strategy: secondCandidate,
    },
    {
      key: 'current',
      roleLabel: 'Current Practice',
      optionLabel: 'Current',
      isHighlighted: false,
      isConditional: false,
      strategy: reference,
    },
  ];

  const allColumns: ComparisonColumn[] = [
    ...rankedCandidates.map((s, idx) => ({
      key: s.id,
      roleLabel:
        idx === 0
          ? isTopReady
            ? 'Recommended'
            : 'Top Candidate'
          : `Alternative ${idx}`,
      optionLabel: `Option ${s.id}`,
      isHighlighted: idx === 0,
      isConditional: s.recommendation_status === 'conditional_candidate',
      strategy: s,
    })),
    {
      key: 'current',
      roleLabel: 'Current Practice',
      optionLabel: 'Current',
      isHighlighted: false,
      isConditional: false,
      strategy: reference,
    },
  ];

  const rows: ComparisonCriterionRow[] = [
    {
      key: 'water',
      label: 'Water Demand',
      cells: Object.fromEntries(
        allColumns.map((col) => [col.key, buildWaterCell(col.strategy)])
      ),
    },
    {
      key: 'soil_nitrogen',
      label: 'Soil Nitrogen Impact',
      cells: Object.fromEntries(
        allColumns.map((col) => [col.key, buildSoilNitrogenCell(col.strategy)])
      ),
    },
    {
      key: 'erosion',
      label: 'Erosion Resistance',
      cells: Object.fromEntries(
        allColumns.map((col) => [col.key, buildErosionCell(col.strategy)])
      ),
    },
    {
      key: 'income',
      label: 'Cash Income Potential',
      cells: Object.fromEntries(
        allColumns.map((col) => [col.key, buildIncomeCell(col.strategy)])
      ),
    },
    {
      key: 'food',
      label: 'Household Food Supply',
      cells: Object.fromEntries(
        allColumns.map((col) => [col.key, buildFoodCell(col.strategy)])
      ),
    },
    {
      key: 'labour',
      label: 'Labour Requirement',
      cells: Object.fromEntries(
        allColumns.map((col) => [col.key, buildLabourCell(col.strategy)])
      ),
    },
  ];

  return {
    primaryColumns,
    allColumns,
    rows,
    extraStrategies,
    recommendedStrategy: topCandidate,
  };
}

// ============================================================================
// Strategy Detail Structured Helpers (PDF Pages 1-3)
// ============================================================================

export interface WhyExplanationCard {
  id: string;
  tag: string;
  title: string;
  description: string;
  avoidsOrCost: string;
  gainOrBenefit: string;
  iconKey: 'soil' | 'water' | 'market';
}

export function buildWhyCards(strategy: Strategy): WhyExplanationCard[] {
  const criteria = strategy.criteria || [];
  const soilCrit = criteria.find((c) => c.name === 'soil_health');
  const waterCrit = criteria.find((c) => c.name === 'water');
  const foodCrit = criteria.find((c) => c.name === 'food');
  const incomeCrit = criteria.find((c) => c.name === 'income');
  const labourCrit = criteria.find((c) => c.name === 'labour');

  const benefits = strategy.benefits || [];
  const tradeOffs = strategy.trade_offs || [];
  const crops = strategy.sequence.map((s) => s.crop).join(' → ');
  const isCurrent = strategy.id === 'current';

  const soilBenefit = benefits.find((b) =>
    /nitrogen|legume|cereal follows|soil/i.test(b)
  );
  const waterBenefit = benefits.find((b) =>
    /water|dry|drought|rain/i.test(b)
  );
  const marketOrFoodBenefit = benefits.find((b) =>
    /market|food|income|labour/i.test(b)
  );

  // Card 1: Soil & Crop Rotation Cycle
  const legToCer = strategy.rotation_effects?.legume_to_cereal_transitions ?? 0;
  const repeats = strategy.rotation_effects?.repeat_transitions ?? 0;
  const soilCard: WhyExplanationCard = {
    id: 'soil-cycle',
    tag:
      strategy.sequence.length >= 2
        ? `Cycle (${strategy.sequence.length} seasons)`
        : 'Soil Cycle',
    title: isCurrent
      ? 'Baseline soil & repeat-crop pattern'
      : legToCer > 0 && repeats === 0
      ? 'Alternates legume and cereal seasons'
      : 'Soil balance across the sequence',
    description:
      soilBenefit ||
      (soilCrit?.reason
        ? soilCrit.reason.split('.')[0] + '.'
        : `Evaluates nitrogen balance and ground cover across ${crops || 'this sequence'}.`),
    avoidsOrCost:
      repeats > 0
        ? `${repeats} same-crop repeat transition`
        : tradeOffs.find((t) => /fertiliser|urea|nitrogen|soil/i.test(t))?.split('.')[0] ||
          'Requires residue & nutrient care',
    gainOrBenefit: soilCrit
      ? `Soil health score: ${Math.round(soilCrit.score)} / 100`
      : legToCer > 0
      ? `${legToCer} legume → cereal transition`
      : 'Baseline reference',
    iconKey: 'soil',
  };

  // Card 2: Water & Dry-Spell Exposure
  const waterCard: WhyExplanationCard = {
    id: 'water-fit',
    tag: 'Rain-fed climate fit',
    title:
      waterCrit && waterCrit.score >= 55
        ? 'Better tolerance to dry spells'
        : 'Dry-spell exposure during key growth stages',
    description:
      waterBenefit ||
      (waterCrit?.reason
        ? waterCrit.reason.split('.')[0] + '.'
        : 'Evaluated against area-wide NASA rainfall and 7-day July–September dry-spell records.'),
    avoidsOrCost:
      tradeOffs.find((t) => /water|dry|drought/i.test(t))?.split('.')[0] ||
      (waterCrit && waterCrit.score < 50
        ? 'Sensitive to mid-season dry spells'
        : 'Depends on timely rain onset'),
    gainOrBenefit: waterCrit
      ? `Water fit score: ${Math.round(waterCrit.score)} / 100`
      : 'Satellite context checked',
    iconKey: 'water',
  };

  // Card 3: Household Food, Market & Labour Fit
  const topDriver =
    foodCrit && foodCrit.score >= 70
      ? `Household food-role fit (${Math.round(foodCrit.score)}/100)`
      : incomeCrit
      ? `Market & input fit (${Math.round(incomeCrit.score)}/100)`
      : 'Household & market fit';

  const marketCard: WhyExplanationCard = {
    id: 'household-market',
    tag: 'Food, income & labour',
    title: isCurrent
      ? 'Familiar household food & market profile'
      : marketOrFoodBenefit
      ? marketOrFoodBenefit.split(';')[0]
      : 'Balances household food with market & labour limits',
    description:
      strategy.why ||
      [foodCrit?.reason?.split('.')[0], incomeCrit?.reason?.split('.')[0]]
        .filter(Boolean)
        .join('. ') ||
      'Scored against your stated household food, cash income, and labour priorities.',
    avoidsOrCost:
      tradeOffs.find((t) => /market|labour|seed|budget|cost/i.test(t))?.split('.')[0] ||
      (labourCrit && labourCrit.score < 45
        ? `Higher labour demand (ease ${Math.round(labourCrit.score)}/100)`
        : 'Confirm local input costs'),
    gainOrBenefit: topDriver,
    iconKey: 'market',
  };

  return [soilCard, waterCard, marketCard];
}

export interface ExpandableRiskItem {
  id: string;
  category: string;
  summary: string;
  isEvidenceGap: boolean;
  isHistoricalEvent: boolean;
  whyItMatters: string;
  affectedCrops: string;
  rotationRelation: string;
  supportingEvidence: string;
  possibleConsequences: string;
  localCheck: string;
  evidenceLimitations: string;
}

function extractRiskCategory(text: string): string {
  const low = text.toLowerCase();
  if (low.includes('1997') || low.includes('drought') || low.includes('flowering')) return 'Drought risk';
  if (low.includes('dry spell')) return 'Dry spell';
  if (low.includes('aflatoxin') || low.includes('storage') || low.includes('drying')) return 'Storage & safety';
  if (low.includes('monoculture') || low.includes('disease') || low.includes('repeated') || low.includes('carry-over')) {
    return 'Repeat crop';
  }
  if (low.includes('weaver') || low.includes('bird') || low.includes('thrips') || low.includes('maruca') || low.includes('pest')) {
    return 'Pests & labour';
  }
  if (low.includes('rule-of-thumb') || low.includes('exact numbers')) return 'Scoring limit';
  if (low.includes('evidence gap') || low.includes('without a source') || low.includes('no soil or yield')) {
    return 'Evidence gap';
  }
  return 'Local check';
}

function detectAffectedCrops(text: string, strategy: Strategy): string {
  const seqCrops = Array.from(new Set(strategy.sequence.map((s) => s.crop)));
  const mentioned = seqCrops.filter((c) => text.toLowerCase().includes(c.toLowerCase()));
  if (mentioned.length > 0) {
    return mentioned.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
  }
  return seqCrops.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(' & ') || 'Selected sequence';
}

export function buildExpandableRisks(
  strategy: Strategy,
  evaluationResult: BackendStrategyResponse | null | undefined,
  evidenceData: EvidenceData | null | undefined
): ExpandableRiskItem[] {
  const items: ExpandableRiskItem[] = [];
  const evidenceItems = strategy.evidence_items || [];
  const rawRisks = strategy.risks_for_local_review || [];
  const rawGaps = strategy.gaps || [];

  const imergSeasons =
    evidenceData?.evidence?.power_annual?.filter((p) => p.imerg.dry_spells_ge7_days && p.imerg.dry_spells_ge7_days > 0)
      .length ?? null;
  const totalSeasons = evidenceData?.evidence?.power_annual?.length ?? null;

  rawRisks.forEach((riskText, idx) => {
    const cleanText = riskText.replace(/\s*\([A-Z0-9,\s-]+\)\s*$/g, '').trim();
    const category = extractRiskCategory(cleanText);
    const low = cleanText.toLowerCase();
    const affected = detectAffectedCrops(cleanText, strategy);
    const isHistoricalEvent = /\b(1997|2002|trials|in the past)\b/i.test(cleanText);

    const matchingEvidence = evidenceItems.find(
      (ev) =>
        (low.includes('maize') && ev.statement.toLowerCase().includes('maize')) ||
        (low.includes('cowpea') && ev.statement.toLowerCase().includes('cowpea')) ||
        (low.includes('aflatoxin') && ev.statement.toLowerCase().includes('groundnut')) ||
        (low.includes('monoculture') && ev.statement.toLowerCase().includes('trials'))
    );

    let whyItMatters =
      'This condition directly affects whether the crops in this rotation perform reliably under local field and household conditions.';
    let possibleConsequences =
      'Lower harvest quality or unexpected losses if local field conditions do not match assumptions.';
    let localCheck =
      'Review this factor with experienced local farmers and your agricultural extension officer before planting.';
    let evidenceLimitations =
      'Based on available regional studies and pilot interviews rather than field-measured trials on your exact plot.';

    if (category === 'Drought risk' || category === 'Dry spell') {
      whyItMatters =
        'Moisture stress during flowering and grain filling can sharply reduce cereal and legume yields in rain-fed Gambian upland fields.';
      possibleConsequences =
        'Severe yield drop if a mid-season dry spell hits a sensitive crop growth stage.';
      localCheck =
        'Confirm planting timing with rain onset and ask locally about shorter-duration varieties or moisture-conserving ridges.';
      evidenceLimitations = isHistoricalEvent
        ? 'Historical weather events (such as 1997 maize losses) illustrate crop sensitivity from past records — they are NOT a forecast for this season.'
        : 'Rainfall and dry-spell records come from area-level satellite grids, not a rain gauge on your plot.';
    } else if (category === 'Storage & safety') {
      whyItMatters =
        'Improperly dried groundnut pods are prone to mould and aflatoxin contamination after harvest.';
      possibleConsequences =
        'Spoiled seed stock, household health risk, and rejected or lower-priced produce at market.';
      localCheck =
        'Confirm dry storage space, tarpaulins/racks for thorough sun-drying, and pest-safe bags before harvest.';
      evidenceLimitations =
        'Qualitative post-harvest risk from local/regional reports; individual household storage loss rates were not measured.';
    } else if (category === 'Repeat crop') {
      whyItMatters =
        'Growing the same crop family too frequently on one plot allows soil-borne pests, weeds, or foliar diseases to build up.';
      possibleConsequences =
        'Gradually declining yields and higher weeding or disease pressure across seasons.';
      localCheck =
        'Check whether past harvests on this field showed leafspot, root pests, or parasitic weeds (such as Striga).';
      evidenceLimitations =
        'West African monoculture trials observed lower legume yields, but the exact local cause on this field was not diagnosed.';
    } else if (category === 'Pests & labour') {
      whyItMatters =
        'Field pests (such as weaver birds on millet or thrips/Maruca on cowpea) demand timely labour or crop protection.';
      possibleConsequences =
        'Heavy grain or pod damage before harvest if household labour or controls are unavailable.';
      localCheck =
        'Confirm household availability for bird-scaring or pest management during grain fill / flowering.';
      evidenceLimitations =
        'Severity varies widely by village, planting date, and surrounding vegetation; local farmer observation is essential.';
    } else if (category === 'Scoring limit') {
      whyItMatters =
        'Decision-engine scores use rule-of-thumb priority weights to compare options side by side, not field measurements.';
      possibleConsequences =
        'Treating a small point difference (e.g. 2–3 points) as a guarantee could mislead farm planning.';
      localCheck =
        'Use the ranking as a discussion guide alongside seed availability, labour, and soil knowledge.';
      evidenceLimitations =
        'Does not predict harvest weight (kg/ha) or net profit (GMD).';
    }

    const drySpellContext =
      imergSeasons !== null && totalSeasons
        ? ` Satellite GPM IMERG data for this area recorded ≥7-day July–Sept dry spells in ${imergSeasons} of ${totalSeasons} seasons (area-level estimate).`
        : '';

    items.push({
      id: `risk-${idx}`,
      category,
      summary: cleanText,
      isEvidenceGap: false,
      isHistoricalEvent,
      whyItMatters,
      affectedCrops: affected,
      rotationRelation: `Appears in ${strategy.name} (${strategy.sequence.map((s) => s.crop).join(' → ')}).`,
      supportingEvidence: matchingEvidence
        ? `${matchingEvidence.statement}${drySpellContext}`
        : `${cleanText}${category === 'Drought risk' ? drySpellContext : ''}`,
      possibleConsequences,
      localCheck,
      evidenceLimitations,
    });
  });

  // Add concise evidence-gap items so evidence gaps are clearly represented without overwhelming rows
  const unverifiedTraitGap = rawGaps.find((g) =>
    g.toLowerCase().startsWith('crop traits without a source:')
  );
  const missingMeasurementsGap = rawGaps.find(
    (g) => g.toLowerCase().includes('no soil or yield measurements') || g.toLowerCase().includes('not from manduar')
  );
  const unconfirmedCrops = strategy.constraints?.unconfirmed_candidate_crops || [];

  if (unconfirmedCrops.length > 0) {
    items.push({
      id: 'risk-gap-seed',
      category: 'Seed access',
      summary: `Seed access and local suitability for ${unconfirmedCrops.join(', ')} are not yet confirmed for this field.`,
      isEvidenceGap: true,
      isHistoricalEvent: false,
      whyItMatters:
        'A rotation option cannot be planted reliably unless viable seed is locally obtainable before the rains.',
      affectedCrops: unconfirmedCrops.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(', '),
      rotationRelation: `Keeps Option ${strategy.id} marked Conditional until confirmed.`,
      supportingEvidence:
        strategy.constraints?.would_become_feasible_if?.join('; ') ||
        'Marked limited or unconfirmed in practical constraints.',
      possibleConsequences: 'Delays at planting time or inability to establish the full crop sequence.',
      localCheck: `Confirm with local seed dealers or your extension officer that ${unconfirmedCrops.join(', ')} seed is available.`,
      evidenceLimitations: 'Current pilot records only confirm groundnut and maize as widely grown on the pilot site.',
    });
  }

  if (unverifiedTraitGap || missingMeasurementsGap) {
    items.push({
      id: 'risk-gap-evidence',
      category: 'Evidence gap',
      summary:
        'Some crop traits, local costs, and field-level soil or yield measurements are missing, so cash returns and exact yields remain uncertain.',
      isEvidenceGap: true,
      isHistoricalEvent: false,
      whyItMatters:
        'Where local measurements are unavailable, the engine substitutes neutral or assumption-based scores covered by the score range.',
      affectedCrops: strategy.sequence.map((s) => s.crop).join(', '),
      rotationRelation: `Score range (${strategy.score_range ? `${strategy.score_range[0]}–${strategy.score_range[1]}` : 'N/A'}) reflects this uncertainty.`,
      supportingEvidence: [unverifiedTraitGap, missingMeasurementsGap].filter(Boolean).join(' '),
      possibleConsequences: 'Actual field performance and input costs may differ from regional averages.',
      localCheck: 'Verify current local seed/fertiliser prices and inspect topsoil condition directly on the plot.',
      evidenceLimitations:
        evaluationResult?.evidence_base?.note ||
        'Pilot evidence includes 1 farmer interview and 5 recorded fields; no plot-level soil lab test or yield trial.',
    });
  }

  return items;
}
