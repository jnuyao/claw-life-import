// ============================================================
// Canonical Resume Schema
// All resume formats normalize to this structure before
// validation, privacy classification, and memory writing.
// ============================================================

/** Privacy level for each field */
export enum PrivacyLevel {
  /** L0: Auto-write, no confirmation needed */
  PUBLIC = 0,
  /** L1: Write by default, user can cancel */
  GENERAL = 1,
  /** L2: Skip by default, user must opt-in */
  SENSITIVE = 2,
  /** L3: Always discard, never write */
  EXTREMELY_SENSITIVE = 3,
}

/** Confidence-tagged field wrapper */
export interface ConfidenceField<T> {
  value: T;
  confidence: number; // 0-1
  privacy: PrivacyLevel;
  source?: string; // which parser produced this
}

/** Time period with ISO 8601 dates */
export interface Period {
  start: string; // YYYY-MM or YYYY-MM-DD
  end?: string;  // undefined = present
}

/** Work experience entry */
export interface Experience {
  company: string;
  title: string;
  period: Period;
  description?: string;
  highlights: string[];
  technologies: string[];
}

/** Education entry */
export interface Education {
  institution: string;
  degree: string;
  field: string;
  period: Period;
  gpa?: string;
}

/** Skills breakdown */
export interface Skills {
  technical: string[];
  domain: string[];
  soft: string[];
  certifications: string[];
}

/** Project entry */
export interface Project {
  name: string;
  role: string;
  description: string;
  technologies: string[];
  url?: string;
}

/** Contact info (L2 by default) */
export interface Contact {
  email?: string;
  phone?: string;
  linkedin?: string;
  github?: string;
  website?: string;
}

/** Identity block */
export interface Identity {
  name: string;
  headline?: string;      // "Senior Frontend Engineer"
  location?: string;
  timezone?: string;
  contact: Contact;
}

/** Source format enum */
export type SourceFormat =
  | 'pdf'
  | 'json_resume'
  | 'linkedin_json'
  | 'url'
  | 'docx'
  | 'plain_text';

/** Extraction metadata */
export interface ExtractionMeta {
  source_format: SourceFormat;
  source_file?: string;
  parsed_at: string; // ISO 8601
  confidence: number; // 0-1 overall
  field_confidence: Record<string, number>;
  parser_version: string;
}

// ============================================================
// The Canonical Resume — single source of truth
// ============================================================
export interface CanonicalResume {
  identity: Identity;
  experience: Experience[];
  education: Education[];
  skills: Skills;
  projects: Project[];
  _meta: ExtractionMeta;
}

/** Factory for an empty CanonicalResume */
export function createEmptyResume(
  sourceFormat: SourceFormat,
  sourceFile?: string
): CanonicalResume {
  return {
    identity: {
      name: '',
      contact: {},
    },
    experience: [],
    education: [],
    skills: {
      technical: [],
      domain: [],
      soft: [],
      certifications: [],
    },
    projects: [],
    _meta: {
      source_format: sourceFormat,
      source_file: sourceFile,
      parsed_at: new Date().toISOString(),
      confidence: 0,
      field_confidence: {},
      parser_version: '0.1.0',
    },
  };
}
