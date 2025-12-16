/**폼 데이터 수집 유틸리티*/

function collectFormData(formData) {
    /**
     * 폼 데이터를 백엔드 형식으로 변환
     * 
     * @param {FormData|Object} formData - 폼 데이터 또는 객체
     * @returns {Object} 백엔드 형식의 preferences 객체
     */
    const preferences = {};
    const custom_weights = {};
    
    // Q1: 종류 및 종류별 가중치
    const speciesTypes = [];
    const speciesWeights = {};
    
    if (formData instanceof FormData) {
        // FormData인 경우
        for (const [key, value] of formData.entries()) {
            if (key === '종류') {
                speciesTypes.push(value);
            } else if (key.startsWith('종류_가중치_')) {
                const speciesType = key.replace('종류_가중치_', '');
                speciesWeights[speciesType] = parseInt(value) || 10;
            }
        }
    } else {
        // 객체인 경우
        if (formData.종류) {
            if (Array.isArray(formData.종류)) {
                speciesTypes.push(...formData.종류);
            } else {
                speciesTypes.push(formData.종류);
            }
        }
        
        // 종류별 가중치
        Object.keys(formData).forEach(key => {
            if (key.startsWith('종류_가중치_')) {
                const speciesType = key.replace('종류_가중치_', '');
                speciesWeights[speciesType] = parseInt(formData[key]) || 10;
            }
        });
    }
    
    preferences.종류 = speciesTypes;
    if (Object.keys(speciesWeights).length > 0) {
        preferences.종류_가중치 = speciesWeights;
    }
    
    // Q2-Q10: 각 질문 값 및 중요도
    const questionMappings = {
        '사육_난이도_5단계': { valueKey: '사육_난이도_5단계', weightKey: '사육_난이도_5단계_중요도', defaultWeight: 20 },
        '초기비용_등급_5단계_max': { valueKey: '초기비용_등급_5단계_max', weightKey: '초기비용_등급_5단계_중요도', defaultWeight: 15 },
        '사육장_사이즈_3단계_max': { valueKey: '사육장_사이즈_3단계_max', weightKey: '사육장_사이즈_3단계_중요도', defaultWeight: 10 },
        '활동패턴': { valueKey: '활동패턴', weightKey: '활동패턴_중요도', defaultWeight: 10 },
        '먹이빈도_등급_prefer': { valueKey: '먹이빈도_등급_prefer', weightKey: '먹이빈도_등급_중요도', defaultWeight: 10 },
        '핸들링적합도_5단계_prefer': { valueKey: '핸들링적합도_5단계_prefer', weightKey: '핸들링적합도_5단계_중요도', defaultWeight: 10 },
        '관상용_애완용': { valueKey: '관상용_애완용', weightKey: '관상용_애완용_중요도', defaultWeight: 10 },
        '식성타입': { valueKey: '식성타입', weightKey: '식성타입_중요도', defaultWeight: 5 },
        '외형태그': { valueKey: '외형태그', weightKey: '외형태그_중요도', defaultWeight: 5 }
    };
    
    Object.keys(questionMappings).forEach(key => {
        const mapping = questionMappings[key];
        let value = null;
        let weight = mapping.defaultWeight;
        
        if (formData instanceof FormData) {
            value = formData.get(mapping.valueKey);
            const weightValue = formData.get(mapping.weightKey);
            if (weightValue !== null) {
                weight = parseInt(weightValue) || 0;
            }
        } else {
            value = formData[mapping.valueKey];
            const weightValue = formData[mapping.weightKey];
            if (weightValue !== undefined && weightValue !== null) {
                weight = parseInt(weightValue) || 0;
            }
        }
        
        // "상관없음" 선택 시 중요도 0으로 설정
        if (value === '' || value === null || value === undefined) {
            weight = 0;
        } else {
            // 값이 있는 경우에만 preferences에 추가
            if (key === '외형태그') {
                // 체크박스는 배열로 처리
                if (formData instanceof FormData) {
                    const tags = formData.getAll(mapping.valueKey);
                    if (tags.length > 0) {
                        preferences[key] = tags;
                        custom_weights[key] = weight;
                    }
                } else {
                    if (Array.isArray(value)) {
                        preferences[key] = value;
                        custom_weights[key] = weight;
                    } else if (value) {
                        preferences[key] = [value];
                        custom_weights[key] = weight;
                    }
                }
            } else {
                // 숫자 값은 정수로 변환
                if (key.includes('등급') || key.includes('단계')) {
                    preferences[key] = parseInt(value);
                } else {
                    preferences[key] = value;
                }
                custom_weights[key] = weight;
            }
        }
    });
    
    // custom_weights 추가
    preferences.custom_weights = custom_weights;
    
    return preferences;
}

function resetFormToDefaults() {
    /**폼 초기화*/
    // sessionStorage 초기화
    sessionStorage.clear();
    // index.html로 이동
    window.location.href = 'index.html?reset=true';
}

