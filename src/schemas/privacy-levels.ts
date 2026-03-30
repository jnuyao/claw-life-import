// ============================================================
// Privacy Level Definitions & Field Classification Rules
// ============================================================

import { PrivacyLevel } from './canonical-resume';

/**
 * Default privacy classification for resume fields.
 * Maps dot-path field names to their default privacy level.
 */
export const FIELD_PRIVACY_MAP: Record<string, PrivacyLevel> = {
  // === L0: Public — auto-write ===
  'identity.headline':     PrivacyLevel.PUBLIC,
  'identity.timezone':     PrivacyLevel.PUBLIC,
  'experience.*.title':    PrivacyLevel.PUBLIC,
  'experience.*.description': PrivacyLevel.PUBLIC,
  'experience.*.highlights': PrivacyLevel.PUBLIC,
  'experience.*.technologies': PrivacyLevel.PUBLIC,
  'education.*.degree':    PrivacyLevel.PUBLIC,
  'education.*.field':     PrivacyLevel.PUBLIC,
  'skills.technical':      PrivacyLevel.PUBLIC,
  'skills.domain':         PrivacyLevel.PUBLIC,
  'skills.soft':           PrivacyLevel.PUBLIC,
  'skills.certifications': PrivacyLevel.PUBLIC,
  'projects.*.name':       PrivacyLevel.PUBLIC,
  'projects.*.role':       PrivacyLevel.PUBLIC,
  'projects.*.description': PrivacyLevel.PUBLIC,
  'projects.*.technologies': PrivacyLevel.PUBLIC,
  'projects.*.url':        PrivacyLevel.PUBLIC,

  // === L1: General — write by default, can cancel ===
  'identity.name':                PrivacyLevel.GENERAL,
  'identity.location':            PrivacyLevel.GENERAL,
  'experience.*.company':         PrivacyLevel.GENERAL,
  'experience.*.period':          PrivacyLevel.GENERAL,
  'education.*.institution':      PrivacyLevel.GENERAL,
  'education.*.period':           PrivacyLevel.GENERAL,
  'education.*.gpa':              PrivacyLevel.GENERAL,

  // === L2: Sensitive — skip by default, opt-in ===
  'identity.contact.email':       PrivacyLevel.SENSITIVE,
  'identity.contact.phone':       PrivacyLevel.SENSITIVE,
  'identity.contact.linkedin':    PrivacyLevel.SENSITIVE,
  'identity.contact.github':      PrivacyLevel.SENSITIVE,
  'identity.contact.website':     PrivacyLevel.SENSITIVE,

  // === L3: Extremely Sensitive — always discard ===
  // These are detected and removed during extraction, not mapped here.
};

/** Regex patterns for L3 (always-discard) content */
export const L3_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'id_card_cn',     pattern: /\b\d{17}[\dXx]\b/ },
  { name: 'ssn_us',         pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: 'credit_card',    pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/ },
  { name: 'bank_account',   pattern: /\b\d{16,19}\b/ },
  { name: 'password_field',  pattern: /(?:password|密码|口令)\s*[:：]\s*\S+/i },
  { name: 'secret_key',     pattern: /(?:secret|token|api[_-]?key)\s*[:=]\s*\S+/i },
];

/**
 * Get the privacy level for a given field path.
 * Falls back to GENERAL for unknown fields.
 */
export function getFieldPrivacy(fieldPath: string): PrivacyLevel {
  // Direct match
  if (FIELD_PRIVACY_MAP[fieldPath] !== undefined) {
    return FIELD_PRIVACY_MAP[fieldPath];
  }
  // Wildcard match: "experience.0.title" → "experience.*.title"
  const wildcardPath = fieldPath.replace(/\.\d+\./g, '.*.');
  if (FIELD_PRIVACY_MAP[wildcardPath] !== undefined) {
    return FIELD_PRIVACY_MAP[wildcardPath];
  }
  return PrivacyLevel.GENERAL; // default
}

/**
 * Scan text for L3 (extremely sensitive) patterns.
 * Returns list of detected patterns with their positions.
 */
export function scanForL3Content(
  text: string
): Array<{ name: string; match: string; index: number }> {
  const results: Array<{ name: string; match: string; index: number }> = [];
  for (const { name, pattern } of L3_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags + 'g');
    let match: RegExpExecArray | null;
    while ((match = globalPattern.exec(text)) !== null) {
      results.push({ name, match: match[0], index: match.index });
    }
  }
  return results;
}
