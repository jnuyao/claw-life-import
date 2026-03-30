// ============================================================
// LLM Extractor — Use Claw's model to do structured extraction
//
// This module interfaces with OpenClaw's LLM via the standard
// tool interface. In standalone/test mode, it can use a
// configurable API endpoint.
// ============================================================

import {
  CanonicalResume,
  createEmptyResume,
  Experience,
  Education,
  Project,
} from '../schemas/canonical-resume';
import { normalizeDate } from '../utils/date-utils';

/**
 * LLM provider interface — allows plugging in different backends.
 * In OpenClaw context, this uses the agent's own model.
 */
export interface LLMProvider {
  /**
   * Send a prompt and get a structured JSON response.
   * @param systemPrompt - System-level instructions
   * @param userPrompt - User message with the data to extract
   * @returns Parsed JSON object
   */
  chat(systemPrompt: string, userPrompt: string): Promise<Record<string, any>>;
}

/**
 * Default LLM provider using OpenClaw's tool interface.
 * Falls back to direct API call if OPENAI_API_KEY or
 * ANTHROPIC_API_KEY is set.
 */
export class DefaultLLMProvider implements LLMProvider {
  async chat(
    systemPrompt: string,
    userPrompt: string
  ): Promise<Record<string, any>> {
    // Strategy 1: Use OpenClaw's built-in LLM if available
    if (typeof globalThis !== 'undefined' && (globalThis as any).__claw_llm__) {
      const clawLlm = (globalThis as any).__claw_llm__;
      const response = await clawLlm.chat({
        system: systemPrompt,
        user: userPrompt,
        response_format: { type: 'json_object' },
        temperature: 0,
      });
      return JSON.parse(response.content);
    }

    // Strategy 2: Use OpenAI-compatible API
    const apiKey = process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
    const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';

    if (!apiKey) {
      throw new Error(
        'No LLM provider available. Set OPENAI_API_KEY, ANTHROPIC_API_KEY, ' +
        'or run within OpenClaw agent context.'
      );
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${await response.text()}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty LLM response');

    return JSON.parse(content);
  }
}

// ============================================================
// Resume Extraction Prompt
// ============================================================

const RESUME_EXTRACTION_SYSTEM_PROMPT = `You are a precise resume parser. Extract structured information from the provided resume text.

RULES:
1. Extract ONLY what is explicitly stated. Do NOT infer or fabricate information.
2. If a field is not found, use empty string "" or empty array [].
3. Dates should be in ISO format: "YYYY-MM" or "YYYY-MM-DD". Use "YYYY-01" if only year is given.
4. For "present" or "至今" or "current", use null for end date.
5. Highlights should be quantified achievements when possible.
6. Technologies should be specific: "React" not "frontend framework".
7. Separate technical skills from soft skills and domain knowledge.

OUTPUT FORMAT: Return a single JSON object with this exact structure:
{
  "identity": {
    "name": "string",
    "headline": "string or null",
    "location": "string or null",
    "timezone": "string or null",
    "contact": {
      "email": "string or null",
      "phone": "string or null",
      "linkedin": "string or null",
      "github": "string or null",
      "website": "string or null"
    }
  },
  "experience": [
    {
      "company": "string",
      "title": "string",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or null",
      "description": "string or null",
      "highlights": ["string"],
      "technologies": ["string"]
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "field": "string",
      "start_date": "YYYY-MM or null",
      "end_date": "YYYY-MM or null",
      "gpa": "string or null"
    }
  ],
  "skills": {
    "technical": ["string"],
    "domain": ["string"],
    "soft": ["string"],
    "certifications": ["string"]
  },
  "projects": [
    {
      "name": "string",
      "role": "string",
      "description": "string",
      "technologies": ["string"],
      "url": "string or null"
    }
  ],
  "confidence": 0.85
}`;

// ============================================================
// Extractor Class
// ============================================================

export class LLMExtractor {
  private provider: LLMProvider;
  private maxRetries: number;

  constructor(provider?: LLMProvider, maxRetries = 2) {
    this.provider = provider || new DefaultLLMProvider();
    this.maxRetries = maxRetries;
  }

  /**
   * Extract a CanonicalResume from raw text using LLM.
   */
  async extractResume(text: string): Promise<CanonicalResume> {
    // Truncate if too long (most LLMs have context limits)
    const maxChars = 30000;
    const truncated = text.length > maxChars
      ? text.slice(0, maxChars) + '\n\n[... truncated ...]'
      : text;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const raw = await this.provider.chat(
          RESUME_EXTRACTION_SYSTEM_PROMPT,
          `Please extract structured resume data from the following text:\n\n${truncated}`
        );

        return this.mapRawToCanonical(raw);
      } catch (err) {
        lastError = err as Error;
        console.warn(
          `[LLM Extractor] Attempt ${attempt + 1} failed: ${lastError.message}`
        );
      }
    }

    throw new Error(
      `LLM extraction failed after ${this.maxRetries + 1} attempts: ${lastError?.message}`
    );
  }

  /**
   * Map raw LLM output to CanonicalResume.
   */
  private mapRawToCanonical(raw: Record<string, any>): CanonicalResume {
    const identity = raw.identity || {};
    const contact = identity.contact || {};

    const resume = createEmptyResume('pdf');

    resume.identity = {
      name: identity.name || '',
      headline: identity.headline || undefined,
      location: identity.location || undefined,
      timezone: identity.timezone || undefined,
      contact: {
        email: contact.email || undefined,
        phone: contact.phone || undefined,
        linkedin: contact.linkedin || undefined,
        github: contact.github || undefined,
        website: contact.website || undefined,
      },
    };

    resume.experience = (raw.experience || []).map((e: any): Experience => ({
      company: e.company || '',
      title: e.title || e.position || '',
      period: {
        start: normalizeDate(e.start_date || e.startDate) || '',
        end: normalizeDate(e.end_date || e.endDate) || undefined,
      },
      description: e.description || undefined,
      highlights: e.highlights || [],
      technologies: e.technologies || [],
    }));

    resume.education = (raw.education || []).map((e: any): Education => ({
      institution: e.institution || '',
      degree: e.degree || e.studyType || '',
      field: e.field || e.area || '',
      period: {
        start: normalizeDate(e.start_date || e.startDate) || '',
        end: normalizeDate(e.end_date || e.endDate) || undefined,
      },
      gpa: e.gpa || e.score || undefined,
    }));

    const skills = raw.skills || {};
    resume.skills = {
      technical: skills.technical || [],
      domain: skills.domain || [],
      soft: skills.soft || [],
      certifications: skills.certifications || [],
    };

    resume.projects = (raw.projects || []).map((p: any): Project => ({
      name: p.name || '',
      role: p.role || '',
      description: p.description || '',
      technologies: p.technologies || [],
      url: p.url || undefined,
    }));

    resume._meta.confidence = typeof raw.confidence === 'number'
      ? raw.confidence
      : 0.80;

    return resume;
  }
}
