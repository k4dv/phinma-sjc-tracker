/**
 * PHINMA SJC Portal Security Utility
 * Web Crypto API with resilient fallback for non-HTTPS / LAN IP testing
 */

const SALT = 'SJC_CAMPUS_SECURE_SALT_2026_@!';

// Lightweight pure JS SHA-256 implementation fallback
function sha256Fallback(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let lengthProperty = 'length';
  let i, j;
  let result = '';

  const words = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash = [];
  const k = [];
  let primeCounter = 0;

  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return;
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15],
        w2 = w[i - 2];

      const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
      const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
      w[i] =
        i < 16
          ? w[i]
          : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

      const s1h = rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25);
      const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
      const temp1 = (hash[7] + s1h + ch + k[i] + w[i]) | 0;
      const s0h = rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22);
      const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
      const temp2 = (s0h + maj) | 0;

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (let b = 3; b >= 0; b--) {
      const byte = (hash[i] >> (b * 8)) & 255;
      result += (byte < 16 ? '0' : '') + byte.toString(16);
    }
  }
  return result;
}

export async function hashPassword(plainText) {
  if (!plainText) return '';
  const salted = plainText + SALT;

  // Use native Web Crypto if running under HTTPS or localhost
  if (typeof window !== 'undefined' && window.crypto?.subtle?.digest) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(salted);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {}
  }

  // Fallback for non-secure contexts / LAN IPs
  return sha256Fallback(salted);
}

export function sanitizeUser(userObj) {
  if (!userObj) return null;
  const safe = { ...userObj };
  delete safe.password;
  delete safe.password_hash;
  delete safe.secret;
  delete safe.admin_passcode;
  return safe;
}

const PREDICTABLE_PATTERNS = [
  '1234',
  '12345',
  '123456',
  '654321',
  'password',
  'pass123',
  'qwerty',
  'asdfgh',
  'admin',
  'phinma',
  'sjc123',
  'stjude',
  'welcome',
  'letmein',
  'abc123',
  'abcdef',
  '0000',
  '1111',
  '2222',
  '9999'
];

/**
 * Validates modern password requirements & checks against easy/personal patterns:
 * - At least 1 lowercase letter (a-z)
 * - At least 1 uppercase letter (A-Z)
 * - At least 1 number (0-9)
 * - At least 1 special character (!@#$%^&* etc.)
 * - Does not include personal info (Name or Staff ID)
 * - Does not use predictable/easy patterns (1234, password, qwerty, etc.)
 */
export function validatePasswordStrength(password = '', userContext = {}) {
  const str = String(password);
  const lowerStr = str.toLowerCase();

  const hasLowercase = /[a-z]/.test(str);
  const hasUppercase = /[A-Z]/.test(str);
  const hasNumber = /[0-9]/.test(str);
  const hasSpecial = /[^A-Za-z0-9\s]/.test(str);
  const hasMinLength = str.length >= 6;
  const hasAllCharTypes = hasLowercase && hasUppercase && hasNumber && hasSpecial;

  // Check if password contains user's personal info (name tokens or ID)
  let includesPersonalInfo = false;
  if (str.length > 0) {
    const cleanId = String(userContext?.id || '').trim().toLowerCase();
    if (cleanId && cleanId.length >= 2 && lowerStr.includes(cleanId)) {
      includesPersonalInfo = true;
    }

    const rawName = String(userContext?.name || '').trim().toLowerCase();
    const ignoredTitles = ['kuya', 'ate', 'staff', 'member', 'admin', 'supervisor', 'facilities'];
    const nameTokens = rawName
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !ignoredTitles.includes(t));

    if (nameTokens.some((token) => lowerStr.includes(token))) {
      includesPersonalInfo = true;
    }

    const emailPrefix = String(userContext?.email || '').split('@')[0]?.toLowerCase();
    if (emailPrefix && emailPrefix.length >= 4 && lowerStr.includes(emailPrefix)) {
      includesPersonalInfo = true;
    }
  }

  // Check for predictable dictionary patterns, keyboard walks, or 4+ repeated chars
  let isPredictable = false;
  if (str.length > 0) {
    const hasCommonPattern = PREDICTABLE_PATTERNS.some((pat) => lowerStr.includes(pat));
    const hasRepeatedChars = /(.)\1{3,}/.test(lowerStr);
    isPredictable = hasCommonPattern || hasRepeatedChars;
  }

  const noPersonalInfo = str.length > 0 && !includesPersonalInfo;
  const noPredictablePatterns = str.length > 0 && !isPredictable;

  const isValid =
    hasMinLength &&
    hasAllCharTypes &&
    noPersonalInfo &&
    noPredictablePatterns;

  // Determine primary warning message when user is typing
  let warningMessage = '';
  if (str.length > 0 && !isValid) {
    if (includesPersonalInfo) {
      warningMessage = 'Too easy: Password includes your name or Staff ID.';
    } else if (isPredictable) {
      warningMessage = 'Too easy: Avoid predictable sequences (e.g., 1234, password, sjc).';
    } else if (!hasAllCharTypes) {
      warningMessage = 'Conditions not met: Must mix uppercase, lowercase, number, and symbol.';
    } else if (!hasMinLength) {
      warningMessage = 'Too short: Password must be at least 6 characters long.';
    }
  }

  return {
    isValid,
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSpecial,
    hasMinLength,
    hasAllCharTypes,
    noPersonalInfo,
    noPredictablePatterns,
    includesPersonalInfo,
    isPredictable,
    warningMessage
  };
}