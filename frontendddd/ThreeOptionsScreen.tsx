/**
 * AgroShift Gambia — Screen 7: Three Options
 * Restored to match Figma Page 7 three-card design (Current Rotation, Option A, Option B),
 * while preserving Option C accessibility, real backend criterion scores (zero fabricated fallbacks),
 * constraint failure / not_recommended disclosure, and the existing comparison/detail workflow.
 */

import React from 'react';
import { useAgroShift } from '../../context/AgroShiftContext';
import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  Check,
  AlertCircle,
  AlertTriangle,
  Sliders,
} from 'lucide-react';
import { Strategy, StrategyId } from '../../types/agroshift';
import { ensureThreeSeasonStrategy, formatMonthWindow } from '../../services/rotationNormalizer';

export const ThreeOptionsScreen: React.FC = () => {
  const {
    evaluationResult,
    goToStep,
    prevStep,
    setSelectedStrategyId,
    setActiveDetailSection,
    cropHistory,
    runEvaluation,
  } = useAgroShift();

  if (!evaluationResult) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[#fdf3e7] border border-amber-200 text-[#b45309] flex items-center justify-center mx-auto">
          <Sliders className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">No Rotation Analysis Run Yet</h3>
        <p className="text-base font-normal text-gray-600 max-w-md mx-auto leading-relaxed">
          Review your field details, priorities, and practical limits, then run the FastAPI decision engine to compare rotation strategies against your current practice.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            onClick={() => goToStep('priorities-limits')}
            className="px-5 py-2.5 bg-white hover:bg-gray-50 text-[#116b37] border border-gray-200 rounded-lg text-sm sm:text-base font-medium transition cursor-pointer"
          >
            Back to Priorities &amp; Limits
          </button>
          <button
            onClick={() => runEvaluation()}
            className="px-6 py-2.5 bg-[#116b37] hover:bg-[#0d542b] text-white rounded-lg text-sm sm:text-base font-semibold transition cursor-pointer"
          >
            Start Analysis
          </button>
        </div>
      </div>
    );
  }

  const strategies = (evaluationResult.strategies || []).map(ensureThreeSeasonStrategy);
  const reference = evaluationResult.reference_rotation
    ? ensureThreeSeasonStrategy(evaluationResult.reference_rotation)
    : null;
  const suggestion = evaluationResult.suggestion;
  const isFallbackOnly = evaluationResult.recommendation_status === 'fallback_only';

  // Preserve backend identifiers for Figma's three primary cards + optional Option C extension
  const optionA = strategies.find((s) => s.id === 'A') ?? strategies[0];
  const optionB =
    strategies.find((s) => s.id === 'B') ?? strategies.find((s) => s !== optionA);
  const optionC =
    strategies.find((s) => s.id === 'C') ??
    strategies.find((s) => s !== optionA && s !== optionB);

  const handleViewDetails = (id: StrategyId) => {
    setSelectedStrategyId(id);
    setActiveDetailSection(1);
    goToStep('strategy-detail');
  };

  // Extract genuine backend indicator values — return '—' if not evaluated or not returned
  const formatScore = (val: number | null | undefined): string => {
    if (val === null || val === undefined || Number.isNaN(val)) return '—';
    return `${Math.round(val)}/100`;
  };

  const getStrategyIndicators = (strategy: Strategy | null | undefined) => {
    if (!strategy || strategy.recommendation_status === 'not_recommended' || strategy.score === null) {
      return {
        soilHealth: 'Not scored',
        waterUse: 'Not scored',
        erosionRisk: 'Not scored',
      };
    }

    const soilCrit = strategy.criteria?.find((c) => c.name === 'soil_health')?.score;
    const waterCrit = strategy.criteria?.find((c) => c.name === 'water')?.score;
    const erosionComponent = strategy.soil_health_components?.erosion;

    return {
      soilHealth: formatScore(soilCrit),
      waterUse: formatScore(waterCrit),
      erosionRisk:
        erosionComponent !== null && erosionComponent !== undefined
          ? `${Math.round(erosionComponent * 100)}/100`
          : '—',
    };
  };

  const getStatusLabel = (status?: string) => {
    if (status === 'feasible_candidate') return 'Feasible';
    if (status === 'conditional_candidate') return 'Conditional';
    if (status === 'not_recommended') return 'Not recommended';
    return null;
  };

  const currentSeq = [
    reference?.sequence?.[0]?.crop || cropHistory.season_1 || '—',
    reference?.sequence?.[1]?.crop || cropHistory.season_2 || '—',
    reference?.sequence?.[2]?.crop || cropHistory.season_3 || '—',
  ];

  const currentIndicators = getStrategyIndicators(reference);

  const renderCandidateCard = (
    strategy: Strategy | undefined,
    fallbackTitle: string,
    variant: 'orange' | 'green'
  ) => {
    const isOrange = variant === 'orange';
    const headerBg = isOrange ? 'bg-[#ea7b15]' : 'bg-[#116b37]';
    const titleText = isOrange ? 'text-gray-900' : 'text-white';
    const subtitleText = isOrange ? 'text-gray-900/80' : 'text-green-100';
    const btnClasses = isOrange
      ? 'bg-[#fdf3e7] hover:bg-[#fae6cf] text-[#b45309]'
      : 'bg-[#edf5ef] hover:bg-[#e1efe5] text-[#116b37]';

    const seqItems = strategy?.sequence || [];

    const isNotRecommended =
      strategy?.recommendation_status === 'not_recommended' || strategy?.score === null;
    const statusLabel = getStatusLabel(strategy?.recommendation_status);
    const indicators = getStrategyIndicators(strategy);

    return (
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col justify-between">
        <div>
          {/* Card Header */}
          <div className={`${headerBg} px-6 py-5 min-h-[96px] flex flex-col justify-between`}>
            <div className="flex items-start justify-between gap-2">
              <h2 className={`text-lg font-semibold ${titleText}`}>
                {strategy ? `Option ${strategy.id}` : fallbackTitle}
              </h2>
              {statusLabel && (
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 ${
                    isNotRecommended
                      ? 'bg-red-100 text-red-900'
                      : isOrange
                      ? 'bg-white/90 text-gray-900'
                      : 'bg-white text-[#116b37]'
                  }`}
                >
                  {statusLabel}
                </span>
              )}
            </div>
            <div className="flex items-center justify-between gap-2 mt-1.5">
              <p className={`text-sm font-normal ${subtitleText}`}>Alternative rotation</p>
              {strategy && (
                <span className={`text-sm font-semibold tabular-nums ${titleText}`}>
                  {isNotRecommended ? 'Not scored' : `${strategy.score}/100`}
                </span>
              )}
            </div>
          </div>

          {/* Card Body */}
          <div className="p-6 space-y-5">
            <div className="pb-4 border-b border-gray-100 space-y-1.5">
              <p className="text-sm font-normal text-gray-600 leading-relaxed">
                Alternative rotation based on your priorities.
              </p>
              {strategy?.name && (
                <p className="text-sm font-semibold text-gray-900">{strategy.name}</p>
              )}
            </div>

            {/* Season 1 -> Season 2 -> Season 3 (Complete 3-Season Cycle) */}
            <div className="space-y-2.5 text-center py-1">
              {[0, 1, 2].map((idx) => {
                const item = seqItems[idx];
                const cropLabel = item?.crop || 'Groundnut';
                const metaLine = item
                  ? `${item.type} · ${formatMonthWindow(item.month_start, item.month_end)}`
                  : '';
                return (
                  <React.Fragment key={idx}>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Season {idx + 1}</p>
                      <p className="text-base font-medium text-gray-800 mt-1">{cropLabel}</p>
                      {metaLine && (
                        <p className="text-xs font-normal text-gray-500 mt-0.5">{metaLine}</p>
                      )}
                    </div>
                    {idx < 2 && (
                      <div className="flex justify-center text-[#116b37]">
                        <ArrowDown className="w-4 h-4" />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Constraint violation warning if not_recommended */}
            {isNotRecommended && strategy && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-sm font-normal text-red-900 space-y-1 leading-relaxed">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Not scored (limit violated)</span>
                </div>
                {strategy.constraints?.failures && strategy.constraints.failures.length > 0 ? (
                  <p className="text-red-800">{strategy.constraints.failures.join(' ')}</p>
                ) : (
                  <p className="text-red-800">{strategy.status_note || 'Limit violated.'}</p>
                )}
              </div>
            )}

            {/* Indicators: Soil health, Water use, Erosion risk */}
            <div className="border-t border-gray-100 pt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between text-gray-700">
                <span className="flex items-center gap-2 font-normal">
                  <Check className="w-4 h-4 text-[#116b37] shrink-0" />
                  <span>Soil health</span>
                </span>
                <span className="font-medium text-gray-900 tabular-nums">{indicators.soilHealth}</span>
              </div>

              <div className="flex items-center justify-between text-gray-700">
                <span className="flex items-center gap-2 font-normal">
                  <Check className="w-4 h-4 text-[#116b37] shrink-0" />
                  <span>Water use</span>
                </span>
                <span className="font-medium text-gray-900 tabular-nums">{indicators.waterUse}</span>
              </div>

              <div className="flex items-center justify-between text-gray-700">
                <span className="flex items-center gap-2 font-normal">
                  <Check className="w-4 h-4 text-[#116b37] shrink-0" />
                  <span>Erosion risk</span>
                </span>
                <span className="font-medium text-gray-900 tabular-nums">{indicators.erosionRisk}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Button */}
        <div className="p-6 pt-0">
          <button
            onClick={() => strategy && handleViewDetails(strategy.id)}
            disabled={!strategy}
            className={`w-full py-2.5 rounded-lg text-sm font-semibold transition cursor-pointer disabled:opacity-50 ${btnClasses}`}
          >
            View Details
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Static Fallback Warning Banner (only if static fallback mode is active) */}
      {isFallbackOnly && (
        <div className="bg-[#fdf3e7] border border-amber-200 rounded-xl p-4 flex items-start gap-3 text-sm font-normal text-amber-950">
          <AlertTriangle className="w-4 h-4 text-[#ea7b15] shrink-0 mt-1" />
          <p className="leading-relaxed">
            <strong className="font-semibold">Static Demonstration Fallback:</strong> Showing placeholder records because live evaluation did not complete.
          </p>
        </div>
      )}

      {/* Three Strategy Cards (Figma Page 7) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* CARD 1 — Current Rotation */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden flex flex-col justify-between">
          <div>
            {/* Dark green header */}
            <div className="bg-[#116b37] text-white px-6 py-5 min-h-[96px] flex flex-col justify-between">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-lg font-semibold text-white">Current Rotation</h2>
                {reference?.score !== null && reference?.score !== undefined && (
                  <span className="text-sm font-semibold text-white tabular-nums">
                    {reference.score}/100
                  </span>
                )}
              </div>
              <div>
                <span className="inline-block bg-white text-[#116b37] text-xs font-medium px-3 py-0.5 rounded-full">
                  Reference
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5">
              <div className="pb-4 border-b border-gray-100">
                <p className="text-sm font-normal text-gray-600 leading-relaxed">
                  Your current practice for this field.
                </p>
              </div>

              {/* Season 1 -> Season 2 -> Season 3 (Complete 3-Season Cycle) */}
              <div className="space-y-2.5 text-center py-1">
                {[0, 1, 2].map((idx) => {
                  const item = reference?.sequence?.[idx];
                  const cropLabel = item?.crop || currentSeq[idx];
                  const metaLine = item
                    ? `${item.type} · ${formatMonthWindow(item.month_start, item.month_end)}`
                    : '';
                  return (
                    <React.Fragment key={idx}>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Season {idx + 1}</p>
                        <p className="text-base font-medium text-gray-800 mt-1 capitalize">{cropLabel}</p>
                        {metaLine && (
                          <p className="text-xs font-normal text-gray-500 mt-0.5">{metaLine}</p>
                        )}
                      </div>
                      {idx < 2 && (
                        <div className="flex justify-center text-[#116b37]">
                          <ArrowDown className="w-4 h-4" />
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Indicators */}
              <div className="border-t border-gray-100 pt-4 space-y-2.5 text-sm">
                <div className="flex items-center justify-between text-gray-700">
                  <span className="flex items-center gap-2 font-normal">
                    <Check className="w-4 h-4 text-[#116b37] shrink-0" />
                    <span>Soil health</span>
                  </span>
                  <span className="font-medium text-gray-900 tabular-nums">{currentIndicators.soilHealth}</span>
                </div>

                <div className="flex items-center justify-between text-gray-700">
                  <span className="flex items-center gap-2 font-normal">
                    <Check className="w-4 h-4 text-[#116b37] shrink-0" />
                    <span>Water use</span>
                  </span>
                  <span className="font-medium text-gray-900 tabular-nums">{currentIndicators.waterUse}</span>
                </div>

                <div className="flex items-center justify-between text-gray-700">
                  <span className="flex items-center gap-2 font-normal">
                    <Check className="w-4 h-4 text-[#116b37] shrink-0" />
                    <span>Erosion risk</span>
                  </span>
                  <span className="font-medium text-gray-900 tabular-nums">{currentIndicators.erosionRisk}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Pale green View Details button */}
          <div className="p-6 pt-0">
            <button
              onClick={() => handleViewDetails('current')}
              disabled={!reference}
              className="w-full py-2.5 bg-[#edf5ef] hover:bg-[#e1efe5] disabled:opacity-50 text-[#116b37] rounded-lg text-sm font-semibold transition cursor-pointer"
            >
              View Details
            </button>
          </div>
        </div>

        {/* CARD 2 — Option A */}
        {renderCandidateCard(optionA, 'Option A', 'orange')}

        {/* CARD 3 — Option B */}
        {renderCandidateCard(optionB, 'Option B', 'green')}
      </div>

      {/* Natural Figma-styled Extension for Additional Backend Strategy (Option C) & Engine Summary */}
      {(optionC || suggestion?.text) && (
        <div className="space-y-3">
          {optionC && (
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-gray-900">
                    Additional Backend Strategy · Option {optionC.id}: {optionC.name}
                  </span>
                  {getStatusLabel(optionC.recommendation_status) && (
                    <span
                      className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        optionC.recommendation_status === 'not_recommended'
                          ? 'bg-red-100 text-red-900'
                          : 'bg-[#edf5ef] text-[#116b37]'
                      }`}
                    >
                      {getStatusLabel(optionC.recommendation_status)}
                    </span>
                  )}
                  <span className="text-sm font-semibold text-gray-800 tabular-nums">
                    {optionC.score !== null && optionC.score !== undefined
                      ? `${optionC.score}/100`
                      : 'Not scored (limit violated)'}
                  </span>
                </div>
                <p className="text-sm font-normal text-gray-600 capitalize">
                  Sequence:{' '}
                  {optionC.sequence && optionC.sequence.length > 0
                    ? optionC.sequence.map((s) => s.crop).join(' → ')
                    : '—'}
                </p>
                {optionC.recommendation_status === 'not_recommended' &&
                  optionC.constraints?.failures &&
                  optionC.constraints.failures.length > 0 && (
                    <p className="text-sm font-normal text-red-800 leading-relaxed">
                      {optionC.constraints.failures.join(' ')}
                    </p>
                  )}
              </div>

              <button
                onClick={() => handleViewDetails(optionC.id)}
                className="px-5 py-2.5 bg-[#edf5ef] hover:bg-[#e1efe5] text-[#116b37] rounded-lg text-sm font-semibold transition cursor-pointer shrink-0"
              >
                View Details
              </button>
            </div>
          )}

          {suggestion?.text && (
            <div className="bg-[#eff6f1] border border-[#d7e8dc] rounded-xl px-5 py-3.5 text-sm sm:text-base font-normal text-gray-800 leading-relaxed">
              <strong className="font-semibold text-[#116b37]">Decision Engine Note:</strong> {suggestion.text}
            </div>
          )}
        </div>
      )}

      {/* Bottom Navigation (Figma Page 7) */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={prevStep}
          className="px-5 py-2.5 bg-white hover:bg-gray-50 text-[#116b37] border border-gray-200 rounded-lg text-sm sm:text-base font-medium transition flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          onClick={() => goToStep('compare-report')}
          className="px-6 py-2.5 bg-[#116b37] hover:bg-[#0d542b] text-white rounded-lg text-sm sm:text-base font-semibold transition flex items-center gap-2 cursor-pointer shadow-xs"
        >
          <span>Next: Compare</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
