const storageKeys = {
  memories: 'zhiyin-memories',
  messages: 'zhiyin-messages',
  clues: 'zhiyin-clues',
  mood: 'zhiyin-mood',
  backgroundReviews: 'zhiyin-background-reviews'
};

const state = {
  currentView: 'home',
  role: 'user',
  messages: [],
  memories: [
    { type: '长期目标', tone: 'purple', title: '改善睡眠质量', text: '希望建立更稳定的作息，减少睡前反复思考。', source: '用户主动确认 · 2 小时前' },
    { type: '沟通偏好', tone: 'peach', title: '先听见，再建议', text: '希望回答先复述感受，再提供一个小而具体的行动。', source: '系统从明确选择中整理 · 昨天' },
    { type: '可用资源', tone: 'mint', title: '散步与记录', text: '散步、写下来和明确表达需求，曾经帮助自己回到当下。', source: '用户在对话中确认 · 9月22日' }
  ],
  clues: 12,
  backgroundReviews: [],
  modalMode: 'memory'
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];



function loadState() {
  try {
    state.messages = JSON.parse(localStorage.getItem(storageKeys.messages) || '[]');
    const memories = JSON.parse(localStorage.getItem(storageKeys.memories) || 'null');
    const clues = JSON.parse(localStorage.getItem(storageKeys.clues) || 'null');
    const backgroundReviews = JSON.parse(localStorage.getItem(storageKeys.backgroundReviews) || 'null');
    if (Array.isArray(memories) && memories.length) state.memories = memories;
    if (Number.isFinite(clues)) state.clues = clues;
    if (Array.isArray(backgroundReviews)) state.backgroundReviews = backgroundReviews;
  } catch (error) {
    console.warn('本地演示数据读取失败', error);
  }
}

