// ============================================================
// Memory Score — Calculate how well Claw "knows" the user
// based on 7 weighted categories.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';

export interface CategoryScore {
  name: string;
  label: string;
  weight: number;
  completeness: number; // 0-1
  filledFields: string[];
  missingFields: string[];
}

export interface MemoryScoreResult {
  /** Overall score 0-100 */
  score: number;
  /** Per-category breakdown */
  categories: CategoryScore[];
  /** Human-friendly suggestion for next steps */
  suggestion: string;
  /** Visual bar chart lines */
  visualBars: string[];
}

// Category definitions
const CATEGORIES: Array<{
  name: string;
  label: string;
  weight: number;
  fields: string[];
}> = [
  {
    name: 'identity',
    label: '身份信息 Identity',
    weight: 20,
    fields: ['name', 'role', 'company', 'timezone'],
  },
  {
    name: 'skills',
    label: '技能图谱 Skills',
    weight: 15,
    fields: ['technical', 'soft', 'domain'],
  },
  {
    name: 'interests',
    label: '兴趣爱好 Interests',
    weight: 15,
    fields: ['topics', 'sources', 'hobbies'],
  },
  {
    name: 'work_style',
    label: '工作风格 Work Style',
    weight: 15,
    fields: ['schedule', 'collaboration', 'preferences'],
  },
  {
    name: 'projects',
    label: '项目经历 Projects',
    weight: 15,
    fields: ['active_projects', 'past_projects'],
  },
  {
    name: 'relationships',
    label: '人际关系 Relationships',
    weight: 10,
    fields: ['team', 'contacts'],
  },
  {
    name: 'lifestyle',
    label: '生活方式 Lifestyle',
    weight: 10,
    fields: ['travel', 'food', 'health'],
  },
];

/**
 * Calculate Memory Score by scanning workspace memory files.
 */
export function calculateMemoryScore(workspaceDir: string): MemoryScoreResult {
  // Read all memory files
  const userMd = readFile(workspaceDir, 'USER.md');
  const memoryMd = readFile(workspaceDir, 'MEMORY.md');
  const projectFiles = listProjectFiles(workspaceDir);

  const allContent = [userMd, memoryMd, ...projectFiles.map(f => f.content)]
    .join('\n')
    .toLowerCase();

  // Score each category
  const categories: CategoryScore[] = CATEGORIES.map(cat => {
    const filled: string[] = [];
    const missing: string[] = [];

    for (const field of cat.fields) {
      if (hasFieldContent(cat.name, field, allContent, userMd, projectFiles)) {
        filled.push(field);
      } else {
        missing.push(field);
      }
    }

    const completeness = cat.fields.length > 0
      ? filled.length / cat.fields.length
      : 0;

    return {
      name: cat.name,
      label: cat.label,
      weight: cat.weight,
      completeness,
      filledFields: filled,
      missingFields: missing,
    };
  });

  // Calculate overall score
  const score = Math.round(
    categories.reduce((sum, cat) => sum + cat.weight * cat.completeness, 0)
  );

  // Generate suggestion
  const suggestion = generateSuggestion(score, categories);

  // Generate visual bars
  const visualBars = categories.map(cat => {
    const pct = Math.round(cat.completeness * 100);
    const filled = Math.round(cat.completeness * 10);
    const empty = 10 - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `${cat.label.padEnd(24)} ${bar} ${pct}%`;
  });

  return { score, categories, suggestion, visualBars };
}

// ============================================================
// Field Detection Heuristics
// ============================================================

