/**
 * 从 personas/ 目录生成 packages/persona-core/data.mjs。
 *
 * Vercel 的 Node 函数打包器只会跟随静态 import 与 node_modules，
 * 不会把运行时 readFileSync 读取的 personas/* 文件打进函数包。
 * 因此把所有人物数据（profile/quotes/skill）固化为可静态导入的 JS 模块，
 * 每次新增/修改人物后运行本脚本并提交生成结果。
 *
 * 用法：node scripts/build-persona-data.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PERSONAS_DIR = path.join(ROOT, 'personas');
const OUT = path.join(ROOT, 'packages', 'persona-core', 'data.mjs');

const index = JSON.parse(readFileSync(path.join(PERSONAS_DIR, 'index.json'), 'utf8'));
const profiles = [];
const quotes = {};
const skills = {};

for (const item of index.personas) {
  const dir = path.join(PERSONAS_DIR, item.id);
  const profilePath = path.join(dir, 'profile.json');
  if (!existsSync(profilePath)) continue;
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  profiles.push({ ...profile, id: profile.id || item.id, enabled: item.enabled !== false });

  const quotesPath = path.join(dir, 'quotes.json');
  quotes[item.id] = existsSync(quotesPath) ? JSON.parse(readFileSync(quotesPath, 'utf8')) : [];

  const skillPath = path.join(dir, 'skill.md');
  skills[item.id] = existsSync(skillPath) ? readFileSync(skillPath, 'utf8') : '';
}

const out = [
  '// 本文件由 scripts/build-persona-data.mjs 自动生成，请勿手改。',
  `export const PROFILES = ${JSON.stringify(profiles, null, 2)};`,
  `export const QUOTES = ${JSON.stringify(quotes, null, 2)};`,
  `export const SKILLS = ${JSON.stringify(skills, null, 2)};`,
].join('\n\n');

writeFileSync(OUT, `${out}\n`, 'utf8');
console.log(`✔ 已生成 ${path.relative(ROOT, OUT)}（${profiles.length} 个人物）`);
