# claw-life-import

> Import your personal data to bootstrap Claw's memory — fast.

[![Version](https://img.shields.io/badge/version-0.1.0-blue)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](#)
[![OpenClaw Skill](https://img.shields.io/badge/OpenClaw-Skill-purple)](#)

## The Problem

New OpenClaw users face a **"cold start" problem** — Claw knows nothing about you.
Building memory through conversation costs ~**$30-50** in tokens and takes dozens of
back-and-forth exchanges.

## The Solution

**claw-life-import** lets you skip that by importing data you already have:

```bash
# 5 minutes to go from stranger to well-known
/import-resume ./my-resume.pdf
# → 23 fields imported, Memory Score: 0 → 67 ✅
```

## Quick Start

### Installation

```bash
# Install from ClawHub
clawhub install claw-life-import

# Or clone and build from source
git clone https://github.com/yourname/claw-life-import.git
cd claw-life-import
npm install
npm run build
```

### Usage

```bash
# Import a resume (PDF)
/import-resume ./resume.pdf

# Import a resume (JSON Resume standard)
/import-resume ./resume.json

# Import from GitHub profile
/import-resume https://github.com/username

# Preview without writing (dry-run)
/import-resume ./resume.pdf --dry-run

# Check your Memory Score
/memory-score
```

### CLI Mode (standalone)

```bash
# Run directly with Node.js
node dist/index.js import-resume ./resume.pdf
node dist/index.js memory-score
```

## Supported Formats

### v0.1 (Current)

| Format | Command | Status |
|--------|---------|--------|
| PDF Resume | `/import-resume ./file.pdf` | ✅ Supported |
| JSON Resume | `/import-resume ./file.json` | ✅ Supported |
| LinkedIn JSON | `/import-resume ./linkedin-export.json` | ✅ Supported |
| GitHub Profile | `/import-resume https://github.com/user` | ✅ Supported |
| Personal Website | `/import-resume https://example.com` | ✅ Basic |
| Plain Text | `/import-resume ./resume.txt` | ✅ Supported |

### Planned

| Format | Command | Version |
|--------|---------|---------|
| Browser Bookmarks | `/import-bookmarks` | v0.3 |
| Notes (Notion/Obsidian) | `/import-notes` | v0.4 |
| AI Chat History | `/import-ai-history` | v0.5 |
| Calendar (ICS) | `/import-calendar` | v1.0 |
| Photo EXIF | `/import-photos` | v1.0 |

## Memory Score

Memory Score (0-100) measures how well Claw knows you across 7 categories:

```
🧠 Memory Score

████████████████░░░░ 67/100

身份信息 Identity         ████████░░ 80%
技能图谱 Skills           ███████░░░ 70%
兴趣爱好 Interests        ██░░░░░░░░ 20%
工作风格 Work Style       █░░░░░░░░░ 10%
项目经历 Projects         ████████░░ 80%
人际关系 Relationships    █░░░░░░░░░ 10%
生活方式 Lifestyle        ░░░░░░░░░░  0%

💡 已有基本了解！试试导入浏览器书签让我更懂你的兴趣 → /import-bookmarks
```

## Privacy

Privacy is the **#1 priority**, aligned with OpenClaw's "Security and safe defaults" principle.

### 4-Level Classification

| Level | Name | Behavior | Examples |
|-------|------|----------|----------|
| L0 | Public | Auto-write | Job title, skills, project names |
| L1 | General | Write, can cancel | Company name, school, city |
| L2 | Sensitive | Skip, opt-in only | Email, phone, salary |
| L3 | Extreme | Always discard | ID numbers, passwords, bank cards |

### Guarantees

- **100% local processing** — no data leaves your machine
- **No external API calls for data** — only LLM calls for extraction
- **Transparent audit log** — every import generates a detailed report
- **User control** — every field can be reviewed before writing
- **L3 auto-detection** — regex patterns catch sensitive data even if LLM misses it

## Architecture

```
┌──────────────────────────────────────────────────┐
│                claw-life-import                    │
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌─────────────────┐ │
│  │  INGEST   │→│ EXTRACT   │→│ WRITE + VERIFY   │ │
│  │           │  │           │  │                  │ │
│  │ Format    │  │ LLM JSON  │  │ Privacy Filter  │ │
│  │ Detection │  │ Extraction│  │ Confidence Gate │ │
│  │ PDF Parse │  │ Schema    │  │ Memory Writer   │ │
│  │ JSON Map  │  │ Validate  │  │ Score Update    │ │
│  │ URL Fetch │  │ Semantics │  │ User Confirm    │ │
│  └──────────┘  └──────────┘  └─────────────────┘ │
│                                                    │
│  Memory Plugin Interface (Memsearch / Mem0 / ...)  │
└──────────────────────────────────────────────────┘
```

## Project Structure

```
claw-life-import/
├── SKILL.md                     # OpenClaw Skill metadata
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Entry point + CLI
│   ├── schemas/
│   │   ├── canonical-resume.ts  # Unified resume schema
│   │   └── privacy-levels.ts   # Privacy classification rules
│   ├── parsers/
│   │   ├── format-detector.ts   # Auto-detect input format
│   │   ├── pdf-resume-parser.ts # PDF extraction
│   │   ├── json-resume-parser.ts# JSON Resume / LinkedIn
│   │   └── url-resume-parser.ts # GitHub / website scraping
│   ├── extractors/
│   │   └── llm-extractor.ts    # LLM structured extraction
│   ├── validators/
│   │   ├── schema-validator.ts  # Layer 1: structure
│   │   ├── semantic-validator.ts# Layer 2: reasonableness
│   │   └── confidence-scorer.ts # Layer 3: confidence
│   ├── privacy/
│   │   └── classifier.ts       # L0-L3 classification
│   ├── writers/
│   │   └── memory-writer.ts    # Write to USER.md etc.
│   ├── scoring/
│   │   └── memory-score.ts     # Memory Score engine
│   ├── commands/
│   │   ├── import-resume.ts    # /import-resume
│   │   └── memory-score.ts     # /memory-score
│   └── utils/
│       ├── date-utils.ts       # Date normalization
│       └── text-utils.ts       # Text cleaning + sections
└── README.md
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (for LLM extraction) | — |
| `ANTHROPIC_API_KEY` | Anthropic API key (alternative) | — |
| `LLM_BASE_URL` | Custom LLM endpoint | `https://api.openai.com/v1` |
| `LLM_MODEL` | Model to use for extraction | `gpt-4o-mini` |
| `GITHUB_TOKEN` | GitHub token (for higher API rate limits) | — |

> When running inside OpenClaw, the agent's own model is used automatically.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Development mode (auto-rebuild)
npm run dev
```

## Roadmap

| Version | Content | ETA |
|---------|---------|-----|
| **v0.1** ← current | Resume import (PDF/JSON/URL) + Memory Score | Done |
| v0.2 | Memory Score visualization + guided onboarding | +3-5 days |
| v0.3 | Browser bookmark import (Chrome/Firefox) | +1 week |
| v0.4 | Notes import (Notion/Obsidian) | +1-2 weeks |
| v0.5 | AI history migration (ChatGPT/Claude export) | +1 week |
| v1.0 | Calendar + photos + full privacy UI + ClawHub publish | +2-3 weeks |

## License

MIT
