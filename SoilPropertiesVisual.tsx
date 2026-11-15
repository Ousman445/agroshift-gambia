import React, { useMemo } from 'react';
import {
  SOIL_DEPTHS,
  SoilCardSummary,
  SoilPropGroup,
} from './evidenceInterpretation';

interface SoilPropertiesVisualProps {
  soilGroups: SoilPropGroup[];
  soilSummary: SoilCardSummary;
  selectedDepth: string;
  onSelectDepth: (depth: string) => void;
  observedSoil?: string;
}

export const SoilPropertiesVisual: React.FC<SoilPropertiesVisualProps> = ({
  soilGroups,
  soilSummary,
  selectedDepth,
  onSelectDepth,
  observedSoil,
}) => {
  const phMarkerPct = useMemo(() => {
    if (soilSummary.ph === null) return null;
    return Math.max(2, Math.min(98, ((soilSummary.ph - 4.0) / 4.0) * 100));
  }, [soilSummary.ph]);

  const socFillPct = useMemo(() => {
    if (soilSummary.socGKg === null) return 0;
    return Math.max(6, Math.min(100, (soilSummary.socGKg / 30) * 100));
  }, [soilSummary.socGKg]);

  return (
    <section
      aria-label="What Is the Soil Like?"
      className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 space-y-6 w-full"
    >
      {/* Header & Depth Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-[22px] font-semibold text-[#111827]">
            What Is the Soil Like?
          </h2>
          <p className="text-sm text-[#4B5563]">
            Estimated soil properties across depths ({selectedDepth} selected · global 250-metre map, not a lab soil test)
          </p>
        </div>

        <div
          className="flex flex-wrap items-center gap-1.5 bg-[#F9FAFB] border border-[#E5E7EB] p-1 rounded-xl shrink-0"
          role="group"
          aria-label="Select soil depth layer"
        >
          {SOIL_DEPTHS.map((depth) => (
            <button
              key={depth}
              type="button"
              onClick={() => onSelectDepth(depth)}
              aria-pressed={selectedDepth === depth}
              className={`min-h-[44px] px-3.5 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                selectedDepth === depth
                  ? 'bg-[#1E5631] text-white'
                  : 'text-[#4B5563] hover:text-[#111827] hover:bg-white'
              }`}
            >
              {depth.replace('cm', ' cm')}
            </button>
          ))}
        </div>
      </div>

      {!soilSummary.available ? (
        <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F9FAFB] px-6 py-14 text-center space-y-2">
          <p className="text-base font-semibold text-[#111827]">
            Data not available for this location
          </p>
          <p className="text-sm text-[#4B5563]">
            Estimated soil property data is not cached for this field.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Primary Visuals: pH Scale + Organic Carbon + Texture Makeup */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* 1. Soil pH Scale */}
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold text-[#111827]">Soil Acidity (pH)</span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                      soilSummary.phTone === 'green'
                        ? 'bg-emerald-50 text-[#15803D] border-emerald-200'
                        : soilSummary.phTone === 'amber'
                        ? 'bg-amber-50 text-[#C2410C] border-amber-200'
                        : 'bg-white text-[#4B5563] border-[#E5E7EB]'
                    }`}
                  >
                    {soilSummary.phStatus}
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#111827] tabular-nums">
                    {soilSummary.ph !== null ? soilSummary.ph : 'Unavailable'}
                  </span>
                  <span className="text-sm text-[#4B5563]">at {selectedDepth.replace('cm', ' cm')}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="relative w-full h-3 rounded-full bg-gray-200 overflow-visible">
                  <div
                    className="absolute top-0 bottom-0 bg-emerald-200 rounded-full"
                    style={{ left: '37.5%', width: '37.5%' }}
                    title="Balanced range for most crops (5.5–7.0)"
                  />
                  {phMarkerPct !== null && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[#1E5631] border-2 border-white shadow-sm"
                      style={{ left: `${phMarkerPct}%` }}
                    />
                  )}
                </div>
                <div className="flex items-center justify-between text-sm text-[#4B5563]">
                  <span>4.0 Acidic</span>
                  <span className="font-medium text-[#1E5631]">5.5–7.0 Balanced</span>
                  <span>8.0 Alkaline</span>
                </div>
              </div>
            </div>

            {/* 2. Soil Organic Carbon */}
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold text-[#111827]">Organic Carbon</span>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-semibold border ${
                      soilSummary.socStatus === 'Low'
                        ? 'bg-amber-50 text-[#C2410C] border-amber-200'
                        : soilSummary.socStatus === 'Moderate'
                        ? 'bg-amber-50 text-[#D97706] border-amber-200'
                        : 'bg-emerald-50 text-[#15803D] border-emerald-200'
                    }`}
                  >
                    {soilSummary.socStatus}
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#111827] tabular-nums">
                    {soilSummary.socGKg !== null ? `${soilSummary.socGKg} g/kg` : 'Unavailable'}
                  </span>
                  {soilSummary.socPct !== null && (
                    <span className="text-sm text-[#4B5563] tabular-nums">
                      ({soilSummary.socPct}% carbon)
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="w-full h-3 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      soilSummary.socStatus === 'Low' ? 'bg-[#D97706]' : 'bg-[#1E5631]'
                    }`}
                    style={{ width: `${socFillPct}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 text-sm text-[#4B5563]">
                  <span className={soilSummary.socStatus === 'Low' ? 'font-semibold text-[#C2410C]' : ''}>
                    Low (&lt;10)
                  </span>
                  <span
                    className={`text-center ${
                      soilSummary.socStatus === 'Moderate' ? 'font-semibold text-[#D97706]' : ''
                    }`}
                  >
                    Moderate (10–20)
                  </span>
                  <span
                    className={`text-right ${
                      soilSummary.socStatus === 'Higher' ? 'font-semibold text-[#1E5631]' : ''
                    }`}
                  >
                    Higher (&gt;20)
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Soil Makeup & Texture Limitation */}
            <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 sm:p-5 flex flex-col justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-base font-semibold text-[#111827]">Soil Makeup</span>
                  {observedSoil && (
                    <span className="text-sm font-medium text-[#1E5631]">
                      Farmer note: {observedSoil}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#4B5563] tabular-nums">
                  Sand {soilSummary.sandPct !== null ? `${soilSummary.sandPct}%` : 'Unavailable'} · Clay{' '}
                  {soilSummary.clayPct !== null ? `${soilSummary.clayPct}%` : 'Unavailable'} · Silt:{' '}
                  {soilSummary.siltPct !== null ? `${soilSummary.siltPct}%` : 'Not available'}
                </p>
              </div>

              <div className="space-y-2.5">
                <div
                  className="w-full h-3.5 rounded-full overflow-hidden flex bg-gray-200"
                  role="img"
                  aria-label={`Sand ${soilSummary.sandPct ?? 0} percent, Clay ${soilSummary.clayPct ?? 0} percent, Silt not available`}
                >
                  {soilSummary.sandPct !== null && (
                    <div
                      className="h-full bg-[#2563EB]"
                      style={{ width: `${soilSummary.sandPct}%` }}
                      title={`Sand: ${soilSummary.sandPct}%`}
                    />
                  )}
                  {soilSummary.clayPct !== null && (
                    <div
                      className="h-full bg-[#EC4899]"
                      style={{ width: `${soilSummary.clayPct}%` }}
                      title={`Clay: ${soilSummary.clayPct}%`}
                    />
                  )}
                  {soilSummary.unmeasuredPct !== null && (
                    <div
                      className="h-full bg-gray-300"
                      style={{ width: `${soilSummary.unmeasuredPct}%` }}
                      title="Remainder / silt not supplied in dataset"
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#4B5563]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#2563EB]" />
                    Sand
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#EC4899]" />
                    Clay
                  </span>
                  {soilSummary.siltPct === null && (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-gray-300" />
                      Silt not measured
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-[#111827]">{soilSummary.drainageLabel}</p>
              </div>
            </div>
          </div>

          {/* Depth Profile Comparison Bars across 0-5cm, 5-15cm, 15-30cm, 30-60cm */}
          <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-[#111827]">
                How Soil Changes With Depth
              </h3>
              <span className="text-sm text-[#4B5563]">
                Four soil layers shown separately (0–60 cm)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {SOIL_DEPTHS.map((depth) => {
                const phVal = soilGroups.find((g) => g.property === 'phh2o')?.byDepth[depth] ?? null;
                const socVal = soilGroups.find((g) => g.property === 'soc')?.byDepth[depth] ?? null;
                const nitVal = soilGroups.find((g) => g.property === 'nitrogen')?.byDepth[depth] ?? null;
                const bdodVal = soilGroups.find((g) => g.property === 'bdod')?.byDepth[depth] ?? null;
                const isSelected = depth === selectedDepth;

                return (
                  <button
                    key={depth}
                    type="button"
                    onClick={() => onSelectDepth(depth)}
                    className={`text-left rounded-xl p-4 border transition cursor-pointer space-y-2 ${
                      isSelected
                        ? 'bg-white border-[#1E5631] ring-1 ring-[#1E5631]'
                        : 'bg-white border-[#E5E7EB] hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-[#111827]">
                        {depth.replace('cm', ' cm')}
                      </span>
                      {isSelected && (
                        <span className="text-sm font-semibold text-[#1E5631]">Selected</span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-[#4B5563] tabular-nums">
                      <p className="flex justify-between">
                        <span>Soil pH:</span>
                        <span className="font-semibold text-[#111827]">{phVal ?? 'N/A'}</span>
                      </p>
                      <p className="flex justify-between">
                        <span>Organic carbon:</span>
                        <span className="font-semibold text-[#111827]">
                          {socVal !== null ? `${socVal} g/kg` : 'N/A'}
                        </span>
                      </p>
                      <p className="flex justify-between">
                        <span>Nitrogen:</span>
                        <span className="font-semibold text-[#111827]">
                          {nitVal !== null ? `${nitVal} g/kg` : 'N/A'}
                        </span>
                      </p>
                      <p className="flex justify-between">
                        <span>Firmness:</span>
                        <span className="font-semibold text-[#111827]">
                          {bdodVal !== null ? `${bdodVal} kg/dm³` : 'N/A'}
                        </span>
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
