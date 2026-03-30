# claw-life-import

> Import your personal data to bootstrap Claw's memory — fast.

[![Version](https://img.shields.io/badge/version-0.1.1-blue)](#)
[![License](https://img.shields.io/badge/license-MIT-green)](#)
[![OpenClaw Skill](https://img.shields.io/badge/OpenClaw-Skill-purple)](#)
[![Tests](https://img.shields.io/badge/tests-45%20passed-brightgreen)](#)

## The Problem

New OpenClaw users face a **"cold start" problem** — Claw knows nothing about you.
Building memory through conversation costs ~**$30-50** in tokens and takes dozens of
back-and-forth exchanges.

## The Solution

**claw-life-import** lets you skip that by importing data you already have:

```bash
# 5 minutes to go from stranger to well-known
/claw_life_import ./my-resume.pdf
# → 23 fields imported, Memory Score: 0 → 67 ✅
```

---

## Product Vision

### North Star

> Use the least intrusive approach to give Claw a sufficiently good user profile in the shortest time, significantly improving subsequent collaboration quality.

claw_life_import is not just a "resume importer" — it is the **bootstrap layer** for Claw's user modeling capability stack. It solves the cold-start problem: Claw lacks a high-quality, low-friction, privacy-controlled "get to know me" entry point.

### Design Principles

| # | Principle | What It Means |
|---|-----------|---------------|
| 1 | **Trust before intelligence** | Users care more about what you wrote, why you wrote it, and whether you can undo it — than how smart the extraction is. Default behavior is conservative: preview before write, opt-in for sensitive data, full traceability. |
| 2 | **Source Profile ≠ Assistant Memory** | Imported data is "source truth", not final memory. There is a mapping/merge layer between what was extracted and what Claw actually remembers. This enables re-import, diff, rollback, and regeneration. |
| 3 | **From importer to user modeling workbench** | claw_life_import is Phase 1. Future skills (`claw_profile_watch`, `claw_memory_console`) will handle continuous enrichment and memory management. Together they form Claw's user understanding stack. |
| 4 | **Skill cognitive load has an upper bound** | SKILL.md is prompt-injected into the agent's context. Beyond ~20KB, execution quality degrades. All extensions should consider splitting into multiple Skills rather than inflating a single one. |

### Architecture: Two-Layer System

```
┌─────────────────────────────────────┐
│         claw_life_import            │
├──────────────────┬──────────────────┤
│  Import Engine   │ Memory Sync Engine│
│                  │                  │
│  • Source fetch  │  • Merge policy  │
│  • Parser        │  • De-duplication│
│  • Extractor     │  • Source tracking│
│  • Validator     │  • Write strategy│
│  • Privacy class │  • Change summary│
└──────────────────┴──────────────────┘
```

These two layers have different lifecycles: parsers grow with new data sources, while memory strategies evolve with user needs. They are logically separated in SKILL.md and designed for future physical separation.

---

## 🚀 Install in OpenClaw (One Command)

### Option A: Install from ClawHub

```bash
openclaw skills install claw_life_import
```

### Option B: Install from GitHub

```bash
# Clone into your workspace skills directory
git clone https://github.com/jnuyao/claw-life-import.git /tmp/claw-life-import
cp -r /tmp/claw-life-import/skills/claw_life_import ~/.openclaw/skills/claw_life_import
```

Or manually:
```bash
mkdir -p ~/.openclaw/skills/claw_life_import
# Copy the SKILL.md from this repo's skills/claw_life_import/SKILL.md
```

### Option C: Workspace-local install

```bash
# Inside your OpenClaw workspace
mkdir -p skills/claw_life_import
cp /path/to/claw-life-import/skills/claw_life_import/SKILL.md skills/claw_life_import/
```

### Verify installation

```bash
# Start a new session
openclaw skills list | grep claw_life_import
```

---

## 🧪 Usage

Once installed, start a new OpenClaw session and use:

```bash
# Import a resume from a URL
/claw_life_import https://yaohom.vercel.app/

# Import a PDF resume
/claw_life_import ./my-resume.pdf

# Import JSON Resume format
/claw_life_import ./resume.json

# Import from GitHub profile
/claw_life_import https://github.com/jnuyao

# Import plain text (paste or file)
/claw_life_import ./resume.txt

# Check your Memory Score
/claw_life_import score
```

Or just tell the agent naturally:

> "帮我导入这份简历 https://yaohom.vercel.app/"
> "Import my resume from this PDF"
> "你有多了解我？" (triggers Memory Score)

---

## How It Works

The skill teaches OpenClaw's agent a **7-step pipeline**:

```
┌─────────────────────────────────────────────────────────┐
│  /claw_life_import https://yaohom.vercel.app/           │
│                                                          │
│  1. Score BEFORE  → Current Memory Score: 12/100         │
│  2. Detect Format → URL (personal site)                  │
│  3. Fetch & Parse → web_fetch / browser (SPA-aware)      │
│  4. Extract       → Structured CanonicalResume schema    │
│  5. Validate      → Schema + Semantic + Confidence       │
│  6. Privacy       → L0-L3 classification                 │
│  7. Write & Report→ USER.md + MEMORY.md + projects/      │
│                                                          │
│  ✅ Memory Score: 12 → 67 (+55)                          │
└─────────────────────────────────────────────────────────┘
```

**Key insight**: The agent IS the LLM — no external API key needed for structured extraction. The skill encodes all domain knowledge (extraction schema, privacy rules, memory format) as agent instructions.

## Supported Formats

| Format | Input | SPA-aware |
|--------|-------|-----------|
| PDF Resume | `/claw_life_import ./file.pdf` | — |
| JSON Resume | `/claw_life_import ./file.json` | — |
| LinkedIn JSON | `/claw_life_import ./linkedin.json` | — |
| GitHub Profile | `/claw_life_import https://github.com/user` | — |
| Personal Website | `/claw_life_import https://example.com` | ✅ |
| Plain Text | `/claw_life_import ./resume.txt` | — |

## Memory Score

Memory Score (0-100) measures how well Claw knows you across 7 categories:

```
🧠 Memory Score

████████████████░░░░ 67/100

Identity         ████████░░ 80%
Skills           ███████░░░ 70%
Interests        ██░░░░░░░░ 20%
Work Style       █░░░░░░░░░ 10%
Projects         ████████░░ 80%
Relationships    █░░░░░░░░░ 10%
Lifestyle        ░░░░░░░░░░  0%

💡 已有基本了解！试试导入浏览器书签让我更懂你的兴趣
```

## Privacy Model

Privacy is the **#1 priority**, aligned with OpenClaw's "Security and safe defaults" principle.

| Level | Name | Behavior | Examples |
|-------|------|----------|----------|
| L0 | Public | Auto-write | Job title, skills, project names |
| L1 | General | Write, can cancel | Company name, school, city |
| L2 | Sensitive | **Skip**, opt-in only | Email, phone, salary |
| L3 | Extreme | **Always discard** | ID numbers, passwords, bank cards |

- L3 patterns are detected via regex BEFORE extraction
- L2 fields are listed but NOT written until user explicitly opts in
- L0 + L1 fields are written with a summary shown to the user

## Architecture

This project has **two layers**:

### 1. OpenClaw Skill (Pure Markdown — recommended)

The `skills/claw_life_import/SKILL.md` is a standalone OpenClaw Skill that works with zero dependencies. It encodes the complete pipeline as agent instructions, using built-in tools (`web_fetch`, `browser`, `read`, `write`).

**Use this for**: One-command install, immediate usage, no setup.

### 2. TypeScript CLI (Advanced — for deterministic processing)

The `src/` directory contains a full TypeScript implementation with:
- Format auto-detection with magic bytes
- 3-layer validation (schema + semantic + confidence scoring)
- Privacy classifier with regex-based L3 detection
- Memory writer with merge/append modes
- 45 passing tests

**Use this for**: CI/CD integration, batch processing, higher reliability.

```bash
# CLI usage
npm install && npm run build
node dist/index.js import-resume ./resume.pdf --dry-run
```

## Project Structure

```
claw-life-import/
├── skills/
│   └── claw_life_import/
│       └── SKILL.md              ← OpenClaw Skill (install this)
├── src/                           ← TypeScript CLI (optional)
│   ├── index.ts
│   ├── schemas/
│   ├── parsers/
│   ├── extractors/
│   ├── validators/
│   ├── privacy/
│   ├── writers/
│   ├── scoring/
│   ├── commands/
│   └── utils/
├── tests/
│   ├── fixtures/
│   ├── helpers/
│   ├── unit/
│   └── integration/
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## Development

```bash
npm install
npm run build
npm test                           # 45 tests
npx jest --runInBand --verbose     # Verbose output
```

## Changelog

### v0.1.1 — Skill + Real-World Hardening

- **NEW: OpenClaw Skill** — Pure markdown `SKILL.md` that works with zero dependencies
- **SPA Detection** — URL parser detects JS-rendered sites, falls back to browser
- **Pre-rendered Content** — `--content` flag for SPA workarounds
- **Progress Callbacks** — Real-time feedback during import
- **45 tests** — Unit + integration tests with mock LLM

### v0.1.0 — Initial MVP

Full TypeScript pipeline: PDF, JSON Resume, LinkedIn JSON, GitHub profiles, personal websites.

## Roadmap

| Version | Content | Status |
|---------|---------|--------|
| ~~v0.1~~ | Resume import pipeline | ✅ Done |
| **v0.1.1** ← current | OpenClaw Skill + real-world hardening | ✅ Done |
| v0.2 | Interactive confirmation flow + ClawHub publish | Next |
| v0.3 | Browser bookmarks import | Planned |
| v0.4 | Notes import (Notion/Obsidian) | Planned |
| v1.0 | Full data import suite + Privacy UI | Planned |

## License

MIT
