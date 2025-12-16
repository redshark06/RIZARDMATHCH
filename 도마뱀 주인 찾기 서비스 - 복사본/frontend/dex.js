/* 파충류 도감 페이지 */

const DEX_OVERRIDES_KEY = 'dexOverridesV1';
const DEX_CUSTOM_KEY = 'dexCustomV1';

function safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function loadOverrides() {
  return safeJsonParse(localStorage.getItem(DEX_OVERRIDES_KEY) || '{}', {});
}

function saveOverrides(obj) {
  localStorage.setItem(DEX_OVERRIDES_KEY, JSON.stringify(obj || {}));
}

function loadCustomList() {
  return safeJsonParse(localStorage.getItem(DEX_CUSTOM_KEY) || '[]', []);
}

function saveCustomList(arr) {
  localStorage.setItem(DEX_CUSTOM_KEY, JSON.stringify(arr || []));
}

function difficultyLabel(n) {
  const v = Number(n);
  if (!v) return '-';
  return `Lv.${v}`;
}

function applyDexOverrides(items) {
  const overrides = loadOverrides();
  const custom = loadCustomList();

  const map = new Map();
  [...items, ...custom].forEach((it) => {
    if (it && it['종_한글명']) map.set(it['종_한글명'], it);
  });

  Object.entries(overrides).forEach(([name, patch]) => {
    if (!name || !patch) return;
    const cur = map.get(name);
    if (cur) map.set(name, { ...cur, ...patch });
  });

  return Array.from(map.values());
}

function createCard(item) {
  const name = item['종_한글명'] || '-';
  const type = item['종류'] || '';
  const difficulty = item['사육_난이도_5단계'];
  const diet = item['식성타입'] || '';
  const activity = item['활동패턴'] || '';
  const summary = item['사육_요약'] || '';
  const imgUrl = item['사진_URL'] ? convertWikipediaImageUrl(item['사진_URL']) : '';

  const el = document.createElement('article');
  el.className = 'dex-card';

  el.innerHTML = `
    <div class="dex-card-image">
      ${imgUrl ? `<img src="${imgUrl}" alt="${name}" onerror="handleImageError(this)">` : `<div class="dex-card-placeholder">이미지 없음</div>`}
      <span class="dex-badge">${difficultyLabel(difficulty)}</span>
    </div>
    <div class="dex-card-body">
      <div class="dex-card-title-row">
        <div>
          <div class="dex-card-name">${name}</div>
          ${type ? `<div class="dex-card-type">${type}</div>` : ``}
        </div>
        <button type="button" class="dex-edit" aria-label="정보 수정">
          <i class="ph ph-pencil-simple" aria-hidden="true"></i>
        </button>
      </div>
      ${summary ? `<p class="dex-card-desc">${summary}</p>` : ``}
      <div class="dex-chips">
        ${activity ? `<span class="dex-chip">${activity}</span>` : ``}
        ${diet ? `<span class="dex-chip">${diet}</span>` : ``}
      </div>
      <div class="dex-card-actions">
        <a class="dex-detail" href="detail.html?species=${encodeURIComponent(name)}">상세 보기</a>
      </div>
    </div>
  `;

  const editBtn = el.querySelector('.dex-edit');
  if (editBtn) {
    editBtn.addEventListener('click', () => openEditModal(item, false));
  }

  return el;
}

async function fetchDexList({ q, difficulty }) {
  const apiBaseUrl = (typeof getApiBaseUrl === 'function') ? getApiBaseUrl() : 'http://localhost:5000';
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (difficulty) params.set('difficulty', difficulty);
  params.set('limit', '500');

  const res = await fetch(`${apiBaseUrl}/api/species/list?${params.toString()}`);
  if (!res.ok) {
    const text = await res.text();
    // 배포 백엔드가 아직 /api/species/list를 반영하지 못한 경우: /api/species/<name>로 흘러가 "list"를 종명으로 처리
    const maybeJson = (() => { try { return JSON.parse(text); } catch { return null; } })();
    if (res.status === 404 && maybeJson?.error?.code === 'SPECIES_NOT_FOUND' && String(maybeJson?.error?.message || '').includes('list')) {
      throw new Error('도감 목록 API가 아직 백엔드에 배포되지 않았습니다. Render에서 최신 커밋으로 재배포(Clear build cache & deploy) 후 다시 시도해 주세요.');
    }
    throw new Error(`도감 데이터를 불러오지 못했습니다 (${res.status}): ${text}`);
  }
  return await res.json();
}

function setStatus(msg, isError = false) {
  const el = document.getElementById('dexStatus');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? 'block' : 'none';
  el.classList.toggle('is-error', !!isError);
}

function renderGrid(items) {
  const grid = document.getElementById('dexGrid');
  if (!grid) return;
  grid.innerHTML = '';
  items.forEach((it) => grid.appendChild(createCard(it)));
}

// 모달
let _modalModeIsCreate = false;

