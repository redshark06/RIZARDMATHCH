/**페이지 네비게이션 및 데이터 저장*/

function getCurrentPage() {
    /**현재 페이지 번호 확인*/
    const path = window.location.pathname;
    if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
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
    const progressFill = document.querySelector('.progress-fill');
    
    if (progressText) {
        progressText.textContent = `${currentPage} / 4`;
    }
    if (progressFill) {
        progressFill.style.width = `${(currentPage / 4) * 100}%`;
    }
}

function saveCurrentPageData() {
    /**현재 페이지 데이터를 sessionStorage에 저장*/
    const currentPage = getCurrentPage();
    const form = document.getElementById('surveyForm');
    
    if (!form) {
        return;
    }
    
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
        
        // 종류 선택 시 중요도 설정 업데이트 (index.html)
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
    
    if (nextPage === 2) {
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
        window.location.href = 'index.html';
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
    const loadingMessage = document.getElementById('loadingMessage');
    
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '처리 중...';
    }
    
    if (loadingMessage) {
        loadingMessage.style.display = 'block';
    }
    
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
            const errorData = await response.json();
            throw new Error(errorData.error?.message || '서버 오류가 발생했습니다');
        }
        
        const results = await response.json();
        
        // 결과를 sessionStorage에 저장
        sessionStorage.setItem('recommendationResults', JSON.stringify(results));
        
        // results.html로 이동
        const resultsJson = encodeURIComponent(JSON.stringify(results));
        window.location.href = `results.html?results=${resultsJson}`;
    } catch (e) {
        console.error('제출 오류:', e);
        alert('오류가 발생했습니다: ' + e.message);
        
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '추천 받기';
        }
        if (loadingMessage) {
            loadingMessage.style.display = 'none';
        }
    }
}

// 페이지 로드 시 진행 상태 업데이트
document.addEventListener('DOMContentLoaded', () => {
    updateProgressIndicator();
});

