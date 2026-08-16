function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function avatarChar(name) {
  return name ? name.trim().charAt(0) : '?';
}

const CN_DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function cnNumber(n) {
  if (!Number.isInteger(n) || n < 1) return '';
  if (n <= 10) return CN_DIGITS[n];
  if (n < 20) return `十${CN_DIGITS[n - 10]}`;
  return `${CN_DIGITS[Math.floor(n / 10)]}十${n % 10 ? CN_DIGITS[n % 10] : ''}`;
}

function paragraphs(text) {
  return String(text || '')
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveApiBase() {
  const configured = window.APP_CONFIG && window.APP_CONFIG.apiBase;
  if (configured) return String(configured).replace(/\/+$/, '');
  // 未配置时使用同源相对路径（本地开发 / Vercel 整站部署）
  return '';
}

const API_BASE = resolveApiBase();

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `请求失败（${res.status}）`);
  return data;
}

/* ---------- 选人页：杂志索引 ---------- */
async function initIndex() {
  const list = document.getElementById('persona-list');
  const countEl = document.getElementById('index-count');
  try {
    const { personas } = await fetchJson(`${API_BASE}/api/personas`);
    list.innerHTML = '';
    if (!personas.length) {
      list.appendChild(el('div', 'loading', '暂无可用人物，请在 personas/ 中添加。'));
      countEl.textContent = '';
      return;
    }
    countEl.textContent = `共收录 ${cnNumber(personas.length)} 位`;

    personas.forEach((p, i) => {
      const entry = el('a', 'archive-entry');
      entry.href = `/chat.html?persona=${encodeURIComponent(p.id)}`;
      entry.setAttribute('aria-label', `与 ${p.name || p.nameEn || '这位人物'} 开始对话`);

      // 编号
      entry.appendChild(el('div', 'entry-number', `№ ${String(i + 1).padStart(2, '0')}`));

      // 肖像牌
      const figure = el('div', 'entry-figure');
      const plate = el('div', 'entry-plate');
      if (p.avatar) {
        const img = document.createElement('img');
        img.src = p.avatar;
        img.alt = p.name || p.nameEn || '';
        plate.appendChild(img);
      } else {
        plate.appendChild(el('span', 'plate-glyph', avatarChar(p.name)));
        if (p.nameEn) plate.appendChild(el('span', 'plate-caption', p.nameEn.toUpperCase()));
      }
      figure.appendChild(plate);
      entry.appendChild(figure);

      // 姓名与生平
      const main = el('div', 'entry-main');
      main.appendChild(el('h2', 'entry-name', p.name || p.nameEn || '未名'));
      if (p.nameEn) main.appendChild(el('div', 'entry-name-en', p.nameEn));
      const meta = el('div', 'entry-meta');
      if (p.period) meta.appendChild(el('span', 'entry-period', p.period));
      const roleBits = [p.role, p.roleEn].filter(Boolean);
      if (roleBits.length) {
        if (p.period) meta.appendChild(el('span', 'entry-role-sep', ' · '));
        meta.appendChild(el('span', 'entry-role', roleBits.join(' · ')));
      }
      main.appendChild(meta);
      entry.appendChild(main);

      // 引语
      const quote = el('div', 'entry-quote');
      quote.appendChild(el('span', 'quote-mark', '“'));
      const featured = p.quotes && p.quotes[0];
      const quoteText = featured ? featured.text : p.tagline || '……';
      quote.appendChild(el('blockquote', null, quoteText));
      if (featured && featured.source) {
        quote.appendChild(el('div', 'quote-source', `—— ${featured.source}`));
      } else if (p.tagline) {
        quote.appendChild(el('div', 'quote-source', '—— 人物小传'));
      }
      quote.appendChild(el('span', 'entry-action', '开始对话 →'));
      entry.appendChild(quote);

      list.appendChild(entry);
    });
  } catch (err) {
    list.innerHTML = '';
    list.appendChild(el('div', 'loading', `加载失败：${err.message}`));
    countEl.textContent = '';
  }
}

