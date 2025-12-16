/**API 호출 및 결과 표시*/

const RENDER_API_BASE_URL = 'https://rizardmathch-4.onrender.com';

function getApiBaseUrl() {
  // 1) 로컬 개발 환경이면 localhost 사용
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }

  // 2) 그 외(깃허브 페이지 포함)는 항상 Render 백엔드 사용
  return RENDER_API_BASE_URL;
}


function convertWikipediaImageUrl(url) {
    /**
     * Wikipedia URL을 직접 이미지 URL로 변환
     * 
     * @param {string} url - Wikipedia URL
     * @returns {string} 직접 이미지 URL
     */
    if (!url) {
        return '';
    }
    
    // 이미 직접 이미지 URL인 경우
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        return url;
    }
    
    // Wikipedia Special:FilePath URL 변환
    if (url.includes('Special:FilePath')) {
        // https://commons.wikimedia.org/wiki/Special:FilePath/Image.jpg
        // -> https://commons.wikimedia.org/wiki/File:Image.jpg
        // -> https://upload.wikimedia.org/wikipedia/commons/thumb/.../Image.jpg
        const match = url.match(/Special:FilePath\/(.+)$/);
        if (match) {
            const filename = match[1];
            // 간단한 변환: 직접 파일명 사용
            return `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}`;
        }
    }
    
    return url;
}

function handleImageError(img) {
    /**
     * 이미지 로드 실패 처리
     * 
     * @param {HTMLImageElement} img - 이미지 요소
     */
    img.onerror = null; // 무한 루프 방지
    img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3E이미지 없음%3C/text%3E%3C/svg%3E';
}

function formatCurrency(grade) {
    /**
     * 등급을 원화 범위로 변환
     * 
     * @param {number} grade - 등급 (1-5)
     * @returns {string} 원화 범위 문자열
     */
    const ranges = {
        1: '10만원 이하',
        2: '10만원 ~ 30만원',
        3: '30만원 ~ 50만원',
        4: '50만원 ~ 100만원',
        5: '100만원 이상'
    };
    return ranges[grade] || '-';
}

function formatEnclosure(sizeGrade) {
    const g = Number(sizeGrade);
    const map = {
        1: '가로 ≤45cm · 깊이 ≤30cm · 높이 ≈30cm',
        2: '가로 45~60cm · 깊이 30~45cm · 높이 45~60cm',
        3: '가로 ≥60cm(90/120cm) · 깊이 ≥45cm · 높이 ≥60cm'
    };
    return map[g] || '-';
}

function formatActivityPattern(value) {
    const v = (value || '').toString().trim();
    if (v.includes('야행성')) return '야행성';
    if (v.includes('주행성')) return '주행성';
    return '-';
}

function renderStars(level) {
    const n = Math.max(0, Math.min(5, Number(level || 0)));
    let html = '<span class="stars" aria-label="난이도">';
    for (let i = 1; i <= 5; i++) {
        html += i <= n
            ? '<i class="ph-fill ph-star" aria-hidden="true"></i>'
            : '<i class="ph ph-star" aria-hidden="true"></i>';
    }
    html += '</span>';
    return html;
}

const _speciesCache = new Map();

async function fetchSpeciesDetails(speciesName) {
    if (!speciesName) return null;
    if (_speciesCache.has(speciesName)) return _speciesCache.get(speciesName);

    const apiBaseUrl = (typeof getApiBaseUrl === 'function') ? getApiBaseUrl() : 'http://localhost:5000';
    const p = fetch(`${apiBaseUrl}/api/species/${encodeURIComponent(speciesName)}`)
        .then(async (res) => {
            if (!res.ok) return null;
            return await res.json();
        })
        .catch(() => null);

    _speciesCache.set(speciesName, p);
    return p;
}

async function enrichResultIfNeeded(result) {
    const needs =
        result &&
        (result.사육_난이도_5단계 == null ||
            result.사육장_사이즈_3단계 == null ||
            result.활동패턴 == null ||
            result.활동패턴 === '');
    if (!needs) return result;

    const details = await fetchSpeciesDetails(result.종_한글명);
    if (!details) return result;
    return { ...details, ...result };
}

