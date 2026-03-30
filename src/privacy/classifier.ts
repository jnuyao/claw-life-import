// ============================================================
// Privacy Classifier — Classify and filter resume fields
// by privacy level before writing to memory.
// ============================================================

import { CanonicalResume, PrivacyLevel } from '../schemas/canonical-resume';
import { getFieldPrivacy, scanForL3Content } from '../schemas/privacy-levels';

export interface PrivacyClassificationResult {
  /** Fields that will be auto-written (L0 + L1) */
  autoWrite: FieldEntry[];
  /** Fields that need user opt-in (L2) */
  needsOptIn: FieldEntry[];
  /** Fields that were discarded (L3 detected) */
  discarded: FieldEntry[];
  /** L3 patterns detected in raw text */
  l3Detections: Array<{ name: string; match: string }>;
}

export interface FieldEntry {
  path: string;
  label: string;
  value: string;
  privacy: PrivacyLevel;
}

/**
 * Classify all resume fields by privacy level.
 */
export function classifyPrivacy(
  resume: CanonicalResume,
  rawText?: string
): PrivacyClassificationResult {
  const autoWrite: FieldEntry[] = [];
  const needsOptIn: FieldEntry[] = [];
  const discarded: FieldEntry[] = [];

  // Helper to route a field
  function routeField(path: string, label: string, value: string | undefined) {
    if (!value || value.trim() === '') return;
    const privacy = getFieldPrivacy(path);
    const entry: FieldEntry = { path, label, value, privacy };

    switch (privacy) {
      case PrivacyLevel.PUBLIC:
      case PrivacyLevel.GENERAL:
        autoWrite.push(entry);
        break;
      case PrivacyLevel.SENSITIVE:
        needsOptIn.push(entry);
        break;
      case PrivacyLevel.EXTREMELY_SENSITIVE:
        discarded.push(entry);
        break;
    }
  }

  // ---- Identity ----
  routeField('identity.name', 'Name', resume.identity.name);
  routeField('identity.headline', 'Headline', resume.identity.headline);
  routeField('identity.location', 'Location', resume.identity.location);
  routeField('identity.timezone', 'Timezone', resume.identity.timezone);

  // Contact (L2)
  routeField('identity.contact.email', 'Email', resume.identity.contact.email);
  routeField('identity.contact.phone', 'Phone', resume.identity.contact.phone);
  routeField('identity.contact.linkedin', 'LinkedIn', resume.identity.contact.linkedin);
  routeField('identity.contact.github', 'GitHub', resume.identity.contact.github);
  routeField('identity.contact.website', 'Website', resume.identity.contact.website);

  // ---- Experience ----
  for (let i = 0; i < resume.experience.length; i++) {
    const exp = resume.experience[i];
    const prefix = `experience.${i}`;
    routeField(`${prefix}.company`, `Company #${i + 1}`, exp.company);
    routeField(`${prefix}.title`, `Title #${i + 1}`, exp.title);
    routeField(
      `${prefix}.period`,
      `Period #${i + 1}`,
      `${exp.period.start} - ${exp.period.end || 'Present'}`
    );
    if (exp.description) {
      routeField(`${prefix}.description`, `Description #${i + 1}`, exp.description);
    }
    if (exp.highlights.length > 0) {
      routeField(
        `${prefix}.highlights`,
        `Highlights #${i + 1}`,
        exp.highlights.join('; ')
      );
    }
    if (exp.technologies.length > 0) {
      routeField(
        `${prefix}.technologies`,
        `Technologies #${i + 1}`,
        exp.technologies.join(', ')
      );
    }
  }

  // ---- Education ----
  for (let i = 0; i < resume.education.length; i++) {
    const edu = resume.education[i];
    const prefix = `education.${i}`;
    routeField(`${prefix}.institution`, `Institution #${i + 1}`, edu.institution);
    routeField(`${prefix}.degree`, `Degree #${i + 1}`, edu.degree);
    routeField(`${prefix}.field`, `Field #${i + 1}`, edu.field);
    routeField(
      `${prefix}.period`,
      `Period #${i + 1}`,
      `${edu.period.start} - ${edu.period.end || 'Present'}`
    );
    if (edu.gpa) {
      routeField(`${prefix}.gpa`, `GPA #${i + 1}`, edu.gpa);
    }
  }

  // ---- Skills ----
  if (resume.skills.technical.length > 0) {
    routeField('skills.technical', 'Technical Skills', resume.skills.technical.join(', '));
  }
  if (resume.skills.domain.length > 0) {
    routeField('skills.domain', 'Domain Skills', resume.skills.domain.join(', '));
  }
  if (resume.skills.soft.length > 0) {
    routeField('skills.soft', 'Soft Skills', resume.skills.soft.join(', '));
  }
  if (resume.skills.certifications.length > 0) {
    routeField('skills.certifications', 'Certifications', resume.skills.certifications.join(', '));
  }

  // ---- Projects ----
  for (let i = 0; i < resume.projects.length; i++) {
    const proj = resume.projects[i];
    const prefix = `projects.${i}`;
    routeField(`${prefix}.name`, `Project: ${proj.name}`, proj.name);
    routeField(`${prefix}.description`, `Project Desc: ${proj.name}`, proj.description);
    if (proj.technologies.length > 0) {
      routeField(
        `${prefix}.technologies`,
        `Project Tech: ${proj.name}`,
        proj.technologies.join(', ')
      );
    }
  }

  // ---- L3 scan on raw text ----
  const l3Detections = rawText ? scanForL3Content(rawText) : [];
  for (const detection of l3Detections) {
    discarded.push({
      path: `raw_text.${detection.name}`,
      label: `Sensitive: ${detection.name}`,
      value: '[REDACTED]',
      privacy: PrivacyLevel.EXTREMELY_SENSITIVE,
    });
  }

  return {
    autoWrite,
    needsOptIn,
    discarded,
    l3Detections: l3Detections.map(d => ({ name: d.name, match: '[REDACTED]' })),
  };
}
