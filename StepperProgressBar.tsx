/**
 * AgroShift Gambia — Stepper Progress Bar
 * Dual-tone green and amber progress indicator matching the Figma screens 2-5.
 */

import React from 'react';
import { useAgroShift } from '../../context/AgroShiftContext';
import { ScreenStep } from '../../types/agroshift';

const STEP_TITLES: Record<ScreenStep, { title: string; subtitle: string; progress: number }> = {
  'overview': { title: 'Overview', subtitle: 'AgroShift Gambia crop rotation', progress: 0 },
  'farmer-signup': { title: 'Farmer Sign Up', subtitle: 'Create your farmer account', progress: 0 },
  'farmer-login': { title: 'Farmer Log In', subtitle: 'Verify your phone number', progress: 0 },
  'choose-field': { title: 'Choose a Field', subtitle: 'Field analysis · Step 1 of 4', progress: 25 },
  'field-details': { title: 'Field Details', subtitle: 'Field analysis · Step 2 of 4', progress: 50 },
  'priorities-limits': { title: 'Farmer Priorities & Limits', subtitle: 'Field analysis · Step 3 of 4', progress: 75 },
  'analysis': { title: 'Analysing Your Field', subtitle: 'Reviewing environmental evidence', progress: 90 },
  'evidence': { title: 'What the Data Says', subtitle: 'NASA environmental conditions & indicators', progress: 100 },
  'strategies': { title: 'Three Options', subtitle: 'Your current practice & two alternative rotations', progress: 100 },
  'strategy-detail': { title: 'Strategy Detail', subtitle: 'Explore seasonal timeline & evidence', progress: 100 },
  'compare-report': { title: 'Compare & Take Away', subtitle: 'Strategic trade-offs & personalized farmer report', progress: 100 },
};

export const StepperProgressBar: React.FC = () => {
  const { currentStep } = useAgroShift();
  const info = STEP_TITLES[currentStep];

  if (currentStep === 'overview' || currentStep === 'farmer-signup' || currentStep === 'farmer-login') {
    return null;
  }

  if (currentStep === 'field-details') {
    return (
      <div className="mb-6">
        <h1 className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          {info.title}
        </h1>
        <p className="text-sm text-gray-600 font-normal mt-1.5 mb-2.5">Field analysis</p>

        {/* Dual-tone orange & dark-green progress bar matching reference */}
        <div className="w-full max-w-4xl h-2.5 rounded-full overflow-hidden flex">
          <div className="bg-[#ea7b15] h-full w-[54%] rounded-l-full" />
          <div className="bg-[#116b37] h-full w-[46%] rounded-r-full" />
        </div>
      </div>
    );
  }

  if (currentStep === 'priorities-limits') {
    return (
      <div className="mb-6">
        <h1 className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Farmer Priorities &amp; Limits
        </h1>
        <p className="text-sm text-gray-600 font-normal mt-1.5 mb-2.5">Field analysis</p>

        {/* Dual-tone orange & dark-green progress bar matching Figma Page 4 */}
        <div className="w-full max-w-4xl h-2.5 rounded-full overflow-hidden flex">
          <div className="bg-[#ea7b15] h-full w-[74%] rounded-l-full" />
          <div className="bg-[#116b37] h-full w-[26%] rounded-r-full" />
        </div>
      </div>
    );
  }

  if (currentStep === 'analysis') {
    return (
      <div className="mb-6">
        <h1 className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Analysing Your Field
        </h1>
        <p className="text-sm text-gray-600 font-normal mt-1.5">
          We&apos;re gathering and analysing data from multiple sources
        </p>
        <p className="text-[13px] text-gray-600 font-normal mt-3 mb-1.5">Field analysis</p>

        {/* Full orange progress bar matching Figma Page 5 */}
        <div className="w-full max-w-4xl h-2.5 rounded-full overflow-hidden bg-gray-200">
          <div className="bg-[#ea7b15] h-full w-full rounded-full" />
        </div>
      </div>
    );
  }

  if (currentStep === 'strategies') {
    return (
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Three Options
        </h1>
        <p className="text-sm text-gray-600 font-normal mt-1.5">
          Your current rotation and two alternative strategies
        </p>
      </div>
    );
  }

  if (currentStep === 'evidence') {
    return (
      <div className="mb-6 pb-5 border-b border-[#E5E7EB] w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <p className="text-sm font-semibold text-[#1E5631]">
            Step 4 of 7 · Field Environmental Analysis
          </p>
          <div className="w-40 h-2 rounded-full bg-gray-200 overflow-hidden" aria-hidden="true">
            <div className="h-full bg-[#1E5631] rounded-full w-[57%]" />
          </div>
        </div>
        <h1 className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight text-[#111827]">
          What the Data Says
        </h1>
        <p className="text-base text-[#4B5563] font-normal mt-1.5 leading-relaxed">
          Environmental conditions and key indicators for your field.
        </p>
      </div>
    );
  }

  if (currentStep === 'strategy-detail') {
    return (
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Strategy Detail
        </h1>
        <p className="text-sm sm:text-base text-gray-600 font-normal mt-1">
          Explore the crop sequence and evidence for this strategy.
        </p>
      </div>
    );
  }

  if (currentStep === 'compare-report') {
    return (
      <div className="mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight text-gray-900">
          Compare &amp; Take Away
        </h1>
        <p className="text-sm sm:text-base text-gray-600 font-normal mt-1">
          See the full comparison and get your personalised summary.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between gap-4 mb-2.5">
        <div>
          <h1 className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight text-gray-900">
            {info.title}
          </h1>
          <p className="text-sm text-gray-600 font-normal mt-1">{info.subtitle}</p>
        </div>
        <div className="text-[13px] font-medium text-green-800 bg-green-50 px-3 py-1 rounded-full border border-green-200 shrink-0 tabular-nums">
          {info.progress}% Complete
        </div>
      </div>

      {/* Stepper bar with dual-tone progress as in Figma */}
      <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden flex">
        <div
          className="bg-amber-500 h-full transition-all duration-300"
          style={{ width: `${Math.min(info.progress, 35)}%` }}
        />
        <div
          className="bg-green-700 h-full transition-all duration-300"
          style={{ width: `${Math.max(0, info.progress - 35)}%` }}
        />
      </div>
    </div>
  );
};
