/**
 * AgroShift Gambia — Top Header
 * Matching the Figma UI navigation bar with logo, links, backend connection status, and farmer profile.
 * Replaces window.alert with an inline accessible modal for "HOW IT WORKS".
 */

import React, { useState } from 'react';
import { RefreshCw, X, Sprout, Satellite, Sliders, ShieldCheck } from 'lucide-react';
import { useAgroShift } from '../../context/AgroShiftContext';

export const Header: React.FC = () => {
  const {
    backendHealth,
    checkHealth,
    goToStep,
    currentStep,
    location,
    isAuthenticated,
    farmerUser,
    startAuthFlow,
    logout,
  } = useAgroShift();
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  const initials = farmerUser?.fullName
    ? farmerUser.fullName
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || '')
        .join('')
    : 'FA';

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div
            onClick={() => goToStep('overview')}
            className="flex items-center cursor-pointer select-none group"
          >
            <div className="w-36 h-14 overflow-hidden flex items-center justify-start">
              <img
                src="/assets/aistudio/logo_agroshift_af326e9b.jpeg"
                alt="AgroShift Gambia"
                className="w-full h-full object-cover object-center transition-opacity group-hover:opacity-90"
              />
            </div>
          </div>

          {/* Center Nav Links (from Figma P1 - shown only on landing page) */}
          {currentStep === 'overview' && (
            <nav className="hidden md:flex items-center gap-1 bg-green-900/90 text-white px-3 py-1.5 rounded-full text-sm font-medium shadow-sm">
              <button
                onClick={() => goToStep('overview')}
                className={`px-3 py-1 rounded-full transition cursor-pointer ${
                  currentStep === 'overview'
                    ? 'bg-white text-green-950 font-semibold shadow-xs'
                    : 'text-green-100 hover:text-white'
                }`}
              >
                HOME
              </button>
              <button
                onClick={() => goToStep('choose-field')}
                className="px-3 py-1 rounded-full text-green-100 hover:text-white transition cursor-pointer"
              >
                MY FARM
              </button>
              <button
                onClick={() => goToStep('evidence')}
                className="px-3 py-1 rounded-full text-green-100 hover:text-white transition cursor-pointer"
              >
                DATA EVIDENCE
              </button>
              <button
                onClick={() => goToStep('strategies')}
                className="px-3 py-1 rounded-full text-green-100 hover:text-white transition cursor-pointer"
              >
                STRATEGIES
              </button>
              <button
                onClick={() => setShowHowItWorks(true)}
                className="px-3 py-1 rounded-full text-green-100 hover:text-white transition cursor-pointer"
              >
                HOW IT WORKS
              </button>
            </nav>
          )}

          {/* Right Section: Backend Connection Pill & Farmer Profile / Auth */}
          <div className="flex items-center gap-3">
            {/* Live Backend Connection Indicator */}
            <div
              title={
                backendHealth.error
                  ? `FastAPI Backend (${backendHealth.url}): ${backendHealth.error}`
                  : `FastAPI Backend: ${backendHealth.url} (${backendHealth.status})`
              }
              className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50/80"
            >
              <span className="relative flex h-2 w-2">
                {backendHealth.status === 'online' ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-600"></span>
                  </>
                ) : backendHealth.status === 'checking' ? (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                )}
              </span>
              <span className="text-xs text-gray-700 font-medium">
                {backendHealth.status === 'online'
                  ? 'FastAPI Online'
                  : backendHealth.status === 'checking'
                  ? 'Connecting...'
                  : 'API Offline'}
              </span>
              <button
                onClick={() => checkHealth()}
                className="text-gray-500 hover:text-gray-700 ml-0.5 p-0.5 transition cursor-pointer"
                title="Ping Backend Health"
                aria-label="Ping Backend Health"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${backendHealth.status === 'checking' ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Farmer Profile / Auth Actions */}
            {isAuthenticated && farmerUser ? (
              <div className="flex items-center gap-2.5 pl-2.5 border-l border-gray-200">
                <div className="w-8 h-8 rounded-full bg-green-800 text-white flex items-center justify-center text-xs font-semibold">
                  {initials}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <p className="text-sm font-medium text-gray-900">{farmerUser.fullName}</p>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="text-xs font-normal text-gray-500 hover:text-gray-800 cursor-pointer"
                  >
                    Log out
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2.5 border-l border-gray-200">
                <button
                  type="button"
                  onClick={() => startAuthFlow('login', currentStep === 'overview' ? 'choose-field' : currentStep)}
                  className="text-sm font-medium text-green-800 hover:underline px-2 py-1 cursor-pointer"
                >
                  Log in
                </button>
                <div className="hidden sm:block text-left leading-tight">
                  <p className="text-xs font-normal text-gray-500">{location.district}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Accessible Inline "How It Works" Modal */}
      {showHowItWorks && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="how-it-works-title"
        >
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <Sprout className="w-5 h-5 text-green-800" />
                <h3 id="how-it-works-title" className="text-lg font-semibold text-gray-900">
                  How AgroShift Gambia Works
                </h3>
              </div>
              <button
                onClick={() => setShowHowItWorks(false)}
                className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-gray-700 leading-relaxed font-normal">
              <div className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <Satellite className="w-4 h-4 text-green-700 shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900 mb-0.5">1. Multi-Source Environmental Evidence</p>
                  <p>
                    Reviews 2015–2025 NASA POWER (MERRA-2 &amp; GPM IMERG) rainfall/dry spells, MODIS NDVI dry-season cover, NASA SMAP soil moisture, ISRIC SoilGrids, and SRTM elevation for the pilot area.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <Sliders className="w-4 h-4 text-amber-600 shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900 mb-0.5">2. Farmer Context &amp; Practical Limits</p>
                  <p>
                    Combines your field boundary, 3-season rotation history, priorities (water, soil, food, income, labour), and real seed/budget/water limits.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-gray-900 mb-0.5">3. Transparent Decision Support</p>
                  <p>
                    The FastAPI decision engine compares your current practice against three candidate rotations (Options A, B, and C) with explicit evidence sources, data gaps, and readiness conditions — never yield guarantees.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button
                onClick={() => setShowHowItWorks(false)}
                className="px-5 py-2.5 bg-green-800 hover:bg-green-900 text-white rounded-lg text-sm font-semibold transition cursor-pointer"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
