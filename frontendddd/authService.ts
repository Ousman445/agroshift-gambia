/**
 * AgroShift Gambia — Farmer Authentication Service Interface
 *
 * Isolated passwordless phone-OTP service ready for FastAPI backend integration.
 * Uses Gambian (+220) phone validation, HTTP cookies (`credentials: 'include'`),
 * and optional VITE_AUTH_API_URL override.
 *
 * IMPORTANT:
 * - Inspected backend (app/main.py v2.2.0) currently exposes field/strategy endpoints only
 *   and does NOT yet expose /api/v2/auth/* endpoints.
 * - Never fakes SMS delivery, never accepts arbitrary OTP codes, and never uses
 *   localStorage flags as secure authentication.
 *
 * Required Backend Endpoints for Full End-to-End Verification:
 *   1. POST /api/v2/auth/signup/request-otp   { full_name, address, phone_e164 }
 *   2. POST /api/v2/auth/signup/verify-otp    { phone_e164, code, verification_id? }
 *   3. POST /api/v2/auth/login/request-otp    { phone_e164 }
 *   4. POST /api/v2/auth/login/verify-otp     { phone_e164, code, verification_id? }
 *   5. GET  /api/v2/auth/session              -> { authenticated, farmer }
 *   6. POST /api/v2/auth/logout               -> { ok: true }
 */

import { AuthSession } from '../types/agroshift';
import { API_BASE_URL } from './api';

const RAW_AUTH_URL = (import.meta.env.VITE_AUTH_API_URL as string | undefined)?.trim();
const AUTH_BASE_URL =
  !import.meta.env.DEV && RAW_AUTH_URL && /^https?:\/\/\S+$/i.test(RAW_AUTH_URL)
    ? RAW_AUTH_URL.replace(/\/+$/, '')
    : API_BASE_URL;

export type AuthErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_CODE'
  | 'EXPIRED_CODE'
  | 'ACCOUNT_EXISTS'
  | 'ACCOUNT_NOT_FOUND'
  | 'RATE_LIMITED'
  | 'BACKEND_NOT_IMPLEMENTED'
  | 'NETWORK_ERROR'
  | 'UNKNOWN_ERROR';

export class AuthServiceError extends Error {
  code: AuthErrorCode;
  status?: number;

  constructor(message: string, code: AuthErrorCode, status?: number) {
    super(message);
    this.name = 'AuthServiceError';
    this.code = code;
    this.status = status;
  }
}

export interface SignupOtpRequest {
  fullName: string;
  address: string;
  phoneLocal: string;
}

export interface LoginOtpRequest {
  phoneLocal: string;
}

export interface OtpChallengeResponse {
  verificationId?: string;
  phoneE164: string;
  maskedPhone: string;
  expiresInSeconds?: number;
  resendAvailableInSeconds?: number;
}

export interface VerifyOtpRequest {
  phoneE164: string;
  code: string;
  verificationId?: string;
  fullName?: string;
  address?: string;
}

export interface PhoneValidationResult {
  valid: boolean;
  localDigits: string;
  e164: string;
  masked: string;
  formattedLocal: string;
  error?: string;
}

/**
 * Validates and normalizes Gambian (+220) mobile/landline subscriber numbers.
 * Gambian numbers have 7 digits after +220 (e.g., 7XX XXXX, 9XX XXXX, 2XX XXXX, 3XX XXXX, 5XX XXXX, 6XX XXXX).
 */
