/**페이지 네비게이션 및 데이터 저장*/

const SURVEY_PAGE_KEYS = ['page1', 'page2', 'page3', 'page4'];

function clearSurveySessionData() {
    /**설문 응답/진행 플래그 초기화 (추천 결과는 유지 가능)*/
    SURVEY_PAGE_KEYS.forEach(k => sessionStorage.removeItem(k));
    sessionStorage.removeItem('surveyInProgress');
}

function initSurveySessionIfNeeded() {
    /**설문 첫 진입 시 이전 답변이 남아있지 않도록 초기화*/
    const form = document.getElementById('surveyForm');
    if (!form) return;

    const currentPage = getCurrentPage();
    if (currentPage !== 1) {
        // 중간 페이지는 기존 흐름(복원) 유지
        sessionStorage.setItem('surveyInProgress', 'true');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const forcedReset = urlParams.get('reset') === 'true';
    const inProgress = sessionStorage.getItem('surveyInProgress') === 'true';

    // 1페이지에 새로 들어온 경우(진행중 플래그가 없거나, reset=true면) 이전 응답 제거
    if (forcedReset || !inProgress) {
        clearSurveySessionData();
        sessionStorage.setItem('surveyInProgress', 'true');
    }
}

function getCurrentPage() {
    /**현재 페이지 번호 확인*/
    const path = window.location.pathname;
    if (path.includes('survey_page1.html')) {
        return 1;
    } else if (path.includes('survey_page2.html')) {
        return 2;
    } else if (path.includes('survey_page3.html')) {
        return 3;
    } else if (path.includes('survey_page4.html')) {
        return 4;
    }
    return 1;
}

function updateProgressIndicator() {
    /**진행 상태 표시 업데이트*/
    const currentPage = getCurrentPage();
    const progressText = document.querySelector('.progress-text');
    const progressPercent = document.querySelector('.progress-percent');
    const progressFill = document.querySelector('.progress-fill');
    const totalPages = 4;
    const pct = Math.round((currentPage / totalPages) * 100);
    
    if (progressText) {
        progressText.textContent = `질문 ${currentPage} / ${totalPages}`;
    }
    if (progressPercent) {
        progressPercent.textContent = `${pct}%`;
    }
    if (progressFill) {
        progressFill.style.width = `${pct}%`;
    }
}

function saveCurrentPageData() {
    /**현재 페이지 데이터를 sessionStorage에 저장*/
    const currentPage = getCurrentPage();
    const form = document.getElementById('surveyForm');
    
    if (!form) {
        return;
    }
    
    // 설문 진행 플래그
    sessionStorage.setItem('surveyInProgress', 'true');
    
    const formData = new FormData(form);
    const data = {};
    
    // FormData를 객체로 변환
    for (const [key, value] of formData.entries()) {
        if (data[key]) {
            // 이미 값이 있으면 배열로 변환
            if (Array.isArray(data[key])) {
                data[key].push(value);
            } else {
                data[key] = [data[key], value];
            }
        } else {
            data[key] = value;
        }
    }
    
    // 체크박스 처리 (외형태그, 종류)
    const checkboxes = form.querySelectorAll('input[type="checkbox"]:checked');
    checkboxes.forEach(cb => {
        const name = cb.name;
        if (name === '종류' || name === '외형태그') {
            if (!data[name]) {
                data[name] = [];
            }
            if (!Array.isArray(data[name])) {
                data[name] = [data[name]];
            }
            if (!data[name].includes(cb.value)) {
                data[name].push(cb.value);
            }
        }
    });
    
    // sessionStorage에 저장
    sessionStorage.setItem(`page${currentPage}`, JSON.stringify(data));
}

function restoreCurrentPageData() {
    /**저장된 데이터 복원*/
    // reset 파라미터 확인
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('reset') === 'true') {
        // reset=true인 경우 복원하지 않음
        return;
    }
    
    const currentPage = getCurrentPage();
    const form = document.getElementById('surveyForm');
    
    if (!form) {
        return;
    }
    
    const savedData = sessionStorage.getItem(`page${currentPage}`);
    if (!savedData) {
        return;
    }
    
    try {
        const data = JSON.parse(savedData);
        
        // 각 필드 복원
        Object.keys(data).forEach(key => {
            const value = data[key];
            
            if (Array.isArray(value)) {
                // 배열인 경우 (체크박스)
                value.forEach(v => {
                    const element = form.querySelector(`[name="${key}"][value="${v}"]`);
                    if (element) {
                        element.checked = true;
                    }
                });
            } else {
                // 단일 값인 경우
                const element = form.querySelector(`[name="${key}"]`);
                if (element) {
                    if (element.type === 'radio') {
                        const radio = form.querySelector(`[name="${key}"][value="${value}"]`);
                        if (radio) {
                            radio.checked = true;
                        }
                    } else if (element.type === 'checkbox') {
                        element.checked = true;
                    } else {
                        element.value = value;
                    }
                }
            }
        });
        
        // 종류 선택 시 중요도 설정 업데이트 (survey_page1.html)
        if (currentPage === 1) {
            const event = new Event('change');
            const speciesCheckboxes = form.querySelectorAll('input[name="종류"]');
            speciesCheckboxes.forEach(cb => {
                if (cb.checked) {
                    cb.dispatchEvent(event);
                }
            });
        }
    } catch (e) {
        console.error('데이터 복원 오류:', e);
    }
}

