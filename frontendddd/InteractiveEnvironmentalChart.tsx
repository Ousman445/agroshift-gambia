import React, { useEffect, useMemo, useState } from 'react';

export type TimeSeriesMetric =
  | 'Rainfall'
  | 'Temperature'
  | 'Soil Moisture'
  | 'Humidity'
  | 'Vegetation';

export type ChartDisplayMode = 'bar' | 'line';

export interface ChartSeriesPoint {
  value: number | null;
  secondaryText?: string;
  meta?: string;
  highlightRing?: boolean;
}

export interface ChartSeriesConfig {
  id: string;
  label: string;
  sourceLabel: string;
  valueLabel: string;
  color: string;
  unit: string;
  points: ChartSeriesPoint[];
}

export interface ChartReferenceLine {
  label: string;
  value: number;
  unit: string;
}

export interface ChartReferenceSeries {
  label: string;
  points: Array<number | null>;
}

export interface InteractiveChartDataset {
  metric: TimeSeriesMetric;
  mode: ChartDisplayMode;
  title: string;
  subtitle: string;
  contextNote: string;
  xLabels: string[];
  xFullLabels?: string[];
  highlightedIndex?: number | null;
  gapIndices?: number[];
  gapLabel?: string;
  yMin: number;
  yMax: number;
  yTicks: number[];
  yUnit: string;
  formatTick?: (v: number) => string;
  formatValue: (v: number) => string;
  series: ChartSeriesConfig[];
  referenceLine?: ChartReferenceLine | null;
  referenceSeries?: ChartReferenceSeries | null;
  unavailableMessage?: string | null;
}

interface InteractiveEnvironmentalChartProps {
  dataset: InteractiveChartDataset;
  headerActions?: React.ReactNode;
  emptyMessage?: string;
}

const SVG_WIDTH = 860;
const SVG_HEIGHT = 320;
const MARGIN = { top: 24, right: 24, bottom: 44, left: 68 };
const PLOT_WIDTH = SVG_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = SVG_HEIGHT - MARGIN.top - MARGIN.bottom;

function buildLineSegments(coords: Array<{ x: number; y: number } | null>): string[] {
  const segments: string[] = [];
  let current: Array<{ x: number; y: number }> = [];

  for (const pt of coords) {
    if (pt !== null) {
      current.push(pt);
    } else {
      if (current.length >= 2) {
        segments.push(
          current.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
        );
      }
      current = [];
    }
  }

  if (current.length >= 2) {
    segments.push(
      current.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
    );
  }

  return segments;
}

