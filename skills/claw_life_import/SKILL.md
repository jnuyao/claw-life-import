---
name: claw_life_import
description: Import your resume (PDF, JSON, URL, text) to bootstrap Claw memory. One command to go from stranger to well-known.
user-invocable: true
metadata:
  {
    "openclaw": {
      "emoji": "🧠",
      "homepage": "https://github.com/jnuyao/claw-life-import",
      "requires": {}
    }
  }
---

# claw-life-import: Personal Data Import Skill

You are an expert resume parser and memory bootstrapper. When the user invokes `/claw_life_import` (or asks to import their resume, personal data, or profile), follow this complete pipeline to extract structured information and write it into Claw memory files.

## Trigger Conditions

Activate when the user:
- Uses `/claw_life_import <source>` with a file path, URL, or pasted text
- Says "import my resume", "导入我的简历", "import my profile"
- Provides a resume file or URL and asks you to "remember" or "learn about me"
- Asks to boost their Memory Score

## Pipeline Overview

Execute these 7 steps in order:
1. **Score BEFORE** — Calculate current Memory Score
2. **Detect Format** — Identify input type (PDF, JSON, URL, plain text)
3. **Fetch & Parse** — Get the raw content
4. **Extract** — Structured extraction into CanonicalResume schema
5. **Validate & Score** — 3-layer validation
6. **Privacy Filter** — Classify fields by privacy level
7. **Write & Report** — Write to memory files, generate report

---

## Step 1: Score BEFORE

Before importing, assess the current memory state. Read these files if they exist:
- `USER.md` in the workspace root
- `MEMORY.md` in the workspace root
- Files under `memory/projects/` directory

Calculate a rough score (0-100) across these 7 categories:

| Category | Weight | What to look for |
|----------|--------|-----------------|
| Identity | 20% | Name, headline, location, timezone |
| Skills | 15% | Technical skills, domain expertise, certifications |
| Interests | 15% | Hobbies, topics of interest, communities |
| Work Style | 15% | Communication preferences, working hours, methodology |
| Projects | 15% | Project descriptions, roles, technologies |
| Relationships | 10% | Colleagues, mentors, collaborators mentioned |
| Lifestyle | 10% | Location, travel, daily routines |

Score each category: count how many sub-fields are filled, divide by total possible, multiply by the weight.

---

## Step 2: Detect Format

Determine the input format:

| Input | Detection Method | Format |
|-------|-----------------|--------|
| Ends with `.pdf` | File extension | `pdf` |
| Ends with `.json` | File extension, then inspect: has `basics.name`? → JSON Resume; has `positions`? → LinkedIn | `json_resume` / `linkedin_json` |
| Starts with `http` containing `github.com` | URL pattern | `github` |
| Starts with `http` containing `linkedin.com` | URL pattern | `linkedin_url` |
| Starts with `http` | Any other URL | `url` |
| Ends with `.txt` or `.md` | File extension | `plain_text` |
| Raw text (no file path) | Content analysis | `plain_text` |

---

## Step 3: Fetch & Parse

Based on format, retrieve the content:

### For URLs (personal sites, portfolios)
Use `web_fetch` to get the page. If the result is very short (< 200 characters of meaningful text), the site is likely a JavaScript SPA. In that case:
1. Tell the user: "This appears to be a JavaScript-rendered site. Let me try the browser."
2. Use `browser` tool to navigate to the URL, wait for rendering, then extract text.
3. If browser is unavailable, ask the user to paste the resume text directly.

### For GitHub profiles
Use `web_fetch` on these URLs in sequence:
1. `https://api.github.com/users/{username}` — profile info
2. `https://api.github.com/users/{username}/repos?sort=stars&per_page=20` — top repos
3. `https://raw.githubusercontent.com/{username}/{username}/main/README.md` — profile README (may 404)

### For PDF files
Use `exec` to extract text: `python3 -c "import subprocess; ..."` or instruct the user to paste text if PDF tools aren't available.

### For LinkedIn URLs
Do NOT scrape. Instead, tell the user:
> LinkedIn profiles cannot be scraped (anti-bot protection + ToS).
> Please export your data manually:
> 1. Go to LinkedIn → Settings & Privacy → Data Privacy
> 2. Click "Get a copy of your data"
> 3. Select "Profile" and "Connections"
> 4. Download the ZIP, extract the JSON, then run: `/claw_life_import ./linkedin-export.json`

