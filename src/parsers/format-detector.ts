// ============================================================
// Format Detector — auto-detect resume input format
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { SourceFormat } from '../schemas/canonical-resume';

export interface DetectedFormat {
  format: SourceFormat;
  confidence: number;
  details?: string;
}

/**
 * Detect the format of a resume input.
 *
 * @param source - File path, URL, or raw content string
 * @returns Detected format with confidence
 */
export function detectFormat(source: string): DetectedFormat {
  const trimmed = source.trim();

  // 1. URL detection
  if (/^https?:\/\//i.test(trimmed)) {
    return classifyUrl(trimmed);
  }

  // 2. File path detection
  if (fs.existsSync(trimmed)) {
    return classifyFile(trimmed);
  }

  // 3. Raw content detection (stdin or piped input)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return { format: 'json_resume', confidence: 0.8, details: 'Parsed as JSON' };
    } catch {
      // Not valid JSON
    }
  }

  return { format: 'plain_text', confidence: 0.5, details: 'Fallback to plain text' };
}

function classifyFile(filePath: string): DetectedFormat {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case '.pdf':
      return { format: 'pdf', confidence: 0.95, details: 'PDF file extension' };
    case '.json':
      return classifyJsonFile(filePath);
    case '.docx':
      return { format: 'docx', confidence: 0.95, details: 'DOCX file extension' };
    case '.txt':
    case '.md':
      return { format: 'plain_text', confidence: 0.8, details: 'Text file' };
    default: {
      // Check magic bytes for PDF
      const buffer = Buffer.alloc(5);
      const fd = fs.openSync(filePath, 'r');
      fs.readSync(fd, buffer, 0, 5, 0);
      fs.closeSync(fd);
      if (buffer.toString('ascii').startsWith('%PDF')) {
        return { format: 'pdf', confidence: 0.99, details: 'PDF magic bytes' };
      }
      return { format: 'plain_text', confidence: 0.4, details: 'Unknown extension' };
    }
  }
}

function classifyJsonFile(filePath: string): DetectedFormat {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);

    // JSON Resume standard detection
    if (data.basics && (data.work || data.education)) {
      return { format: 'json_resume', confidence: 0.95, details: 'JSON Resume standard' };
    }

    // LinkedIn export detection
    if (data.profile || data.positions || data.educations) {
      return { format: 'linkedin_json', confidence: 0.90, details: 'LinkedIn data export' };
    }

    return { format: 'json_resume', confidence: 0.6, details: 'Unknown JSON structure' };
  } catch {
    return { format: 'plain_text', confidence: 0.3, details: 'Invalid JSON file' };
  }
}

function classifyUrl(url: string): DetectedFormat {
  const lower = url.toLowerCase();

  if (lower.includes('linkedin.com')) {
    return { format: 'linkedin_json', confidence: 0.9, details: 'LinkedIn URL' };
  }
  if (lower.includes('github.com')) {
    return { format: 'url', confidence: 0.9, details: 'GitHub profile URL' };
  }
  if (lower.endsWith('.pdf')) {
    return { format: 'pdf', confidence: 0.9, details: 'PDF URL' };
  }
  if (lower.endsWith('.json')) {
    return { format: 'json_resume', confidence: 0.8, details: 'JSON URL' };
  }

  return { format: 'url', confidence: 0.7, details: 'Generic URL' };
}
