// ============================================================
// Schema Validator — Layer 1: Structural correctness
// ============================================================

import { CanonicalResume } from '../schemas/canonical-resume';

export type Severity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  field: string;
  severity: Severity;
  message: string;
}

export interface SchemaValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

/**
 * Validate structural correctness of a CanonicalResume.
 * Errors = hard failures that must be fixed.
 * Warnings = issues that lower confidence.
 */
export function validateSchema(resume: CanonicalResume): SchemaValidationResult {
  const issues: ValidationIssue[] = [];

  // ---- Required fields ----

  if (!resume.identity.name || resume.identity.name.trim().length === 0) {
    issues.push({
      field: 'identity.name',
      severity: 'error',
      message: 'Name is missing.',
    });
  }

  // At least some content should exist
  const hasExperience = resume.experience.length > 0;
  const hasEducation = resume.education.length > 0;
  const hasSkills =
    resume.skills.technical.length > 0 ||
    resume.skills.domain.length > 0;
  const hasProjects = resume.projects.length > 0;

  if (!hasExperience && !hasEducation && !hasSkills && !hasProjects) {
    issues.push({
      field: 'content',
      severity: 'error',
      message: 'Resume appears empty — no experience, education, skills, or projects found.',
    });
  }

  if (!hasExperience) {
    issues.push({
      field: 'experience',
      severity: 'warning',
      message: 'No work experience found.',
    });
  }

  // ---- Experience validation ----

  for (let i = 0; i < resume.experience.length; i++) {
    const exp = resume.experience[i];
    const prefix = `experience[${i}]`;

    if (!exp.company) {
      issues.push({
        field: `${prefix}.company`,
        severity: 'warning',
        message: `Experience #${i + 1}: Company name is missing.`,
      });
    }
    if (!exp.title) {
      issues.push({
        field: `${prefix}.title`,
        severity: 'warning',
        message: `Experience #${i + 1}: Job title is missing.`,
      });
    }
    if (!exp.period.start) {
      issues.push({
        field: `${prefix}.period.start`,
        severity: 'warning',
        message: `Experience #${i + 1}: Start date is missing.`,
      });
    }
    // Validate date format
    if (exp.period.start && !/^\d{4}-\d{2}(-\d{2})?$/.test(exp.period.start)) {
      issues.push({
        field: `${prefix}.period.start`,
        severity: 'warning',
        message: `Experience #${i + 1}: Start date format invalid: "${exp.period.start}".`,
      });
    }
  }

  // ---- Education validation ----

  for (let i = 0; i < resume.education.length; i++) {
    const edu = resume.education[i];
    const prefix = `education[${i}]`;

    if (!edu.institution) {
      issues.push({
        field: `${prefix}.institution`,
        severity: 'warning',
        message: `Education #${i + 1}: Institution name is missing.`,
      });
    }
  }

  // ---- Result ----

  const hasErrors = issues.some(i => i.severity === 'error');

  return {
    valid: !hasErrors,
    issues,
  };
}