function openModal() {
  const modal = document.getElementById('dexModal');
  if (!modal) return;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modal = document.getElementById('dexModal');
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

function fillForm(item, isCreate) {
  _modalModeIsCreate = !!isCreate;

  const title = document.getElementById('dexModalTitle');
  if (title) title.textContent = isCreate ? '새로운 종 추가하기' : `정보 수정: ${item['종_한글명'] || ''}`;

  const nameEl = document.getElementById('dexName');
  const typeEl = document.getElementById('dexType');
  const summaryEl = document.getElementById('dexSummary');
  const imgEl = document.getElementById('dexImg');
  const diffEl = document.getElementById('dexDifficulty');
  const enclosureEl = document.getElementById('dexEnclosure');
  const activityEl = document.getElementById('dexActivity');
  const dietEl = document.getElementById('dexDiet');
  const costEl = document.getElementById('dexCost');
  const previewImg = document.getElementById('dexPreviewImg');

  if (nameEl) {
    nameEl.value = item['종_한글명'] || '';
    nameEl.disabled = !isCreate; // 수정 시 이름은 키로 사용
  }
  if (typeEl) typeEl.value = item['종류'] || '';
  if (summaryEl) summaryEl.value = item['사육_요약'] || '';
  if (imgEl) imgEl.value = item['사진_URL'] || '';
  if (diffEl) diffEl.value = item['사육_난이도_5단계'] || 1;
  if (enclosureEl) enclosureEl.value = item['필요_공간'] || '';
  if (activityEl) activityEl.value = item['활동패턴'] || '';
  if (dietEl) dietEl.value = item['식성타입'] || '';
  if (costEl) costEl.value = item['초기비용_등급_5단계'] || 1;

  const url = imgEl && imgEl.value ? convertWikipediaImageUrl(imgEl.value) : '';
  if (previewImg) {
    previewImg.style.display = url ? 'block' : 'none';
    previewImg.src = url || '';
  }
}

function openEditModal(item, isCreate) {
  fillForm(item, isCreate);
  openModal();
}

function readFormData() {
  const name = (document.getElementById('dexName')?.value || '').trim();
  const type = (document.getElementById('dexType')?.value || '').trim();
  const summary = (document.getElementById('dexSummary')?.value || '').trim();
  const img = (document.getElementById('dexImg')?.value || '').trim();
  const diff = Number(document.getElementById('dexDifficulty')?.value || 1);
  const enclosure = (document.getElementById('dexEnclosure')?.value || '').trim();
  const activity = (document.getElementById('dexActivity')?.value || '').trim();
  const diet = (document.getElementById('dexDiet')?.value || '').trim();
  const cost = Number(document.getElementById('dexCost')?.value || 1);

  return {
    '종_한글명': name,
    '종류': type,
    '사육_요약': summary,
    '사진_URL': img,
    '사육_난이도_5단계': diff,
    '필요_공간': enclosure,
    '활동패턴': activity,
    '식성타입': diet,
    '초기비용_등급_5단계': cost
  };
}

async function boot() {
  const search = document.getElementById('dexSearchInput');
  const difficultySel = document.getElementById('dexDifficultySelect');
  const addBtn = document.getElementById('dexAddBtn');

  const modal = document.getElementById('dexModal');
  const modalClose = document.getElementById('dexModalClose');
  const cancelBtn = document.getElementById('dexCancelBtn');
  const form = document.getElementById('dexForm');
  const imgEl = document.getElementById('dexImg');
  const previewImg = document.getElementById('dexPreviewImg');

  let lastFetch = { q: '', difficulty: '' };
  let baseItems = [];

  async function refresh() {
    const q = (search?.value || '').trim();
    const difficulty = (difficultySel?.value || '').trim();
    setStatus('불러오는 중...');
    try {
      lastFetch = { q, difficulty };
      const res = await fetchDexList({ q, difficulty });
      baseItems = res.items || [];
      const merged = applyDexOverrides(baseItems);
      setStatus('');
      renderGrid(merged);
    } catch (e) {
      console.error(e);
      setStatus(e.message || '도감 데이터를 불러오지 못했습니다.', true);
    }
  }

  const debounced = (() => {
    let t = null;
    return () => {
      clearTimeout(t);
      t = setTimeout(refresh, 200);
    };
  })();

  if (search) search.addEventListener('input', debounced);
  if (difficultySel) difficultySel.addEventListener('change', refresh);

  if (addBtn) {
    addBtn.addEventListener('click', () => {
      openEditModal({
        '종_한글명': '',
        '종류': '',
        '사육_요약': '',
        '사진_URL': '',
        '사육_난이도_5단계': 1,
        '필요_공간': '',
        '활동패턴': '주행성',
        '식성타입': '잡식',
        '초기비용_등급_5단계': 1
      }, true);
    });
  }

  if (modalClose) modalClose.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (e) => {
      const target = e.target;
      if (target && target.getAttribute && target.getAttribute('data-close') === 'true') {
        closeModal();
      }
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  if (imgEl && previewImg) {
    imgEl.addEventListener('input', () => {
      const url = imgEl.value ? convertWikipediaImageUrl(imgEl.value) : '';
      previewImg.style.display = url ? 'block' : 'none';
      previewImg.src = url || '';
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = readFormData();
      if (!data['종_한글명']) return;

      if (_modalModeIsCreate) {
        const custom = loadCustomList();
        custom.unshift(data);
        saveCustomList(custom);
      } else {
        const overrides = loadOverrides();
        overrides[data['종_한글명']] = {
          '종류': data['종류'],
          '사육_요약': data['사육_요약'],
          '사진_URL': data['사진_URL'],
          '사육_난이도_5단계': data['사육_난이도_5단계'],
          '필요_공간': data['필요_공간'],
          '활동패턴': data['활동패턴'],
          '식성타입': data['식성타입'],
          '초기비용_등급_5단계': data['초기비용_등급_5단계']
        };
        saveOverrides(overrides);
      }

      closeModal();
      // 최신 상태로 다시 렌더
      const merged = applyDexOverrides(baseItems);
      renderGrid(merged);
      // 필터가 걸려있다면 재조회(검색 결과에 추가가 안 나올 수 있음)
      if ((lastFetch.q || '') !== '' || (lastFetch.difficulty || '') !== '') {
        refresh();
      }
    });
  }

  await refresh();
}

document.addEventListener('DOMContentLoaded', boot);