async function displayResults(results) {
    /**
     * 결과 표시
     * 
     * @param {Object} results - API 응답 결과
     */
    const resultsContent = document.getElementById('resultsContent');
    const loadingMessage = document.getElementById('loadingMessage');
    const errorMessage = document.getElementById('errorMessage');
    
    if (loadingMessage) {
        loadingMessage.style.display = 'none';
    }
    
    if (!results || !results.results || results.results.length === 0) {
        if (errorMessage) {
            errorMessage.textContent = '추천 결과가 없습니다.';
            errorMessage.style.display = 'block';
        }
        return;
    }
    
    const enriched = await Promise.all(results.results.slice(0, 7).map(enrichResultIfNeeded));
    const mergedResults = [
        ...enriched,
        ...results.results.slice(7)
    ];

    const best = mergedResults[0];
    const bestPct = Math.max(0, Math.min(100, Math.round(Number(best.match_score || 0))));
    const bestImg = best.사진_URL ? convertWikipediaImageUrl(best.사진_URL) : '';
    const bestActivity = formatActivityPattern(best.활동패턴);
    const bestEnclosure = formatEnclosure(best.사육장_사이즈_3단계);
    const bestCost = best.초기비용_등급_5단계 ? `Lv.${best.초기비용_등급_5단계}` : '-';
    const bestDifficulty = best.사육_난이도_5단계 ? `Lv.${best.사육_난이도_5단계}` : '';

    let html = '';
    html += '<div class="results-hero-head">';
    html += '<span class="results-pill">최고의 매칭 결과</span>';
    html += '<h2 class="results-title">당신을 위한 <span class="results-title-accent">완벽한 파트너</span></h2>';
    html += '</div>';

    html += '<section class="best-card">';
    html += '<div class="best-image">';
    if (bestImg) {
        html += `<img src="${bestImg}" alt="${best.종_한글명}" onerror="handleImageError(this)" class="best-photo">`;
    } else {
        html += '<div class="best-photo placeholder">이미지 없음</div>';
    }
    html += `<span class="best-badge">${bestPct}% 일치</span>`;
    html += '</div>';

    html += '<div class="best-info">';
    html += '<div class="best-meta">';
    html += `<span class="best-type">${best.종류 || '-'}</span>`;
    if (bestActivity && bestActivity !== '-') html += `<span class="best-chip">${bestActivity}</span>`;
    html += '</div>';
    html += `<h3 class="best-name">${best.종_한글명 || '-'}</h3>`;
    html += '<div class="best-rating">';
    if (best.사육_난이도_5단계) html += `난이도: ${renderStars(best.사육_난이도_5단계)} <span class="best-lv">(Lv.${best.사육_난이도_5단계})</span>`;
    html += '</div>';
    if (best.사육_요약) {
        html += `<p class="best-desc">${best.사육_요약}</p>`;
    }

    html += '<div class="best-stats">';
    html += '<div class="stat"><i class="ph ph-ruler" aria-hidden="true"></i><div><div class="stat-label">필요 공간</div><div class="stat-value">'+bestEnclosure+'</div></div></div>';
    html += '<div class="stat"><i class="ph ph-moon-stars" aria-hidden="true"></i><div><div class="stat-label">활동 시간</div><div class="stat-value">'+bestActivity+'</div></div></div>';
    html += '<div class="stat"><i class="ph ph-heartbeat" aria-hidden="true"></i><div><div class="stat-label">매칭 점수</div><div class="stat-value">'+bestPct+'/100</div></div></div>';
    html += '<div class="stat"><i class="ph ph-currency-dollar" aria-hidden="true"></i><div><div class="stat-label">초기 비용</div><div class="stat-value">'+bestCost+(bestDifficulty ? ` · ${bestDifficulty}` : '')+'</div></div></div>';
    html += '</div>';

    html += `<a href="detail.html?species=${encodeURIComponent(best.종_한글명)}" class="best-cta">사육 정보 더보기</a>`;
    html += '</div>';
    html += '</section>';

    // 다른 추천 친구들
    const others = mergedResults.slice(1, 7);
    if (others.length > 0) {
        html += '<section class="others">';
        html += '<h3 class="others-title">다른 추천 친구들</h3>';
        html += '<div class="others-grid">';
        others.forEach(r => {
            const pct = Math.max(0, Math.min(100, Math.round(Number(r.match_score || 0))));
            const img = r.사진_URL ? convertWikipediaImageUrl(r.사진_URL) : '';
            const activity = formatActivityPattern(r.활동패턴);
            html += '<div class="other-card">';
            html += `<div class="other-top"><div class="other-name">${r.종_한글명 || '-'}</div><span class="other-badge">${pct}%</span></div>`;
            if (activity !== '-') html += `<div class="other-meta">${activity}</div>`;
            if (r.사육_난이도_5단계) {
                html += `<div class="other-stars">${renderStars(r.사육_난이도_5단계)}</div>`;
            }
            html += '<div class="other-image">';
            if (img) html += `<img src="${img}" alt="${r.종_한글명}" onerror="handleImageError(this)">`;
            else html += '<div class="placeholder">이미지 없음</div>';
            html += '</div>';
            if (r.사육_요약) html += `<p class="other-desc">${r.사육_요약}</p>`;
            html += `<a class="other-btn" href="detail.html?species=${encodeURIComponent(r.종_한글명)}">상세 보기</a>`;
            html += '</div>';
        });
        html += '</div></section>';
    }

    resultsContent.innerHTML = html;
}

// 전역 함수로 export (HTML에서 직접 호출 가능하도록)
window.getApiBaseUrl = getApiBaseUrl;
window.convertWikipediaImageUrl = convertWikipediaImageUrl;
window.handleImageError = handleImageError;
window.displayResults = displayResults;

