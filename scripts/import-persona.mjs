/**
 * 导入女娲蒸馏的人物 Skill 到 persona-hub。
 *
 * 用法：
 *   node scripts/import-persona.mjs --id nietzsche
 *   node scripts/import-persona.mjs --id nietzsche --source C:/path/to/skills
 *
 * 行为：
 *   1. 复制 <source>/<id>-perspective/SKILL.md → personas/<id>/skill.md
 *   2. 从 references/research/03-expression-dna.md 的「可核实关键引语」表提取 quotes.json
 *   3. 若 profile.json 不存在，生成默认占位（名字取自标题，主题色由 id 哈希生成）
 *   4. 在 personas/index.json 注册（已存在则跳过）
 *   5. 重新生成 packages/persona-core/data.mjs（Vercel 部署用）
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PERSONAS_DIR = path.join(ROOT, 'personas');
const DEFAULT_SOURCE = process.env.CODEX_HOME
  ? path.join(process.env.CODEX_HOME, 'skills')
  : 'C:/Users/edwar/.codex/skills';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true;
      if (args[key] !== true) i++;
    }
  }
  return args;
}

function hashHue(str) {
  let h = 0;
  for (const ch of str) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return h % 360;
}

function extractQuotes(research03) {
  const lines = research03.split(/\r?\n/);
  const quotes = [];
  let inTable = false;
  for (const line of lines) {
    if (/可核实关键引语|已核验|核验清单|格言核验/i.test(line)) inTable = true;
    else if (inTable && /^#{1,3}\s/.test(line)) inTable = false;
    if (!inTable) continue;
    const m = line.match(/^\|\s*"(.+?)"\s*\|\s*(.+?)\s*\|$/);
    if (m) quotes.push({ text: m[1], source: m[2].replace(/\*\*/g, '') });
  }
  return quotes;
}

function nameFromTitle(skill) {
  const m = skill.match(/^#\s+(.+?)\s*·\s*思维操作系统/m);
  return m ? m[1].trim() : null;
}

async function main() {
  const { id, source } = parseArgs(process.argv);
  if (!id) {
    console.error('用法：node scripts/import-persona.mjs --id <persona-id>');
    process.exit(1);
  }

  const sourceRoot = source || DEFAULT_SOURCE;
  const srcDir = path.join(sourceRoot, `${id}-perspective`);
  const srcSkill = path.join(srcDir, 'SKILL.md');
  const srcResearch = path.join(srcDir, 'references', 'research', '03-expression-dna.md');

  if (!existsSync(srcSkill)) {
    console.error(`找不到源文件：${srcSkill}`);
    process.exit(1);
  }

  const destDir = path.join(PERSONAS_DIR, id);
  mkdirSync(destDir, { recursive: true });

  const skill = readFileSync(srcSkill, 'utf8');
  copyFileSync(srcSkill, path.join(destDir, 'skill.md'));
  console.log(`✔ 已复制 skill.md（${skill.length} 字符）`);

  const quotes = existsSync(srcResearch) ? extractQuotes(readFileSync(srcResearch, 'utf8')) : [];
  if (quotes.length) {
    writeFileSync(path.join(destDir, 'quotes.json'), JSON.stringify(quotes, null, 2), 'utf8');
    console.log(`✔ 已生成 quotes.json（${quotes.length} 条引语）`);
  } else {
    console.warn('⚠ 未在 03-expression-dna.md 中找到可核实引语表，请手动补充 quotes.json');
  }

  const profilePath = path.join(destDir, 'profile.json');
  if (!existsSync(profilePath)) {
    const hue = hashHue(id);
    const profile = {
      id,
      name: nameFromTitle(skill) || id,
      nameEn: '',
      tagline: '',
      description: '',
      theme: {
        primary: `hsl(${hue}, 80%, 62%)`,
        accent: `hsl(${(hue + 40) % 360}, 85%, 62%)`,
        bg: `hsl(${hue}, 30%, 10%)`,
      },
      avatar: null,
      welcome: '问吧。',
      disclaimer: `我以${nameFromTitle(skill) || id}的视角与你交谈，基于其公开著作的提炼，非本人观点。`,
      model: 'deepseek-v4-flash',
      maxHistory: 24,
    };
    writeFileSync(profilePath, JSON.stringify(profile, null, 2), 'utf8');
    console.log(`✔ 已生成 profile.json（占位配置，请手动补充简介/欢迎语/主题色）`);
  } else {
    console.log('· profile.json 已存在，跳过');
  }

  const indexPath = path.join(PERSONAS_DIR, 'index.json');
  const index = JSON.parse(readFileSync(indexPath, 'utf8'));
  if (!index.personas.some((p) => p.id === id)) {
    index.personas.push({ id, enabled: true });
    writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8');
    console.log(`✔ 已在 personas/index.json 注册 ${id}`);
  } else {
    console.log('· 已在注册表中，跳过');
  }

  console.log('· 重新生成 packages/persona-core/data.mjs');
  await import('./build-persona-data.mjs');
}

main();