function goToNextPage() {
    /**다음 페이지로 이동*/
    const currentPage = getCurrentPage();
    const nextPage = currentPage + 1;
    
    if (nextPage === 1) {
        window.location.href = 'survey_page1.html';
    } else if (nextPage === 2) {
        window.location.href = 'survey_page2.html';
    } else if (nextPage === 3) {
        window.location.href = 'survey_page3.html';
    } else if (nextPage === 4) {
        window.location.href = 'survey_page4.html';
    }
}

function goToPreviousPage() {
    /**이전 페이지로 이동*/
    const currentPage = getCurrentPage();
    const prevPage = currentPage - 1;
    
    if (prevPage === 1) {
        window.location.href = 'survey_page1.html';
    } else if (prevPage === 2) {
        window.location.href = 'survey_page2.html';
    } else if (prevPage === 3) {
        window.location.href = 'survey_page3.html';
    }
}

function collectAllPageData() {
    /**모든 페이지 데이터 수집*/
    const allData = {
        page1: null,
        page2: null,
        page3: null,
        page4: null
    };
    
    // sessionStorage에서 각 페이지 데이터 가져오기
    for (let i = 1; i <= 4; i++) {
        const dataStr = sessionStorage.getItem(`page${i}`);
        if (dataStr) {
            try {
                allData[`page${i}`] = JSON.parse(dataStr);
            } catch (e) {
                console.error(`페이지 ${i} 데이터 파싱 오류:`, e);
            }
        }
    }
    
    // 모든 페이지 데이터를 하나의 FormData로 합치기
    const combinedData = {};
    Object.values(allData).forEach(pageData => {
        if (pageData) {
            Object.assign(combinedData, pageData);
        }
    });
    
    // form_utils.js의 collectFormData 사용
    const preferences = collectFormData(combinedData);
    
    return {
        preferences: preferences,
        rawData: allData
    };
}

async function handleFinalSubmit() {
    /**최종 제출 처리*/
    const submitBtn = document.getElementById('submitBtn');
    const analysisOverlay = document.getElementById('analysisOverlay');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '처리 중...';
    }
    
    if (analysisOverlay) analysisOverlay.style.display = 'block';
    
    try {
        // 모든 페이지 데이터 수집
        const allData = collectAllPageData();
        
        // API 호출
        const apiBaseUrl = (typeof getApiBaseUrl === 'function') ? getApiBaseUrl() : 'http://localhost:5000';
        const response = await fetch(`${apiBaseUrl}/api/recommend`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                preferences: allData.preferences,
                options: {
                    top_n: 10,
                    include_reasons: true
                }
            })
        });
        
        if (!response.ok) {
            const text = await response.text();
            console.error('API 오류 응답:', response.status, text);
            throw new Error(`서버 오류 (${response.status})`);
        }
        
        const results = await response.json();
        
        // 결과를 sessionStorage에 저장
        sessionStorage.setItem('recommendationResults', JSON.stringify(results));

        // 설문 응답은 정리해서, 다시 설문 진입 시 이전 답이 남지 않게 함
        clearSurveySessionData();
        
        // 결과 페이지로 이동 (URL에 긴 쿼리스트링을 넣지 않기 위해 sessionStorage만 사용)
        window.location.href = 'results.html';
    } catch (e) {
        console.error('제출 오류:', e);
        alert('오류가 발생했습니다: ' + e.message);
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '추천 받기';
        }
        if (analysisOverlay) analysisOverlay.style.display = 'none';
    }
}

// 페이지 로드 시 진행 상태 업데이트
document.addEventListener('DOMContentLoaded', () => {
    initSurveySessionIfNeeded();
    updateProgressIndicator();
});

