// ============================================================
// claw-life-import — Entry Point
//
// OpenClaw Skill for importing personal data into agent memory.
// ============================================================

// Re-export commands
export { importResume, ImportResumeOptions, ImportResumeResult } from './commands/import-resume';
export { memoryScore, MemoryScoreOptions } from './commands/memory-score';

// Re-export core types
export {
  CanonicalResume,
  SourceFormat,
  PrivacyLevel,
  Experience,
  Education,
  Skills,
  Project,
} from './schemas/canonical-resume';

// Re-export utilities for external use
export { LLMExtractor, LLMProvider } from './extractors/llm-extractor';
export { calculateMemoryScore, MemoryScoreResult } from './scoring/memory-score';
export { classifyPrivacy } from './privacy/classifier';
export { detectFormat } from './parsers/format-detector';

// ============================================================
// CLI Entry Point (when run directly)
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    return;
  }

  const command = args[0];

  switch (command) {
    case 'import-resume':
    case '/import-resume': {
      const source = args[1];
      if (!source) {
        console.error('Error: Please provide a resume source (file path, URL, or JSON).');
        console.error('Usage: claw-life-import import-resume <source> [--format pdf|json|url] [--dry-run]');
        process.exit(1);
      }

      const { importResume } = await import('./commands/import-resume');

      const format = getArgValue(args, '--format') as SourceFormat | undefined;
      const dryRun = args.includes('--dry-run');
      const workspaceDir = getArgValue(args, '--workspace') || process.cwd();

      console.log(`\n🔄 Importing resume from: ${source}\n`);

      const result = await importResume({
        source,
        format,
        dryRun,
        workspaceDir,
      });

      console.log(result.report);

      if (!result.success) {
        process.exit(1);
      }
      break;
    }

    case 'memory-score':
    case '/memory-score': {
      const { memoryScore } = await import('./commands/memory-score');
      const workspaceDir = getArgValue(args, '--workspace') || process.cwd();
      const format = (getArgValue(args, '--format') || 'full') as 'full' | 'compact' | 'json';

      const result = memoryScore({ workspaceDir, format });
      console.log(result.report);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

function printHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║           🧠 claw-life-import v0.1.0                  ║
║   Import personal data to bootstrap Claw memory       ║
╚═══════════════════════════════════════════════════════╝

COMMANDS:

  import-resume <source>     Import a resume into Claw memory
    --format <pdf|json|url>  Force input format (auto-detected by default)
    --dry-run                Preview changes without writing
    --workspace <dir>        OpenClaw workspace directory

  memory-score               Check how well Claw knows you
    --format <full|compact|json>  Output format
    --workspace <dir>             OpenClaw workspace directory

EXAMPLES:

  # Import a PDF resume
  claw-life-import import-resume ./my-resume.pdf

  # Import JSON Resume format
  claw-life-import import-resume ./resume.json

  # Import from GitHub profile
  claw-life-import import-resume https://github.com/username

  # Dry-run (preview without writing)
  claw-life-import import-resume ./resume.pdf --dry-run

  # Check your memory score
  claw-life-import memory-score
`);
}

function getArgValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) {
    return args[idx + 1];
  }
  return undefined;
}

// Run if executed directly
if (require.main === module) {
  main().catch(err => {
    console.error('Fatal error:', err.message || err);
    process.exit(1);
  });
}