### For JSON files / plain text / pasted content
Use `read` tool to get the file contents, or use the pasted text directly.

---

## Step 4: Extract — CanonicalResume Schema

Extract ALL of the following fields from the content. Only extract what is **explicitly stated**. Do NOT infer or fabricate.

```json
{
  "identity": {
    "name": "Full name",
    "headline": "Professional title or one-line summary",
    "location": "City, Country",
    "timezone": "e.g., Asia/Shanghai",
    "contact": {
      "email": "only if explicitly shown",
      "phone": "only if explicitly shown",
      "github": "GitHub URL",
      "linkedin": "LinkedIn URL",
      "website": "Personal site URL"
    }
  },
  "experience": [
    {
      "company": "Company name",
      "title": "Job title",
      "start": "YYYY-MM",
      "end": "YYYY-MM or null if current",
      "description": "Role summary",
      "highlights": ["Quantified achievement 1", "Achievement 2"],
      "technologies": ["Specific tech mentioned"]
    }
  ],
  "education": [
    {
      "institution": "School name",
      "degree": "Degree type",
      "field": "Field of study",
      "start": "YYYY-MM",
      "end": "YYYY-MM",
      "gpa": "if mentioned"
    }
  ],
  "skills": {
    "technical": ["Programming languages, frameworks, tools"],
    "domain": ["Business domains, expertise areas"],
    "soft": ["Leadership, communication, etc."],
    "certifications": ["Formal certifications"]
  },
  "projects": [
    {
      "name": "Project name",
      "role": "Your role",
      "description": "What the project does",
      "technologies": ["Tech used"],
      "url": "Project URL if available"
    }
  ]
}
```

### Extraction Rules
- Dates: Use ISO format `YYYY-MM`. If only year given, use `YYYY-01`. For "present"/"至今", use `null`.
- Highlights: Prefer quantified results (e.g., "Reduced latency by 39%", "Handled 100k QPS").
- Technologies: Be specific — "React" not "frontend framework", "Go" not "programming language".
- Skills domain: Business domains like "payments", "advertising", "marketing automation", "analytics".
- If text is in Chinese, extract in the ORIGINAL LANGUAGE. Do not translate.

---

## Step 5: Validate

Perform these checks on the extracted data:

### Layer 1: Schema Validation
- ❌ Error if `name` is empty
- ❌ Error if ALL of experience, education, skills, and projects are empty
- ⚠️ Warning if any experience is missing company or title
- ⚠️ Warning if dates are not in YYYY-MM format

### Layer 2: Semantic Validation
- ⚠️ Warning if two experiences overlap by more than 90 days
- ⚠️ Warning if first job starts more than 1 year before graduation
- ❌ Error if any experience has negative duration (end before start)
- ⚠️ Warning if any experience exceeds 20 years
- ⚠️ Warning if skills are listed but never appear in any project/experience ("orphan skills")

### Layer 3: Confidence Assessment
Rate your confidence (0.0-1.0) in the overall extraction:
- JSON Resume: 0.95 baseline
- LinkedIn JSON: 0.90 baseline
- GitHub profile: 0.70 baseline
- PDF: 0.80 baseline
- URL/plain text: 0.75 baseline
- Reduce by 0.05 for each validation warning, 0.10 for each error

---

## Step 6: Privacy Classification

Classify EVERY extracted field into one of 4 privacy levels:

| Level | Name | Action | Fields |
|-------|------|--------|--------|
| **L0** Public | Auto-write | Name, headline, job titles, company names, school names, technical skills, project names |
| **L1** General | Write (user can cancel) | Location, work periods, education periods, project descriptions, highlights, domain skills, soft skills |
| **L2** Sensitive | **SKIP** (user must opt-in) | Email, phone, LinkedIn URL, GitHub URL, website, salary, GPA |
| **L3** Extreme | **ALWAYS DISCARD** | Anything matching these patterns: ID numbers (`\d{15,18}`), SSN (`\d{3}-\d{2}-\d{4}`), credit cards (`\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}`), passwords, API keys (`sk-`, `ghp_`, `key-`) |

**CRITICAL**: Scan the raw text for L3 patterns BEFORE extraction. If found, redact and warn.