export const InteractiveEnvironmentalChart: React.FC<InteractiveEnvironmentalChartProps> = ({
  dataset,
  headerActions,
  emptyMessage = 'No observations available for this selection.',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    setHoveredIdx(null);
  }, [dataset.metric, dataset.mode, dataset.xLabels.length, dataset.subtitle]);

  const count = dataset.xLabels.length;

  const getX = (idx: number): number => {
    if (count <= 1) return MARGIN.left + PLOT_WIDTH / 2;
    const padX = dataset.mode === 'bar' ? Math.max(36, PLOT_WIDTH / (count * 2)) : Math.min(44, PLOT_WIDTH / (count * 2));
    return MARGIN.left + padX + (idx / (count - 1)) * (PLOT_WIDTH - padX * 2);
  };

  const getY = (val: number): number => {
    const span = dataset.yMax - dataset.yMin || 1;
    const clamped = Math.max(dataset.yMin, Math.min(dataset.yMax, val));
    return MARGIN.top + PLOT_HEIGHT - ((clamped - dataset.yMin) / span) * PLOT_HEIGHT;
  };

  const mappedSeries = useMemo(() => {
    return dataset.series.map((s) => {
      const coords = s.points.map((pt, idx) => {
        if (pt.value === null || pt.value === undefined || Number.isNaN(pt.value)) {
          return null;
        }
        return {
          x: getX(idx),
          y: getY(pt.value),
          value: pt.value,
          secondaryText: pt.secondaryText,
          meta: pt.meta,
          highlightRing: pt.highlightRing,
          idx,
        };
      });
      const segments = buildLineSegments(coords);
      return { ...s, coords, segments };
    });
  }, [dataset]);

  const referenceSeriesSegments = useMemo(() => {
    if (!dataset.referenceSeries) return [];
    const coords = dataset.referenceSeries.points.map((val, idx) => {
      if (val === null || val === undefined || Number.isNaN(val)) return null;
      return { x: getX(idx), y: getY(val) };
    });
    return buildLineSegments(coords);
  }, [dataset.referenceSeries, dataset.xLabels.length, dataset.yMax, dataset.yMin]);

  const hasAnyPoint =
    !dataset.unavailableMessage &&
    mappedSeries.some((s) => s.coords.some((c) => c !== null));

  const gapBands = useMemo(() => {
    const indices = dataset.gapIndices || [];
    if (!indices.length || count === 0) return [];
    const sorted = [...indices].sort((a, b) => a - b);
    const runs: Array<{ start: number; end: number }> = [];
    for (const idx of sorted) {
      const last = runs[runs.length - 1];
      if (last && idx === last.end + 1) {
        last.end = idx;
      } else {
        runs.push({ start: idx, end: idx });
      }
    }
    const step = count > 1 ? Math.abs(getX(1) - getX(0)) : 64;
    return runs.map((r) => {
      const xStart = getX(r.start) - step * 0.46;
      const xEnd = getX(r.end) + step * 0.46;
      return {
        x: Math.max(MARGIN.left, xStart),
        width: Math.min(MARGIN.left + PLOT_WIDTH, xEnd) - Math.max(MARGIN.left, xStart),
      };
    });
  }, [dataset.gapIndices, count]);

  const hitBandWidth = useMemo(() => {
    if (count <= 1) return PLOT_WIDTH * 0.5;
    return Math.max(36, PLOT_WIDTH / count);
  }, [count]);

  const activeXLabel =
    hoveredIdx !== null
      ? dataset.xFullLabels?.[hoveredIdx] || dataset.xLabels[hoveredIdx]
      : null;

  const isHoveredGap = hoveredIdx !== null && (dataset.gapIndices || []).includes(hoveredIdx);

  // Reference horizontal dashed line Y coordinate
  const refLineY =
    dataset.referenceLine &&
    dataset.referenceLine.value >= dataset.yMin &&
    dataset.referenceLine.value <= dataset.yMax
      ? getY(dataset.referenceLine.value)
      : null;

  const baselineY = MARGIN.top + PLOT_HEIGHT;

  return (
    <section
      aria-label={dataset.title}
      className="bg-white rounded-2xl border border-[#E5E7EB] p-5 sm:p-6 space-y-4 w-full"
    >
      {/* Top Title & Dataset/View Controls Row */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl sm:text-[22px] font-semibold text-[#111827] leading-snug">
            {dataset.title}
          </h2>
          <p className="text-sm text-[#4B5563]">{dataset.subtitle}</p>
        </div>

        {headerActions && <div className="flex flex-wrap items-center gap-2 shrink-0">{headerActions}</div>}
      </div>

      {/* Clear Legend Row */}
      {hasAnyPoint && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[#111827] pt-1">
          {dataset.series.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-2 font-medium">
              {dataset.mode === 'bar' ? (
                <span
                  className="w-2.5 h-4 rounded-full inline-block shrink-0"
                  style={{ backgroundColor: s.color }}
                />
              ) : (
                <span className="inline-flex items-center shrink-0">
                  <span className="w-4 h-0.5 rounded-full" style={{ backgroundColor: s.color }} />
                  <span
                    className="w-2.5 h-2.5 rounded-full -ml-1 border-2 border-white"
                    style={{ backgroundColor: s.color }}
                  />
                </span>
              )}
              <span>{s.label}</span>
            </span>
          ))}

          {dataset.referenceLine && (
            <span className="inline-flex items-center gap-2 text-[#4B5563] font-medium">
              <span className="w-5 border-t-2 border-dashed border-[#94A3B8] inline-block" />
              <span>
                {dataset.referenceLine.label} ({dataset.formatValue(dataset.referenceLine.value)}{' '}
                {dataset.referenceLine.unit})
              </span>
            </span>
          )}

          {dataset.referenceSeries && (
            <span className="inline-flex items-center gap-2 text-[#4B5563] font-medium">
              <span className="w-5 border-t-2 border-dashed border-[#94A3B8] inline-block" />
              <span>{dataset.referenceSeries.label}</span>
            </span>
          )}
        </div>
      )}

      {/* Main White Chart Canvas */}
      {dataset.unavailableMessage ? (
        <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F9FAFB] px-6 py-14 text-center space-y-2">
          <p className="text-base font-semibold text-[#111827]">
            Data not available for this location
          </p>
          <p className="text-sm text-[#4B5563] max-w-xl mx-auto leading-relaxed">
            {dataset.unavailableMessage}
          </p>
        </div>
      ) : hasAnyPoint ? (
        <div
          className="relative select-none w-full"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Floating Interactive Simple-English Tooltip */}
          {hoveredIdx !== null && activeXLabel && (
            <div
              role="status"
              className="pointer-events-none sm:absolute sm:z-20 sm:top-2 mb-3 sm:mb-0 bg-white border border-[#E5E7EB] rounded-xl shadow-md px-4 py-3 text-sm min-w-[240px] max-w-[330px]"
              style={{
                left: `${Math.min(64, Math.max(4, (getX(hoveredIdx) / SVG_WIDTH) * 100 - 10))}%`,
              }}
            >
              <div className="font-semibold text-[#111827] border-b border-[#E5E7EB] pb-1.5 mb-2">
                {activeXLabel}
              </div>

              {isHoveredGap ? (
                <p className="text-sm text-[#4B5563] leading-snug">
                  {dataset.gapLabel || 'Heavy rainy-season clouds block satellite views here (not measured).'}
                </p>
              ) : (
                <div className="space-y-2">
                  {mappedSeries.map((s) => {
                    const pt = s.coords[hoveredIdx];
                    return (
                      <div key={s.id} className="space-y-0.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="inline-flex items-center gap-2 text-[#111827] font-medium">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            <span>{s.valueLabel}:</span>
                          </span>
                          <span className="font-semibold text-[#111827] tabular-nums">
                            {pt ? `${dataset.formatValue(pt.value)} ${s.unit}` : 'Not available'}
                          </span>
                        </div>
                        <div className="text-sm text-[#4B5563] pl-4">
                          <span>Information source: {s.sourceLabel}</span>
                          {pt?.secondaryText && (
                            <span className="block text-[#4B5563] tabular-nums">{pt.secondaryText}</span>
                          )}
                          {pt?.meta && (
                            <span className="block font-medium text-[#C2410C]">{pt.meta}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {dataset.referenceLine && (
                    <div className="pt-1.5 mt-1.5 border-t border-[#E5E7EB] text-sm text-[#4B5563] tabular-nums">
                      {dataset.referenceLine.label}:{' '}
                      <span className="font-semibold text-[#111827]">
                        {dataset.formatValue(dataset.referenceLine.value)} {dataset.referenceLine.unit}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
              className="w-full min-w-[540px] h-auto block"
              role="img"
              aria-label={`${dataset.title} interactive chart`}
            >
              {/* Vertical Gridlines matching Reference Screenshot */}
              {dataset.xLabels.map((lbl, idx) => {
                const x = getX(idx);
                const isSelectedYear =
                  dataset.highlightedIndex !== null &&
                  dataset.highlightedIndex !== undefined &&
                  dataset.highlightedIndex === idx;
                return (
                  <g key={`vgrid-${lbl}-${idx}`}>
                    {isSelectedYear && (
                      <rect
                        x={x - hitBandWidth * 0.42}
                        y={MARGIN.top}
                        width={hitBandWidth * 0.84}
                        height={PLOT_HEIGHT}
                        rx={8}
                        fill="#ECFDF5"
                        opacity={0.75}
                      />
                    )}
                    <line
                      x1={x}
                      y1={MARGIN.top}
                      x2={x}
                      y2={baselineY}
                      stroke="#F1F5F9"
                      strokeWidth={1}
                    />
                  </g>
                );
              })}

              {/* Horizontal Gridlines & Y-Axis Ticks */}
              {dataset.yTicks.map((tick) => {
                const y = getY(tick);
                const formatted = dataset.formatTick ? dataset.formatTick(tick) : dataset.formatValue(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={MARGIN.left}
                      y1={y}
                      x2={SVG_WIDTH - MARGIN.right}
                      y2={y}
                      stroke="#F1F5F9"
                      strokeWidth={1}
                    />
                    <text
                      x={MARGIN.left - 10}
                      y={y + 5}
                      textAnchor="end"
                      fontSize="14"
                      fontFamily="Inter, system-ui, sans-serif"
                      fill="#4B5563"
                      className="tabular-nums"
                    >
                      {formatted}
                    </text>
                  </g>
                );
              })}

              {/* Y-Axis Unit Label */}
              <text
                x={MARGIN.left - 10}
                y={15}
                textAnchor="end"
                fontSize="14"
                fontWeight="600"
                fontFamily="Inter, system-ui, sans-serif"
                fill="#4B5563"
              >
                {dataset.yUnit}
              </text>

              {/* Baseline X-axis */}
              <line
                x1={MARGIN.left}
                y1={baselineY}
                x2={SVG_WIDTH - MARGIN.right}
                y2={baselineY}
                stroke="#E5E7EB"
                strokeWidth={1.25}
              />

              {/* Cloud-Cover Gap Band (e.g. MODIS Jul–Oct) */}
              {gapBands.map((band, idx) => (
                <g key={`gap-${idx}`}>
                  <rect
                    x={band.x}
                    y={MARGIN.top}
                    width={band.width}
                    height={PLOT_HEIGHT}
                    rx={8}
                    fill="#F8FAFC"
                    stroke="#CBD5E1"
                    strokeDasharray="4 4"
                    strokeWidth={1}
                  />
                  {dataset.gapLabel && (
                    <text
                      x={band.x + band.width / 2}
                      y={MARGIN.top + PLOT_HEIGHT / 2}
                      textAnchor="middle"
                      fontSize="14"
                      fontFamily="Inter, system-ui, sans-serif"
                      fontWeight={500}
                      fill="#4B5563"
                    >
                      {dataset.gapLabel}
                    </text>
                  )}
                </g>
              ))}

              {/* Subtle Grey Dashed Historical Reference Line */}
              {refLineY !== null && (
                <line
                  x1={MARGIN.left}
                  y1={refLineY}
                  x2={SVG_WIDTH - MARGIN.right}
                  y2={refLineY}
                  stroke="#94A3B8"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                />
              )}

              {/* Subtle Grey Dashed Historical Reference Curve (for single-year vs baseline) */}
              {referenceSeriesSegments.map((d, segIdx) => (
                <path
                  key={`ref-seg-${segIdx}`}
                  d={d}
                  fill="none"
                  stroke="#94A3B8"
                  strokeWidth={2}
                  strokeDasharray="6 6"
                  strokeLinecap="round"
                />
              ))}

              {/* Active Hover Vertical Guide Line */}
              {hoveredIdx !== null && (
                <line
                  x1={getX(hoveredIdx)}
                  y1={MARGIN.top}
                  x2={getX(hoveredIdx)}
                  y2={baselineY}
                  stroke="#CBD5E1"
                  strokeWidth={1.25}
                  strokeDasharray="3 3"
                />
              )}

              {/* MODE 1: PAIRED VERTICAL ROUNDED PILL BARS (Reference Style) */}
              {dataset.mode === 'bar' && (
                <g>
                  {dataset.xLabels.map((_, idx) => {
                    const cx = getX(idx);
                    const seriesCount = mappedSeries.length;
                    const barWidth = seriesCount === 1 ? 14 : 9;
                    const barGap = 5;
                    const totalGroupW = seriesCount * barWidth + (seriesCount - 1) * barGap;
                    const startX = cx - totalGroupW / 2;

                    const isDimmed =
                      dataset.highlightedIndex !== null &&
                      dataset.highlightedIndex !== undefined &&
                      dataset.highlightedIndex !== idx &&
                      hoveredIdx !== idx;

                    return mappedSeries.map((s, sIdx) => {
                      const pt = s.coords[idx];
                      if (!pt) return null;
                      const barX = startX + sIdx * (barWidth + barGap);
                      const barHeight = Math.max(4, baselineY - pt.y);
                      const isHovered = hoveredIdx === idx;
                      return (
                        <g key={`${s.id}-bar-${idx}`}>
                          <rect
                            x={barX}
                            y={pt.y}
                            width={barWidth}
                            height={barHeight}
                            rx={barWidth / 2}
                            ry={barWidth / 2}
                            fill={s.color}
                            opacity={isDimmed ? 0.35 : isHovered ? 1 : 0.92}
                            className="transition-opacity duration-150"
                          />
                          {pt.highlightRing && (
                            <circle
                              cx={barX + barWidth / 2}
                              cy={Math.max(MARGIN.top + 6, pt.y - 8)}
                              r={3.5}
                              fill="#D97706"
                            />
                          )}
                        </g>
                      );
                    });
                  })}
                </g>
              )}

              {/* MODE 2: CLEAN LINE GRAPH WITH VISIBLE DATA POINTS */}
              {dataset.mode === 'line' && (
                <g>
                  {mappedSeries.map((s) => (
                    <g key={s.id}>
                      {s.segments.map((d, segIdx) => (
                        <path
                          key={`${s.id}-seg-${segIdx}`}
                          d={d}
                          fill="none"
                          stroke={s.color}
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}

                      {s.coords.map((pt) => {
                        if (!pt) return null;
                        const isHovered = hoveredIdx === pt.idx;
                        return (
                          <circle
                            key={`${s.id}-pt-${pt.idx}`}
                            cx={pt.x}
                            cy={pt.y}
                            r={isHovered ? 6.5 : 4.75}
                            fill={s.color}
                            stroke="#FFFFFF"
                            strokeWidth={2}
                          />
                        );
                      })}
                    </g>
                  ))}
                </g>
              )}

              {/* X-Axis Labels */}
              {dataset.xLabels.map((lbl, idx) => {
                const x = getX(idx);
                const isHovered = hoveredIdx === idx;
                const isHighlighted = dataset.highlightedIndex === idx;
                const isGap = (dataset.gapIndices || []).includes(idx);
                return (
                  <text
                    key={`${lbl}-${idx}`}
                    x={x}
                    y={SVG_HEIGHT - 12}
                    textAnchor="middle"
                    fontSize="14"
                    fontFamily="Inter, system-ui, sans-serif"
                    fontWeight={isHovered || isHighlighted ? 700 : 500}
                    fill={
                      isHovered || isHighlighted
                        ? '#111827'
                        : isGap
                        ? '#6B7280'
                        : '#4B5563'
                    }
                  >
                    {lbl}
                  </text>
                );
              })}

              {/* Accessible Interactive Hit Columns */}
              {dataset.xLabels.map((lbl, idx) => {
                const cx = getX(idx);
                return (
                  <rect
                    key={`hit-${lbl}-${idx}`}
                    x={cx - hitBandWidth / 2}
                    y={MARGIN.top}
                    width={hitBandWidth}
                    height={PLOT_HEIGHT + 34}
                    fill="transparent"
                    tabIndex={0}
                    role="button"
                    aria-label={`Inspect ${dataset.xFullLabels?.[idx] || lbl}`}
                    className="cursor-pointer focus:outline-none"
                    onMouseEnter={() => setHoveredIdx(idx)}
                    onClick={() => setHoveredIdx((prev) => (prev === idx ? null : idx))}
                    onFocus={() => setHoveredIdx(idx)}
                    onBlur={() => setHoveredIdx(null)}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F9FAFB] px-6 py-14 text-center text-base text-[#4B5563]">
          {emptyMessage}
        </div>
      )}

      {/* Honest Scope & Context Footer */}
      <p className="text-sm text-[#4B5563] leading-relaxed border-t border-[#F1F5F9] pt-3">
        {dataset.contextNote}
      </p>
    </section>
  );
};
