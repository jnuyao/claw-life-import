// ============================================================
// /memory-score Command — Show how well Claw knows the user
// ============================================================

import { calculateMemoryScore, MemoryScoreResult } from '../scoring/memory-score';

export interface MemoryScoreOptions {
  /** OpenClaw workspace directory (defaults to cwd) */
  workspaceDir?: string;
  /** Output format */
  format?: 'full' | 'compact' | 'json';
}

/**
 * Execute the /memory-score command.
 */
export function memoryScore(
  opts: MemoryScoreOptions = {}
): { report: string; data: MemoryScoreResult } {
  const workspaceDir = opts.workspaceDir || process.cwd();
  const result = calculateMemoryScore(workspaceDir);
  const format = opts.format || 'full';

  let report: string;

  switch (format) {
    case 'json':
      report = JSON.stringify(result, null, 2);
      break;
    case 'compact':
      report = `Memory Score: ${result.score}/100 — ${result.suggestion}`;
      break;
    case 'full':
    default:
      report = generateFullReport(result);
  }

  return { report, data: result };
}

function generateFullReport(result: MemoryScoreResult): string {
  const lines: string[] = [];

  // Header with visual score
  lines.push('## 🧠 Memory Score');
  lines.push('');

  // Score display
  const filled = Math.round(result.score / 5);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  lines.push(`### ${bar} ${result.score}/100`);
  lines.push('');

  // Category breakdown
  lines.push('### 分类详情');
  lines.push('');
  lines.push('```');
  for (const bar of result.visualBars) {
    lines.push(bar);
  }
  lines.push('```');
  lines.push('');

  // Details per category
  for (const cat of result.categories) {
    const pct = Math.round(cat.completeness * 100);
    const status = pct >= 80 ? '✅' : pct >= 40 ? '⚠️' : '❌';

    lines.push(`**${status} ${cat.label}** — ${pct}%`);

    if (cat.filledFields.length > 0) {
      lines.push(`  已有: ${cat.filledFields.join(', ')}`);
    }
    if (cat.missingFields.length > 0) {
      lines.push(`  缺失: ${cat.missingFields.join(', ')}`);
    }
    lines.push('');
  }

  // Suggestion
  lines.push('---');
  lines.push('');
  lines.push(result.suggestion);

  return lines.join('\n');
}
