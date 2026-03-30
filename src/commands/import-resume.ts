// ============================================================
// /import-resume Command — Main entry point for resume import
// ============================================================

import * as path from 'path';
import { detectFormat } from '../parsers/format-detector';
import { PdfResumeParser } from '../parsers/pdf-resume-parser';
import { JsonResumeParser } from '../parsers/json-resume-parser';
import { UrlResumeParser, UserActionRequired } from '../parsers/url-resume-parser';
import { LLMExtractor, LLMProvider } from '../extractors/llm-extractor';
import { validateSchema } from '../validators/schema-validator';
import { validateSemantics } from '../validators/semantic-validator';
import { scoreConfidence } from '../validators/confidence-scorer';
import { classifyPrivacy } from '../privacy/classifier';
import { MemoryWriter } from '../writers/memory-writer';
import { calculateMemoryScore } from '../scoring/memory-score';
import { CanonicalResume, SourceFormat } from '../schemas/canonical-resume';

export interface ImportResumeOptions {
  /** Path to file, URL, or raw JSON string */
  source: string;
  /** Force a specific format (auto-detected if omitted) */
  format?: SourceFormat;
  /** OpenClaw workspace directory (defaults to cwd) */
  workspaceDir?: string;
  /** Custom LLM provider */
  llmProvider?: LLMProvider;
  /** Dry-run mode */
  dryRun?: boolean;
}

export interface ImportResumeResult {
  success: boolean;
  /** Parsed resume data */
  resume?: CanonicalResume;
  /** Summary of what was written */
  summary: string;
  /** Detailed report for user display */
  report: string;
  /** Memory Score before and after */
  scoreBefore?: number;
  scoreAfter?: number;
  /** Error if failed */
  error?: string;
}

/**
 * Execute the /import-resume command.
 */
export async function importResume(
  opts: ImportResumeOptions
): Promise<ImportResumeResult> {
  const workspaceDir = opts.workspaceDir || process.cwd();

  try {
    // ============================================================
    // Step 0: Calculate score BEFORE import
    // ============================================================
    const scoreBefore = calculateMemoryScore(workspaceDir).score;

    // ============================================================
    // Step 1: Detect format
    // ============================================================
    const detected = opts.format
      ? { format: opts.format, confidence: 1, details: 'User-specified' }
      : detectFormat(opts.source);

    console.log(
      `[import-resume] Format: ${detected.format} ` +
      `(confidence: ${detected.confidence}, ${detected.details})`
    );

    // ============================================================
    // Step 2: Parse by format
    // ============================================================
    const llmExtractor = new LLMExtractor(opts.llmProvider);
    let resume: CanonicalResume;

    switch (detected.format) {
      case 'pdf': {
        const parser = new PdfResumeParser(llmExtractor);
        resume = await parser.parse(opts.source);
        break;
      }
      case 'json_resume':
      case 'linkedin_json': {
        const parser = new JsonResumeParser(llmExtractor);
        resume = await parser.parse(opts.source);
        break;
      }
      case 'url': {
        const parser = new UrlResumeParser(llmExtractor);
        resume = await parser.parse(opts.source);
        break;
      }
      default: {
        // Treat as plain text → LLM extraction
        const fs = require('fs');
        let text: string;
        if (fs.existsSync(opts.source)) {
          text = fs.readFileSync(opts.source, 'utf-8');
        } else {
          text = opts.source;
        }
        resume = await llmExtractor.extractResume(text);
        resume._meta.source_format = detected.format;
        resume._meta.source_file = opts.source;
      }
    }

    // ============================================================
    // Step 3: Validate (3-layer)
    // ============================================================

    // Layer 1: Schema validation
    const schemaResult = validateSchema(resume);
    if (!schemaResult.valid) {
      const errors = schemaResult.issues
        .filter(i => i.severity === 'error')
        .map(i => i.message)
        .join('\n');
      return {
        success: false,
        summary: 'Schema validation failed.',
        report: `❌ **Validation Failed**\n\n${errors}`,
        error: errors,
      };
    }

    // Layer 2: Semantic validation
    const semanticResult = validateSemantics(resume);

    // Layer 3: Confidence scoring
    const allIssues = [...schemaResult.issues, ...semanticResult.issues];
    const confidence = scoreConfidence(resume, allIssues);

    // Update meta
    resume._meta.confidence = confidence.overall;
    resume._meta.field_confidence = confidence.fields;

    // ============================================================
    // Step 4: Privacy classification
    // ============================================================
    const privacy = classifyPrivacy(resume);

    // ============================================================
    // Step 5: Write to memory
    // ============================================================
    const writer = new MemoryWriter({
      workspaceDir,
      mode: 'merge',
      dryRun: opts.dryRun,
    });

    const writeResult = writer.write(resume, privacy, confidence);

    // ============================================================
    // Step 6: Calculate score AFTER import
    // ============================================================
    const scoreAfter = opts.dryRun
      ? scoreBefore // Can't calculate if dry-run
      : calculateMemoryScore(workspaceDir).score;

    // ============================================================
    // Step 7: Generate report
    // ============================================================
    const report = generateReport(
      resume,
      privacy,
      confidence,
      allIssues,
      writeResult,
      scoreBefore,
      scoreAfter,
      detected.format,
      opts.dryRun
    );

    return {
      success: true,
      resume,
      summary: `Imported ${writeResult.fieldsWritten} fields from ${detected.format}. ` +
               `Memory Score: ${scoreBefore} → ${scoreAfter}.`,
      report,
      scoreBefore,
      scoreAfter,
    };
  } catch (err) {
    // Handle UserActionRequired (e.g., LinkedIn)
    if (err instanceof UserActionRequired) {
      const lines = [
        `⚠️ **Action Required**\n`,
        err.message,
        '',
        ...err.steps,
      ];
      if (err.fallback) {
        lines.push('', `💡 ${err.fallback}`);
      }
      return {
        success: false,
        summary: 'User action required.',
        report: lines.join('\n'),
        error: err.message,
      };
    }

    const error = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      summary: `Import failed: ${error}`,
      report: `❌ **Import Failed**\n\n${error}`,
      error,
    };
  }
}

