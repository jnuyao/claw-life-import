---
name: claw-life-import
version: 0.1.0
description: |
  Import your personal data (resume, bookmarks, notes, etc.) to quickly
  bootstrap Claw's memory about you. Turn 30 minutes of conversation
  into a 5-minute import.
author: ""
commands:
  - name: import-resume
    description: Import a resume file (PDF/JSON/URL) into Claw memory
    arguments:
      - name: source
        description: Path to resume file, URL, or "-" for stdin
        required: true
      - name: format
        description: "Force format: pdf, json, url (auto-detected if omitted)"
        required: false
  - name: memory-score
    description: Show how well Claw knows you with a 0-100 score
    arguments: []
tools:
  - resume-parser
  - privacy-classifier
  - memory-writer
  - memory-scorer
requires:
  memory: true
---

# claw-life-import

Import your personal data to bootstrap Claw's memory — fast.

## Quick Start

```bash
# Install from ClawHub
clawhub install claw-life-import

# Import a resume
/import-resume ./my-resume.pdf

# Check how well Claw knows you
/memory-score
```

## Why?

New Claw users face a "cold start" problem — Claw knows nothing about you.
Building memory through conversation costs ~$30-50 in tokens.

**claw-life-import** lets you skip that by importing data you already have.

## Privacy

All data is processed locally. Sensitive fields (L2+) are skipped by default.
See the Privacy section in README.md for details.
