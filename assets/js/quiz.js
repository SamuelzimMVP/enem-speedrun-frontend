// ─── Proteção e carregamento de sessão ─────────────────────────────────────────
if (!isLoggedIn() && localStorage.getItem('isGuest') !== 'true') {
  window.location.href = 'index.html';
}

const session = JSON.parse(sessionStorage.getItem('quiz_session') || 'null');
if (!session) window.location.href = 'home.html';

const questions  = session.questions;
const sessionId  = session.sessionId;
const totalCount = session.count;

let currentIndex = 0;
let elapsed      = 0;     // segundos
let timerInterval = null;
let answers      = questions.map(q => ({ questionId: q.id, selected: null }));
let answerGiven  = false;

// ─── Monta label da categoria ─────────────────────────────────────────────────
document.getElementById('quiz-category-label').textContent =
  (session.categoryLabel || CATEGORY_LABELS[session.category] || 'ENEM Speedrun').toUpperCase();
document.getElementById('q-total').textContent = totalCount;

// ─── Cronômetro ───────────────────────────────────────────────────────────────
function startTimer() {
  timerInterval = setInterval(() => {
    elapsed++;
    const el = document.getElementById('timer');
    el.textContent = formatTime(elapsed);

    // Alertas visuais de tempo
    const limit = totalCount * 3 * 60; // 3 min por questão referência
    if (elapsed > limit * 0.85) el.className = 'timer danger';
    else if (elapsed > limit * 0.6) el.className = 'timer warning';
    else el.className = 'timer';
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

// ─── Helper para processar Markdown de imagens ─────────────────────────────────
function parseMarkdownImages(text) {
  if (!text) return '';
  // Converte ![](url) para <img src="url" class="inline-image">
  return text.replace(/!\[.*?\]\((.*?)\)/g, '<img src="$1" class="question-inline-img" alt="Imagem do enunciado">');
}

// ─── Renderiza questão atual ──────────────────────────────────────────────────
function renderQuestion(index) {
  const q = questions[index];
  answerGiven = false;

  // Meta
  document.getElementById('q-current').textContent = index + 1;
  document.getElementById('q-num').textContent = `Questão ${index + 1}`;
  document.getElementById('q-year').textContent = q.ano ? `ENEM ${q.ano}` : 'ENEM';
  document.getElementById('q-disciplina').textContent = CATEGORY_LABELS[q.disciplina] || q.disciplina || '';

  // Progresso (mostra o progresso incluindo a questão atual)
  const pct = Math.round(((index + 1) / totalCount) * 100);
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = `${pct}% concluído`;

  // Contexto (com suporte a markdown de imagens)
  const ctxEl = document.getElementById('q-context');
  if (q.contexto && q.contexto.trim()) {
    ctxEl.style.display = 'block';
    ctxEl.innerHTML = parseMarkdownImages(q.contexto);
  } else {
    ctxEl.style.display = 'none';
  }

  // Imagens Anexas (Múltiplas)
  const imgWrap = document.getElementById('q-image');
  imgWrap.innerHTML = ''; // Limpa container
  
  if (q.imagens && q.imagens.length > 0) {
    q.imagens.forEach(url => {
      const img = document.createElement('img');
      img.src = url;
      img.className = 'question-main-img';
      img.onerror = () => img.style.display = 'none';
      imgWrap.appendChild(img);
    });
    imgWrap.style.display = 'block';
  } else {
    imgWrap.style.display = 'none';
  }

  // Enunciado (com suporte a markdown de imagens)
  document.getElementById('q-text').innerHTML = parseMarkdownImages(q.enunciado || '');

  // Alternativas
  const altContainer = document.getElementById('alternatives');
  altContainer.innerHTML = '';
  (q.alternativas || []).forEach(alt => {
    const btn = document.createElement('button');
    btn.className = 'alt-btn';
    btn.dataset.letra = alt.letra;
    btn.innerHTML = `
      <span class="alt-letter">${alt.letra}</span>
      ${alt.imgUrl
        ? `<img src="${alt.imgUrl}" alt="Alternativa ${alt.letra}" style="max-width:100%;max-height:120px;object-fit:contain;" onerror="this.style.display='none'">`
        : `<span>${alt.texto}</span>`
      }
    `;
    btn.onclick = () => selectAnswer(alt.letra, q.id);
    altContainer.appendChild(btn);
  });

  // Botão próximo
  const btnNext = document.getElementById('btn-next');
  btnNext.disabled = true;
  btnNext.textContent = index === totalCount - 1 ? 'Finalizar ✓' : 'Próxima →';

  // Animação
  const card = document.getElementById('question-card');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'fadeIn 0.3s ease forwards';

  // Scroll ao topo
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ─── Seleciona alternativa ────────────────────────────────────────────────────
function selectAnswer(letra, questionId) {
  answerGiven = true;

  // Marca visualmente
  document.querySelectorAll('.alt-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.letra === letra);
  });

  // Registra resposta na posição correta
  const ans = answers.find(a => a.questionId === questionId);
  if (ans) {
    ans.selected = letra;
  }

  // Habilita próximo
  document.getElementById('btn-next').disabled = false;
}

// ─── Avança questão ───────────────────────────────────────────────────────────
async function nextQuestion() {
  currentIndex++;

  if (currentIndex < totalCount) {
    renderQuestion(currentIndex);
  } else {
    await finishQuiz();
  }
}

// ─── Finaliza e envia resultado ───────────────────────────────────────────────
async function finishQuiz() {
  stopTimer();
  document.getElementById('quiz-screen').style.display = 'none';

  // Spinner enquanto envia
  document.getElementById('result-screen').style.display = 'block';
  document.getElementById('result-screen').innerHTML = `
    <div style="text-align:center;padding:60px 0;">
      <div class="spinner spinner-blue" style="width:48px;height:48px;border-width:5px;margin:0 auto 20px;"></div>
      <p style="color:var(--azul-primario);font-weight:600;font-size:1.1rem;">Calculando resultado...</p>
    </div>
  `;

  try {
    const result = await apiRequest('/api/quiz/submit', {
      method: 'POST',
      body: JSON.stringify({ sessionId, answers, timeSeconds: elapsed }),
    });

    showResult(result);

    // Exibe conquistas desbloqueadas (após pequeno delay para o resultado aparecer primeiro)
    if (result.newAchievements && result.newAchievements.length > 0) {
      result.newAchievements.forEach((ach, i) => {
        setTimeout(() => showAchievementToast(ach), 1200 + i * 1800);
      });
    }
  } catch (err) {
    document.getElementById('result-screen').innerHTML = `
      <div class="alert alert-error">Erro ao enviar resultado: ${err.message}</div>
      <div style="text-align:center;margin-top:20px;">
        <a href="home.html" class="btn btn-primary">Voltar ao início</a>
      </div>
    `;
  }
}

// ─── Exibe tela de resultado ──────────────────────────────────────────────────
function showResult(result) {
  const pct = result.percentage;
  const emoji = pct >= 80 ? '🏆' : pct >= 60 ? '🎯' : pct >= 40 ? '📚' : '💪';
  const msg = pct >= 80
    ? 'Excelente desempenho!'
    : pct >= 60 ? 'Bom resultado!'
    : pct >= 40 ? 'Continue praticando!'
    : 'Não desista, continue estudando!';

  document.getElementById('result-screen').innerHTML = `
    <div class="result-hero">
      <div style="font-size:3rem;margin-bottom:12px">${emoji}</div>
      <h2>Speedrun concluída!</h2>
      <p>${CATEGORY_LABELS[session.category] || session.category} — ${result.total} questões</p>
    </div>
    <div class="result-stats">
      <div class="result-stat">
        <div class="rs-value">${result.correct}/${result.total}</div>
        <div class="rs-label">Acertos</div>
      </div>
      <div class="result-stat">
        <div class="rs-value">${pct}%</div>
        <div class="rs-label">Aproveitamento</div>
      </div>
      <div class="result-stat">
        <div class="rs-value">${formatTime(result.timeSeconds)}</div>
        <div class="rs-label">Tempo total</div>
      </div>
      <div class="result-stat" style="${result.isGuest ? 'background: #fff0f0; border-color: #ffcccc;' : ''}">
        <div class="rs-value">${result.isGuest ? '🔒' : '#' + result.position}</div>
        <div class="rs-label">${result.isGuest ? 'Não salvo' : 'Posição no ranking'}</div>
      </div>
    </div>

    ${result.isGuest ? `
    <div style="background: #e8f0ff; border: 1px solid #b3d1ff; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 24px; color: #1a4a99;">
      <strong>Modo Visitante:</strong> Seu tempo não foi salvo no ranking nacional. 
      <a href="index.html" style="font-weight:700; color: #0056b3;">Crie uma conta</a> para competir com outros estudantes!
    </div>
    ` : ''}

    <div class="gabarito-section">
      <h3>📋 Gabarito detalhado</h3>
      <div class="gabarito-grid" id="gabarito-grid"></div>
    </div>
    <div class="result-actions">
      <a href="home.html" class="btn btn-outline btn-lg">← Voltar ao Início</a>
      ${result.isGuest ? '' : '<a href="ranking.html" class="btn btn-primary btn-lg">Ver ranking 🏆</a>'}
    </div>
  `;

  // Preenche gabarito
  const grid = document.getElementById('gabarito-grid');
  result.details.forEach((d, i) => {
    const div = document.createElement('div');
    div.className = `gab-item ${d.correct ? 'ok' : 'fail'} clickable`;
    div.title = "Clique para ver detalhes";
    div.innerHTML = `
      <div class="gab-q">Q${i + 1}</div>
      <div class="gab-ans">${d.selected || '—'} ${d.correct ? '✓' : '✗'}</div>
      ${!d.correct ? `<div style="font-size:0.68rem;opacity:0.8">Gab: ${d.gabarito}</div>` : ''}
    `;
    div.onclick = () => openQuestionDetails(d.questionId, d, i);
    grid.appendChild(div);
  });

  // Limpa sessão
  sessionStorage.removeItem('quiz_session');

  // Barra de progresso 100%
  const fill = document.getElementById('progress-fill');
  const text = document.getElementById('progress-text');
  if (fill) fill.style.width = '100%';
  if (text) text.textContent = '100% concluído';
}

// ─── Inicia quiz ──────────────────────────────────────────────────────────────
startTimer();
renderQuestion(0);

// ─── Botão próximo ───────────────────────────────────────────────────────────
document.getElementById('btn-next').onclick = nextQuestion;

// ─── Toast de conquista estilo Steam ─────────────────────────────────────────
function showAchievementToast(ach) {
  // Garante que o container existe
  let container = document.getElementById('achievement-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'achievement-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'achievement-toast';
  toast.innerHTML = `
    <div class="ach-header">🎮 Conquista desbloqueada!</div>
    <div class="ach-body">
      <div class="ach-icon">${ach.icon}</div>
      <div class="ach-info">
        <div class="ach-title">${ach.title}</div>
        <div class="ach-desc">${ach.description}</div>
      </div>
    </div>
  `;

  container.appendChild(toast);

  // Anima entrada
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  // Remove após 5 segundos
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  }, 5000);
}

// ─── Modal de gabarito detalhado ─────────────────────────────────────────────
function openQuestionDetails(questionId, detail, index) {
  const q = questions.find(q => q.id === questionId);
  if (!q) return;

  const modal = document.getElementById('question-modal');
  const title = document.getElementById('modal-q-title');
  const body = document.getElementById('modal-q-body');

  title.textContent = `Questão ${index + 1} — ENEM ${q.ano || ''}`;
  
  let altsHtml = '';
  (q.alternativas || []).forEach(alt => {
    const isCorrect = alt.letra === detail.gabarito;
    const isSelected = alt.letra === detail.selected;
    
    let stateClass = '';
    if (isCorrect) stateClass = 'correct';
    else if (isSelected && !detail.correct) stateClass = 'wrong';

    altsHtml += `
      <div class="detail-alt ${stateClass}">
        <span class="alt-letter">${alt.letra}</span>
        ${alt.imgUrl
          ? `<img src="${alt.imgUrl}" style="max-width:100%;max-height:120px;object-fit:contain;">`
          : `<span>${alt.texto}</span>`
        }
      </div>
    `;
  });

  body.innerHTML = `
    <div class="question-meta" style="margin-bottom:16px;">
      <span class="question-badge">${CATEGORY_LABELS[q.disciplina] || q.disciplina || ''}</span>
    </div>
    ${q.contexto ? `<div class="question-context" style="margin-bottom:16px;">${parseMarkdownImages(q.contexto)}</div>` : ''}
    <div class="modal-images" style="margin-bottom:16px;">
      ${(q.imagens || []).map(url => `<img src="${url}" class="question-main-img" style="margin-bottom:8px;">`).join('')}
    </div>
    <div class="question-text" style="font-weight:600; margin-bottom:20px;">${parseMarkdownImages(q.enunciado)}</div>
    <div class="alternatives">${altsHtml}</div>
    ${!detail.correct ? `
      <div style="margin-top:20px; padding:12px; background:#F0F5FF; border-radius:8px; font-size:0.9rem; color:var(--azul-escuro);">
        💡 <strong>Dica:</strong> Você marcou a alternativa <strong>${detail.selected || 'nenhuma'}</strong>, mas a correta era a <strong>${detail.gabarito}</strong>.
      </div>
    ` : `
      <div style="margin-top:20px; padding:12px; background:var(--verde-claro); border-radius:8px; font-size:0.9rem; color:#0a4a0a;">
        ✅ Você acertou esta questão! Parabéns!
      </div>
    `}
  `;

  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden'; // Trava scroll
}

function closeModal() {
  document.getElementById('question-modal').style.display = 'none';
  document.body.style.overflow = ''; // Destrava scroll
}

// Fecha modal ao clicar fora
window.onclick = function(event) {
  const modal = document.getElementById('question-modal');
  if (event.target == modal) {
    closeModal();
  }
}
