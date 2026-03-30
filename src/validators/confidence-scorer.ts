// ============================================================
// Confidence Scorer — Layer 3: Quantify trustworthiness
// ============================================================

import { CanonicalResume, SourceFormat } from '../schemas/canonical-resume';
import { ValidationIssue } from './schema-validator';

export interface ConfidenceResult {
  overall: number;
  fields: Record<string, number>;
}

/** Bonus/penalty per source format */
const FORMAT_ADJUSTMENT: Record<SourceFormat, number> = {
  json_resume: +0.10,
  linkedin_json: +0.08,
  pdf: 0,
  docx: 0,
  url: -0.05,
  plain_text: -0.10,
};

/**
 * Calculate per-field and overall confidence scores.
 */
export function scoreConfidence(
  resume: CanonicalResume,
  validationIssues: ValidationIssue[] = []
): ConfidenceResult {
  const fields: Record<string, number> = {};

  // ---- Identity ----
  fields['identity.name'] = resume.identity.name ? 0.95 : 0;
  fields['identity.headline'] = resume.identity.headline ? 0.90 : 0;
  fields['identity.location'] = resume.identity.location ? 0.85 : 0;

  // ---- Experience ----
  if (resume.experience.length > 0) {
    const expScores = resume.experience.map((exp, i) => {
      let score = 0.5; // base
      if (exp.company) score += 0.15;
      if (exp.title) score += 0.15;
      if (exp.period.start) score += 0.10;
      if (exp.highlights.length > 0) score += 0.05;
      if (exp.technologies.length > 0) score += 0.05;

      // Check if this field has validation issues
      const hasIssue = validationIssues.some(
        issue => issue.field.startsWith(`experience[${i}]`)
      );
      if (hasIssue) score -= 0.15;

      return Math.max(0, Math.min(1, score));
    });
    fields['experience'] = average(expScores);
  } else {
    fields['experience'] = 0;
  }

  // ---- Education ----
  if (resume.education.length > 0) {
    const eduScores = resume.education.map(edu => {
      let score = 0.5;
      if (edu.institution) score += 0.20;
      if (edu.degree) score += 0.15;
      if (edu.field) score += 0.10;
      if (edu.period.start) score += 0.05;
      return Math.max(0, Math.min(1, score));
    });
    fields['education'] = average(eduScores);
  } else {
    fields['education'] = 0.3; // Missing education is not critical
  }

  // ---- Skills ----
  const totalSkills =
    resume.skills.technical.length +
    resume.skills.domain.length +
    resume.skills.soft.length;
  fields['skills'] = totalSkills > 0
    ? Math.min(0.95, 0.5 + totalSkills * 0.03)
    : 0.2;

  // ---- Projects ----
  fields['projects'] = resume.projects.length > 0
    ? Math.min(0.95, 0.5 + resume.projects.length * 0.05)
    : 0.3;

  // ---- Overall ----
  const weights: Record<string, number> = {
    'identity.name': 0.20,
    'identity.headline': 0.05,
    'identity.location': 0.05,
    'experience': 0.30,
    'education': 0.15,
    'skills': 0.15,
    'projects': 0.10,
  };

  let overall = 0;
  for (const [field, weight] of Object.entries(weights)) {
    overall += (fields[field] ?? 0) * weight;
  }

  // Format adjustment
  const formatAdj = FORMAT_ADJUSTMENT[resume._meta.source_format] ?? 0;
  overall = Math.max(0, Math.min(1, overall + formatAdj));

  // Existing meta confidence is a floor/ceiling reference
  const metaConfidence = resume._meta.confidence;
  if (metaConfidence > 0) {
    overall = (overall + metaConfidence) / 2; // blend
  }

  return {
    overall: Math.round(overall * 100) / 100,
    fields,
  };
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
