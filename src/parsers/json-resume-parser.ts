// ============================================================
// JSON Resume Parser
// Handles: JSON Resume Standard, LinkedIn Export, generic JSON
// ============================================================

import * as fs from 'fs';
import {
  CanonicalResume,
  createEmptyResume,
  Experience,
  Education,
  Project,
} from '../schemas/canonical-resume';
import { normalizeDate } from '../utils/date-utils';
import { uniqueNormalized } from '../utils/text-utils';
import { LLMExtractor } from '../extractors/llm-extractor';

// ---- JSON Resume Standard types ----

interface JRBasics {
  name?: string;
  label?: string;
  email?: string;
  phone?: string;
  url?: string;
  summary?: string;
  location?: { city?: string; region?: string; countryCode?: string };
  profiles?: Array<{ network?: string; url?: string; username?: string }>;
}

interface JRWork {
  name?: string;
  company?: string;
  position?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
}

interface JREducation {
  institution?: string;
  area?: string;
  studyType?: string;
  startDate?: string;
  endDate?: string;
  score?: string;
  gpa?: string;
  courses?: string[];
}

interface JRSkill {
  name?: string;
  level?: string;
  keywords?: string[];
}

interface JRProject {
  name?: string;
  description?: string;
  highlights?: string[];
  keywords?: string[];
  startDate?: string;
  endDate?: string;
  url?: string;
  roles?: string[];
}

interface JsonResumeData {
  basics?: JRBasics;
  work?: JRWork[];
  education?: JREducation[];
  skills?: JRSkill[];
  projects?: JRProject[];
  [key: string]: unknown;
}

// ---- LinkedIn Export types ----

interface LinkedInPosition {
  companyName?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  location?: string;
}

interface LinkedInEducation {
  schoolName?: string;
  degreeName?: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
}

interface LinkedInExport {
  profile?: {
    firstName?: string;
    lastName?: string;
    headline?: string;
    locationName?: string;
    summary?: string;
  };
  positions?: LinkedInPosition[];
  educations?: LinkedInEducation[];
  skills?: Array<{ name?: string }>;
  [key: string]: unknown;
}

// ---- Parser ----

export type JsonFormat = 'json_resume_standard' | 'linkedin_export' | 'unknown_structured';

export class JsonResumeParser {
  private llmExtractor: LLMExtractor;

  constructor(llmExtractor: LLMExtractor) {
    this.llmExtractor = llmExtractor;
  }

  /**
   * Parse a JSON resume file or string.
   */
  async parse(source: string): Promise<CanonicalResume> {
    const raw = this.loadJson(source);
    const format = this.detectJsonFormat(raw);

    switch (format) {
      case 'json_resume_standard':
        return this.mapJsonResumeStandard(raw as JsonResumeData, source);
      case 'linkedin_export':
        return this.mapLinkedInExport(raw as LinkedInExport, source);
      case 'unknown_structured':
        return this.mapUnknownJson(raw, source);
    }
  }

  private loadJson(source: string): Record<string, unknown> {
    // Try as file path first
    try {
      if (fs.existsSync(source)) {
        return JSON.parse(fs.readFileSync(source, 'utf-8'));
      }
    } catch { /* not a file */ }

    // Try as raw JSON string
    return JSON.parse(source);
  }

  detectJsonFormat(data: Record<string, unknown>): JsonFormat {
    // JSON Resume: has basics + (work or education)
    if (data.basics && (data.work || data.education)) {
      return 'json_resume_standard';
    }
    // LinkedIn: has profile or positions
    if (data.profile || data.positions || data.educations) {
      return 'linkedin_export';
    }
    return 'unknown_structured';
  }

  // ---- JSON Resume Standard Mapping ----