export function validateGambianPhone(rawInput: string): PhoneValidationResult {
  const cleaned = rawInput.replace(/[\s\-().]/g, '').trim();
  let digits = cleaned;

  if (digits.startsWith('+220')) {
    digits = digits.slice(4);
  } else if (digits.startsWith('00220')) {
    digits = digits.slice(5);
  } else if (digits.startsWith('220') && digits.length === 10) {
    digits = digits.slice(3);
  }

  if (!digits) {
    return {
      valid: false,
      localDigits: '',
      e164: '',
      masked: '',
      formattedLocal: '',
      error: 'Enter your 7-digit Gambian phone number.',
    };
  }

  if (!/^\d+$/.test(digits)) {
    return {
      valid: false,
      localDigits: digits,
      e164: '',
      masked: '',
      formattedLocal: digits,
      error: 'Phone number should contain digits only.',
    };
  }

  if (digits.length !== 7) {
    return {
      valid: false,
      localDigits: digits,
      e164: '',
      masked: '',
      formattedLocal: digits,
      error: 'Gambian phone numbers must be 7 digits after +220 (for example, 712 3456).',
    };
  }

  if (!/^[2-9]/.test(digits)) {
    return {
      valid: false,
      localDigits: digits,
      e164: '',
      masked: '',
      formattedLocal: digits,
      error: 'Enter a valid Gambian subscriber number after +220.',
    };
  }

  const e164 = `+220${digits}`;
  const formattedLocal = `${digits.slice(0, 3)} ${digits.slice(3)}`;
  const masked = `+220 ••• ${digits.slice(3)}`;

  return {
    valid: true,
    localDigits: digits,
    e164,
    masked,
    formattedLocal,
  };
}

export function maskPhoneE164(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '');
  if (digits.length >= 7) {
    const tail = digits.slice(-4);
    return `+220 ••• ${tail}`;
  }
  return phoneE164;
}

async function authFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${AUTH_BASE_URL}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...((options.headers as Record<string, string>) || {}),
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let detail = '';
      let errorCode: string | undefined;
      try {
        const body = await response.json();
        detail = typeof body?.detail === 'string' ? body.detail : body?.message || '';
        errorCode = body?.code;
      } catch {
        // Non-JSON response
      }

      if (response.status === 404 || response.status === 501) {
        throw new AuthServiceError(
          `Phone verification backend endpoint (${path}) is not deployed yet on the server (HTTP ${response.status}).`,
          'BACKEND_NOT_IMPLEMENTED',
          response.status
        );
      }

      if (response.status === 409 || errorCode === 'ACCOUNT_EXISTS') {
        throw new AuthServiceError(
          detail || 'An account with this phone number already exists. Please log in instead.',
          'ACCOUNT_EXISTS',
          response.status
        );
      }

      if (response.status === 410 || errorCode === 'EXPIRED_CODE' || /expired/i.test(detail)) {
        throw new AuthServiceError(
          detail || 'This verification code has expired. Please request a new code.',
          'EXPIRED_CODE',
          response.status
        );
      }

      if (response.status === 400 || response.status === 401 || errorCode === 'INVALID_CODE') {
        throw new AuthServiceError(
          detail || 'That verification code does not match. Please check the 6 digits and try again.',
          'INVALID_CODE',
          response.status
        );
      }

      if (response.status === 429) {
        throw new AuthServiceError(
          detail || 'Too many verification requests. Please wait a moment before trying again.',
          'RATE_LIMITED',
          response.status
        );
      }

      throw new AuthServiceError(
        detail || `Authentication request failed (HTTP ${response.status}).`,
        'UNKNOWN_ERROR',
        response.status
      );
    }

    return (await response.json()) as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err instanceof AuthServiceError) {
      throw err;
    }
    throw new AuthServiceError(
      'Unable to reach the authentication service right now. Check your connection and try again.',
      'NETWORK_ERROR'
    );
  }
}

