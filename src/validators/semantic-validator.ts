// ============================================================
// Semantic Validator — Layer 2: Content reasonableness
// ============================================================

import { CanonicalResume } from '../schemas/canonical-resume';
import { ValidationIssue } from './schema-validator';
import { dateDiffDays, compareDates } from '../utils/date-utils';

export interface SemanticValidationResult {
  issues: ValidationIssue[];
}

/**
 * Check semantic consistency of resume content.
 * These are warnings, not errors — they flag potential issues
 * for the user to confirm.
 */
export function validateSemantics(
  resume: CanonicalResume
): SemanticValidationResult {
  const issues: ValidationIssue[] = [];

  // ---- 1. Timeline continuity: overlapping experience ----

  const sortedExp = [...resume.experience]
    .filter(e => e.period.start)
    .sort((a, b) => a.period.start.localeCompare(b.period.start));

  for (let i = 1; i < sortedExp.length; i++) {
    const prevEnd = sortedExp[i - 1].period.end;
    const currStart = sortedExp[i].period.start;

    if (prevEnd && currStart) {
      const overlapDays = dateDiffDays(currStart, prevEnd);
      if (overlapDays > 90) {
        issues.push({
          field: `experience[${i}].period`,
          severity: 'warning',
          message:
            `Work experience at "${sortedExp[i].company}" overlaps with ` +
            `"${sortedExp[i - 1].company}" by ~${Math.round(overlapDays / 30)} months. ` +
            `Please verify dates.`,
        });
      }
    }
  }

  // ---- 2. Education → Work timeline ----

  const sortedEdu = [...resume.education]
    .filter(e => e.period.end)
    .sort((a, b) => compareDates(a.period.end, b.period.end));

  if (sortedEdu.length > 0 && sortedExp.length > 0) {
    const lastGraduation = sortedEdu[sortedEdu.length - 1].period.end;
    const firstJob = sortedExp[0].period.start;

    if (lastGraduation && firstJob) {
      const diff = dateDiffDays(lastGraduation, firstJob);
      if (diff < -365) {
        // First job started > 1 year before graduation
        issues.push({
          field: 'experience[0].period.start',
          severity: 'warning',
          message:
            `First job started ${Math.round(Math.abs(diff) / 365)} year(s) before graduation. ` +
            `This might be an internship or the dates may need correction.`,
        });
      }
    }
  }

  // ---- 3. Unreasonable date ranges ----

  for (let i = 0; i < resume.experience.length; i++) {
    const exp = resume.experience[i];
    if (exp.period.start && exp.period.end) {
      const durationDays = dateDiffDays(exp.period.start, exp.period.end);
      if (durationDays < 0) {
        issues.push({
          field: `experience[${i}].period`,
          severity: 'warning',
          message:
            `"${exp.company}": End date is before start date. Please verify.`,
        });
      }
      if (durationDays > 365 * 20) {
        issues.push({
          field: `experience[${i}].period`,
          severity: 'warning',
          message:
            `"${exp.company}": Duration exceeds 20 years. Please verify dates.`,
        });
      }
    }
  }

  // ---- 4. Name sanity check ----

  const name = resume.identity.name;
  if (name) {
    if (name.length > 60) {
      issues.push({
        field: 'identity.name',
        severity: 'warning',
        message: `Name seems unusually long (${name.length} chars). Might include extra text.`,
      });
    }
    if (/\d{4}/.test(name)) {
      issues.push({
        field: 'identity.name',
        severity: 'warning',
        message: 'Name contains a 4-digit number — possible parsing error.',
      });
    }
  }

  // ---- 5. Skills with no project/experience evidence ----

  const allTechnologies = new Set<string>();
  for (const exp of resume.experience) {
    for (const tech of exp.technologies) {
      allTechnologies.add(tech.toLowerCase());
    }
  }
  for (const proj of resume.projects) {
    for (const tech of proj.technologies) {
      allTechnologies.add(tech.toLowerCase());
    }
  }

  const orphanSkills = resume.skills.technical.filter(
    skill => !allTechnologies.has(skill.toLowerCase())
  );

  if (orphanSkills.length > 0 && allTechnologies.size > 0) {
    issues.push({
      field: 'skills.technical',
      severity: 'info',
      message:
        `These skills are listed but not mentioned in any project/experience: ` +
        `${orphanSkills.slice(0, 5).join(', ')}${orphanSkills.length > 5 ? '...' : ''}. ` +
        `They will still be imported.`,
    });
  }

  return { issues };
}
