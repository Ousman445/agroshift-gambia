/**
 * AgroShift Gambia — Screen S7: Compare & Take Away
 * Faithful to Page 4 of the updated AgroShift UI reference PDF:
 *   - Top context label + working Download Report & Share actions
 *   - Clean 6-Criterion Comparison Matrix (Recommended / Alternative / Current Practice, plus toggle for all 4 backend options)
 *   - Highlighted Recommended column with green outline & badge
 *   - Prominent "Our Recommendation" card powered by real backend suggestion & farmer priorities
 *   - Bottom navigation: "← Back" and "Get Your Farmer Report →"
 *
 * Consumes the exact same shared buildStrategyComparison() model as PrintableFarmerReportModal.
 */

import React, { useMemo, useState } from 'react';
import { useAgroShift } from '../../context/AgroShiftContext';
import {
  buildStrategyComparison,
  ComparisonCell,
  ComparisonCriterionRow,
} from './strategyComparison';
import { PrintableFarmerReportModal } from './PrintableFarmerReportModal';
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Share2,
  Sun,
  Droplet,
  Sprout,
  ShieldCheck,
  Coins,
  Wheat,
  Users,
  Check,
  Minus,
  AlertTriangle,
  X as XIcon,
  Star,
  Sliders,
} from 'lucide-react';

const CRITERION_ICON: Record<ComparisonCriterionRow['key'], React.ElementType> = {
  water: Droplet,
  soil_nitrogen: Sprout,
  erosion: ShieldCheck,
  income: Coins,
  food: Wheat,
  labour: Users,
};

function renderBadgeCell(cell: ComparisonCell) {
  if (cell.tone === 'muted') {
    return (
      <div className="inline-flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
          {cell.label}
        </span>
        {cell.sublabel && <span className="text-[11px] text-gray-400">{cell.sublabel}</span>}
      </div>
    );
  }

  const badgeStyles: Record<ComparisonCell['tone'], string> = {
    positive: 'bg-[#e6f4ea] text-[#137333]',
    neutral: 'bg-gray-100 text-gray-700',
    warning: 'bg-amber-50 text-amber-800 border border-amber-200',
    negative: 'bg-red-50 text-red-700',
    muted: 'bg-gray-100 text-gray-600',
  };

  const BadgeIcon =
    cell.tone === 'positive'
      ? Check
      : cell.tone === 'negative'
      ? XIcon
      : cell.tone === 'warning'
      ? AlertTriangle
      : Minus;

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <span
        className={`inline-flex items-center gap-1 px-3 py-0.5 rounded-full text-xs font-semibold ${badgeStyles[cell.tone]}`}
      >
        <BadgeIcon className="w-3 h-3 shrink-0" />
        <span>{cell.label}</span>
      </span>
      {cell.sublabel && (
        <span className="text-[11px] text-gray-500 tabular-nums">{cell.sublabel}</span>
      )}
    </div>
  );
}