/* ---------- 对话页：书信往来 ---------- */
function initChat() {
  const params = new URLSearchParams(location.search);
  const personaId = params.get('persona');
  const nameEl = document.getElementById('chat-name');
  const metaEl = document.getElementById('chat-meta');
  const avatarEl = document.getElementById('chat-avatar');
  const messagesEl = document.getElementById('conversation');
  const epigraphEl = document.getElementById('chat-epigraph');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const toast = document.getElementById('error-toast');

  if (!personaId) {
    location.href = '/';
    return;
  }

  const storageKey = `persona-hub:history:${personaId}`;
  const disclaimerKey = `persona-hub:disclaimer:${personaId}`;
  let profile = null;
  let history = [];

  try { history = JSON.parse(localStorage.getItem(storageKey) || '[]'); } catch { history = []; }

  function showToast(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => { toast.hidden = true; }, 5000);
  }

  function scrollDown() {
    messagesEl.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }

  function addMessage(role, content, letterNo) {
    const isAssistant = role === 'assistant';
    const isDisclaimer = isAssistant && profile && content === profile.disclaimer;
    const row = el('div', `msg${isAssistant ? ' assistant' : ' user'}`);

    if (isDisclaimer) {
      row.classList.add('msg-disclaimer');
      for (const para of paragraphs(content)) row.appendChild(el('p', null, para));
      messagesEl.appendChild(row);
      scrollDown();
      return row;
    }

    row.appendChild(el('div', 'msg-label', isAssistant ? avatarChar(profile?.name) : '你'));

    const wrap = el('div', 'msg-content');
    let kicker;
    if (isAssistant) {
      kicker = letterNo ? `${profile.name}的答复 · 第${cnNumber(letterNo)}封` : `${profile.name}的开场 · 开卷`;
    } else {
      kicker = letterNo ? `你的来信 · 第${cnNumber(letterNo)}封` : '你的来信';
    }
    wrap.appendChild(el('div', 'msg-kicker', kicker));
    for (const para of paragraphs(content)) wrap.appendChild(el('p', 'msg-body', para));
    row.appendChild(wrap);
    messagesEl.appendChild(row);
    scrollDown();
    return row;
  }

  function addTyping() {
    const row = el('div', 'msg assistant typing');
    row.appendChild(el('div', 'msg-label', avatarChar(profile?.name)));
    const wrap = el('div', 'msg-content');
    wrap.appendChild(el('div', 'msg-kicker', `${profile.name}的答复`));
    const para = el('p', 'msg-body', '正在书写……');
    wrap.appendChild(para);
    row.appendChild(wrap);
    messagesEl.appendChild(row);
    scrollDown();
    return { row, para };
  }

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(history.slice(-50)));
  }

  function renderHistory() {
    messagesEl.innerHTML = '';
    let letterNo = 0;
    for (const m of history) {
      if (m.role === 'user') letterNo++;
      addMessage(m.role, m.content, m.role === 'user' ? letterNo : letterNo || null);
    }
  }

  function showDisclaimer() {
    if (!profile?.disclaimer || localStorage.getItem(disclaimerKey)) return;
    addMessage('assistant', profile.disclaimer);
    localStorage.setItem(disclaimerKey, '1');
  }

  function renderEpigraph() {
    const quote = profile.quotes && profile.quotes[0];
    if (!quote) return;
    epigraphEl.hidden = false;
    document.getElementById('epigraph-text').textContent = `“${quote.text}”`;
    document.getElementById('epigraph-source').textContent = quote.source || '';
  }

  async function send(text) {
    const userMsg = text.trim();
    if (!userMsg || sendBtn.disabled) return;
    input.value = '';
    autoGrow();
    history.push({ role: 'user', content: userMsg });
    addMessage('user', userMsg, history.filter((m) => m.role === 'user').length);
    persist();

    sendBtn.disabled = true;
    const { row: typingRow, para: typingPara } = addTyping();
    let acc = '';
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          personaId,
          messages: history,
          disclaimerShown: !!localStorage.getItem(disclaimerKey),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `请求失败（${res.status}）`);
      }

      const contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        const data = await res.json();
        if (data.crisis) {
          acc = data.message;
        } else {
          throw new Error('未知响应');
        }
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
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
              const delta = parsed.delta ?? '';
              if (delta) {
                acc += delta;
                typingPara.textContent = acc;
                scrollDown();
              }
            } catch { /* 忽略 */ }
          }
        }
        if (!acc) throw new Error('没有收到回复内容');
      }

      typingRow.remove();
      history.push({ role: 'assistant', content: acc });
      addMessage('assistant', acc, history.filter((m) => m.role === 'user').length);
    } catch (err) {
      typingRow.remove();
      showToast(err.message);
      history.pop();
    } finally {
      persist();
      sendBtn.disabled = false;
      input.focus();
    }
  }

  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    send(input.value);
  });

  input.addEventListener('input', autoGrow);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input.value);
    }
  });

  document.getElementById('exit-role').addEventListener('click', () => {
    send('请退出角色，恢复正常回答。');
  });

  (async () => {
    try {
      const { personas } = await fetchJson(`${API_BASE}/api/personas`);
      profile = personas.find((p) => p.id === personaId);
      if (!profile) throw new Error('人物不存在');
      nameEl.textContent = profile.name;
      avatarEl.textContent = avatarChar(profile.name);
      const metaBits = [profile.period, profile.role, profile.roleEn].filter(Boolean).join(' · ');
      metaEl.textContent = metaBits || profile.tagline || '';
      document.title = `对话 ${profile.name} · 人物对话`;
      renderEpigraph();
      renderHistory();
      showDisclaimer();
      if (!history.length) {
        addMessage('assistant', profile.welcome || '问吧。');
      }
      input.focus();
    } catch (err) {
      showToast(err.message);
    }
  })();
}

const page = document.body.classList.contains('chat-body') ? 'chat' : 'index';
if (page === 'chat') initChat();
else initIndex();
