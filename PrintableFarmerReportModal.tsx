/**
 * AgroShift Gambia — Farmer Rotation Advisory Sheet (PDF Page 5)
 * Printable 1-page smallholder 3-year decision summary.
 * - Uses the exact same buildStrategyComparison() data structure as CompareTakeAwayScreen.
 * - Leaves writable blank lines for Farmer Name and Date / Agent instead of fabricating them.
 * - Never invents crop varieties, sowing/harvest dates, pH, rainfall numbers, or QR links.
 * - Uses real field, location, SoilGrids, and NASA POWER values when available in context.
 */

import React, { useEffect, useMemo } from 'react';
import { useAgroShift } from '../../context/AgroShiftContext';
import { buildStrategyComparison } from './strategyComparison';
import { Printer, X, Sprout, ArrowRight } from 'lucide-react';

interface PrintableFarmerReportModalProps {
  onClose: () => void;
}

export const PrintableFarmerReportModal: React.FC<PrintableFarmerReportModalProps> = ({ onClose }) => {
  const {
    selectedFieldId,
    fieldDetails,
    location,
    evaluationResult,
    evidenceData,
  } = useAgroShift();

  useEffect(() => {
    document.body.classList.add('printing-advisory-sheet');
    return () => {
      document.body.classList.remove('printing-advisory-sheet');
    };
  }, []);

  const comparison = useMemo(
    () => buildStrategyComparison(evaluationResult),
    [evaluationResult]
  );

  const recommended = comparison.recommendedStrategy;
  const fieldId = evaluationResult?.field_id || selectedFieldId || 'field-001';

  // Extract genuine environmental context strictly from live evidenceData
  const envLine = useMemo(() => {
    const soilParts: string[] = [fieldDetails.observed_soil || 'Soil not recorded'];

    const sg = evidenceData?.evidence?.soilgrids || [];
    const phTop = sg.find((item) => item.property === 'phh2o' && item.depth === '0-5cm');
    if (phTop && phTop.value !== null && phTop.value !== undefined) {
      soilParts.push(`pH ${phTop.value} (SoilGrids)`);
    }

    const power = evidenceData?.evidence?.power_annual || [];
    const imergVals = power
      .map((p) => p.imerg.rain_total_mm)
      .filter((v): v is number => v !== null && v !== undefined);
    const merraVals = power
      .map((p) => p.merra2.rain_total_mm)
      .filter((v): v is number => v !== null && v !== undefined);
    const rainVals = imergVals.length > 0 ? imergVals : merraVals;

    if (rainVals.length > 0) {
      const meanRain = Math.round(rainVals.reduce((a, b) => a + b, 0) / rainVals.length);
      soilParts.push(`${rainVals.length}-yr Mean Rain (${meanRain} mm)`);
    } else {
      soilParts.push('Rain-fed upland context');
    }

    return soilParts.join(' · ');
  }, [evidenceData, fieldDetails.observed_soil]);

  const extensionNotesText = useMemo(() => {
    const parts: string[] = [
      'Satellite data describes regional patterns, not field measurements.',
    ];
    if (recommended?.constraints?.would_become_feasible_if?.length) {
      parts.push(
        `Confirm locally: ${recommended.constraints.would_become_feasible_if.join('; ')}.`
      );
    } else {
      parts.push(
        'Confirm seed availability, input costs, and topsoil moisture with your local extension agent.'
      );
    }
    if (recommended?.risks_for_local_review?.[0]) {
      parts.push(recommended.risks_for_local_review[0].replace(/\s*\([A-Z0-9,\s-]+\)\s*$/g, ''));
    }
    return parts.join(' ');
  }, [recommended]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-gray-200 my-4 space-y-5">
        {/* Top Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200 no-print">
          <div className="flex items-center gap-2">
            <Sprout className="w-5 h-5 text-[#116b37]" />
            <h3 className="font-semibold text-gray-900 text-base sm:text-lg">
              Farmer Rotation Advisory Sheet
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 bg-[#116b37] hover:bg-[#0d542b] text-white rounded-lg text-sm font-semibold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Save as PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition cursor-pointer"
              aria-label="Close advisory sheet"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable One-Page Sheet matching PDF Page 5 */}
        <div id="farmer-report-document" className="text-gray-900 space-y-5 bg-white">
          {/* Brand & Field ID Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sprout className="w-6 h-6 text-gray-900" />
                <span className="text-lg font-bold tracking-tight">AgroShift Gambia</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight uppercase pt-2">
                FARMER ROTATION ADVISORY SHEET
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">
                Smallholder 3-Year Decision Summary
              </p>
            </div>

            <div className="border border-gray-800 px-3.5 py-1.5 text-xs font-semibold tabular-nums shrink-0">
              {fieldId.toUpperCase()}
            </div>
          </div>

          <hr className="border-t-2 border-gray-900" />

          {/* 2-Column Metadata Box (Blank writable lines for Farmer Name & Date/Agent) */}
          <div className="border border-gray-800 grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-800 text-xs sm:text-sm">
            <div className="p-3.5 space-y-2.5">
              <p className="font-semibold">
                Farmer Name: <span className="font-normal tracking-widest">____________________</span>
              </p>
              <p>
                <span className="font-medium">Community:</span> {location.district}, {location.region} ({fieldDetails.size_ha} ha · {fieldDetails.field_type})
              </p>
            </div>
            <div className="p-3.5 space-y-2.5">
              <p className="font-semibold">
                Date / Agent: <span className="font-normal tracking-widest">____________________</span>
              </p>
              <p>
                <span className="font-medium">Soil &amp; Rain:</span> {envLine}
              </p>
            </div>
          </div>

          {/* Recommended / Top Candidate 3-Year Rotation */}
          {recommended && (
            <div className="space-y-3">
              <div className="bg-gray-100 border border-gray-300 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    {evaluationResult?.suggestion?.ready_option === recommended.id
                      ? `RECOMMENDED ROTATION (OPTION ${recommended.id})`
                      : `TOP CANDIDATE ROTATION (OPTION ${recommended.id} · CONDITIONAL)`}
                  </span>
                  <span className="text-xs font-semibold text-gray-700 tabular-nums">
                    {recommended.score !== null && recommended.score !== undefined
                      ? `Score: ${recommended.score}/100`
                      : 'Not scored'}
                  </span>
                </div>
                <p className="text-base sm:text-lg font-bold text-gray-900 mt-1 capitalize">
                  {recommended.sequence.map((s) => s.crop).join(' → ')}
                  <span className="text-sm font-normal text-gray-600 ml-2 normal-case">
                    ({recommended.name})
                  </span>
                </p>
              </div>

              {/* Crop Sequence Cards with Connecting Arrows */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {recommended.sequence.map((seq, idx) => (
                  <React.Fragment key={idx}>
                    <div className="flex-1 border border-gray-800 p-3.5 space-y-1.5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-800">
                        <span className="w-4 h-4 rounded-full border border-gray-800 inline-block shrink-0" />
                        <span>
                          {seq.year ? `Year ${seq.year}` : `Season ${idx + 1}`}
                        </span>
                      </div>
                      <p className="text-base font-bold text-gray-900 capitalize">{seq.crop}</p>
                      <p className="text-xs text-gray-600 capitalize">
                        Role: {seq.role || 'Rain-fed season'} · Main Rains (Jun–Oct)
                      </p>
                    </div>
                    {idx < recommended.sequence.length - 1 && (
                      <div className="hidden sm:flex items-center justify-center text-gray-700 shrink-0 px-0.5">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Compare Your Options — Shared 6-Criterion Table */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-900">
              COMPARE YOUR OPTIONS
            </h2>
            <table className="w-full border border-gray-800 border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-800 py-2 px-3 text-left font-bold">Factor</th>
                  {comparison.primaryColumns.map((col) => (
                    <th key={col.key} className="border border-gray-800 py-2 px-3 text-left font-bold">
                      {col.roleLabel} ({col.optionLabel})
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.key}>
                    <td className="border border-gray-800 py-2 px-3 font-medium">{row.label}</td>
                    {comparison.primaryColumns.map((col, cIdx) => {
                      const cell = row.cells[col.key];
                      return (
                        <td
                          key={col.key}
                          className={`border border-gray-800 py-2 px-3 ${
                            cIdx === 0 ? 'font-semibold' : 'font-normal text-gray-800'
                          }`}
                        >
                          {cell ? cell.label : 'Not assessed'}
                          {cell?.score !== null && cell?.score !== undefined && (
                            <span className="text-[11px] font-normal text-gray-600 ml-1 tabular-nums">
                              ({cell.score})
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Extension Note Box */}
          <div className="border border-gray-800 bg-gray-50 p-3.5 text-xs sm:text-sm space-y-1">
            <p className="font-bold text-gray-900">Extension Note:</p>
            <p className="text-gray-800 leading-relaxed">{extensionNotesText}</p>
          </div>

          {/* Farmer / Agent Notes (Writable blank lines for printed field use) */}
          <div className="space-y-4 pt-1">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-900">
              FARMER / AGENT NOTES
            </p>
            <div className="border-b border-dashed border-gray-400 h-5" />
            <div className="border-b border-dashed border-gray-400 h-5" />
            <div className="border-b border-dashed border-gray-400 h-5" />
          </div>

          {/* Sheet Footer */}
          <div className="pt-2 border-t border-gray-300 flex items-center justify-between text-xs text-gray-500">
            <span>AgroShift Gambia · Field {fieldId.toUpperCase()}</span>
            <span>1 / 1</span>
          </div>
        </div>

        {/* Bottom Modal Close (Hidden in Print) */}
        <div className="flex justify-end pt-3 border-t border-gray-100 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg text-sm font-medium cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
