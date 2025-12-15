/**API 호출 및 결과 표시*/

const RENDER_API_BASE_URL = 'https://rizardmathch-4.onrender.com';

function getApiBaseUrl() {
    // 배포된 백엔드 주소
    const PROD_API_BASE = 'https://rizardmathch-4.onrender.com';

    const hostname = window.location.hostname;
    const protocol = window.location.protocol;

    // 로컬 개발 시에는 localhost 사용
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://localhost:5000';
    }

    // 배포된 홈페이지(깃허브 페이지, Netlify 등)에서는 항상 Render 백엔드 사용
    return PROD_API_BASE;
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

function displayResults(results) {
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
    
    let html = '<div class="results-header">';
    html += `<h2>추천 결과 (${results.results.length}개)</h2>`;
    html += '</div>';
    
    html += '<div class="results-grid">';
    
    results.results.forEach((result, index) => {
        html += '<div class="result-card">';
        html += `<div class="result-rank">${index + 1}</div>`;

        // 이미지
        if (result.사진_URL) {
            const imageUrl = convertWikipediaImageUrl(result.사진_URL);
            html += `<img src="${imageUrl}" alt="${result.종_한글명}" onerror="handleImageError(this)" class="result-image">`;
        } else {
            html += '<div class="result-image-placeholder">이미지 없음</div>';
        }
        
        // 종 정보
        html += '<div class="result-info">';
        html += `<h3><a href="detail.html?species=${encodeURIComponent(result.종_한글명)}">${result.종_한글명}</a></h3>`;
        html += `<p class="result-type">${result.종류 || '-'}</p>`;
        html += `<p class="result-score">매칭 점수: <strong>${result.match_score}</strong>점</p>`;
        
        // 비용 정보
        html += '<div class="result-costs">';
        html += `<p>초기 비용: <strong>${formatCurrency(result.초기비용_등급_5단계)}</strong></p>`;
        html += '</div>';
        
        // 사육 요약
        if (result.사육_요약) {
            html += `<p class="result-summary">${result.사육_요약}</p>`;
        }
        
        // 추천 근거
        if (result.match_reasons && result.match_reasons.length > 0) {
            html += '<div class="result-reasons">';
            html += '<h4>추천 근거</h4>';
            html += '<ul>';
            result.match_reasons.forEach(reason => {
                html += `<li>${reason}</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }
        
        // 질문별 기여도
        if (result.question_contributions) {
            html += '<div class="result-contributions">';
            html += '<h4>질문별 기여도</h4>';
            html += '<ul>';
            Object.entries(result.question_contributions).forEach(([question, contribution]) => {
                html += `<li>${question}: ${contribution.toFixed(1)}점</li>`;
            });
            html += '</ul>';
            html += '</div>';
        }

        // 세부 정보 보기 버튼
        html += '<div class="result-actions">';
        html += `<a href="detail.html?species=${encodeURIComponent(result.종_한글명)}" class="btn btn-secondary btn-detail">세부 정보 보기</a>`;
        html += '</div>';

        html += '</div>'; // result-info
        html += '</div>'; // result-card
    });
    
    html += '</div>'; // results-grid
    
    resultsContent.innerHTML = html;
}

// 전역 함수로 export (HTML에서 직접 호출 가능하도록)
window.getApiBaseUrl = getApiBaseUrl;
window.convertWikipediaImageUrl = convertWikipediaImageUrl;
window.handleImageError = handleImageError;
window.displayResults = displayResults;