export const authService = {
  async getSession(): Promise<AuthSession | null> {
    try {
      const res = await authFetch<{ authenticated: boolean; farmer?: AuthSession['farmer']; expires_at?: string }>(
        '/api/v2/auth/session'
      );
      if (res?.authenticated && res.farmer) {
        return {
          authenticated: true,
          farmer: res.farmer,
          expiresAt: res.expires_at,
        };
      }
      return null;
    } catch (err) {
      // If backend auth endpoints are not yet deployed or unreachable, do not fake a session
      if (err instanceof AuthServiceError && err.code === 'BACKEND_NOT_IMPLEMENTED') {
        return null;
      }
      return null;
    }
  },

  async requestSignupVerification(payload: SignupOtpRequest): Promise<OtpChallengeResponse> {
    const phoneCheck = validateGambianPhone(payload.phoneLocal);
    if (!phoneCheck.valid) {
      throw new AuthServiceError(phoneCheck.error || 'Invalid phone number.', 'INVALID_INPUT');
    }

    const res = await authFetch<{
      verification_id?: string;
      phone_e164?: string;
      expires_in_seconds?: number;
      resend_available_in_seconds?: number;
    }>('/api/v2/auth/signup/request-otp', {
      method: 'POST',
      body: JSON.stringify({
        full_name: payload.fullName.trim(),
        address: payload.address.trim(),
        phone_e164: phoneCheck.e164,
      }),
    });

    const e164 = res.phone_e164 || phoneCheck.e164;
    return {
      verificationId: res.verification_id,
      phoneE164: e164,
      maskedPhone: maskPhoneE164(e164),
      expiresInSeconds: res.expires_in_seconds,
      resendAvailableInSeconds: res.resend_available_in_seconds ?? 45,
    };
  },

  async verifySignupOtp(payload: VerifyOtpRequest): Promise<AuthSession> {
    if (!/^\d{6}$/.test(payload.code)) {
      throw new AuthServiceError('Please enter the 6-digit verification code.', 'INVALID_CODE');
    }

    const res = await authFetch<{
      authenticated?: boolean;
      farmer?: {
        id: string;
        full_name: string;
        address: string;
        phone_e164: string;
        verified_at?: string;
      };
      expires_at?: string;
    }>('/api/v2/auth/signup/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        phone_e164: payload.phoneE164,
        code: payload.code,
        verification_id: payload.verificationId,
        full_name: payload.fullName,
        address: payload.address,
      }),
    });

    if (!res?.authenticated || !res.farmer) {
      throw new AuthServiceError(
        'Verification response was incomplete. Account session could not be confirmed.',
        'UNKNOWN_ERROR'
      );
    }

    return {
      authenticated: true,
      farmer: {
        id: res.farmer.id,
        fullName: res.farmer.full_name,
        address: res.farmer.address,
        phoneE164: res.farmer.phone_e164,
        verifiedAt: res.farmer.verified_at,
      },
      expiresAt: res.expires_at,
    };
  },

  async requestLoginVerification(payload: LoginOtpRequest): Promise<OtpChallengeResponse> {
    const phoneCheck = validateGambianPhone(payload.phoneLocal);
    if (!phoneCheck.valid) {
      throw new AuthServiceError(phoneCheck.error || 'Invalid phone number.', 'INVALID_INPUT');
    }

    const res = await authFetch<{
      verification_id?: string;
      phone_e164?: string;
      expires_in_seconds?: number;
      resend_available_in_seconds?: number;
    }>('/api/v2/auth/login/request-otp', {
      method: 'POST',
      body: JSON.stringify({
        phone_e164: phoneCheck.e164,
      }),
    });

    const e164 = res.phone_e164 || phoneCheck.e164;
    return {
      verificationId: res.verification_id,
      phoneE164: e164,
      maskedPhone: maskPhoneE164(e164),
      expiresInSeconds: res.expires_in_seconds,
      resendAvailableInSeconds: res.resend_available_in_seconds ?? 45,
    };
  },

  async verifyLoginOtp(payload: VerifyOtpRequest): Promise<AuthSession> {
    if (!/^\d{6}$/.test(payload.code)) {
      throw new AuthServiceError('Please enter the 6-digit verification code.', 'INVALID_CODE');
    }

    const res = await authFetch<{
      authenticated?: boolean;
      farmer?: {
        id: string;
        full_name: string;
        address: string;
        phone_e164: string;
        verified_at?: string;
      };
      expires_at?: string;
    }>('/api/v2/auth/login/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        phone_e164: payload.phoneE164,
        code: payload.code,
        verification_id: payload.verificationId,
      }),
    });

    if (!res?.authenticated || !res.farmer) {
      throw new AuthServiceError(
        'Login verification could not be confirmed by the server.',
        'UNKNOWN_ERROR'
      );
    }

    return {
      authenticated: true,
      farmer: {
        id: res.farmer.id,
        fullName: res.farmer.full_name,
        address: res.farmer.address,
        phoneE164: res.farmer.phone_e164,
        verifiedAt: res.farmer.verified_at,
      },
      expiresAt: res.expires_at,
    };
  },

  async logout(): Promise<void> {
    try {
      await authFetch('/api/v2/auth/logout', { method: 'POST' });
    } catch {
      // Clear client session state even if logout endpoint is not yet deployed
    }
  },
};
