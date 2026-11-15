/**
 * AgroShift Gambia — Screen S6: Strategy Detail
 * Faithful to Pages 1–3 of the updated AgroShift UI reference PDF:
 *   - Top 3-tab strategy switcher (Current Rotation, Option A, Option B; keeping Option C accessible)
 *   - 4 primary horizontal tabs: Sequence, Why Suggested, Risks, Trade-offs
 *   - Sequence: Strategy badge + score/range header, horizontal crop timeline cards, Typical Gambian Rain-Fed Calendar
 *   - Why Suggested: 3-step rotation summary, 3 evidence-backed explanation cards, priority fit & confidence details
 *   - Risks: Numbered Risk Summary From Your Evidence with clickable/expandable detail panels & historical vs forecast clarity
 *   - Trade-offs: What you gain, What you give up, What to consider (dynamic per strategy)
 *
 * Strictly uses real backend strategy and environmental evidence data — zero fabricated content.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useAgroShift } from '../../context/AgroShiftContext';
import { Strategy, StrategyCriterion } from '../../types/agroshift';
import {
  buildExpandableRisks,
  buildWhyCards,
} from './strategyComparison';
import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Calendar,
  Check,
  X as XIcon,
  Sprout,
  Wheat,
  Droplet,
  Coins,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  Sliders,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';

const PRIMARY_TABS = [
  { id: 1, label: 'Sequence' },
  { id: 2, label: 'Why Suggested' },
  { id: 3, label: 'Risks' },
  { id: 4, label: 'Trade-offs' },
] as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatSeasonHeading(season?: string, year?: number | string, idx: number = 0): string {
  if (year !== undefined && year !== null && String(year).trim() !== '') {
    return `Season ${year}`;
  }
  if (season) {
    const clean = season.toLowerCase();
    if (clean === 'current_or_next') return `Season ${idx + 1}`;
    if (clean === 'following_season') return `Season ${idx + 1}`;
    return `Season ${idx + 1} · ${season.replace(/_/g, ' ')}`;
  }
  return `Season ${idx + 1}`;
}

function getCropCardTheme(crop: string, role?: string) {
  const lower = `${crop} ${role || ''}`.toLowerCase();
  if (
    lower.includes('groundnut') ||
    lower.includes('cowpea') ||
    lower.includes('legume') ||
    lower.includes('green manure')
  ) {
    return {
      cardBg: 'bg-[#eef8f1] border-[#9fd7b2]',
      iconBg: 'bg-[#116b37] text-white',
      Icon: Sprout,
      roleFallback: 'Legume Crop',
    };
  }
  return {
    cardBg: 'bg-[#fef9ec] border-[#f3dc9f]',
    iconBg: 'bg-[#e37d10] text-white',
    Icon: Wheat,
    roleFallback: 'Cereal Crop',
  };
}

function getStatusLabel(status?: string): { label: string; classes: string } {
  if (status === 'reference') {
    return {
      label: 'Existing Practice (Baseline)',
      classes: 'bg-gray-100 text-gray-800 border-gray-200',
    };
  }
  if (status === 'feasible_candidate') {
    return {
      label: 'Ready to Consider',
      classes: 'bg-[#eef8f1] text-[#116b37] border-[#b7dfc4]',
    };
  }
  if (status === 'conditional_candidate') {
    return {
      label: 'Conditional · Confirm Locally',
      classes: 'bg-amber-50 text-amber-900 border-amber-200',
    };
  }
  if (status === 'not_recommended') {
    return {
      label: 'Not Recommended (Limit Violated)',
      classes: 'bg-red-50 text-red-800 border-red-200',
    };
  }
  return {
    label: 'Candidate Strategy',
    classes: 'bg-gray-100 text-gray-800 border-gray-200',
  };
}

function simplifyCriterionLabel(c: StrategyCriterion): string {
  const n = c.name.toLowerCase();
  if (n.includes('water')) return 'Water & drought fit';
  if (n.includes('soil')) return 'Soil health support';
  if (n.includes('food')) return 'Household food-role fit';
  if (n.includes('income')) return 'Market & input cost fit';
  if (n.includes('labour') || n.includes('labor')) return 'Labour ease';
  return c.label;
}

function capFirst(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const StrategyDetailScreen: React.FC = () => {
  const {
    evaluationResult,
    evidenceData,
    selectedStrategyId,
    setSelectedStrategyId,
    activeDetailSection,
    setActiveDetailSection,
    goToStep,
    runEvaluation,
  } = useAgroShift();

  const [expandedRiskId, setExpandedRiskId] = useState<string | null>(null);
  const [showPriorityBreakdown, setShowPriorityBreakdown] = useState<boolean>(false);
  const [showEvidenceList, setShowEvidenceList] = useState<boolean>(false);

  // Normalize section index to 1..4
  const currentTab = activeDetailSection >= 1 && activeDetailSection <= 4 ? activeDetailSection : 1;

  useEffect(() => {
    if (activeDetailSection < 1 || activeDetailSection > 4) {
      setActiveDetailSection(1);
    }
  }, [activeDetailSection, setActiveDetailSection]);

  // Reset expanded risk when switching strategies
  useEffect(() => {
    setExpandedRiskId(null);
  }, [selectedStrategyId]);

  const strategies = evaluationResult?.strategies || [];
  const reference = evaluationResult?.reference_rotation || null;

  const optionA = strategies.find((s) => s.id === 'A') ?? strategies[0];
  const optionB = strategies.find((s) => s.id === 'B') ?? strategies.find((s) => s !== optionA);
  const optionC = strategies.find((s) => s.id === 'C') ?? strategies.find((s) => s !== optionA && s !== optionB);

  const activeStrategy: Strategy | null = useMemo(() => {
    if (!evaluationResult) return null;
    if (selectedStrategyId === 'current' && reference) return reference;
    return strategies.find((s) => s.id === selectedStrategyId) || optionA || reference || null;
  }, [evaluationResult, selectedStrategyId, reference, strategies, optionA]);

  if (!evaluationResult) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
          <Sliders className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Strategy Breakdown Unavailable</h3>
        <p className="text-base font-normal text-gray-600 max-w-md mx-auto leading-relaxed">
          Run the analysis to review each crop rotation sequence, supporting reasons, risks, and trade-offs.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => goToStep('priorities-limits')}
            className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 rounded-lg text-sm font-medium transition cursor-pointer"
          >
            Review Priorities &amp; Limits
          </button>
          <button
            type="button"
            onClick={() => runEvaluation()}
            className="px-6 py-2.5 bg-[#116b37] hover:bg-[#0d542b] text-white rounded-lg text-sm font-semibold transition cursor-pointer"
          >
            Run Analysis Now
          </button>
        </div>
      </div>
    );
  }

  if (!activeStrategy) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-base text-gray-600">
        No strategies were returned for this field.
      </div>
    );
  }

  const isCurrentBaseline = activeStrategy.id === 'current';
  const statusInfo = getStatusLabel(isCurrentBaseline ? 'reference' : activeStrategy.recommendation_status);
  const whyCards = buildWhyCards(activeStrategy);
  const expandableRisks = buildExpandableRisks(activeStrategy, evaluationResult, evidenceData);

  // Build 3-slot strategy tabs matching PDF Page 1 (keeping Option C cleanly accessible if selected or returned)
  const thirdTabStrategy = selectedStrategyId === 'C' && optionC ? optionC : optionB;
  const strategyTabs: Array<{ id: Strategy['id']; label: string; score: number | null }> = [
    ...(reference
      ? [{ id: 'current' as const, label: 'Current Rotation', score: reference.score }]
      : []),
    ...(optionA
      ? [{ id: optionA.id, label: `Option ${optionA.id}`, score: optionA.score }]
      : []),
    ...(thirdTabStrategy
      ? [{ id: thirdTabStrategy.id, label: `Option ${thirdTabStrategy.id}`, score: thirdTabStrategy.score }]
      : []),
  ];

  // Trade-off groupings for Tab 4
  const gainsList: string[] = [
    ...(activeStrategy.benefits || []),
    ...(isCurrentBaseline && (activeStrategy.benefits || []).length === 0
      ? [
          'Familiar crops and seed channels already established on this field.',
          ...(activeStrategy.criteria || [])
            .filter((c) => c.score >= 65)
            .map((c) => `${simplifyCriterionLabel(c)} scored ${Math.round(c.score)}/100 in your current practice.`),
        ]
      : []),
  ];

  const giveUpsList: string[] = [
    ...(activeStrategy.trade_offs || []),
    ...(isCurrentBaseline && (activeStrategy.trade_offs || []).length === 0
      ? (activeStrategy.criteria || [])
          .filter((c) => c.score < 45)
          .map((c) => `${simplifyCriterionLabel(c)} scored ${Math.round(c.score)}/100, leaving room for improvement.`)
      : []),
  ];

  const considerList: string[] = Array.from(
    new Set([
      ...(activeStrategy.constraints?.failures || []).map((f) => `Limit exceeded: ${f}`),
      ...(activeStrategy.constraints?.conditions || []),
      ...(activeStrategy.constraints?.would_become_feasible_if || []).map((w) => `Confirm locally: ${w}`),
      ...(activeStrategy.status_note ? [activeStrategy.status_note] : []),
      ...(activeStrategy.gaps || [])
        .filter((g) => /manduar|measurements|evidence base/i.test(g))
        .slice(0, 2),
    ])
  );

  return (
    <div className="space-y-5">
      {/* 1. Strategy Selection Segmented Bar (PDF Page 1) */}
      <div className="space-y-2">
        <div
          className="bg-white border border-gray-200 rounded-xl p-1 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, strategyTabs.length)}, minmax(0, 1fr))` }}
          role="tablist"
          aria-label="Choose strategy"
        >
          {strategyTabs.map((tab) => {
            const isSelected = activeStrategy.id === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedStrategyId(tab.id)}
                className={`py-2.5 px-3 sm:px-4 rounded-lg text-sm font-semibold transition cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap ${
                  isSelected
                    ? 'bg-[#116b37] text-white shadow-xs'
                    : 'text-gray-800 hover:bg-gray-50'
                }`}
              >
                <span>{tab.label}</span>
                {tab.score !== null && tab.score !== undefined && (
                  <span
                    className={`text-xs tabular-nums font-medium ${
                      isSelected ? 'text-green-100' : 'text-gray-500'
                    }`}
                  >
                    ({Math.round(tab.score)})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Preserve access to Option C / Option B if >2 candidate strategies exist */}
        {optionC && optionB && (
          <div className="flex items-center justify-end text-xs text-gray-600 gap-2">
            <span>Additional backend option evaluated:</span>
            <button
              type="button"
              onClick={() => setSelectedStrategyId(selectedStrategyId === 'C' ? 'B' : 'C')}
              className="font-semibold text-[#116b37] hover:underline cursor-pointer"
            >
              {selectedStrategyId === 'C'
                ? `Switch to Option B (${optionB.score !== null ? `${Math.round(optionB.score)}/100` : 'Not scored'})`
                : `View Option C (${optionC.score !== null ? `${Math.round(optionC.score)}/100` : 'Not scored'})`}
            </button>
          </div>
        )}
      </div>

      {/* 2. Four Horizontal Section Tabs (PDF Pages 1–3) */}
      <div className="bg-white border border-gray-200 rounded-xl p-2 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3" role="tablist" aria-label="Strategy detail sections">
        {PRIMARY_TABS.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveDetailSection(tab.id)}
              className={`flex-1 min-w-[120px] py-2 px-4 rounded-lg text-sm font-semibold transition cursor-pointer border whitespace-nowrap ${
                isActive
                  ? 'bg-[#116b37] text-white border-[#116b37] shadow-xs'
                  : 'bg-white text-[#116b37] border-gray-300 hover:bg-[#f0f7f2]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: SEQUENCE (PDF Page 1)                                         */}
      {/* ==================================================================== */}
      {currentTab === 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 space-y-6">
          {/* Header with status badge, rotation title, score & range */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-5 border-b border-gray-200">
            <div className="space-y-1.5">
              <span
                className={`inline-block px-3 py-0.5 rounded-full text-xs font-medium border ${statusInfo.classes}`}
              >
                {isCurrentBaseline ? statusInfo.label : `Option ${activeStrategy.id} · ${statusInfo.label}`}
              </span>
              <h2 className="text-xl sm:text-[22px] font-semibold text-gray-900 leading-snug">
                {activeStrategy.name}
              </h2>
            </div>

            <div className="flex flex-col sm:items-end gap-1 shrink-0">
              <span
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold border tabular-nums ${
                  activeStrategy.recommendation_status === 'not_recommended'
                    ? 'bg-red-50 text-red-800 border-red-200'
                    : isCurrentBaseline
                    ? 'bg-gray-100 text-gray-800 border-gray-200'
                    : 'bg-[#eef8f1] text-[#116b37] border-[#b7dfc4]'
                }`}
              >
                {activeStrategy.score !== null && activeStrategy.score !== undefined
                  ? `Score: ${activeStrategy.score} / 100`
                  : 'Not scored (limit violated)'}
              </span>
              {activeStrategy.score_range && (
                <span className="text-xs text-gray-500 font-normal tabular-nums">
                  Score range: {activeStrategy.score_range[0]} – {activeStrategy.score_range[1]}
                </span>
              )}
            </div>
          </div>

          {/* Crop Sequence Timeline */}
          <div className="space-y-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#116b37]" />
                <span>Crop Sequence Timeline</span>
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {isCurrentBaseline
                  ? 'This is the crop sequence recorded for your field over recent seasons.'
                  : 'Follow this season-by-season crop order during the main rain-fed growing window.'}
              </p>
            </div>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {activeStrategy.sequence.map((item, idx) => {
                const theme = getCropCardTheme(item.crop, item.role);
                const CropIcon = theme.Icon;
                return (
                  <React.Fragment key={idx}>
                    <div className={`flex-1 p-5 sm:p-6 rounded-2xl border ${theme.cardBg} space-y-2.5`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-gray-600">
                          {formatSeasonHeading(item.season, item.year, idx)}
                        </span>
                        <span
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${theme.iconBg}`}
                        >
                          <CropIcon className="w-4 h-4" />
                        </span>
                      </div>
                      <p className="text-lg font-semibold text-gray-900 capitalize">{item.crop}</p>
                      <p className="text-sm text-gray-600 capitalize">
                        {item.role || theme.roleFallback}
                      </p>
                    </div>

                    {idx < activeStrategy.sequence.length - 1 && (
                      <>
                        <div className="hidden md:flex items-center justify-center text-gray-400 shrink-0 px-0.5">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                        <div className="flex md:hidden items-center justify-center text-gray-400">
                          <ArrowDown className="w-4 h-4" />
                        </div>
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {activeStrategy.sequence.length < 3 && (
              <p className="text-xs sm:text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
                This option defines a {activeStrategy.sequence.length}-season repeating cycle (Year 3 repeats Year 1).
              </p>
            )}
          </div>

          {/* Typical Gambian Rain-Fed Calendar */}
          <div className="p-5 bg-gray-50/70 rounded-2xl border border-gray-200 space-y-3">
            <p className="text-sm font-semibold text-gray-800">Typical Gambian Rain-Fed Calendar</p>
            <div className="grid grid-cols-12 gap-1 text-center text-xs text-gray-500">
              {MONTHS.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            <div className="grid grid-cols-12 gap-1.5 h-9">
              <div className="col-span-5 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-xs font-medium text-gray-600 px-2 text-center truncate">
                Dry Season (Fallow / Grazing)
              </div>
              <div className="col-span-5 bg-[#116b37] text-white rounded-lg flex items-center justify-center text-xs font-medium px-2 text-center truncate">
                Main Rains (Jun–Oct)
              </div>
              <div className="col-span-2 bg-[#fef9ec] border border-[#f3dc9f] rounded-lg flex items-center justify-center text-xs font-medium text-amber-900 px-1 text-center truncate">
                Harvest
              </div>
            </div>
          </div>

          {activeStrategy.rotation_effects && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="px-4 py-3 rounded-xl bg-[#f4faf6] border border-[#d6ebd9] flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Legume → Cereal transitions</span>
                <span className="font-semibold text-[#116b37] tabular-nums">
                  {activeStrategy.rotation_effects.legume_to_cereal_transitions} per cycle
                </span>
              </div>
              <div className="px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">Same-crop repeat transitions</span>
                <span className="font-semibold text-gray-900 tabular-nums">
                  {activeStrategy.rotation_effects.repeat_transitions} per cycle
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: WHY SUGGESTED (PDF Page 2)                                    */}
      {/* ==================================================================== */}
      {currentTab === 2 && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 space-y-6">
            <div>
              <h2 className="text-xl sm:text-[22px] font-semibold text-gray-900">
                {isCurrentBaseline
                  ? 'Why Your Current Practice Is Scored as the Baseline'
                  : activeStrategy.recommendation_status === 'not_recommended'
                  ? 'Why This Rotation Was Not Recommended'
                  : 'Why This Rotation Works for Your Field'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Your rotation sequence and key reasons from your field evidence
              </p>
            </div>

            {/* Horizontal Sequence Summary Row */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {activeStrategy.sequence.map((item, idx) => {
                const theme = getCropCardTheme(item.crop, item.role);
                const CropIcon = theme.Icon;
                return (
                  <React.Fragment key={idx}>
                    <div
                      className={`flex-1 px-4 py-3.5 rounded-xl border flex items-center gap-3.5 ${
                        idx === 1 && !isCurrentBaseline
                          ? 'bg-[#eef8f1] border-[#9fd7b2]'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <span
                        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                          idx === 1 && !isCurrentBaseline
                            ? 'bg-[#116b37] text-white'
                            : 'bg-gray-100 text-[#116b37]'
                        }`}
                      >
                        <CropIcon className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <span className="text-xs text-gray-500 block">
                          {formatSeasonHeading(item.season, item.year, idx)}
                        </span>
                        <span className="text-base font-semibold text-gray-900 capitalize block truncate">
                          {item.crop}
                        </span>
                        <span className="text-xs text-gray-600 capitalize block truncate">
                          {item.role || theme.roleFallback}
                        </span>
                      </div>
                    </div>

                    {idx < activeStrategy.sequence.length - 1 && (
                      <>
                        <div className="hidden md:flex items-center justify-center text-gray-400 shrink-0">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                        <div className="flex md:hidden items-center justify-center text-gray-400">
                          <ArrowDown className="w-4 h-4" />
                        </div>
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Three Explanation Cards (PDF Page 2 grid) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {whyCards.map((card) => {
                const CardIcon =
                  card.iconKey === 'soil'
                    ? Sprout
                    : card.iconKey === 'water'
                    ? Droplet
                    : Coins;
                const iconStyle =
                  card.iconKey === 'soil'
                    ? 'bg-[#eef8f1] text-[#116b37]'
                    : card.iconKey === 'water'
                    ? 'bg-sky-50 text-sky-700'
                    : 'bg-amber-50 text-[#e37d10]';

                return (
                  <div
                    key={card.id}
                    className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`w-9 h-9 rounded-full flex items-center justify-center ${iconStyle}`}>
                          <CardIcon className="w-4 h-4" />
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                          {card.tag}
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-gray-900 leading-snug">
                        {card.title}
                      </h3>
                      <p className="text-sm text-gray-600 leading-relaxed">
                        {card.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 space-y-1.5 text-xs sm:text-sm">
                      <p className="flex items-start gap-2 text-gray-600">
                        <XIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                        <span>{card.avoidsOrCost}</span>
                      </p>
                      <p className="flex items-start gap-2 font-semibold text-[#116b37]">
                        <Check className="w-4 h-4 text-[#116b37] shrink-0 mt-0.5" />
                        <span>{card.gainOrBenefit}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Condition / Status Note if applicable */}
            {activeStrategy.status_note && (
              <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-3 text-sm text-amber-950">
                <AlertTriangle className="w-4 h-4 text-[#ea7b15] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Status note: </span>
                  <span>{activeStrategy.status_note}</span>
                </div>
              </div>
            )}

            {/* Supporting Priority Scores & Evidence Toggles (keeps all backend detail accessible without cluttering) */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-100 text-sm">
              {(activeStrategy.criteria || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPriorityBreakdown((p) => !p)}
                  className="text-[#116b37] font-semibold hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>
                    {showPriorityBreakdown ? 'Hide priority score breakdown' : 'View priority score breakdown & confidence'}
                  </span>
                  {showPriorityBreakdown ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}

              {(activeStrategy.evidence_items || []).length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowEvidenceList((p) => !p)}
                  className="text-gray-700 font-medium hover:text-gray-900 hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-gray-500" />
                  <span>
                    {showEvidenceList
                      ? 'Hide source citations'
                      : `View source citations (${activeStrategy.evidence_items?.length})`}
                  </span>
                  {showEvidenceList ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              )}
            </div>

            {showPriorityBreakdown && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-900">
                    Criterion Scores ({activeStrategy.confidence} confidence)
                  </h4>
                  {activeStrategy.confidence_detail?.trait_support_share !== undefined && (
                    <span className="text-xs text-gray-600 tabular-nums">
                      {Math.round(activeStrategy.confidence_detail.trait_support_share * 100)}% crop traits backed by source
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {activeStrategy.criteria.map((c) => {
                    const pct = Math.max(0, Math.min(100, Math.round(c.score)));
                    return (
                      <div key={c.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs sm:text-sm">
                          <span className="font-medium text-gray-800">{simplifyCriterionLabel(c)}</span>
                          <span className="font-semibold text-gray-900 tabular-nums">{c.score} / 100</span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct >= 65 ? 'bg-[#116b37]' : pct >= 45 ? 'bg-[#ea7b15]' : 'bg-red-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        {c.reason && <p className="text-xs text-gray-600 leading-relaxed">{c.reason}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {showEvidenceList && (activeStrategy.evidence_items || []).length > 0 && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 divide-y divide-gray-200">
                {activeStrategy.evidence_items?.map((ev, i) => (
                  <div key={ev.id || i} className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-sm">
                    <p className="text-gray-800 leading-relaxed">{capFirst(ev.statement)}</p>
                    {ev.source_ids && ev.source_ids.length > 0 && (
                      <span className="text-xs font-mono text-gray-500 shrink-0">
                        [{ev.source_ids.join(', ')}]
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: RISKS (PDF Page 3 — Expandable Evidence-Backed List)          */}
      {/* ==================================================================== */}
      {currentTab === 3 && (
        <div className="bg-[#f8faf8] rounded-2xl border border-gray-200 p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-[22px] font-semibold text-gray-900">
                Risk summary from your evidence
              </h2>
              <p className="text-sm text-gray-600 mt-0.5">
                Click any item to inspect why it matters, supporting records, and what to verify locally.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-gray-200/70 text-gray-700 text-xs font-medium capitalize">
              {activeStrategy.confidence} confidence · draft summary
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
            {expandableRisks.length > 0 ? (
              expandableRisks.map((risk, idx) => {
                const isOpen = expandedRiskId === risk.id;
                return (
                  <div key={risk.id} className="transition-colors">
                    <button
                      type="button"
                      onClick={() => setExpandedRiskId(isOpen ? null : risk.id)}
                      aria-expanded={isOpen}
                      className="w-full px-5 py-4 flex items-start justify-between gap-4 text-left hover:bg-gray-50/70 transition cursor-pointer"
                    >
                      <div className="flex items-start gap-3.5 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 text-xs font-semibold text-gray-700 flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                          {idx + 1}
                        </span>
                        <p className="text-sm sm:text-base text-gray-800 leading-relaxed">
                          <strong className="font-semibold text-gray-900">{risk.category}.</strong>{' '}
                          {risk.summary}
                        </p>
                      </div>
                      <span className="text-gray-400 shrink-0 mt-1">
                        {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-5 pt-1 pl-14 bg-gray-50/60 border-t border-gray-100 space-y-3 text-sm">
                        {risk.isHistoricalEvent && (
                          <div className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-900 bg-sky-50 border border-sky-200 rounded-md px-2.5 py-1">
                            <Info className="w-3.5 h-3.5 text-sky-700" />
                            <span>Historical record — illustrates past sensitivity, not a weather forecast.</span>
                          </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Why it matters
                            </p>
                            <p className="text-gray-800 mt-0.5 leading-relaxed">{risk.whyItMatters}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Affected crop(s) &amp; rotation link
                            </p>
                            <p className="text-gray-800 mt-0.5 leading-relaxed">
                              <span className="font-medium">{risk.affectedCrops}:</span> {risk.rotationRelation}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Supporting evidence
                            </p>
                            <p className="text-gray-800 mt-0.5 leading-relaxed">{risk.supportingEvidence}</p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              What to check locally
                            </p>
                            <p className="text-[#116b37] font-medium mt-0.5 leading-relaxed">
                              {risk.localCheck}
                            </p>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-gray-200/70 text-xs text-gray-600 leading-relaxed">
                          <span className="font-semibold text-gray-700">Evidence limitation: </span>
                          {risk.evidenceLimitations}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-sm text-gray-600">
                No specific risks were returned for this strategy. Confirm seed availability and soil readiness locally.
              </div>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Based on available field, satellite, and research evidence. Not an official extension list.
          </p>
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: TRADE-OFFS (What You Gain / Give Up / Consider)               */}
      {/* ==================================================================== */}
      {currentTab === 4 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 space-y-6">
          <div>
            <h2 className="text-xl sm:text-[22px] font-semibold text-gray-900">
              Trade-offs for {isCurrentBaseline ? 'Current Rotation' : `Option ${activeStrategy.id}`}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Practical benefits, compromises, and local conditions to weigh before choosing {activeStrategy.name}.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
            {/* 1. What you gain */}
            <div className="rounded-2xl border border-[#b7dfc4] bg-[#f4faf6] p-5 space-y-3">
              <div className="flex items-center gap-2 text-base font-semibold text-[#116b37]">
                <Check className="w-5 h-5 shrink-0" />
                <span>What you gain</span>
              </div>
              {gainsList.length > 0 ? (
                <ul className="space-y-2.5 text-sm text-gray-800 leading-relaxed">
                  {gainsList.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-[#116b37] shrink-0 mt-1" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-600">
                  No comparative advantages above the baseline were recorded in the available data.
                </p>
              )}
            </div>

            {/* 2. What you give up */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-5 space-y-3">
              <div className="flex items-center gap-2 text-base font-semibold text-amber-900">
                <AlertTriangle className="w-5 h-5 text-[#ea7b15] shrink-0" />
                <span>What you give up</span>
              </div>
              {giveUpsList.length > 0 ? (
                <ul className="space-y-2.5 text-sm text-gray-800 leading-relaxed">
                  {giveUpsList.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ea7b15] shrink-0 mt-2" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-600">
                  No major comparative trade-offs were flagged for this option.
                </p>
              )}
            </div>

            {/* 3. What to consider */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5 space-y-3">
              <div className="flex items-center gap-2 text-base font-semibold text-gray-900">
                <Info className="w-5 h-5 text-sky-700 shrink-0" />
                <span>What to consider</span>
              </div>
              {considerList.length > 0 ? (
                <ul className="space-y-2.5 text-sm text-gray-800 leading-relaxed">
                  {considerList.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-700 shrink-0 mt-2" />
                      <span>{capFirst(item)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-600">
                  Confirm local seed supply, planting timing, and household labour before the rains begin.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Footer Navigation (PDF Pages 1–3) */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={() => goToStep('strategies')}
          className="px-5 py-2.5 bg-white hover:bg-gray-50 text-[#116b37] border border-gray-200 rounded-lg text-sm font-semibold transition flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Options</span>
        </button>

        <button
          type="button"
          onClick={() => goToStep('compare-report')}
          className="px-6 py-2.5 bg-[#116b37] hover:bg-[#0d542b] text-white rounded-lg text-sm font-semibold transition flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <span>View Comparison</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
