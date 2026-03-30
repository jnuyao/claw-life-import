// ============================================================
// Memory Writer — Write extracted resume data into OpenClaw
// Memory files (USER.md, MEMORY.md, memory/projects/)
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

import { CanonicalResume } from '../schemas/canonical-resume';
import { PrivacyClassificationResult } from '../privacy/classifier';
import { ConfidenceResult } from '../validators/confidence-scorer';

export interface WriteOptions {
  /** OpenClaw workspace root directory */
  workspaceDir: string;
  /** Whether to overwrite existing content or merge */
  mode: 'merge' | 'overwrite';
  /** Dry-run mode: return what would be written without writing */
  dryRun?: boolean;
}

export interface WriteResult {
  filesWritten: string[];
  fieldsWritten: number;
  fieldsSkipped: number;
  preview: Record<string, string>; // filename → content preview
}

export class MemoryWriter {
  private opts: WriteOptions;

  constructor(opts: WriteOptions) {
    this.opts = opts;
  }

  /**
   * Write resume data to OpenClaw memory files.
   */
  write(
    resume: CanonicalResume,
    privacy: PrivacyClassificationResult,
    confidence: ConfidenceResult
  ): WriteResult {
    const result: WriteResult = {
      filesWritten: [],
      fieldsWritten: 0,
      fieldsSkipped: 0,
      preview: {},
    };

    // 1. Generate USER.md content
    const userMd = this.generateUserMd(resume, privacy, confidence);
    result.preview['USER.md'] = userMd;

    // 2. Generate MEMORY.md section
    const memorySection = this.generateMemorySection(resume, privacy);
    result.preview['MEMORY.md'] = memorySection;

    // 3. Generate project files
    const projectFiles = this.generateProjectFiles(resume);
    for (const [filename, content] of Object.entries(projectFiles)) {
      result.preview[filename] = content;
    }

    // Count fields
    result.fieldsWritten = privacy.autoWrite.length;
    result.fieldsSkipped = privacy.needsOptIn.length + privacy.discarded.length;

    // Write files (unless dry-run)
    if (!this.opts.dryRun) {
      this.writeUserMd(userMd);
      result.filesWritten.push('USER.md');

      this.writeMemoryMd(memorySection);
      result.filesWritten.push('MEMORY.md');

      for (const [filename, content] of Object.entries(projectFiles)) {
        this.writeProjectFile(filename, content);
        result.filesWritten.push(filename);
      }
    }

    return result;
  }

  // ============================================================
  // Content Generation
  // ============================================================

  private generateUserMd(
    resume: CanonicalResume,
    privacy: PrivacyClassificationResult,
    confidence: ConfidenceResult
  ): string {
    const lines: string[] = [];

    // Identity section
    lines.push('## Identity');
    if (resume.identity.name) {
      lines.push(`- Name: ${resume.identity.name}`);
    }
    if (resume.identity.headline) {
      lines.push(`- Role: ${resume.identity.headline}`);
    }

    // Extract current company from most recent experience
    const currentJob = resume.experience.find(e => !e.period.end);
    const latestJob = currentJob || resume.experience[0];
    if (latestJob) {
      lines.push(`- Company: ${latestJob.company}`);
      if (!resume.identity.headline) {
        lines.push(`- Role: ${latestJob.title}`);
      }
    }

    if (resume.identity.location) {
      lines.push(`- Location: ${resume.identity.location}`);
    }
    if (resume.identity.timezone) {
      lines.push(`- Timezone: ${resume.identity.timezone}`);
    }

    // Years of experience
    if (resume.experience.length > 0) {
      const years = this.calculateYearsOfExperience(resume);
      if (years > 0) {
        lines.push(`- Years of Experience: ${years}`);
      }
    }

    lines.push('');

    // Technical Skills section
    if (
      resume.skills.technical.length > 0 ||
      resume.skills.domain.length > 0
    ) {
      lines.push('## Technical Skills');
      if (resume.skills.technical.length > 0) {
        // Split into primary (first 5) and secondary (rest)
        const primary = resume.skills.technical.slice(0, 5);
        const secondary = resume.skills.technical.slice(5);
        lines.push(`- Primary: ${primary.join(', ')}`);
        if (secondary.length > 0) {
          lines.push(`- Secondary: ${secondary.join(', ')}`);
        }
      }
      if (resume.skills.domain.length > 0) {
        lines.push(`- Domain: ${resume.skills.domain.join(', ')}`);
      }
      if (resume.skills.certifications.length > 0) {
        lines.push(`- Certifications: ${resume.skills.certifications.join(', ')}`);
      }
      lines.push('');
    }

    // Career summary
    if (resume.experience.length > 0) {
      lines.push('## Career Summary');
      for (const exp of resume.experience.slice(0, 5)) {
        const endStr = exp.period.end || 'Present';
        lines.push(`- ${exp.title} @ ${exp.company} (${exp.period.start} - ${endStr})`);
      }
      lines.push('');
    }

    // Education
    if (resume.education.length > 0) {
      lines.push('## Education');
      for (const edu of resume.education) {
        lines.push(`- ${edu.degree} in ${edu.field} — ${edu.institution}`);
      }
      lines.push('');
    }

    // Import metadata
    lines.push('## Import Metadata');
    lines.push(`- Source: ${resume._meta.source_file || 'unknown'} (${resume._meta.source_format})`);
    lines.push(`- Imported: ${resume._meta.parsed_at}`);
    lines.push(`- Confidence: ${Math.round(confidence.overall * 100)}%`);
    lines.push(`- Imported via: claw-life-import v${resume._meta.parser_version}`);

    return lines.join('\n');
  }