function hasFieldContent(
  category: string,
  field: string,
  allContent: string,
  userMd: string,
  projectFiles: Array<{ name: string; content: string }>
): boolean {
  const userLower = userMd.toLowerCase();

  switch (`${category}.${field}`) {
    // Identity
    case 'identity.name':
      return /\bname\s*[:：]\s*\S+/.test(userLower) || /\b名[字称]\s*[:：]/.test(userLower);
    case 'identity.role':
      return /\brole\s*[:：]/.test(userLower) || /\btitle\s*[:：]/.test(userLower) ||
             /\bheadline\s*[:：]/.test(userLower) || /\b职[位务]\s*[:：]/.test(userLower);
    case 'identity.company':
      return /\bcompany\s*[:：]/.test(userLower) || /\b公司\s*[:：]/.test(userLower);
    case 'identity.timezone':
      return /\btimezone\s*[:：]/.test(userLower) || /\b时区\s*[:：]/.test(userLower);

    // Skills
    case 'skills.technical':
      return /\btechnical\s*(skills?)?\s*[:：]/.test(userLower) ||
             /\bprimary\s*[:：]/.test(userLower) ||
             allContent.includes('technical skill');
    case 'skills.soft':
      return /\bsoft\s*(skills?)?\s*[:：]/.test(userLower) ||
             allContent.includes('soft skill');
    case 'skills.domain':
      return /\bdomain\s*[:：]/.test(userLower) ||
             allContent.includes('domain knowledge');

    // Interests
    case 'interests.topics':
      return allContent.includes('interests') || allContent.includes('兴趣');
    case 'interests.sources':
      return allContent.includes('bookmark') || allContent.includes('书签') ||
             allContent.includes('resource');
    case 'interests.hobbies':
      return allContent.includes('hobby') || allContent.includes('hobbies') ||
             allContent.includes('爱好');

    // Work style
    case 'work_style.schedule':
      return allContent.includes('schedule') || allContent.includes('作息') ||
             allContent.includes('morning') || allContent.includes('work hours');
    case 'work_style.collaboration':
      return allContent.includes('collaboration') || allContent.includes('async') ||
             allContent.includes('sync') || allContent.includes('协作');
    case 'work_style.preferences':
      return allContent.includes('prefer') || allContent.includes('偏好') ||
             allContent.includes('style');

    // Projects
    case 'projects.active_projects':
      return projectFiles.length > 0 ||
             allContent.includes('active project') || allContent.includes('current project');
    case 'projects.past_projects':
      return projectFiles.length > 1 ||
             allContent.includes('past project') || allContent.includes('career trajectory');

    // Relationships
    case 'relationships.team':
      return allContent.includes('team') || allContent.includes('团队');
    case 'relationships.contacts':
      return allContent.includes('contact') || allContent.includes('联系');

    // Lifestyle
    case 'lifestyle.travel':
      return allContent.includes('travel') || allContent.includes('旅行');
    case 'lifestyle.food':
      return allContent.includes('food') || allContent.includes('饮食') ||
             allContent.includes('cuisine');
    case 'lifestyle.health':
      return allContent.includes('health') || allContent.includes('fitness') ||
             allContent.includes('健康');

    default:
      return false;
  }
}

// ============================================================
// Suggestion Generator
// ============================================================

function generateSuggestion(score: number, categories: CategoryScore[]): string {
  if (score < 30) {
    return '🌱 刚认识你！导入一份简历就能快速提升到 60+ → /import-resume';
  }
  if (score < 60) {
    // Find weakest category
    const weakest = [...categories]
      .filter(c => c.completeness < 0.5)
      .sort((a, b) => b.weight - a.weight)[0];

    if (weakest) {
      const tips: Record<string, string> = {
        'interests': '试试导入浏览器书签让我更懂你的兴趣 → /import-bookmarks',
        'work_style': '导入日历信息能让我更好地理解你的工作节奏 → /import-calendar',
        'projects': '导入笔记或补充项目细节 → /import-notes',
        'skills': '导入简历来丰富技能图谱 → /import-resume',
        'identity': '导入简历补全基本信息 → /import-resume',
        'relationships': '在日常对话中提到团队成员，我会自动记住',
        'lifestyle': '聊聊你的生活，或导入照片元数据 → /import-photos',
      };
      return `📈 已有基本了解！${tips[weakest.name] || '继续聊天我会逐步了解更多'}`;
    }
    return '📈 已有基本了解，继续对话会持续丰富记忆';
  }
  if (score < 80) {
    return '🎯 了解得不错了！日常对话会持续加深理解';
  }
  return '🤝 我们已经非常熟悉了！持续互动会让记忆保持最新';
}

// ============================================================
// File Helpers
// ============================================================

function readFile(dir: string, filename: string): string {
  const filePath = path.join(dir, filename);
  try {
    return fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf-8')
      : '';
  } catch {
    return '';
  }
}

function listProjectFiles(
  dir: string
): Array<{ name: string; content: string }> {
  const projectDir = path.join(dir, 'memory', 'projects');
  try {
    if (!fs.existsSync(projectDir)) return [];
    return fs.readdirSync(projectDir)
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        name: f,
        content: fs.readFileSync(path.join(projectDir, f), 'utf-8'),
      }));
  } catch {
    return [];
  }
}
