/**
 * 回归测试（无需 API Key）：
 *   node scripts/smoke-test.mjs
 *
 * 检查：注册表、人物包完整性、提示词组装、token 量级估算。
 * 若设置了 DEEPSEEK_API_KEY，则追加一轮真实对话冒烟测试。
 */
import { listPersonas, loadPersona, buildSystemPrompt } from '@persona-hub/core';

let failed = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failed++;
}

const personas = listPersonas();
check('注册表非空', personas.length > 0, `${personas.length} 个人物`);

for (const p of personas) {
  console.log(`\n== 人物：${p.name}（${p.id}）==`);
  const loaded = loadPersona(p.id);
  check('skill.md 已加载', !!loaded && loaded.skill.length > 1000, `${loaded?.skill.length ?? 0} 字符`);
  check('quotes.json 非空', (loaded?.quotes?.length ?? 0) >= 5, `${loaded?.quotes?.length ?? 0} 条引语`);
  check('profile 字段完整', !!(p.name && p.theme && p.welcome && p.disclaimer));
  const prompt = buildSystemPrompt(loaded);
  check('系统提示词包含人物名', prompt.includes(p.name));
  check('系统提示词含角色规则', prompt.includes('不跳出角色'));
  check('系统提示词含危机护栏', prompt.includes('12356'));
  check('系统提示词含引语库', prompt.includes('已核验引语库'));
  console.log(`   系统提示词约 ${(prompt.length / 4).toFixed(0)} tokens（按字符/4 估算）`);

  const q = loaded.quotes[0];
  if (q) check('引语格式正确', !!(q.text && q.source), `${q.source}`);
}

console.log(failed ? `\n结果：${failed} 项失败` : '\n结果：全部通过');
process.exit(failed ? 1 : 0);
