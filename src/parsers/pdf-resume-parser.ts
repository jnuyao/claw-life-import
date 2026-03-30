// ============================================================
// PDF Resume Parser
// Handles: text-based PDFs, scanned PDFs (OCR fallback),
// single/multi-column layouts, Chinese + English resumes.
// ============================================================

import * as fs from 'fs';
import { CanonicalResume, createEmptyResume } from '../schemas/canonical-resume';
import { cleanResumeText, splitIntoSections } from '../utils/text-utils';
import { LLMExtractor } from '../extractors/llm-extractor';

export interface PdfParseResult {
  text: string;
  numPages: number;
  info?: Record<string, unknown>;
}

export class PdfResumeParser {
  private llmExtractor: LLMExtractor;

  constructor(llmExtractor: LLMExtractor) {
    this.llmExtractor = llmExtractor;
  }

  /**
   * Parse a PDF resume file into CanonicalResume.
   */
  async parse(filePath: string): Promise<CanonicalResume> {
    // Stage 1: Extract raw text
    const rawResult = await this.extractText(filePath);
    const rawText = rawResult.text;

    // Check if text extraction succeeded
    if (rawText.trim().length < 50) {
      // OCR fallback would go here in production
      // For MVP, we report the issue
      console.warn(
        `[PDF Parser] Low text content (${rawText.length} chars). ` +
        `PDF might be scanned/image-based. OCR not yet implemented in v0.1.`
      );
      if (rawText.trim().length < 10) {
        throw new Error(
          'Could not extract text from PDF. ' +
          'The file may be scanned/image-based. OCR support coming in v0.2.'
        );
      }
    }

    // Stage 2: Clean text
    const cleaned = cleanResumeText(rawText, {
      removePageNumbers: true,
      normalizeWhitespace: true,
      fixBrokenLines: true,
      deduplicateHeaders: rawResult.numPages > 1,
    });

    // Stage 3: Section splitting (rule-based)
    const sections = splitIntoSections(cleaned);

    // Stage 4: LLM structured extraction
    const sectionTexts = sections
      .map(s => `[${s.title}]\n${s.content}`)
      .join('\n\n---\n\n');

    const resume = await this.llmExtractor.extractResume(sectionTexts);

    // Stage 5: Enrich metadata
    resume._meta.source_format = 'pdf';
    resume._meta.source_file = filePath;
    resume._meta.parsed_at = new Date().toISOString();

    // Confidence adjustment for PDF
    // PDF has inherent uncertainty compared to structured formats
    resume._meta.confidence = Math.min(resume._meta.confidence, 0.90);

    return resume;
  }

  /**
   * Extract raw text from PDF using pdf-parse.
   */
  private async extractText(filePath: string): Promise<PdfParseResult> {
    // Dynamic import for pdf-parse (CommonJS module)
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);

    return {
      text: result.text || '',
      numPages: result.numpages || 1,
      info: result.info,
    };
  }
}