  private generateMemorySection(
    resume: CanonicalResume,
    _privacy: PrivacyClassificationResult
  ): string {
    const lines: string[] = [];
    const now = new Date().toISOString().split('T')[0];

    lines.push(`## Resume Import (${now})`);
    lines.push('');

    // Career trajectory
    if (resume.experience.length > 0) {
      lines.push('### Career Trajectory');
      for (const exp of resume.experience) {
        const endStr = exp.period.end || 'Present';
        lines.push(`- **${exp.title}** at ${exp.company} (${exp.period.start} – ${endStr})`);
        if (exp.description) {
          lines.push(`  ${exp.description}`);
        }
        if (exp.highlights.length > 0) {
          for (const h of exp.highlights.slice(0, 3)) {
            lines.push(`  - ${h}`);
          }
        }
      }
      lines.push('');
    }

    // Skill landscape
    if (resume.skills.technical.length > 0) {
      lines.push('### Technical Skill Landscape');
      lines.push(resume.skills.technical.join(', '));
      lines.push('');
    }

    // Active projects
    if (resume.projects.length > 0) {
      lines.push('### Known Projects');
      for (const p of resume.projects) {
        lines.push(`- **${p.name}** (${p.role}): ${p.description}`);
        if (p.technologies.length > 0) {
          lines.push(`  Tech: ${p.technologies.join(', ')}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateProjectFiles(
    resume: CanonicalResume
  ): Record<string, string> {
    const files: Record<string, string> = {};

    for (const project of resume.projects) {
      const safeName = project.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      if (!safeName) continue;

      const filename = `memory/projects/${safeName}.md`;
      const lines: string[] = [];

      lines.push(`# ${project.name}`);
      lines.push('');
      lines.push(`**Role**: ${project.role}`);
      lines.push('');
      lines.push(project.description);
      lines.push('');

      if (project.technologies.length > 0) {
        lines.push('## Technologies');
        lines.push(project.technologies.join(', '));
        lines.push('');
      }

      if (project.url) {
        lines.push(`**URL**: ${project.url}`);
        lines.push('');
      }

      lines.push(`---`);
      lines.push(`_Imported from resume by claw-life-import_`);

      files[filename] = lines.join('\n');
    }

    return files;
  }

  // ============================================================
  // File Writing
  // ============================================================

  private writeUserMd(content: string): void {
    const filePath = path.join(this.opts.workspaceDir, 'USER.md');

    if (this.opts.mode === 'merge' && fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf-8');

      // Check if already has import section
      if (existing.includes('## Import Metadata')) {
        // Replace the imported sections
        const sections = this.parseMdSections(existing);
        const newSections = this.parseMdSections(content);

        for (const [title, body] of Object.entries(newSections)) {
          sections[title] = body;
        }

        const merged = Object.entries(sections)
          .map(([title, body]) => `## ${title}\n${body}`)
          .join('\n\n');

        fs.writeFileSync(filePath, merged, 'utf-8');
      } else {
        // Append to existing
        fs.writeFileSync(filePath, existing + '\n\n' + content, 'utf-8');
      }
    } else {
      fs.writeFileSync(filePath, content, 'utf-8');
    }
  }

  private writeMemoryMd(content: string): void {
    const filePath = path.join(this.opts.workspaceDir, 'MEMORY.md');

    if (fs.existsSync(filePath)) {
      const existing = fs.readFileSync(filePath, 'utf-8');
      fs.writeFileSync(filePath, existing + '\n\n' + content, 'utf-8');
    } else {
      const header = '# Memory\n\n';
      fs.writeFileSync(filePath, header + content, 'utf-8');
    }
  }

  private writeProjectFile(relativePath: string, content: string): void {
    const fullPath = path.join(this.opts.workspaceDir, relativePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  // ============================================================
  // Helpers
  // ============================================================

  private calculateYearsOfExperience(resume: CanonicalResume): number {
    if (resume.experience.length === 0) return 0;

    const sorted = [...resume.experience]
      .filter(e => e.period.start)
      .sort((a, b) => a.period.start.localeCompare(b.period.start));

    if (sorted.length === 0) return 0;

    const earliest = new Date(
      sorted[0].period.start.length === 7
        ? `${sorted[0].period.start}-01`
        : sorted[0].period.start
    );
    const now = new Date();

    return Math.round((now.getTime() - earliest.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  }

  private parseMdSections(md: string): Record<string, string> {
    const sections: Record<string, string> = {};
    const regex = /^## (.+)$/gm;
    let match: RegExpExecArray | null;
    const boundaries: Array<{ title: string; start: number }> = [];

    while ((match = regex.exec(md)) !== null) {
      boundaries.push({ title: match[1], start: match.index + match[0].length });
    }

    for (let i = 0; i < boundaries.length; i++) {
      const end = i + 1 < boundaries.length
        ? md.lastIndexOf('\n## ', boundaries[i + 1].start)
        : md.length;
      sections[boundaries[i].title] = md.slice(boundaries[i].start, end).trim();
    }

    return sections;
  }
}