function persist(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { console.warn('本地演示数据保存失败', error); }
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function switchView(view) {
  const names = { home: '今日概览', chat: '对话空间', clues: '线索图谱', memory: '记忆中心', goals: '成长目标', architecture: '架构总览', settings: '系统设置' };
  state.currentView = view;
  $$('.view').forEach((panel) => panel.classList.toggle('active', panel.dataset.viewPanel === view));
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  $('#currentViewName').textContent = names[view] || names.home;
  closeMobileMenu();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openMobileMenu() {
  $('#sidebar').classList.add('open');
  $('#mobileOverlay').classList.add('open');
}
function closeMobileMenu() {
  $('#sidebar').classList.remove('open');
  $('#mobileOverlay').classList.remove('open');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function timeLabel() {
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(new Date());
}

function renderMessages() {
  const body = $('#chatBody');
  if (!state.messages.length) return;
  body.innerHTML = '<div class="chat-day"><span>今天 '+timeLabel()+'</span></div>';
  state.messages.forEach((message) => {
    if (message.role === 'assistant' && message.crisis) {
      body.insertAdjacentHTML('beforeend', '<div class="crisis-card"><strong>需要先确认你的安全</strong><p>我很重视你刚才说的话。此刻请先把自己放在安全的地方，远离可能伤害自己的物品，并联系一位你信任的人陪着你。如果你可能马上行动或已经受伤，请立即联系当地急救服务或前往最近的急诊。</p><a class="crisis-link" href="https://www.who.int/health-topics/suicide" target="_blank" rel="noreferrer">查看国际危机支持资源 ↗</a></div>');
    }
    const avatar = message.role === 'user' ? '林' : '知';
    const content = escapeHtml(message.content).replace(/\n/g, '<br>');
    body.insertAdjacentHTML('beforeend', `<div class="message ${message.role}"><div class="message-avatar ${message.role === 'user' ? 'avatar-blue' : 'avatar-agent'}">${avatar}</div><div class="message-content"><p>${content}</p></div></div>`);
  });
  body.scrollTop = body.scrollHeight;
}

function addMessage(role, content, extra = {}) {
  state.messages.push({ role, content, time: timeLabel(), ...extra });
  persist(storageKeys.messages, state.messages);
  renderMessages();
}

const crisisTerms = ['自杀', '不想活', '活不下去', '结束生命', '伤害自己', '自残', '杀了自己', '想死'];
const crisisResponse = '我很重视你刚才说的话。此刻请先确认自己的安全：把自己放在安全的地方，远离可能伤害自己的物品，并联系一位你信任的人陪着你。如果危险可能马上发生，请立即联系当地急救服务或前往最近的急诊。你也可以告诉我：你现在是在安全的地方吗？身边有没有可以联系的人？';
const agentRoutes = {
  crisis: ['边界审查', '现实支持引导'],
  sleep: ['倾听承接', '记忆整理', '探索发现', '边界审查'],
  relationship: ['倾听承接', '记忆整理', '模式发现', '边界审查'],
  exercise: ['倾听承接', '探索发现', '练习生成', '边界审查'],
  default: ['倾听承接', '记忆整理', '探索发现', '边界审查']
};
function getAgentRoute(topic, crisis) {
  return crisis ? agentRoutes.crisis : (agentRoutes[topic] || agentRoutes.default);
}

function queueBackgroundReview(topic, crisis, route) {
  window.setTimeout(() => {
    const recentCount = state.messages.slice(-8).filter((message) => message.role === 'user').length;
    const review = {
      id: `review_${Date.now()}`,
      createdAt: new Date().toISOString(),
      status: 'completed',
      topic,
      route,
      evidenceCount: recentCount,
      observation: crisis ? '安全信号已单独处理' : (topic === 'default' ? '保留当前经验，等待更多语境' : '发现一条候选线索，继续观察')
    };
    state.backgroundReviews.unshift(review);
    state.backgroundReviews = state.backgroundReviews.slice(0, 30);
    persist(storageKeys.backgroundReviews, state.backgroundReviews);
    if (!crisis && topic !== 'default') {
      state.clues += 1;
      persist(storageKeys.clues, state.clues);
      const summary = $('.summary-card strong');
      if (summary) summary.textContent = String(state.clues);
    }
  }, 1200);
}

const normalResponses = {
  sleep: '我先听见你最近很难让大脑安静下来。这里有一个工作假设：工作压力可能让思维停不下来，但我们还需要继续确认。先做一个很小的事情：今晚把最占脑力的一件具体事情写在纸上，给它一个明确的结束位置。你愿意告诉我，这种“停不下来”更常发生在什么时候吗？',
  relationship: '我们可以把这段关系当作一条线索来观察，而不是急着判断谁对谁错。你愿意先说说，最近一次冲突是从哪一个具体时刻开始的吗？我们会一起看：发生了什么、你当时的感受、你通常会怎么回应，以及关系里有没有反复出现的模式。',
  exercise: '我们做一个不费力的三分钟练习。双脚踩地，肩膀自然放松，慢慢吸气数四拍，停留两拍，再慢慢呼气六拍。重复四轮后，观察一下身体哪里放松了、哪里仍然紧。如果愿意，可以告诉我你现在更接近放松、麻木，还是有点烦。',
  default: '我在听。可以先把这件事拆成三个小问题：发生了什么？你当时和现在分别有什么感受？你最希望接下来有什么不同？你不需要一次讲完整，先说最想被看见的那一部分就好。'
};

function detectTopic(text) {
  if (/睡|失眠|睡不着|熬夜|入睡|早醒/.test(text)) return 'sleep';
  if (/关系|朋友|伴侣|父母|家庭|冲突|吵架|边界/.test(text)) return 'relationship';
  if (/放松|练习|呼吸|冥想|焦虑/.test(text)) return 'exercise';
  return 'default';
}

function isCrisis(text) { return crisisTerms.some((term) => text.includes(term)); }

function handleSend(text) {
  const clean = text.trim();
  if (!clean) return;
  addMessage('user', clean);
  const crisis = isCrisis(clean);
  const topic = detectTopic(clean);
  const route = getAgentRoute(topic, crisis);
  setTimeout(() => {
    addMessage('assistant', crisis ? crisisResponse : normalResponses[topic], { crisis, topic });
    queueBackgroundReview(topic, crisis, route);
  }, 500);
}

function openModal(mode) {
  state.modalMode = mode;
  const isMemory = mode === 'memory';
  $('#modalTitle').textContent = isMemory ? '添加一条重要记忆' : '添加一条观察';
  $('#modalDescription').textContent = isMemory ? '只保存你明确希望系统记住的内容。' : '记录一个你希望继续观察的现象，系统会把它整理为线索。';
  $('#modalInput').placeholder = isMemory ? '例如：希望回答先复述感受，再给出建议' : '例如：工作忙起来时更容易失眠';
  $('#modalConfirm').innerHTML = isMemory ? '保存记忆 <span>→</span>' : '保存观察 <span>→</span>';
  $('#modalBackdrop').classList.add('open');
  $('#modalBackdrop').setAttribute('aria-hidden', 'false');
  setTimeout(() => $('#modalInput').focus(), 50);
}

function closeModal() {
  $('#modalBackdrop').classList.remove('open');
  $('#modalBackdrop').setAttribute('aria-hidden', 'true');
  $('#modalInput').value = '';
}

function addMemory(content) {
  state.memories.unshift({ type: '用户新增', tone: 'purple', title: '我的一条记忆', text: content, source: '用户主动添加 · 刚刚' });
  persist(storageKeys.memories, state.memories);
  renderMemoryCards();
  showToast('记忆已保存到本地演示空间');
}

function addClue(content) {
  state.clues += 1;
  persist(storageKeys.clues, state.clues);
  const summary = $('.summary-card strong');
  if (summary) summary.textContent = String(state.clues);
  showToast('观察已保存为待验证线索');
}

function renderMemoryCards() {
  const grid = $('.memory-grid');
  if (!grid) return;
  const tones = { purple: 'tag-purple', peach: 'tag-peach', mint: 'tag-mint' };
  const rendered = state.memories.slice(0, 5).map((memory) => `<article class="memory-card"><div class="memory-card-top"><span class="tag ${tones[memory.tone] || tones.purple}">${escapeHtml(memory.type)}</span><button class="icon-button" data-memory-action="more">•••</button></div><h3>${escapeHtml(memory.title)}</h3><p>${escapeHtml(memory.text)}</p><div class="memory-source"><span>✦</span> ${escapeHtml(memory.source)}</div><div class="memory-card-footer"><span class="saved-status">已保存</span><button class="small-action" data-memory-action="edit">编辑</button></div></article>`).join('');
  const addCard = '<article class="memory-card add-memory-card" id="addMemoryCard"><div class="add-circle">＋</div><h3>添加一条重要记忆</h3><p>只保存你明确希望系统记住的内容。</p></article>';
  grid.innerHTML = rendered + addCard;
}

function bindEvents() {
  $$('.nav-item, [data-view-target]').forEach((element) => element.addEventListener('click', () => switchView(element.dataset.view || element.dataset.viewTarget)));
  $('#mobileMenu').addEventListener('click', openMobileMenu);
  $('#mobileOverlay').addEventListener('click', closeMobileMenu);
  $$('.role-button').forEach((button) => button.addEventListener('click', () => {
    $$('.role-button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    state.role = button.dataset.role;
    if (state.role === 'architecture') { switchView('architecture'); showToast('已切换到架构总览'); }
    else { switchView('home'); showToast('已切换到使用端'); }
  }));
  $$('.mood-option').forEach((option) => option.addEventListener('click', () => {
    $$('.mood-option').forEach((item) => item.classList.remove('selected'));
    option.classList.add('selected');
    const mood = option.dataset.mood;
    $('#checkinStatus').textContent = `已选择：${mood}`;
    localStorage.setItem(storageKeys.mood, mood);
    showToast(`已记录今天的情绪：${mood}`);
  }));
  $$('.prompt-card').forEach((card) => card.addEventListener('click', () => {
    switchView('chat');
    setTimeout(() => { $('#messageInput').value = card.dataset.prompt; $('#messageInput').focus(); }, 80);
  }));
  $('#messageForm').addEventListener('submit', (event) => { event.preventDefault(); const input = $('#messageInput'); const text = input.value; input.value = ''; handleSend(text); });
  $$('#chatSuggestions button').forEach((button) => button.addEventListener('click', () => { $('#messageInput').value = button.dataset.prompt; handleSend(button.dataset.prompt); }));
  $('#openCheckin').addEventListener('click', () => switchView('chat'));
  $('#openMemory').addEventListener('click', () => switchView('memory'));
  $('#newMemory').addEventListener('click', () => openModal('memory'));
  $('#addClue').addEventListener('click', () => openModal('clue'));
  $('.memory-grid').addEventListener('click', (event) => {
    if (event.target.closest('#addMemoryCard')) openModal('memory');
    if (event.target.closest('[data-memory-action]')) showToast('正式版本中可编辑、删除或设置记忆有效期');
  });
  $('#modalClose').addEventListener('click', closeModal);
  $('#modalCancel').addEventListener('click', closeModal);
  $('#modalBackdrop').addEventListener('click', (event) => { if (event.target.id === 'modalBackdrop') closeModal(); });
  $('#modalConfirm').addEventListener('click', () => { const content = $('#modalInput').value.trim(); if (!content) { showToast('请先写下内容'); return; } if (state.modalMode === 'memory') addMemory(content); else addClue(content); closeModal(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') { closeModal(); closeMobileMenu(); } });
  $('#exportData').addEventListener('click', () => { const data = { exportedAt: new Date().toISOString(), memories: state.memories, messages: state.messages, backgroundReviews: state.backgroundReviews, clues: state.clues }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'zhiyin-demo-data.json'; link.click(); URL.revokeObjectURL(link.href); showToast('演示数据已导出'); });
  $('#completeAction').addEventListener('click', (event) => { event.currentTarget.innerHTML = '已完成 ✓'; event.currentTarget.disabled = true; showToast('小行动完成，做得很好'); });
  $('#saveQuestions').addEventListener('click', () => showToast('已保存为个人探索问题'));
}

function init() {
  loadState();
  const savedMood = localStorage.getItem(storageKeys.mood);
  if (savedMood) { const option = $(`.mood-option[data-mood="${CSS.escape(savedMood)}"]`); if (option) { $$('.mood-option').forEach((item) => item.classList.remove('selected')); option.classList.add('selected'); $('#checkinStatus').textContent = `已选择：${savedMood}`; } }
  renderMessages();
  renderMemoryCards();
  bindEvents();
  const count = $('.summary-card strong');
  if (count) count.textContent = String(state.clues);
}

init();