function renderCriterionCell(rowKey: ComparisonCriterionRow['key'], cell: ComparisonCell) {
  if (cell.tone === 'muted') {
    return renderBadgeCell(cell);
  }

  // Row 4: Cash Income Potential with 3-star indicator + honest fit label
  if (rowKey === 'income' && cell.stars !== undefined) {
    return (
      <div className="inline-flex flex-col items-center gap-1">
        <div className="flex items-center gap-0.5" aria-label={`${cell.stars} out of 3 market fit`}>
          {[1, 2, 3].map((idx) => (
            <Star
              key={idx}
              className={`w-3.5 h-3.5 ${
                idx <= (cell.stars ?? 0)
                  ? 'fill-[#f59e0b] text-[#f59e0b]'
                  : 'fill-gray-200 text-gray-200'
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-medium text-gray-700">{cell.label}</span>
        {cell.sublabel && (
          <span className="text-[11px] text-gray-500 tabular-nums">{cell.sublabel}</span>
        )}
      </div>
    );
  }

  // Row 5: Household Food Supply with bar + honest role-fit label (no fabricated months of grain)
  if (rowKey === 'food' && cell.barPct !== undefined) {
    return (
      <div className="inline-flex flex-col items-center gap-1 w-full max-w-[165px]">
        <span className="text-xs font-semibold text-gray-800">{cell.label}</span>
        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#116b37] rounded-full"
            style={{ width: `${cell.barPct}%` }}
          />
        </div>
        {cell.sublabel && (
          <span className="text-[11px] text-gray-500 tabular-nums">{cell.sublabel}</span>
        )}
      </div>
    );
  }

  return renderBadgeCell(cell);
}

export const CompareTakeAwayScreen: React.FC = () => {
  const { evaluationResult, prevStep, goToStep, runEvaluation } = useAgroShift();
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const comparison = useMemo(
    () => buildStrategyComparison(evaluationResult),
    [evaluationResult]
  );

  if (!evaluationResult) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 sm:p-10 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
          <Sliders className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900">Comparison Matrix Unavailable</h3>
        <p className="text-base font-normal text-gray-600 max-w-md mx-auto leading-relaxed">
          Run the decision engine to compare rotation strategies side by side and generate your printable farmer advisory sheet.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => goToStep('priorities-limits')}
            className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 rounded-lg text-sm font-medium transition cursor-pointer"
          >
            Review Priorities &amp; Limits
          </button>
          <button
            type="button"
            onClick={() => runEvaluation()}
            className="px-6 py-2.5 bg-[#116b37] hover:bg-[#0d542b] text-white rounded-lg text-sm font-semibold transition cursor-pointer"
          >
            Run Decision Engine Now
          </button>
        </div>
      </div>
    );
  }

  const displayedColumns = showAllOptions ? comparison.allColumns : comparison.primaryColumns;
  const suggestion = evaluationResult.suggestion;

  const handleShare = async () => {
    const topCol = comparison.primaryColumns[0];
    const summaryText = [
      `AgroShift Gambia — Field ${evaluationResult.field_id}`,
      topCol?.strategy
        ? `${topCol.roleLabel}: ${topCol.strategy.name} (${topCol.strategy.sequence.map((s) => s.crop).join(' → ')})`
        : '',
      suggestion?.text || '',
    ]
      .filter(Boolean)
      .join('\n');

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'AgroShift Gambia — Rotation Summary',
          text: summaryText,
          url: window.location.href,
        });
        setShareFeedback('Shared');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${summaryText}\n${window.location.href}`);
        setShareFeedback('Copied Summary!');
      }
    } catch {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(window.location.href);
        setShareFeedback('Copied Link!');
      }
    }
    setTimeout(() => setShareFeedback(null), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Label & Action Bar (PDF Page 4) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-gray-500 tracking-wide uppercase">
            DECISION SUPPORT COMPARISON · FOR LOCAL REVIEW
          </span>
          {comparison.extraStrategies.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllOptions((prev) => !prev)}
              className="text-xs font-semibold text-[#116b37] hover:underline cursor-pointer"
            >
              {showAllOptions
                ? 'Show standard 3-column summary'
                : `Include Option ${comparison.extraStrategies.map((s) => s.id).join(', ')} (${comparison.allColumns.length} columns)`}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPrintModal(true)}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 rounded-lg text-sm font-medium transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4 text-gray-500" />
            <span>Download Report</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 rounded-lg text-sm font-medium transition flex items-center gap-1.5 cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-gray-500" />
            <span>{shareFeedback || 'Share'}</span>
          </button>
        </div>
      </div>

      {/* Engine Warnings Banner if any */}
      {evaluationResult.warnings && evaluationResult.warnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-sm text-amber-950">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            {evaluationResult.warnings.map((w, idx) => (
              <p key={idx}>{w}</p>
            ))}
          </div>
        </div>
      )}

      {/* 6-Criterion Comparison Matrix (PDF Page 4) */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 sm:p-7 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            6-Criterion Comparison Matrix
          </h2>
          <span className="text-xs text-gray-500">
            Derived from backend criterion &amp; soil-component scores
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left min-w-[640px]">
            <thead>
              <tr>
                <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-200 w-[26%]">
                  Criterion
                </th>
                {displayedColumns.map((col) => (
                  <th
                    key={col.key}
                    className={`py-3 px-4 text-center align-top border-b ${
                      col.isHighlighted
                        ? 'bg-[#f4faf6] border-t border-l border-r border-[#116b37] rounded-t-xl border-b-[#d6ebd9]'
                        : 'border-b-gray-200'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      {col.isHighlighted ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#116b37] text-white text-xs font-semibold">
                          <Check className="w-3 h-3" />
                          <span>{col.roleLabel}</span>
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">{col.optionLabel}</span>
                      )}
                      <span className="text-xs font-normal text-gray-600">
                        {col.isHighlighted ? col.optionLabel : col.roleLabel}
                        {col.strategy?.score !== null && col.strategy?.score !== undefined
                          ? ` · ${Math.round(col.strategy.score)}/100`
                          : ''}
                      </span>
                      {col.strategy?.sequence && col.strategy.sequence.length > 0 && (
                        <span className="text-[11px] font-medium text-gray-500 capitalize">
                          {col.strategy.sequence.map((s) => s.crop).join(' → ')}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {comparison.rows.map((row, rowIdx) => {
                const Icon = CRITERION_ICON[row.key];
                const isLastRow = rowIdx === comparison.rows.length - 1;
                return (
                  <tr key={row.key}>
                    <td className="py-4 px-4 align-middle">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{row.label}</span>
                      </div>
                    </td>
                    {displayedColumns.map((col) => {
                      const cell = row.cells[col.key] || {
                        label: 'Not assessed',
                        tone: 'muted',
                        score: null,
                      };
                      return (
                        <td
                          key={col.key}
                          className={`py-4 px-4 text-center align-middle ${
                            col.isHighlighted
                              ? `bg-[#f4faf6] border-l border-r border-[#116b37] ${
                                  isLastRow ? 'border-b rounded-b-xl' : ''
                                }`
                              : ''
                          }`}
                        >
                          {renderCriterionCell(row.key, cell)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Our Recommendation Card (PDF Page 4) */}
      <div className="bg-[#f0f7f2] border border-[#d6ebd9] rounded-2xl p-6 flex items-start gap-4">
        <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-700">
          <Sun className="w-5 h-5" />
        </div>
        <div className="space-y-1.5">
          <h3 className="font-semibold text-[#116b37] text-lg">Our Recommendation</h3>
          <p className="text-sm sm:text-base font-normal leading-relaxed text-gray-800">
            {suggestion?.text ||
              'Review the scored options above with your local extension officer before changing your field plan.'}
          </p>
        </div>
      </div>

      {/* Bottom Actions Row (PDF Page 4) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={prevStep}
          className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 font-medium rounded-lg text-sm transition flex items-center justify-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={() => setShowPrintModal(true)}
          className="px-7 py-2.5 bg-[#116b37] hover:bg-[#0d542b] text-white font-semibold rounded-lg text-sm transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
        >
          <span>Get Your Farmer Report</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {showPrintModal && (
        <PrintableFarmerReportModal onClose={() => setShowPrintModal(false)} />
      )}
    </div>
  );
};
