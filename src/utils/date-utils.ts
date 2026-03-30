// ============================================================
// Date Utilities — normalize diverse date formats to ISO 8601
// ============================================================

/**
 * Normalize a date string into YYYY-MM or YYYY-MM-DD format.
 *
 * Handles:
 *   - "2019-03", "2019-03-15" → pass through
 *   - "March 2019", "Mar 2019" → "2019-03"
 *   - "2019年3月" → "2019-03"
 *   - "2019" → "2019-01"
 *   - "2019年初" → "2019-01"
 *   - "Present", "至今", "current" → undefined
 */
export function normalizeDate(raw?: string): string | undefined {
  if (!raw) return undefined;

  const trimmed = raw.trim();

  // "Present" / "至今" / "current" / "now"
  if (/^(present|至今|current|now|在职|目前)$/i.test(trimmed)) {
    return undefined;
  }

  // Already ISO: YYYY-MM-DD or YYYY-MM
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(trimmed)) {
    return trimmed;
  }

  // YYYY/MM/DD or YYYY/MM
  const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})(\/\d{1,2})?$/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2].padStart(2, '0')}`;
  }

  // "March 2019", "Mar 2019", "Sep. 2020"
  const enMonthYear = trimmed.match(
    /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{4})$/i
  );
  if (enMonthYear) {
    const month = englishMonthToNumber(enMonthYear[1]);
    return `${enMonthYear[2]}-${String(month).padStart(2, '0')}`;
  }

  // "2019年3月", "2019年03月"
  const cnYearMonth = trimmed.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月?$/);
  if (cnYearMonth) {
    return `${cnYearMonth[1]}-${cnYearMonth[2].padStart(2, '0')}`;
  }

  // "2019年初" / "2019年中" / "2019年末"
  const cnYearApprox = trimmed.match(/^(\d{4})\s*年\s*(初|中|末|底)$/);
  if (cnYearApprox) {
    const monthMap: Record<string, string> = {
      '初': '01', '中': '06', '末': '12', '底': '12',
    };
    return `${cnYearApprox[1]}-${monthMap[cnYearApprox[2]]}`;
  }

  // "2019" → "2019-01"
  if (/^\d{4}$/.test(trimmed)) {
    return `${trimmed}-01`;
  }

  // "MM/YYYY" or "MM.YYYY"
  const mmyyyy = trimmed.match(/^(\d{1,2})[./](\d{4})$/);
  if (mmyyyy) {
    return `${mmyyyy[2]}-${mmyyyy[1].padStart(2, '0')}`;
  }

  // Fallback: return as-is, downstream will flag low confidence
  return trimmed;
}

const EN_MONTHS: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

function englishMonthToNumber(month: string): number {
  return EN_MONTHS[month.toLowerCase().replace('.', '')] ?? 1;
}

/**
 * Compare two date strings. Returns negative if a < b.
 */
export function compareDates(
  a?: string,
  b?: string
): number {
  if (!a && !b) return 0;
  if (!a) return 1;  // undefined (present) is latest
  if (!b) return -1;
  return a.localeCompare(b);
}

/**
 * Calculate difference in days between two date strings.
 * Positive if b > a.
 */
export function dateDiffDays(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const dateA = new Date(a.length === 7 ? `${a}-01` : a);
  const dateB = new Date(b.length === 7 ? `${b}-01` : b);
  return Math.round((dateB.getTime() - dateA.getTime()) / (1000 * 60 * 60 * 24));
}
