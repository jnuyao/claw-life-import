// ============================================================
// Text Utilities — clean and normalize resume text
// ============================================================

export interface CleanOptions {
  removePageNumbers?: boolean;
  normalizeWhitespace?: boolean;
  fixBrokenLines?: boolean;
  deduplicateHeaders?: boolean;
}

/**
 * Clean raw text extracted from PDF/HTML resumes.
 */
export function cleanResumeText(
  text: string,
  options: CleanOptions = {}
): string {
  let cleaned = text;

  // 1. Remove page numbers: standalone numbers, "Page X of Y"
  if (options.removePageNumbers !== false) {
    cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
    cleaned = cleaned.replace(/Page\s+\d+\s*(of\s+\d+)?/gi, '');
    cleaned = cleaned.replace(/第\s*\d+\s*页/g, '');
  }

  // 2. Fix cross-line hyphenation: "Experi-\nence" → "Experience"
  if (options.fixBrokenLines !== false) {
    cleaned = cleaned.replace(/([a-zA-Z])-\n([a-zA-Z])/g, '$1$2');
  }

  // 3. Normalize whitespace
  if (options.normalizeWhitespace !== false) {
    cleaned = cleaned.replace(/[ \t]+/g, ' ');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  }

  // 4. Deduplicate repeated headers (common in multi-column layouts)
  if (options.deduplicateHeaders) {
    const lines = cleaned.split('\n');
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const line of lines) {
      const normalized = line.trim().toLowerCase();
      if (normalized.length > 0 && normalized.length < 80) {
        if (seen.has(normalized)) continue;
        seen.add(normalized);
      }
      deduped.push(line);
    }
    cleaned = deduped.join('\n');
  }

  return cleaned.trim();
}

/**
 * Detect section boundaries in resume text using keyword matching.
 *
 * Returns an array of { title, content } for each detected section.
 */
export function splitIntoSections(
  text: string
): Array<{ title: string; content: string }> {
  const SECTION_PATTERNS = [
    // English
    /^(experience|work\s*experience|employment|professional\s*experience|work\s*history)$/i,
    /^(education|academic|educational\s*background)$/i,
    /^(skills|technical\s*skills|core\s*competencies|expertise)$/i,
    /^(projects|key\s*projects|selected\s*projects)$/i,
    /^(summary|profile|objective|about\s*me|professional\s*summary)$/i,
    /^(certifications?|licenses?|awards?)$/i,
    /^(publications?|papers?)$/i,
    /^(languages?)$/i,
    /^(references?)$/i,
    /^(contact|contact\s*info(?:rmation)?)$/i,
    // Chinese
    /^(工作经[历验]|职业经[历验]|工作履历)$/,
    /^(教育背景|教育经[历验]|学历)$/,
    /^(技[能术]|专业技能|核心能力)$/,
    /^(项目经[历验]|主要项目)$/,
    /^(个人简介|自我评价|个人总结)$/,
    /^(证书|资质|获奖)$/,
    /^(联系方式|联系信息)$/,
  ];

  const lines = text.split('\n');
  const sections: Array<{ title: string; startLine: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Remove common formatting: bullets, dashes, colons
    const cleaned = trimmed
      .replace(/^[#*\-●◆►▸]+\s*/, '')
      .replace(/\s*[:：]\s*$/, '')
      .trim();

    for (const pattern of SECTION_PATTERNS) {
      if (pattern.test(cleaned)) {
        sections.push({ title: cleaned, startLine: i });
        break;
      }
    }
  }

  if (sections.length === 0) {
    // No sections detected → return full text as single section
    return [{ title: 'full_text', content: text }];
  }

  // Build section content
  const result: Array<{ title: string; content: string }> = [];
  for (let i = 0; i < sections.length; i++) {
    const start = sections[i].startLine + 1;
    const end = i + 1 < sections.length
      ? sections[i + 1].startLine
      : lines.length;
    result.push({
      title: sections[i].title,
      content: lines.slice(start, end).join('\n').trim(),
    });
  }

  // Prepend any content before the first section as "header"
  if (sections[0].startLine > 0) {
    const headerContent = lines.slice(0, sections[0].startLine).join('\n').trim();
    if (headerContent) {
      result.unshift({ title: 'header', content: headerContent });
    }
  }

  return result;
}

/**
 * Extract unique, normalized strings from an array.
 */
export function uniqueNormalized(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      result.push(item.trim());
    }
  }
  return result;
}
