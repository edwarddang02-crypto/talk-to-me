import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = path.resolve(__dirname, '..');
export const PERSONAS_DIR = path.join(PROJECT_ROOT, 'personas');

function baseProtocol(profile, opts) {
  const disclaimerRule = opts.disclaimerShown
    ? `2. 免责声明已由界面展示，不要再重复「${profile.disclaimer}」这句话，直接以角色回答。`
    : `2. 每次会话第一次回复时，先给出免责声明：「${profile.disclaimer}」，之后不再重复。`;
  return [
    `你是「${profile.name}」的 AI 复现，基于一份深度调研蒸馏出的 SKILL.md 运行。你必须严格遵守以下规则：`,
    `1. 以第一人称「我」扮演该人物，不跳出角色（除非用户明确说「退出」「切回正常」）。`,
    disclaimerRule,
    `3. 未表态主题标推断：涉及该人物从未表态的现代领域，先说明「这是基于我的思维框架的推断，非本人立场」再回答；若该人物对此结构性沉默，就忠实呈现沉默，不要编造精巧折衷。`,
    `4. 引用纪律：引用该人物的招牌句时，优先使用下方「已核验引语库」中的原话，并附出处（书名/格言编号）；引语库中不存在的句子，绝对禁止冒充原话，只能转述或标为「大意」。`,
    `5. 语言：与用户使用同一种语言作答（默认中文）。`,
    `6. 输出格式：纯文本，不要使用任何 Markdown 符号（如 **、#、*），需要强调时用语气与标点表达。`,
    `7. 危机安全：若用户流露出自杀、自伤、伤害他人的意图，请立即停止角色游戏，用温暖直接的话回应，并给出求助渠道：全国统一心理援助热线 12356；北京心理危机研究与干预中心 010-82951332。随后再决定是否继续。`,
  ].join('\n');
}

export function loadPersona(id) {
  const dir = path.join(PERSONAS_DIR, id);
  const profilePath = path.join(dir, 'profile.json');
  const skillPath = path.join(dir, 'skill.md');
  if (!existsSync(profilePath) || !existsSync(skillPath)) return null;
  const profile = JSON.parse(readFileSync(profilePath, 'utf8'));
  const skill = readFileSync(skillPath, 'utf8');
  let quotes = [];
  const quotesPath = path.join(dir, 'quotes.json');
  if (existsSync(quotesPath)) {
    quotes = JSON.parse(readFileSync(quotesPath, 'utf8'));
  }
  return { id, profile, skill, quotes };
}

export function listPersonas() {
  const index = JSON.parse(readFileSync(path.join(PERSONAS_DIR, 'index.json'), 'utf8'));
  const out = [];
  for (const item of index.personas) {
    if (item.enabled === false) continue;
    const p = loadPersona(item.id);
    if (!p) continue;
    out.push({ ...p.profile, id: p.profile.id || item.id, quotes: p.quotes });
  }
  return out;
}

export function buildSystemPrompt(persona, opts = {}) {
  const { profile, skill, quotes } = persona;
  const quoteBlock = quotes.length
    ? quotes.map((q, i) => `${i + 1}. 「${q.text}」 —— ${q.source}`).join('\n')
    : '（本人物暂无已核验引语库）';
  return [
    baseProtocol(profile, opts),
    '',
    '========== 人物档案 ==========',
    skill.trim(),
    '',
    '========== 已核验引语库 ==========',
    quoteBlock,
  ].join('\n');
}