  private mapJsonResumeStandard(
    jr: JsonResumeData,
    sourceFile: string
  ): CanonicalResume {
    const basics = jr.basics || {};
    const profileUrl = (network: string) =>
      basics.profiles?.find(
        p => p.network?.toLowerCase() === network
      )?.url;

    const resume = createEmptyResume('json_resume', sourceFile);

    // Identity
    resume.identity = {
      name: basics.name ?? '',
      headline: basics.label,
      location: [basics.location?.city, basics.location?.region]
        .filter(Boolean)
        .join(', ') || undefined,
      contact: {
        email: basics.email,
        phone: basics.phone,
        linkedin: profileUrl('linkedin'),
        github: profileUrl('github'),
        website: basics.url,
      },
    };

    // Experience
    resume.experience = (jr.work ?? []).map((w): Experience => ({
      company: w.name ?? w.company ?? '',
      title: w.position ?? '',
      period: {
        start: normalizeDate(w.startDate) ?? '',
        end: normalizeDate(w.endDate),
      },
      description: w.summary,
      highlights: w.highlights ?? [],
      technologies: [], // JSON Resume doesn't have this, LLM can infer later
    }));

    // Education
    resume.education = (jr.education ?? []).map((e): Education => ({
      institution: e.institution ?? '',
      degree: e.studyType ?? '',
      field: e.area ?? '',
      period: {
        start: normalizeDate(e.startDate) ?? '',
        end: normalizeDate(e.endDate),
      },
      gpa: e.score ?? e.gpa,
    }));

    // Skills
    resume.skills = {
      technical: uniqueNormalized(
        (jr.skills ?? []).flatMap(s => s.keywords ?? [])
      ),
      domain: [],
      soft: [],
      certifications: [],
    };

    // Projects
    resume.projects = (jr.projects ?? []).map((p): Project => ({
      name: p.name ?? '',
      role: p.roles?.[0] ?? '',
      description: p.description ?? '',
      technologies: p.keywords ?? [],
      url: p.url,
    }));

    // Meta
    resume._meta.confidence = 0.95; // Structured input = high confidence
    resume._meta.field_confidence = {
      'identity.name': basics.name ? 0.99 : 0,
      'experience': jr.work?.length ? 0.95 : 0,
      'education': jr.education?.length ? 0.95 : 0,
      'skills': jr.skills?.length ? 0.90 : 0,
    };

    return resume;
  }

  // ---- LinkedIn Export Mapping ----

  private mapLinkedInExport(
    li: LinkedInExport,
    sourceFile: string
  ): CanonicalResume {
    const profile = li.profile || {};
    const resume = createEmptyResume('linkedin_json', sourceFile);

    resume.identity = {
      name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
      headline: profile.headline,
      location: profile.locationName,
      contact: { linkedin: 'https://linkedin.com' },
    };

    resume.experience = (li.positions ?? []).map((p): Experience => ({
      company: p.companyName ?? '',
      title: p.title ?? '',
      period: {
        start: normalizeDate(p.startDate) ?? '',
        end: normalizeDate(p.endDate),
      },
      description: p.description,
      highlights: [],
      technologies: [],
    }));

    resume.education = (li.educations ?? []).map((e): Education => ({
      institution: e.schoolName ?? '',
      degree: e.degreeName ?? '',
      field: e.fieldOfStudy ?? '',
      period: {
        start: normalizeDate(e.startDate) ?? '',
        end: normalizeDate(e.endDate),
      },
    }));

    resume.skills = {
      technical: uniqueNormalized(
        (li.skills ?? []).map(s => s.name ?? '').filter(Boolean)
      ),
      domain: [],
      soft: [],
      certifications: [],
    };

    resume._meta.confidence = 0.90;
    return resume;
  }

  // ---- Unknown JSON → LLM Extraction ----

  private async mapUnknownJson(
    data: Record<string, unknown>,
    sourceFile: string
  ): Promise<CanonicalResume> {
    // Convert to formatted string and let LLM extract
    const jsonString = JSON.stringify(data, null, 2);
    const resume = await this.llmExtractor.extractResume(jsonString);
    resume._meta.source_format = 'json_resume';
    resume._meta.source_file = sourceFile;
    resume._meta.confidence = Math.min(resume._meta.confidence, 0.70);
    return resume;
  }
}
