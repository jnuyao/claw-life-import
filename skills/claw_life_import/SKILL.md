---
name: claw_life_import
description: Import your resume (PDF, JSON, URL, text) to bootstrap Claw memory. One command to go from stranger to well-known.
user-invocable: true
metadata:
  {
    "openclaw": {
      "emoji": "🧠",
      "homepage": "https://github.com/jnuyao/claw-life-import"
    }
  }
---

# claw-life-import: Personal Data Import Skill

You are an expert resume parser and memory bootstrapper. When the user invokes `/claw_life_import` or asks to import their resume/profile, follow the pipeline below.

## Trigger Conditions

Activate when the user:
- Uses `/claw_life_import <source>` with a file path, URL, or pasted text
- Says "import my resume", "导入我的简历", "import my profile"
- Provides a resume file or URL and asks you to "remember" or "learn about me"
- Uses `/claw_life_import score` to check memory status

## Pipeline (6 Steps)

```
detect → parse(source-specific) → normalize & validate → privacy filter → preview → write
```

Default behavior is **preview mode**: show what will be written, wait for user confirmation before writing anything. Use `--apply` to skip confirmation.

### Architecture Note: Two-Layer System

This skill's pipeline is organized into two logical layers:

**Import Engine** (Steps 1-4): Responsible for fetching external data, parsing it into structured format, and validating quality.
- Step 1: Assess → evaluate current memory state
- Step 2: Detect → identify input format and source type
- Step 3: Parse → fetch and extract content using source-specific parsers
- Step 4: Normalize & Validate → standardize to CanonicalResume schema

**Memory Sync Engine** (Steps 5-6): Responsible for privacy filtering, user consent, and writing to Claw's memory system.
- Step 5: Privacy Review & Preview → classify fields, show preview, get consent
- Step 6: Write & Report → execute writes, generate before/after report

These layers have different evolution paths. When extending this skill, keep changes within the appropriate layer.

---

## Step 1: Assess Current Memory

Read existing memory files (if any) to establish a baseline:
- `USER.md` in workspace root
- `MEMORY.md` in workspace root
- `memory/projects/*.md`

Compute two scores (details in "Scoring System" section below). Record them as `score_before`.

---

## Step 2: Detect Format & Route to Parser

| Input | Detection | Route to |
|-------|-----------|----------|
| `*.pdf` | Extension | `parser_pdf` |
| `*.json` with `basics.name` | JSON structure | `parser_json_resume` |
| `*.json` with `positions` | JSON structure | `parser_linkedin_export` |
| `*.txt` or `*.md` | Extension | `parser_plain_text` |
| URL containing `github.com` | URL pattern | `parser_github_profile` |
| URL containing `linkedin.com` | URL pattern | `parser_linkedin` (guide export) |
| Any other URL | Default | `parser_url_resume_site` |
| Raw pasted text | No file/URL | `parser_plain_text` |

---

## Step 3: Source-Specific Parsers

### parser_url_resume_site

This is the hardest parser. Personal sites vary wildly. Follow this **fallback chain strictly in order**:

**Level 1: Direct fetch**
```
Use web_fetch on the URL.
Check: does the response contain > 200 characters of meaningful text (after stripping HTML)?
If YES → use this content, proceed to normalize.
```

**Level 2: JS bundle data extraction**
```
If Level 1 returned mostly empty HTML (SPA shell):
1. Look for <script src="..."> tags in the HTML.
   Common patterns: /static/js/main.*.js, /_next/static/chunks/app*.js, /assets/index*.js
2. Fetch those JS files with web_fetch.
3. Search the JS content for embedded data objects:
   - JSON blocks with resume-like fields (name, experience, education)
   - Large string literals or template literals containing resume text
   - Data objects assigned to variables like `data`, `resume`, `profile`, `content`
4. Extract the data and use it as the source text.
```

**Level 3: Alternative pages**
```
If Level 2 didn't work:
1. Try common sub-paths: /resume, /cv, /about, /api/resume, /resume.json
2. Try fetching the sitemap: /sitemap.xml
3. If any returns meaningful content, use it.
```