// ============================================================
// Report Generator
// ============================================================

function generateReport(
  resume: CanonicalResume,
  privacy: ReturnType<typeof classifyPrivacy>,
  confidence: ReturnType<typeof scoreConfidence>,
  issues: Array<{ field: string; severity: string; message: string }>,
  writeResult: ReturnType<InstanceType<typeof MemoryWriter>['write']>,
  scoreBefore: number,
  scoreAfter: number,
  format: string,
  dryRun?: boolean
): string {
  const lines: string[] = [];

  // Header
  lines.push(`## ✅ 简历导入${dryRun ? '预览 (Dry Run)' : '完成'}`);
  lines.push('');
  lines.push(`📄 来源: ${resume._meta.source_file || 'stdin'} (${format})`);
  lines.push(`📊 整体置信度: ${Math.round(confidence.overall * 100)}%`);
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');

  // Auto-written fields
  lines.push(`### 自动写入（${privacy.autoWrite.length} 个字段）  ✅`);
  lines.push('');
  lines.push('| 类别 | 内容 |');
  lines.push('|------|------|');

  if (resume.identity.name) {
    lines.push(`| 姓名 | ${resume.identity.name} |`);
  }
  if (resume.identity.headline) {
    lines.push(`| 头衔 | ${resume.identity.headline} |`);
  }
  const currentJob = resume.experience.find(e => !e.period.end) || resume.experience[0];
  if (currentJob) {
    lines.push(`| 当前公司 | ${currentJob.company} |`);
  }
  if (resume.skills.technical.length > 0) {
    lines.push(`| 技术栈 | ${resume.skills.technical.slice(0, 8).join(', ')}${resume.skills.technical.length > 8 ? '...' : ''} |`);
  }
  lines.push(`| 工作经历 | ${resume.experience.length} 段 |`);
  if (resume.education.length > 0) {
    lines.push(`| 教育背景 | ${resume.education.map(e => e.institution).join(', ')} |`);
  }
  if (resume.projects.length > 0) {
    lines.push(`| 项目 | ${resume.projects.length} 个已写入 memory/projects/ |`);
  }
  lines.push('');

  // Needs confirmation
  const warnings = issues.filter(i => i.severity === 'warning');
  if (warnings.length > 0) {
    lines.push(`### ⚠️ 需要确认（${warnings.length} 项）`);
    lines.push('');
    for (let i = 0; i < warnings.length; i++) {
      lines.push(`${i + 1}. **${warnings[i].field}**: ${warnings[i].message}`);
    }
    lines.push('');
  }

  // Sensitive fields (skipped by default)
  if (privacy.needsOptIn.length > 0) {
    lines.push(`### 🔒 已跳过的敏感字段（${privacy.needsOptIn.length} 个）`);
    lines.push('');
    for (const field of privacy.needsOptIn) {
      lines.push(`- ${field.label}: [需要手动确认才会写入]`);
    }
    lines.push('');
  }

  // L3 discarded
  if (privacy.discarded.length > 0) {
    lines.push(`### 🚫 已丢弃的极敏感信息（${privacy.discarded.length} 个）`);
    lines.push('');
    for (const field of privacy.discarded) {
      lines.push(`- ${field.label}: [已安全丢弃]`);
    }
    lines.push('');
  }

  // Suggestions
  const missingHints: string[] = [];
  if (!resume.identity.timezone) missingHints.push('时区偏好');
  if (resume.skills.soft.length === 0) missingHints.push('软技能');
  if (missingHints.length > 0) {
    lines.push('### ❓ 建议补充');
    lines.push('');
    for (const hint of missingHints) {
      lines.push(`- [ ] ${hint}`);
    }
    lines.push('');
  }

  // Score
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  const delta = scoreAfter - scoreBefore;
  lines.push(
    `📊 Memory Score: ${scoreBefore} → **${scoreAfter}** (+${delta})`
  );

  // Score bars
  const scoreResult = calculateMemoryScore(
    process.cwd() // will be recalculated
  );
  for (const bar of scoreResult.visualBars) {
    lines.push(`   ${bar}`);
  }

  lines.push('');
  lines.push(`💡 ${scoreResult.suggestion}`);

  // Files written
  if (writeResult.filesWritten.length > 0 && !dryRun) {
    lines.push('');
    lines.push('### 📁 写入文件');
    for (const f of writeResult.filesWritten) {
      lines.push(`- \`${f}\``);
    }
  }

  return lines.join('\n');
}
