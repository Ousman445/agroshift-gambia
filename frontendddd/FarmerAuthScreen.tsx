/**
 * AgroShift Gambia — Farmer Signup & Returning Farmer Login
 * Faithful to the Figma signup design (signup_5fe012b0.pdf):
 *   - Responsive 2-column layout (Form left, Photographic Farmer Intro right)
 *   - Validates Full name, Address, and +220 Gambian phone number
 *   - Proceeds directly to Choose a Field once required spaces are filled (no SMS OTP gate)
 */

import React, { useEffect, useState } from 'react';
import { useAgroShift } from '../../context/AgroShiftContext';
import { validateGambianPhone } from '../../services/authService';
import { X } from 'lucide-react';

interface FarmerAuthScreenProps {
  mode: 'signup' | 'login';
}

export const FarmerAuthScreen: React.FC<FarmerAuthScreenProps> = ({ mode }) => {
  const {
    goToStep,
    signupDraft,
    setSignupDraft,
    completeAuthSession,
  } = useAgroShift();

  const isSignup = mode === 'signup';

  const [fullName, setFullName] = useState<string>(signupDraft.fullName || '');
  const [address, setAddress] = useState<string>(signupDraft.address || '');
  const [phoneLocal, setPhoneLocal] = useState<string>(signupDraft.phoneLocal || '');

  const [fieldErrors, setFieldErrors] = useState<{
    fullName?: string;
    address?: string;
    phone?: string;
  }>({});

  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);

  // Keep draft inputs synced across mode switches
  useEffect(() => {
    setSignupDraft({ fullName, address, phoneLocal });
  }, [fullName, address, phoneLocal, setSignupDraft]);

  useEffect(() => {
    setFieldErrors({});
  }, [mode]);

  const validateForm = (): boolean => {
    const errors: typeof fieldErrors = {};

    if (isSignup) {
      if (!fullName.trim()) {
        errors.fullName = 'Please enter your full name.';
      } else if (fullName.trim().length < 2) {
        errors.fullName = 'Full name should be at least 2 characters.';
      }

      if (!address.trim()) {
        errors.address = 'Please enter your village or town, and region.';
      } else if (address.trim().length < 3) {
        errors.address = 'Please provide a village, town, or region name.';
      }
    }

    const phoneValidation = validateGambianPhone(phoneLocal);
    if (!phoneValidation.valid) {
      errors.phone = phoneValidation.error;
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const phoneValidation = validateGambianPhone(phoneLocal);
    const trimmedName = fullName.trim();
    const trimmedAddress = address.trim();

    completeAuthSession({
      authenticated: true,
      farmer: {
        id: `farmer-${phoneValidation.localDigits}`,
        fullName: isSignup ? trimmedName : trimmedName || 'Returning Farmer',
        address: isSignup ? trimmedAddress : trimmedAddress || 'The Gambia',
        phoneE164: phoneValidation.e164,
      },
    });
  };

  return (
    <div className="min-h-screen bg-white grid grid-cols-1 lg:grid-cols-12">
      {/* ================================================================== */}
      {/* LEFT COLUMN — Farmer Signup / Login Form                           */}
      {/* ================================================================== */}
      <div className="lg:col-span-6 flex flex-col justify-between px-5 sm:px-10 lg:px-14 py-6 sm:py-8">
        {/* Top Logo + Account Switch Link */}
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => goToStep('overview')}
            className="flex items-center cursor-pointer group focus-visible:outline-2 focus-visible:outline-[#116b37] rounded-lg"
            aria-label="Back to AgroShift landing page"
          >
            <div className="w-32 h-12 overflow-hidden flex items-center justify-start">
              <img
                src="/assets/aistudio/logo_agroshift_af326e9b.jpeg"
                alt="AgroShift Gambia"
                className="w-full h-full object-cover object-center group-hover:opacity-90 transition-opacity"
              />
            </div>
          </button>

          <div className="flex items-center gap-2 text-sm">
            {isSignup ? (
              <>
                <span className="text-gray-500">Already have an account?</span>
                <button
                  type="button"
                  onClick={() => goToStep('farmer-login')}
                  className="font-semibold text-[#116b37] hover:underline cursor-pointer"
                >
                  Log in
                </button>
              </>
            ) : (
              <>
                <span className="text-gray-500">New to AgroShift?</span>
                <button
                  type="button"
                  onClick={() => goToStep('farmer-signup')}
                  className="font-semibold text-[#116b37] hover:underline cursor-pointer"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>

        {/* Centered Form Card Body */}
        <div className="w-full max-w-[420px] mx-auto my-auto py-8 sm:py-10">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {/* Centered Heading */}
            <div className="text-center space-y-2 pb-2">
              <p className="text-xs font-semibold tracking-wider text-[#116b37] uppercase">
                {isSignup ? 'FARMER SIGN UP' : 'FARMER LOG IN'}
              </p>
              <h1 className="text-3xl sm:text-[32px] font-bold text-gray-900 tracking-tight leading-tight">
                {isSignup ? 'Create your account' : 'Welcome back'}
              </h1>
              <p className="text-sm sm:text-base text-gray-500">
                {isSignup
                  ? 'Tell us a little about yourself to get started.'
                  : 'Enter your phone number to continue to your field.'}
              </p>
              <p className="text-xs text-gray-400">
                {isSignup ? 'All fields are required.' : 'No password needed.'}
              </p>
            </div>

            {/* Full Name (Signup only) */}
            {isSignup && (
              <div className="space-y-1.5">
                <label
                  htmlFor="farmer-full-name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Full name
                </label>
                <input
                  id="farmer-full-name"
                  type="text"
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (fieldErrors.fullName) {
                      setFieldErrors((prev) => ({ ...prev, fullName: undefined }));
                    }
                  }}
                  placeholder="Enter your full name"
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  className={`w-full h-11 px-3.5 rounded-lg border text-sm text-gray-900 placeholder:text-gray-400 transition focus:outline-none focus:ring-2 ${
                    fieldErrors.fullName
                      ? 'border-red-400 focus:ring-red-200 focus:border-red-500'
                      : 'border-gray-200 focus:ring-[#116b37]/20 focus:border-[#116b37]'
                  }`}
                />
                {fieldErrors.fullName && (
                  <p className="text-xs text-red-600">{fieldErrors.fullName}</p>
                )}
              </div>
            )}

            {/* Address (Signup only) */}
            {isSignup && (
              <div className="space-y-1.5">
                <label
                  htmlFor="farmer-address"
                  className="block text-sm font-medium text-gray-700"
                >
                  Address
                </label>
                <textarea
                  id="farmer-address"
                  rows={3}
                  autoComplete="street-address"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    if (fieldErrors.address) {
                      setFieldErrors((prev) => ({ ...prev, address: undefined }));
                    }
                  }}
                  placeholder="Enter your village or town, and region"
                  aria-invalid={Boolean(fieldErrors.address)}
                  className={`w-full px-3.5 py-2.5 rounded-lg border text-sm text-gray-900 placeholder:text-gray-400 resize-none transition focus:outline-none focus:ring-2 ${
                    fieldErrors.address
                      ? 'border-red-400 focus:ring-red-200 focus:border-red-500'
                      : 'border-gray-200 focus:ring-[#116b37]/20 focus:border-[#116b37]'
                  }`}
                />
                {fieldErrors.address && (
                  <p className="text-xs text-red-600">{fieldErrors.address}</p>
                )}
              </div>
            )}

            {/* Phone Number (+220 fixed prefix) */}
            <div className="space-y-1.5">
              <label
                htmlFor="farmer-phone"
                className="block text-sm font-medium text-gray-700"
              >
                Phone number
              </label>
              <div
                className={`flex items-center h-11 rounded-lg border overflow-hidden bg-white transition focus-within:ring-2 ${
                  fieldErrors.phone
                    ? 'border-red-400 focus-within:ring-red-200 focus-within:border-red-500'
                    : 'border-gray-200 focus-within:ring-[#116b37]/20 focus-within:border-[#116b37]'
                }`}
              >
                <span
                  className="px-3.5 h-full flex items-center text-sm font-medium text-gray-800 border-r border-gray-200 bg-white select-none shrink-0 tabular-nums"
                  aria-label="Country code +220"
                >
                  +220
                </span>
                <input
                  id="farmer-phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  value={phoneLocal}
                  onChange={(e) => {
                    setPhoneLocal(e.target.value);
                    if (fieldErrors.phone) {
                      setFieldErrors((prev) => ({ ...prev, phone: undefined }));
                    }
                  }}
                  placeholder="Enter your phone number"
                  aria-invalid={Boolean(fieldErrors.phone)}
                  className="w-full h-full px-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none tabular-nums"
                />
              </div>
              {fieldErrors.phone && (
                <p className="text-xs text-red-600">{fieldErrors.phone}</p>
              )}
              <div className="text-xs text-gray-400 leading-relaxed pt-0.5 space-y-0.5">
                <p>Use your phone number to continue — no password needed.</p>
              </div>
            </div>

            {/* Submit Button — Goes straight to Choose a Field */}
            <button
              type="submit"
              className="w-full h-11 bg-[#116b37] hover:bg-[#0d542b] text-white font-semibold rounded-lg text-sm transition flex items-center justify-center cursor-pointer"
            >
              <span>{isSignup ? 'Continue' : 'Log in'}</span>
            </button>

            {/* Legal Links */}
            <p className="text-xs text-gray-400 text-center leading-relaxed pt-1">
              By continuing, you agree to our{' '}
              <br className="hidden sm:inline" />
              <button
                type="button"
                onClick={() => setLegalModal('terms')}
                className="text-[#116b37] font-medium hover:underline cursor-pointer"
              >
                Terms of Service
              </button>{' '}
              and{' '}
              <button
                type="button"
                onClick={() => setLegalModal('privacy')}
                className="text-[#116b37] font-medium hover:underline cursor-pointer"
              >
                Privacy Policy
              </button>
              .
            </p>
          </form>
        </div>

        {/* Bottom Tagline matching Figma PDF */}
        <p className="text-xs text-gray-400 text-center pt-4">
          AgroShift · Better choices. Healthier fields.
        </p>
      </div>

      {/* ================================================================== */}
      {/* RIGHT COLUMN — Photographic Gambian Farmer Introduction             */}
      {/* ================================================================== */}
      <div className="lg:col-span-6 p-4 sm:p-5 lg:p-5 flex">
        <div className="relative w-full rounded-2xl overflow-hidden min-h-[500px] lg:min-h-[calc(100vh-2.5rem)] flex flex-col justify-between p-6 sm:p-8 lg:p-10 bg-[#0d2718]">
          <img
            src="/assets/aistudio/image_of_an_african_farmer_holding_a_smart_phone_and_smiling_b3f5391c.jpg"
            alt="Gambian farmer smiling in a green crop field holding a mobile phone"
            className="absolute inset-0 w-full h-full object-cover object-[center_20%]"
          />

          <div
            className="absolute inset-0 bg-gradient-to-t from-[#07190e]/95 via-[#0a2314]/70 to-black/15"
            aria-hidden="true"
          />

          <div className="relative z-10">
            <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-white text-[#116b37] text-xs font-semibold shadow-xs">
              Made for farmers
            </span>
          </div>

          <div className="relative z-10 space-y-6 max-w-lg pt-24">
            <div className="space-y-3">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-green-300/90 uppercase">
                GROW WITH AGROSHIFT
              </p>
              <h2 className="text-3xl sm:text-[36px] font-bold text-white leading-[1.12] tracking-tight">
                A better season starts with you.
              </h2>
              <p className="text-sm sm:text-base text-white/85 leading-relaxed">
                Make confident crop choices with a plan that works for you and your land.
              </p>
            </div>

            <div className="space-y-4 pt-4 border-t border-white/15">
              <div className="flex items-start gap-4">
                <span className="text-xs font-semibold text-white/55 tabular-nums pt-0.5 w-6 shrink-0">
                  01
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Create your farmer account
                  </p>
                  <p className="text-xs sm:text-sm text-white/75 mt-0.5">
                    Start with a few simple details.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="text-xs font-semibold text-white/55 tabular-nums pt-0.5 w-6 shrink-0">
                  02
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Tell us about your field
                  </p>
                  <p className="text-xs sm:text-sm text-white/75 mt-0.5">
                    Add your crops, soil and priorities.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="text-xs font-semibold text-white/55 tabular-nums pt-0.5 w-6 shrink-0">
                  03
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    Explore your crop plan
                  </p>
                  <p className="text-xs sm:text-sm text-white/75 mt-0.5">
                    Compare rotations for the season ahead.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inline Terms / Privacy Modal */}
      {legalModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="legal-modal-title"
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 id="legal-modal-title" className="text-lg font-semibold text-gray-900">
                {legalModal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </h3>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="p-1.5 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-sm text-gray-600 leading-relaxed space-y-2">
              {legalModal === 'terms' ? (
                <>
                  <p>
                    AgroShift Gambia provides crop-rotation decision support based on regional Earth observation datasets and recorded agricultural evidence.
                  </p>
                  <p>
                    Guidance is advisory only and should be confirmed locally with agricultural extension officers before planting.
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Your name, village/region address, and phone number are used solely to personalize your farmer profile and field analysis session.
                  </p>
                  <p>
                    We do not sell or share personal farmer contact details with third parties.
                  </p>
                </>
              )}
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-5 py-2 bg-[#116b37] hover:bg-[#0d542b] text-white rounded-lg text-sm font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