**Level 4: Browser/canvas rendering**
```
If a browser-like capability is available (browser, canvas, puppeteer, etc.):
1. Navigate to the URL
2. Wait for rendering to complete
3. Extract the visible text content
Note: Do NOT hardcode a specific tool name. Use whatever rendering capability is available in the current environment.
```

**Level 5: User fallback**
```
If all above fail, tell the user:
"这个网站是 JavaScript 渲染的，我无法自动提取内容。请用以下任一方式提供：
1. 在浏览器中打开网站，全选复制文本，粘贴给我
2. 如果网站有 /resume.json 或 API 接口，提供该 URL
3. 导出为 PDF 后发给我"
```

**Anti-noise rules for web content:**
- Strip navigation bars, footers, cookie banners, social media links
- Remove repeated header/footer text that appears on every section
- Filter out: "Home", "About", "Contact", "Back to top", "Copyright ©", cookie consent text
- If the page has clear section headings (Experience, Education, Skills, Projects), use them as extraction anchors

### parser_github_profile

Fetch these endpoints with web_fetch (no auth needed for public profiles):
1. `https://api.github.com/users/{username}` → name, bio, location, blog
2. `https://api.github.com/users/{username}/repos?sort=stars&per_page=20` → top repos
3. `https://raw.githubusercontent.com/{username}/{username}/main/README.md` → profile README (may 404, that's OK)

Map to resume fields:
- identity.name ← profile.name or username
- identity.headline ← profile.bio
- identity.contact.github ← profile URL
- identity.contact.website ← profile.blog
- skills.technical ← inferred from repo languages (count stars as weight)
- projects ← top non-fork repos (name, description, language, stars, URL)

If README exists, extract additional self-described info from it.

Confidence: 0.70 baseline (GitHub has limited career info).

### parser_json_resume

Standard [JSON Resume](https://jsonresume.org) format. Direct 1:1 field mapping:
- basics.name → identity.name
- basics.label → identity.headline
- basics.location.city → identity.location
- basics.email → identity.contact.email
- basics.url → identity.contact.website
- basics.profiles → identity.contact.{github,linkedin}
- work[] → experience[]
- education[] → education[]
- skills[].keywords → skills.technical (flatten)
- projects[] → projects[]

Confidence: 0.95 baseline.

### parser_linkedin_export

LinkedIn JSON export has nested structure:
- positions.positionList → experience[]
- educations.educationList → education[]
- skills.skillList → skills.technical

Confidence: 0.90 baseline.

### parser_linkedin (URL — guide export)

Do NOT scrape. Tell the user:
> LinkedIn 无法直接抓取（反爬 + ToS）。请手动导出：
> 1. LinkedIn → Settings → Data Privacy → Get a copy of your data
> 2. 选择 "Profile"，下载 ZIP
> 3. 解压后运行：`/claw_life_import ./linkedin-export.json`

### parser_pdf

Use available tools to extract text from PDF. Try in order:
1. If `exec` is available: `python3 -c "..."` with PyMuPDF or pdftotext
2. Ask user to paste the text content

After extraction, split into sections by heading patterns and extract.

Confidence: 0.80 baseline.

### parser_plain_text

Use the text directly. Split into sections by common resume heading patterns:
- English: Experience, Education, Skills, Projects, Summary, Objective, Certifications
- Chinese: 工作经历, 教育背景, 技能, 项目经历, 个人简介, 自我评价

Confidence: 0.75 baseline.

---

## Step 4: Normalize & Validate

### 4a: Extract Structured Fields

From the parsed text, extract into this schema. **Only extract what is explicitly stated. Do NOT infer or fabricate.**

```json
{
  "identity": {
    "name": "Full name",
    "headline": "Professional title / one-line summary",
    "location": "City, Country",
    "contact": {
      "email": "if explicitly shown",
      "phone": "if explicitly shown",
      "github": "GitHub URL",
      "linkedin": "LinkedIn URL",
      "website": "Personal site URL"
    }
  },
  "experience": [{
    "company": "Company name",
    "title": "Job title / role",
    "team": "Team or department (if mentioned)",
    "start": "YYYY-MM",
    "end": "YYYY-MM or null if current",
    "description": "Role summary",
    "highlights": ["Quantified achievement with numbers"],
    "technologies": ["Specific tech: React, Go, PostgreSQL"]
  }],
  "education": [{
    "institution": "School name",
    "degree": "Degree type",
    "field": "Field of study",
    "start": "YYYY-MM",
    "end": "YYYY-MM",
    "achievements": ["Awards, scholarships, honors"]
  }],
  "skills": {
    "technical": ["Languages, frameworks, tools, platforms"],
    "domain": ["Business domains: payments, ads, marketing, analytics"],
    "soft": ["Leadership, communication, etc."],
    "certifications": ["Formal certifications"]
  },
  "projects": [{
    "name": "Project name",
    "role": "Your role",
    "description": "What the project does",
    "technologies": ["Tech used"],
    "url": "URL if available"
  }]
}
```

**Extraction rules:**
1. Dates → ISO `YYYY-MM`. Only year → `YYYY-01`. "至今"/"present"/"current" → `null` for end. Chinese dates like `2024.02` → `2024-02`.
2. Highlights → quantified where possible: "Reduced latency 171min → 105min (-39%)", "10B PV/day, 100k+ QPS".
3. Technologies → specific names, not categories.
4. Keep original language. Chinese resume → Chinese output.
5. Same company, different teams/roles → separate experience entries with the same `company` but different `team`/`title`/dates. Do NOT merge them.
6. If text is duplicated across sections (e.g., a project described in both "Highlights" and "Projects"), extract once, reference the richer version.

### 4b: Validate

**Schema checks** (block on errors):
- ❌ `name` is empty
- ❌ ALL of experience, education, skills, projects are empty
- ⚠️ Experience missing company or title
- ⚠️ Date not in YYYY-MM format

**Semantic checks** (warn only):
- ⚠️ Two experiences overlap by > 90 days (unless different teams at same company)
- ⚠️ Experience duration > 20 years
- ❌ Experience end date before start date

**Do NOT check**: "first job before graduation" (internships, gap years, and different education systems make this unreliable).

### 4c: Confidence

Start from format baseline, then adjust:
- -0.05 per validation warning
- -0.10 per validation error
- -0.05 if web content had noise (navigation text detected)
- Final range: 0.0 - 1.0

### Evidence & Provenance

Every extracted fact SHOULD carry provenance metadata when possible. When writing to MEMORY.md, attach evidence inline:

**Format for MEMORY.md entries:**
```
## [Section Name] [source: {source_identifier} {ISO-date}] [confidence: {high|medium|low}]

- Fact statement
  > Evidence: "{original text snippet from source}" — {source_url_or_file}

- Another fact
  > Evidence: "{original text}" — {source}
```

**Evidence fields in extraction:**
| Field | Description | Example |
|-------|-------------|---------|
| `source_url` | Original URL or file path | `https://yaohom.vercel.app/` |
| `original_snippet` | Verbatim text from source (≤200 chars) | `"Led migration of 50+ micro-frontends..."` |
| `extraction_time` | ISO 8601 timestamp | `2026-03-30T12:00:00Z` |
| `confidence` | Extraction confidence level | `high` / `medium` / `low` |

**Confidence assignment rules:**
- **high**: Explicitly stated in source (e.g., job title in resume header)
- **medium**: Inferred from context (e.g., skill derived from project description)
- **low**: Ambiguous or partial information (e.g., date range unclear)

**Why this matters:** When users ask "how do you know this about me?", every fact is traceable back to its source. This enables:
- Re-importing the same source to update stale data
- Comparing old vs new extractions
- User verification of specific claims
- Rollback of a single import session

---

## Step 5: Privacy Filter & Preview

### 5a: Classify Every Field

| Level | Name | Default Action | Fields |
|-------|------|----------------|--------|
| **L0** Public | Auto-include | Name, headline, job titles, company names, school names, technical skills, project names, project descriptions |
| **L1** General | Include, cancelable | Location, work periods, education periods, highlights, domain skills, soft skills, certifications |
| **L2a** Semi-public | Preview, batch opt-in | GitHub URL, personal website URL, LinkedIn URL (when source itself is a public page) |
| **L2b** Private | Skip, individual opt-in | Email, phone, physical address, salary, GPA |
| **L3** Extreme | **ALWAYS DISCARD** | Matches: ID numbers `\d{15,18}`, SSN `\d{3}-\d{2}-\d{4}`, credit cards `\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}`, passwords, API keys (`sk-`, `ghp_`, `key-`, `token`) |

**L2a rule**: If the source URL itself is a public page (e.g., a personal website or public GitHub), the contact links on that page are semi-public. Show them in preview and allow batch opt-in with "都允许公开资料" / "allow all public fields".

**L3 rule**: Scan raw text for patterns BEFORE extraction. Redact and warn if found.

### 5b: Preview (DEFAULT behavior)

**This is the default mode.** Present a structured preview to the user:

```
🧠 Resume Import Preview

Source: {source}
Format: {format} | Confidence: {confidence}

📋 Will Write (L0 + L1):
┌─────────────────────────────────────────┐
│ Name: Yaohong Zheng                      │
│ Headline: AI Agent Infra / Engineering Lead │
│ Experience: 4 positions (2015 - Present)  │
│ Education: Jinan University (2009 - 2013) │
│ Skills: 12 technical, 4 domain            │
│ Projects: 3 projects                      │
└─────────────────────────────────────────┘

🔓 Semi-public (L2a) — reply "允许公开资料" to include all:
  • GitHub: https://github.com/jnuyao
  • Website: https://yaohom.vercel.app/

🔒 Sensitive (L2b) — reply field name to include:
  (none found)

🚫 Discarded (L3):
  (none detected)

⚠️ Warnings:
  (none)

👉 Reply:
  • "确认" or "confirm" — write L0+L1 to memory
  • "允许公开资料" or "allow public" — also include L2a
  • "全部" or "all" — include L0+L1+L2a+L2b
  • "取消" or "cancel" — abort without writing
  • Or mention specific fields to adjust
```

**Only proceed to Step 6 after user confirms.** If the user used `--apply` flag, skip preview and write directly.

---

## Step 6: Write to Memory

### USER.md — Section-based merge

Write or update these **fixed sections only**. If USER.md already exists, update only the sections below. **Preserve all other content the user may have written.**

```markdown
# Identity

- **Name**: {name}
- **Headline**: {headline}
- **Location**: {location}

# Technical Skills

## Primary
{Skills appearing in 2+ experience/project entries, comma-separated}

## Secondary
{Remaining skills, comma-separated}

# Career Summary

{years_of_experience} years of experience in {primary domains}.

## Career Timeline
{For each experience, reverse-chronologically:}
- **{company}** · {team} — {title} ({start} - {end or Present})
  {description, 1-2 lines max}

# Education

{For each entry:}
- **{institution}** — {degree} in {field} ({start} - {end})
  {achievements as sub-bullets}

---
*Imported by claw-life-import on {YYYY-MM-DD} from {source}*
*Confidence: {score}*
```

**Merge rules:**
- Known sections: `# Identity`, `# Technical Skills`, `# Career Summary`, `# Education`. Update content within these sections.
- Unknown sections (anything not in the list above): **DO NOT TOUCH**. Leave them exactly as they are.
- If a section doesn't exist yet, append it before the `---` footer.
- Always update the footer timestamp.

### MEMORY.md — Source-tagged append

Before appending, check if there's already a section with the same source tag. If so, **replace that section** instead of duplicating.

```markdown
## Career Trajectory [source: {source_url_or_filename} {YYYY-MM-DD}] [confidence: high]

{For each experience with highlights:}
### {company} · {title}
- {highlight with metrics}
  > Evidence: "{original text from source}" — {source_url_or_file}

Technologies: {technologies}

## Technical Skill Landscape [source: {source} {YYYY-MM-DD}] [confidence: high]

{Skills grouped by domain}
- {skill}
  > Evidence: "{mention in source}" — {source}

## Known Projects [source: {source} {YYYY-MM-DD}] [confidence: medium]

{For each project:}
- **{name}** ({role}): {description} [{technologies}]
  > Evidence: "{project description from source}" — {source}
```

**Merge rules:**
- Each imported section gets a `[source: ...]` tag and `[confidence: ...]` tag in the heading.
- On re-import from the same source: replace the tagged sections.
- On import from a different source: append new sections (don't touch existing ones).

### memory/projects/{slug}.md — Stable slug naming

Use a stable slug derived from project name: lowercase, hyphens for spaces, strip special chars.
Example: "OpenClaw Contributor" → `memory/projects/openclaw-contributor.md`

```markdown
# {Project Name}

- **Role**: {role}
- **Technologies**: {technologies}
- **URL**: {url}

## Description
{description}

## Key Achievements
{highlights}

---
*Source: {source} | Imported: {YYYY-MM-DD}*
```

If the file already exists (same slug), **update** its content. Don't create duplicates.

---

## Scoring System

Compute **two separate scores**, not one blended number:

### Score A: Profile Coverage (how complete is THIS import)

Measures what percentage of extractable fields the source actually provided. This reflects the **source quality**, not memory gaps.

| Field Group | Weight | Full marks if... |
|-------------|--------|-----------------|
| Identity (name, headline, location) | 20% | All 3 present |
| Experience (with highlights + tech) | 30% | 2+ entries with highlights |
| Education | 10% | 1+ entry with degree + field |
| Skills (technical + domain) | 20% | 5+ technical, 1+ domain |
| Projects | 20% | 1+ project with description |

Score 0-100. This tells the user: "your resume covered X% of what I can learn from a resume."

### Score B: Assistant Understanding (how well do I know you overall)

Measures the total memory state across ALL sources. Read all memory files.

| Category | Weight | What to look for in memory files |
|----------|--------|--------------------------------|
| Identity | 20% | Name, headline, location in USER.md |
| Career & Skills | 25% | Experience entries + skill lists in USER.md and MEMORY.md |
| Projects | 20% | Files in memory/projects/ |
| Interests | 15% | Any mentions of hobbies, communities, reading lists |
| Work Style | 10% | Communication preferences, tools, methodology |
| Relationships | 10% | Colleagues, mentors, collaborators mentioned |

Score 0-100. Categories not coverable by resume import (Interests, Work Style, Relationships) are scored based on what's actually in memory — if empty, that's fine, the score just reflects reality.

### Display

```
📊 Import Results

Profile Coverage: ██████████████████░░ 87/100
(This resume covered most extractable fields)

Assistant Understanding: ███████████░░░░░░░░░ 54/100
Before: 12 → After: 54 (+42)

  Identity        ████████░░ 80%
  Career & Skills ████████░░ 78%
  Projects        ██████░░░░ 60%
  Interests       █░░░░░░░░░ 10%
  Work Style      ░░░░░░░░░░  0%
  Relationships   ░░░░░░░░░░  0%

💡 简历导入效果很好！低分项（兴趣、工作风格）需要其他数据源补充，
   试试告诉我你平时的工作习惯和兴趣爱好。
```

Note: Low Interests/WorkStyle/Relationships scores after resume import are **expected and normal**. The suggestion should point the user to other data sources, not imply the import failed.

---

## Error Handling

| Situation | Response |
|-----------|----------|
| web_fetch returns < 200 chars | Proceed to JS bundle extraction (Level 2) |
| All fetch attempts fail | Ask user to paste text |
| Extraction produces empty result | "未能提取到有效信息。请确认这是一份简历或个人资料。" |
| Confidence < 0.50 | Show warning in preview, recommend user review carefully before confirming |
| USER.md write conflict | Show diff of what will change, ask confirmation |
| Network error | "网络请求失败，请检查连接或提供本地文件。" |

---

## Important Constraints

1. **Preview-first**: NEVER write to memory files without user confirmation (unless `--apply` flag is used). This is a HARD constraint.
2. **Privacy**: NEVER write L2b+ fields without explicit per-field or batch opt-in. ALWAYS scan for L3 patterns before extraction.
3. **Preserve user content**: When merging USER.md, NEVER delete or modify sections you didn't create. Unknown sections are sacred.
4. **Idempotent**: Re-importing the same source should update, not duplicate. Use source tags in MEMORY.md and stable slugs for project files.
5. **Language**: Respond in the user's language. Keep extracted data in its original language.
6. **No fabrication**: If a field is not in the source, leave it empty. Do not guess.
