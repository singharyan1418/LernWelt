export interface CredentialValidationResult {
  valid: boolean;
  normalizedEmail: string;
  error?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeEmail(rawEmail: string): string {
  return String(rawEmail || '').trim().toLowerCase();
}

export function maskEmailAddress(email: string): string {
  const clean = normalizeEmail(email);
  const [local, domain] = clean.split('@');
  if (!local || !domain) return clean;
  if (local.length <= 2) {
    return `${local[0] || '*'}*@${domain}`;
  }
  return `${local.slice(0, 2)}${'*'.repeat(Math.min(5, local.length - 2))}@${domain}`;
}

export function validateCredentialsInput(params: {
  email: string;
  password: string;
  mode: 'signin' | 'signup';
  name?: string;
}): CredentialValidationResult {
  const normalizedEmail = normalizeEmail(params.email);

  if (params.mode === 'signup') {
    const cleanName = String(params.name || '').trim();
    if (cleanName.length < 2) {
      return {
        valid: false,
        normalizedEmail,
        error: 'Please enter your full name (at least 2 characters).'
      };
    }
  }

  if (!normalizedEmail || !EMAIL_REGEX.test(normalizedEmail)) {
    return {
      valid: false,
      normalizedEmail,
      error: 'Please enter a valid email address (for example, name@example.com).'
    };
  }

  const rawPassword = String(params.password || '');
  if (rawPassword.length < 6) {
    return {
      valid: false,
      normalizedEmail,
      error: 'Password must be at least 6 characters long.'
    };
  }

  return {
    valid: true,
    normalizedEmail
  };
}

export function validateOtpCodeFormat(rawOtp: string): { valid: boolean; cleanOtp: string; error?: string } {
  const cleanOtp = String(rawOtp || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanOtp)) {
    return {
      valid: false,
      cleanOtp,
      error: 'Please enter the complete 6-digit OTP code sent to your email.'
    };
  }
  return {
    valid: true,
    cleanOtp
  };
}

export function deriveDisplayNameFromEmail(email: string): string {
  const local = normalizeEmail(email).split('@')[0] || 'learner';
  const formatted = local
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
  return formatted.length >= 2 ? formatted : 'Verified Learner';
}
