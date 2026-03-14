// ─── Proteção de rota ─────────────────────────────────────────────────────────
const isGuest = localStorage.getItem('isGuest') === 'true';

if (!isLoggedIn() && !isGuest) {
  window.location.href = 'index.html';
}

const user = getUser();
if (user) {
  document.getElementById('user-name').textContent = user.nome;
  document.getElementById('banner-name').textContent = user.nome.split(' ')[0];
} else if (isGuest) {
  document.getElementById('user-name').textContent = 'Visitante';
  document.getElementById('banner-name').textContent = 'Visitante';
}

// ─── Estado ───────────────────────────────────────────────────────────────────
let selectedCategory = null;
let selectedCount = null;

// ─── Mostra área de matérias ──────────────────────────────────────────────────
function showArea(area, btn) {
  document.querySelectorAll('[id^="area-"]').forEach(el => el.style.display = 'none');
  document.getElementById(`area-${area}`).style.display = 'grid';
  document.querySelectorAll('.subject-area-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}

// ─── Seleciona grupo ──────────────────────────────────────────────────────────
function selectGroup(el) {
  // Deseleciona tudo
  document.querySelectorAll('.group-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.subject-chip').forEach(c => c.classList.remove('selected'));

  el.classList.add('selected');
  selectedCategory = el.dataset.category;
  updateStartBar();
}

// ─── Seleciona matéria individual ─────────────────────────────────────────────
function selectSubject(el) {
  document.querySelectorAll('.group-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.subject-chip').forEach(c => c.classList.remove('selected'));

  el.classList.add('selected');
  selectedCategory = el.dataset.category;
  updateStartBar();
}

// ─── Seleciona quantidade ─────────────────────────────────────────────────────
function selectCount(el) {
  document.querySelectorAll('.count-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedCount = Number(el.dataset.count);
  updateStartBar();
}

// ─── Atualiza barra de start ──────────────────────────────────────────────────
function updateStartBar() {
  const btn = document.getElementById('btn-start');
  const summary = document.getElementById('start-summary');

  if (selectedCategory && selectedCount) {
    const label = CATEGORY_LABELS[selectedCategory] || selectedCategory;
    summary.innerHTML = `<strong>${label}</strong> — <strong>${selectedCount} questões</strong> &nbsp;✅ Pronto para começar!`;
    btn.disabled = false;
  } else if (selectedCategory) {
    summary.innerHTML = `<strong>${CATEGORY_LABELS[selectedCategory]}</strong> selecionada. Agora escolha a quantidade.`;
    btn.disabled = true;
  } else if (selectedCount) {
    summary.innerHTML = `<strong>${selectedCount} questões</strong> selecionadas. Agora escolha a área.`;
    btn.disabled = true;
  } else {
    summary.textContent = 'Selecione uma área e quantidade para continuar.';
    btn.disabled = true;
  }
}

// ─── Inicia a speedrun ────────────────────────────────────────────────────────
async function startQuiz() {
  if (!selectedCategory || !selectedCount) return;

  const btn = document.getElementById('btn-start');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Carregando questões...';

  try {
    const data = await apiRequest('/api/quiz/start', {
      method: 'POST',
      body: JSON.stringify({ category: selectedCategory, count: selectedCount }),
    });

    // Salva sessão no sessionStorage
    sessionStorage.setItem('quiz_session', JSON.stringify(data));
    window.location.href = 'quiz.html';
  } catch (err) {
    alert(`Erro ao carregar questões: ${err.message}`);
    btn.disabled = false;
    btn.innerHTML = 'Iniciar Speedrun ▶';
  }
}
// ─── Carrega conquistas ───────────────────────────────────────────────────────
async function loadAchievements() {
  const grid = document.getElementById('achievements-grid');
  if (!grid) return;

  try {
    const { achievements, all_possible } = await apiRequest('/api/quiz/achievements/me');
    const earnedIds = new Set(achievements.map(a => a.achievement_id));

    grid.innerHTML = all_possible.map(ach => {
      const isUnlocked = earnedIds.has(ach.id);
      const earned = achievements.find(a => a.achievement_id === ach.id);
      const dateStr = earned ? new Date(earned.earned_at).toLocaleDateString('pt-BR') : '';

      return `
        <div class="achievement-badge ${isUnlocked ? 'unlocked' : ''}" title="${ach.description}">
          <div class="badge-icon">${ach.icon}</div>
          <div class="badge-title">${ach.title}</div>
          ${isUnlocked ? `<div class="badge-date">${dateStr}</div>` : '<div class="badge-date">Bloqueada</div>'}
        </div>
      `;
    }).join('');

  } catch (err) {
    grid.innerHTML = '<p style="color:red;font-size:0.8rem;">Erro ao carregar conquistas.</p>';
  }
}

// ─── Inicia ───────────────────────────────────────────────────────────────────
if (!isGuest) {
  loadAchievements();
} else {
  const achSection = document.querySelector('.achievements-section');
  if (achSection) {
    achSection.innerHTML = `
      <div class="section-label">Conquistas</div>
      <div style="background: #f8f9fa; border: 2px dashed #ddd; border-radius: 12px; padding: 24px; text-align: center; color: #666;">
        <div style="font-size: 1.5rem; margin-bottom: 8px;">🔒</div>
        <p><strong>Crie uma conta</strong> para desbloquear conquistas nacionais, ganhar badges e competir no ranking!</p>
        <button onclick="logout()" class="btn btn-primary" style="margin-top: 12px; padding: 8px 20px;">Criar Conta Agora</button>
      </div>
    `;
  }
}
