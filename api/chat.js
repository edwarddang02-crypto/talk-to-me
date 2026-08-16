import { loadPersona, buildSystemPrompt } from '../shared/prompt-builder.mjs';
import { applyCors, handlePreflight } from '../shared/cors.mjs';

const CRISIS_PATTERNS = [
  /自杀|不想活|想死|自残|伤害自己|结束生命|轻生|活着没意思|没有活下去/i,
];

const CRISIS_MESSAGE =
  '我听到你说这样的话，心里很在意。先停一下，此刻最重要的不是哲学，是你的安全。' +
  '请现在联系专业帮助：全国统一心理援助热线 12356（24小时）；北京心理危机研究与干预中心 010-82951332。' +
  '你不需要一个人扛着。等你感觉平稳一些，我随时在这里。';

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('bad json')); }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  applyCors(res);
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'method_not_allowed', message: '仅支持 POST' });
  }

  let body;
  try {
    body = req.body ?? (await readBody(req));
  } catch {
    return sendJson(res, 400, { error: 'bad_request', message: '请求体必须是合法 JSON' });
  }

  const { personaId, messages, disclaimerShown } = body || {};
  if (!personaId || !Array.isArray(messages) || messages.length === 0) {
    return sendJson(res, 400, { error: 'bad_request', message: '缺少 personaId 或 messages' });
  }

  const persona = loadPersona(personaId);
  if (!persona) {
    return sendJson(res, 404, { error: 'persona_not_found', message: `找不到人物：${personaId}` });
  }

  const last = String(messages[messages.length - 1]?.content ?? '');
  if (CRISIS_PATTERNS.some((re) => re.test(last))) {
    return sendJson(res, 200, { crisis: true, message: CRISIS_MESSAGE });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: 'no_api_key', message: '未配置 DEEPSEEK_API_KEY（见 .env.example）' });
  }

  const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const model = body.model || persona.profile.model || process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
  const history = messages.slice(-(persona.profile.maxHistory || 24));
  const systemPrompt = buildSystemPrompt(persona, { disclaimerShown: !!disclaimerShown });

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...history],
      stream: true,
      temperature: 0.8,
      max_tokens: 1024,
    }),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return sendJson(res, 502, { error: 'upstream_error', message: `DeepSeek 返回 ${upstream.status}：${text.slice(0, 300)}` });
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content ?? '';
          if (delta) res.write(`data: ${JSON.stringify({ delta })}\n\n`);
        } catch {
          // 忽略无法解析的中间帧
        }
      }
    }
  } catch {
    // 客户端断开
  }

  res.write('data: [DONE]\n\n');
  res.end();
}
