// ============================================================
// URL Resume Parser
// Handles: GitHub profiles, personal websites, PDF URLs.
// LinkedIn → guides user to export (anti-scraping).
// ============================================================

import { CanonicalResume, createEmptyResume, Project } from '../schemas/canonical-resume';
import { LLMExtractor } from '../extractors/llm-extractor';
import { uniqueNormalized } from '../utils/text-utils';

export class UserActionRequired extends Error {
  steps: string[];
  fallback?: string;

  constructor(opts: { message: string; steps: string[]; fallback?: string }) {
    super(opts.message);
    this.name = 'UserActionRequired';
    this.steps = opts.steps;
    this.fallback = opts.fallback;
  }
}

type UrlType = 'linkedin' | 'github' | 'pdf_url' | 'personal_site' | 'generic';

export class UrlResumeParser {
  private llmExtractor: LLMExtractor;

  constructor(llmExtractor: LLMExtractor) {
    this.llmExtractor = llmExtractor;
  }

  async parse(url: string): Promise<CanonicalResume> {
    const urlType = this.classifyUrl(url);

    switch (urlType) {
      case 'linkedin':
        return this.handleLinkedIn(url);
      case 'github':
        return this.parseGitHubProfile(url);
      case 'pdf_url':
        return this.handlePdfUrl(url);
      case 'personal_site':
      case 'generic':
        return this.parseGenericUrl(url);
    }
  }

  private classifyUrl(url: string): UrlType {
    const lower = url.toLowerCase();
    if (lower.includes('linkedin.com')) return 'linkedin';
    if (lower.includes('github.com')) return 'github';
    if (lower.endsWith('.pdf')) return 'pdf_url';
    return 'personal_site';
  }

  // ---- LinkedIn: Don't scrape, guide export ----

  private async handleLinkedIn(_url: string): Promise<never> {
    throw new UserActionRequired({
      message:
        'LinkedIn profiles cannot be scraped directly (anti-bot protection + ToS).\n' +
        'Please export your data manually:',
      steps: [
        '1. Go to LinkedIn → Settings & Privacy → Data Privacy',
        '2. Click "Get a copy of your data"',
        '3. Select "Profile" and "Connections"',
        '4. Download the ZIP file when ready',
        '5. Run: /import-resume ./linkedin-export.zip',
      ],
      fallback:
        'Alternatively, open your LinkedIn profile in browser, ' +
        'save as PDF, then run: /import-resume ./linkedin-profile.pdf',
    });
  }

  // ---- GitHub: Use REST API ----

  async parseGitHubProfile(url: string): Promise<CanonicalResume> {
    const username = this.extractGitHubUsername(url);
    if (!username) {
      throw new Error(`Could not extract GitHub username from URL: ${url}`);
    }

    // Fetch profile, repos, and README in parallel
    const [profile, repos, readme] = await Promise.all([
      this.fetchGitHubApi(`/users/${username}`),
      this.fetchGitHubApi(`/users/${username}/repos?sort=stars&per_page=20`),
      this.fetchGitHubReadme(username),
    ]);

    const resume = createEmptyResume('url', url);

    // Identity from profile
    resume.identity = {
      name: profile.name || username,
      headline: profile.bio || undefined,
      location: profile.location || undefined,
      contact: {
        github: url,
        website: profile.blog || undefined,
      },
    };

    // Infer tech stack from repo languages
    const techStack = this.inferTechStack(repos);
    resume.skills = {
      technical: techStack,
      domain: [],
      soft: [],
      certifications: [],
    };

    // Top repos as projects
    resume.projects = repos
      .filter((r: any) => !r.fork)
      .slice(0, 10)
      .map((r: any): Project => ({
        name: r.name,
        role: 'Creator/Maintainer',
        description: r.description || '',
        technologies: [r.language].filter(Boolean),
        url: r.html_url,
      }));

    // If user has a profile README, extract additional info via LLM
    if (readme) {
      try {
        const additionalInfo = await this.llmExtractor.extractResume(
          `GitHub Profile README for ${username}:\n\n${readme}`
        );
        // Merge additional info (README might have self-intro, skills, etc.)
        if (additionalInfo.identity.headline && !resume.identity.headline) {
          resume.identity.headline = additionalInfo.identity.headline;
        }
        resume.skills.technical = uniqueNormalized([
          ...resume.skills.technical,
          ...additionalInfo.skills.technical,
        ]);
        resume.skills.domain = uniqueNormalized([
          ...resume.skills.domain,
          ...additionalInfo.skills.domain,
        ]);
      } catch {
        // README extraction is best-effort
      }
    }

    resume._meta.confidence = 0.70; // GitHub has limited career info
    resume._meta.field_confidence = {
      'identity.name': profile.name ? 0.95 : 0.5,
      'skills.technical': techStack.length > 0 ? 0.85 : 0.3,
      'projects': repos.length > 0 ? 0.90 : 0,
    };

    return resume;
  }

  // ---- Generic URL: Fetch + LLM extract ----

  private async parseGenericUrl(url: string): Promise<CanonicalResume> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'ClawLifeImport/0.1 (resume-parser)' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Strip HTML tags for simple extraction (MVP approach)
    // In production, use readability algorithm
    const text = this.stripHtml(html);

    if (text.length < 50) {
      throw new Error('Could not extract meaningful text from URL.');
    }

    const resume = await this.llmExtractor.extractResume(text);
    resume._meta.source_format = 'url';
    resume._meta.source_file = url;
    resume._meta.confidence = Math.min(resume._meta.confidence, 0.75);

    return resume;
  }

  // ---- PDF URL: Download and hand off ----

  private async handlePdfUrl(url: string): Promise<CanonicalResume> {
    // In production, download PDF to temp file and use PdfResumeParser
    // For MVP, we note this and throw a helpful error
    throw new Error(
      `PDF URL detected: ${url}\n` +
      `Please download the file first, then use:\n` +
      `  /import-resume ./downloaded-resume.pdf`
    );
  }

  // ---- Helpers ----

  private extractGitHubUsername(url: string): string | null {
    const match = url.match(/github\.com\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  private async fetchGitHubApi(endpoint: string): Promise<any> {
    const response = await fetch(`https://api.github.com${endpoint}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'ClawLifeImport/0.1',
        // GitHub token can be passed via env for higher rate limits
        ...(process.env.GITHUB_TOKEN
          ? { 'Authorization': `token ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    return response.json();
  }

  private async fetchGitHubReadme(username: string): Promise<string | null> {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${username}/${username}/main/README.md`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (response.ok) return response.text();

      // Try master branch
      const response2 = await fetch(
        `https://raw.githubusercontent.com/${username}/${username}/master/README.md`,
        { signal: AbortSignal.timeout(5000) }
      );
      return response2.ok ? response2.text() : null;
    } catch {
      return null;
    }
  }

  private inferTechStack(repos: any[]): string[] {
    const langCount: Record<string, number> = {};
    for (const repo of repos) {
      if (repo.language) {
        langCount[repo.language] = (langCount[repo.language] || 0) + (repo.stargazers_count || 1);
      }
    }
    return Object.entries(langCount)
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang)
      .slice(0, 15);
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