### L2 Handling
List all L2 fields and ask:
> The following sensitive fields were found but NOT written (L2 — opt-in required):
> - Email: t***@example.com
> - Phone: +86-138****8000
> - GitHub: https://github.com/***
>
> Would you like to include any of these? Reply with the field names to opt-in, or "skip all" to continue.

---

## Step 7: Write Memory Files

Write the extracted (L0 + L1) data to these files:

### USER.md (Identity + Skills + Career Summary)

```markdown
# Identity

- **Name**: {name}
- **Headline**: {headline}
- **Location**: {location}

# Technical Skills

## Primary
{top skills by frequency in experience/projects, comma-separated}

## Secondary
{remaining skills, comma-separated}

# Career Summary

{years_of_experience} years of experience in {primary domains}.

## Career Timeline
{For each experience, chronologically:}
- **{company}** — {title} ({start} - {end})
  {description}

# Education

- **{institution}** — {degree} in {field} ({start} - {end})
  {notable achievements}

---
*Imported by claw-life-import on {current date} from {source}*
*Confidence: {confidence score}*
```

### MEMORY.md (append a section)

```markdown
## Career Trajectory (imported {date})

{For each experience with highlights:}
### {company} · {title}
{highlights as bullet points, with quantified metrics}
Technologies: {technologies joined}

## Technical Skill Landscape
{skills.technical categorized by domain}

## Known Projects
{For each project:}
- **{name}** ({role}): {description} [{technologies}]
```

### memory/projects/{project-name}.md (one per project)

```markdown
# {Project Name}

- **Role**: {role}
- **Technologies**: {technologies}

## Description
{description}

## Key Achievements
{highlights as bullet points}
```

### Writing Rules
- If `USER.md` already exists, **MERGE** — update sections, don't overwrite unrelated content.
- If `MEMORY.md` already exists, **APPEND** — add a new section with a date header.
- For project files, **CREATE OR UPDATE** — match by project name.

---

## Step 8: Generate Report

After writing, present this report to the user:

```
🧠 Resume Import Complete

Source: {source}
Format: {format}
Confidence: {confidence}

📊 Extraction Summary
├── Identity: {name}, {headline}
├── Experience: {count} positions ({earliest} - {latest})
├── Education: {count} entries
├── Skills: {technical_count} technical, {domain_count} domain
└── Projects: {count} projects

✅ Auto-written (L0 + L1): {count} fields
⏭️ Skipped (L2 — opt-in): {count} fields
🚫 Discarded (L3): {count} patterns

⚠️ Validation Warnings:
{list any warnings}

📊 Memory Score
Before: {score_before}/100
After:  {score_after}/100  (+{delta})

{score_bar_visualization}

💡 {suggestion based on score}
```

### Score Bar Visualization
```
████████████████░░░░ {score}/100

Identity         {bar} {pct}%
Skills           {bar} {pct}%
Interests        {bar} {pct}%
Work Style       {bar} {pct}%
Projects         {bar} {pct}%
Relationships    {bar} {pct}%
Lifestyle        {bar} {pct}%
```

### Suggestions by score range:
- < 30: "刚刚开始！试试导入更多数据源来让我更了解你。"
- 30-60: "已有基本了解！导入浏览器书签可以帮助我了解你的兴趣。"
- 60-80: "了解得不错！再补充一些工作风格偏好就更好了。"
- > 80: "非常了解你了！记忆库已经很丰富。"

---

## Error Handling

- If fetch fails: "无法访问 {url}。请检查网络连接或直接粘贴简历文本。"
- If extraction produces empty result: "未能从内容中提取到有效信息。请确认这是一份简历或个人资料。"
- If confidence < 0.5: Show a warning and ask user to review before writing.
- If SPA detected (fetch returns < 200 chars): Try browser, then ask user to paste text.

---

## Memory Score Command

When user invokes `/claw_life_import score` or asks "what's my memory score" or "你有多了解我":

1. Read USER.md, MEMORY.md, and memory/projects/*.md
2. Score each of the 7 categories
3. Display the visualization and suggestions
4. Do NOT write any files

---

## Important Notes

- **Privacy First**: NEVER write L2+ fields without explicit user consent. ALWAYS scan for L3 patterns.
- **Transparency**: Show exactly what will be written before writing. In dry-run mode, show everything but write nothing.
- **Idempotent**: Running import twice on the same resume should not create duplicates. Merge intelligently.
- **Language**: Respond in the same language as the user's message. If resume is in Chinese, keep extracted data in Chinese.
