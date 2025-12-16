# LizardMatch 프로젝트 재구축 PRD (Product Requirements Document)

## 1. 프로젝트 개요

### 1.1 목적
사용자의 설문 응답을 기반으로 파충류/양서류 종을 추천하는 웹 애플리케이션

### 1.2 기술 스택
- **백엔드**: Python Flask, Pandas, LightGBM (선택적)
- **프론트엔드**: HTML5, CSS3, JavaScript (Vanilla)
- **데이터**: CSV 파일 기반

---

## 2. 시스템 아키텍처

### 2.1 전체 구조
```
프로젝트 루트/
├── backend/
│   ├── app.py                    # Flask REST API 서버
│   ├── data_loader.py            # CSV/Excel 데이터 로더 및 검증
│   ├── recommendation_engine.py  # 추천 엔진 (규칙 기반 + ML 선택적)
│   ├── scoring_helpers.py        # 점수 계산 헬퍼 함수들
│   ├── file_utils.py             # 파일 경로 유틸리티
│   ├── feature_engineering.py   # ML 모델용 피처 생성
│   ├── ltr_model.py              # LightGBM Ranker 모델
│   ├── model_config.py           # ML 모델 설정
│   ├── train_model.py            # ML 모델 학습 스크립트
│   └── requirements.txt          # Python 의존성
├── frontend/
│   ├── index.html                # 페이지 1: 기본 분류 (Q1)
│   ├── survey_page2.html         # 페이지 2: 사육 조건 (Q2-Q7)
│   ├── survey_page3.html         # 페이지 3: 목적 및 취향 (Q8-Q10)
│   ├── survey_page4.html         # 페이지 4: 최종 제출
│   ├── results.html               # 결과 표시 페이지
│   ├── detail.html                # 종 상세 정보 페이지
│   ├── app.js                     # API 호출 및 결과 표시
│   ├── form_utils.js              # 폼 데이터 수집 유틸리티
│   ├── survey_navigation.js      # 페이지 네비게이션 및 데이터 저장
│   └── styles.css                 # 스타일시트
└── 도마뱀_cursor_ai_utf8_clean.csv  # 데이터 파일
```

---

## 3. 데이터 구조

### 3.1 CSV 파일 스키마

**필수 컬럼:**
- `종_한글명` (string): 종의 한글 이름
- `사육_난이도_5단계` (int, 1-5): 사육 난이도 등급
- `초기비용_등급_5단계` (int, 1-5): 초기 비용 등급
- `성체크기_등급_3단계` (int, 1-3): 성체 크기 등급
- `온도습도_5단계` (int, 1-5): 온도/습도 관리 난이도
- `활동패턴` (string): "야행성" 또는 "주행성"
- `식성타입` (string): "잡식", "초식", "육식"
- `먹이빈도_등급` (int, 1-5): 먹이 급여 빈도
- `핸들링적합도_5단계` (int, 1-5): 핸들링 적합도
- `사육장_사이즈_3단계` (int, 1-3): 사육장 크기 등급
- `외형태그` (string): 쉼표로 구분된 태그 (예: "귀엽고, 화려하다")
- `종류` (string): "도마뱀", "게코", "육지 거북", "수생 거북", "반수생 거북", "개구리", "도롱뇽", "카멜레온", "뱀"
- `관상용_애완용` (string): "관상용", "애완용", "둘 다"
- `사진_URL` (string): 이미지 URL (없으면 빈 문자열 "")

**선택적 컬럼:**
- `사진_페이지_URL` (string): 이미지 출처 페이지 URL

### 3.2 데이터 검증 규칙
1. 필수 컬럼 존재 여부 확인
2. 등급형 컬럼: 1~5 또는 1~3 범위 검증
3. 범주형 컬럼: 허용된 값 목록 검증
4. 허용되지 않은 `종류` 값이 있으면 해당 행 필터링 (경고만 표시)
5. `사진_URL`이 없으면 빈 문자열로 변환
6. 중복 제거: `종_한글명` 기준 (공백 제거 후 정규화)

---

## 4. 백엔드 API

### 4.1 엔드포인트

#### `GET /api/health`
헬스체크
```json
{
  "status": "ok",
  "server": "LizardMatch API",
  "data_loaded": true
}
```

#### `POST /api/recommend`
추천 요청
**Request:**
```json
{
  "preferences": {
    "종류": ["도마뱀", "게코"],
    "종류_가중치": {
      "도마뱀": 10,
      "게코": 15
    },
    "사육_난이도_5단계": 3,
    "초기비용_등급_5단계_max": 3,
    "사육장_사이즈_3단계_max": 2,
    "활동패턴": "주행성",
    "먹이빈도_등급_prefer": 2,
    "핸들링적합도_5단계_prefer": 4,
    "관상용_애완용": "애완용",
    "식성타입": "잡식",
    "외형태그": ["귀엽다", "화려하다"],
    "custom_weights": {
      "사육_난이도_5단계": 20,
      "초기비용_등급_5단계": 15,
      "사육장_사이즈_3단계": 10,
      "활동패턴": 10,
      "먹이빈도_등급": 10,
      "핸들링적합도_5단계": 10,
      "관상용_애완용": 10,
      "식성타입": 5,
      "외형태그": 5
    }
  },
  "options": {
    "top_n": 10,
    "include_reasons": true
  }
}
```

**Response:**
```json
{
  "request_id": "req_20241201_120000",
  "dataset_version": "도마뱀_cursor_ai_utf8_clean.csv@DATASET",
  "top_n": 10,
  "results": [
    {
      "종_한글명": "크레스티드 게코",
      "종류": "게코",
      "관상용_애완용": "애완용",
      "사진_URL": "https://...",
      "사진_페이지_URL": "https://...",
      "match_score": 85,
      "초기비용_등급_5단계": 1,
      "예상_월유지비_등급_5단계": 2,
      "사육_요약": "초보자에게 적합한 난이도입니다. 주행성으로 낮 시간 활동이 활발합니다.",
      "match_reasons": [
        "사육 난이도가 쉬움으로 선호하신 난이도와 일치합니다",
        "초기 비용이 예산 범위 내입니다"
      ],
      "question_contributions": {
        "사육_난이도": 20,
        "초기비용": 15,
        "종류": 10
      }
    }
  ],
  "scoring_policy_version": "v1.0"
}
```

#### `GET /api/species/<species_name>`
종 상세 정보 조회

#### `GET /api/metadata`
메타데이터 (허용된 값, 등급 범위 등)

#### `GET /api/dataset/info`
데이터셋 정보

---

## 5. 추천 알고리즘

### 5.1 점수 계산 방식

**기본 가중치 (WEIGHTS):**
```python
{
    '사육_난이도_5단계': 20,
    '초기비용_등급_5단계': 15,
    '온도습도_5단계': 10,
    '활동패턴': 10,
    '식성타입': 5,
    '먹이빈도_등급': 10,
    '핸들링적합도_5단계': 10,
    '사육장_사이즈_3단계': 10,
    '성체크기_등급_3단계': 5,
    '외형태그': 5
}
```

### 5.2 점수 계산 로직

#### 사육 난이도 (Q2)
- 사용자 선호 등급 이하: 점수 부여 (정확히 일치: 100%, 1단계 쉬움: 90%, 2단계 쉬움: 75%, 3단계 이상 쉬움: 60%)
- 사용자 선호 등급 초과: 감점 (1단계 어려움: 50%, 2단계 어려움: 25%)

#### 초기 비용 (Q3)
- 예산 범위 내: 100% 점수
- 예산 초과: 감점 (1단계 초과: 33%)

#### 사육장 크기 (Q4)
- 선호 크기 이하: 점수 부여
- 선호 크기 초과: 감점

#### 먹이 빈도 (Q6)
- 선호 빈도 이하 (덜 자주): 점수 부여
- 선호 빈도 초과: 감점

#### 핸들링 적합도 (Q7)
- 선호 등급 이상: 점수 부여
- 선호 등급 미만: 감점

#### 종류 (Q1)
- 하드 필터: 선택한 종류와 일치하지 않으면 점수 0
- 종류별 개별 가중치 지원

#### 외형태그 (Q10)
- 태그 정규화: "멋지다", "멋있고" → "멋있다"
- 선택한 태그와 일치하는 태그가 있으면 점수 부여

### 5.3 중요도 설정 (custom_weights)
- 사용자가 각 질문의 중요도를 0, 1, 5, 10, 15, 20 중에서 선택 가능
- 중요도가 0이면 해당 질문은 점수 계산에서 제외
- 기본 가중치를 사용자 정의 가중치로 대체

### 5.4 ML 모델 통합 (선택적)
- 환경 변수 `USE_ML_MODEL=true`로 활성화
- LightGBM Ranker (LambdaMART) 사용
- 규칙 기반 시스템과 ML 모델 중 선택 가능

---

## 6. 프론트엔드 구조

### 6.1 페이지 구성

#### 페이지 1: 기본 분류 (index.html)
- **Q1: 종류 선택**
  - 복수 선택 가능 (체크박스)
  - 선택 가능 종류: 도마뱀, 게코, 육지 거북, 수생 거북, 반수생 거북, 개구리, 도롱뇽, 카멜레온, 뱀
  - 각 종류별 개별 중요도 설정 (0, 1, 5, 10, 15, 20)
  - 종류 선택 시 해당 종류의 중요도 설정 표시

#### 페이지 2: 사육 조건 및 성향 (survey_page2.html)
- **Q2: 사육 난이도** (드롭다운, 1-5, "상관없음" 옵션)
- **Q3: 초기 비용** (드롭다운, 1-5, "상관없음" 옵션)
- **Q4: 사육장 크기** (드롭다운, 1-3, "상관없음" 옵션)
- **Q5: 활동 패턴** (드롭다운, "야행성"/"주행성", "상관없음" 옵션)
- **Q6: 먹이 급여 부담** (드롭다운, 1-5, "상관없음" 옵션)
- **Q7: 핸들링 적합도** (드롭다운, 1-5, "상관없음" 옵션)
- **각 질문별 중요도 설정** (체크박스, 0, 1, 5, 10, 15, 20)

#### 페이지 3: 목적 및 취향 (survey_page3.html)
- **Q8: 사육 목적** (드롭다운, "관상용"/"애완용"/"둘 다")
- **Q9: 식성 타입** (드롭다운, "잡식"/"초식"/"육식")
- **Q10: 외형 태그** (체크박스, "귀엽다"/"화려하다"/"멋있다", "상관없음" 옵션)
- **각 질문별 중요도 설정** (체크박스, 0, 1, 5, 10, 15, 20)

#### 페이지 4: 최종 제출 (survey_page4.html)
- 모든 중요도 설정 확인 및 최종 제출
- "상관없음" 선택한 질문의 중요도는 자동으로 0으로 설정

#### 결과 페이지 (results.html)
- 추천 결과 리스트 표시
- 각 결과 카드에 포함:
  - 종 이름, 종류, 사진
  - 매칭 점수 (0-100)
  - 초기 비용 (원화 범위)
  - 월 유지비 (원화 범위)
  - 추천 근거 (상위 2개)
  - 질문별 기여도 (상위 5개)
- "설문 다시하기" 버튼 (sessionStorage 초기화)

#### 상세 페이지 (detail.html)
- 종의 상세 정보 표시
- 모든 속성 값 표시
- "결과로 돌아가기" 버튼

### 6.2 데이터 흐름

1. **페이지 간 데이터 저장**
   - `survey_navigation.js`의 `saveCurrentPageData()` 함수로 각 페이지 데이터를 sessionStorage에 저장
   - 키 형식: `page1`, `page2`, `page3`, `page4`

2. **데이터 수집**
   - `form_utils.js`의 `collectFormData()` 함수로 모든 페이지 데이터를 수집
   - `preferences` 객체 생성 (백엔드 API 형식)

3. **API 호출**
   - `app.js`의 `handleFormSubmit()` 또는 `survey_navigation.js`의 `handleFinalSubmit()` 함수
   - `POST /api/recommend` 호출

4. **결과 표시**
   - 결과를 URL 파라미터 또는 sessionStorage로 전달
   - `results.html`에서 결과 표시

### 6.3 중요 기능

#### 중요도 체크박스
- 각 질문별로 하나만 선택 가능 (라디오 버튼처럼 동작)
- 기본값: Q2=20, Q3=15, Q4-Q8=10, Q9-Q10=5

#### "상관없음" 처리
- "상관없음" 선택 시 해당 질문의 중요도 자동으로 0으로 설정
- 점수 계산에서 제외

#### 설문 다시하기
- `results.html`에서 "설문 다시하기" 클릭 시:
  - sessionStorage의 모든 설문 데이터 삭제
  - `index.html?reset=true`로 이동
  - `survey_navigation.js`에서 `reset=true` 파라미터 확인 후 데이터 복원 건너뜀

---

## 7. 핵심 코드 구조

### 7.1 백엔드 핵심 파일

#### `backend/app.py`
- Flask 애플리케이션
- CORS 설정
- 데이터 초기화 (`init_data()`)
- API 엔드포인트 정의
- 입력 검증 (`validate_preferences()`)

#### `backend/data_loader.py`
- CSV/Excel 파일 로드
- 스키마 검증
- 중복 제거 (종_한글명 정규화)
- 허용되지 않은 값 필터링

#### `backend/recommendation_engine.py`
- `RecommendationEngine` 클래스
- 규칙 기반 추천 (`_recommend_rule_based()`)
- ML 모델 기반 추천 (`_recommend_ml()`, 선택적)
- 점수 계산 (`calculate_match_score()`)
- 월 유지비 등급 계산 (`calculate_monthly_cost_grade()`)
- 사육 요약 생성 (`generate_care_summary()`)

#### `backend/scoring_helpers.py`
- `ScoringContext` 클래스: 점수 계산 컨텍스트
- 각 질문별 점수 계산 함수:
  - `calculate_difficulty_score()`: 사육 난이도
  - `calculate_initial_cost_score()`: 초기 비용
  - `calculate_temperature_humidity_score()`: 온도/습도
  - `calculate_activity_pattern_score()`: 활동 패턴
  - `calculate_diet_type_score()`: 식성 타입
  - `calculate_feeding_frequency_score()`: 먹이 빈도
  - `calculate_handling_score()`: 핸들링 적합도
  - `calculate_enclosure_size_score()`: 사육장 크기
  - `calculate_adult_size_score()`: 성체 크기
  - `calculate_appearance_tags_score()`: 외형 태그
  - `calculate_species_type_score()`: 종류 (하드 필터)
  - `calculate_purpose_score()`: 사육 목적

#### `backend/file_utils.py`
- `find_data_file()`: 데이터 파일 우선순위에 따라 찾기

### 7.2 프론트엔드 핵심 파일

#### `frontend/form_utils.js`
- `collectFormData(formData)`: 폼 데이터를 백엔드 형식으로 변환
- `resetFormToDefaults()`: 폼 초기화

#### `frontend/survey_navigation.js`
- `getCurrentPage()`: 현재 페이지 번호 확인
- `updateProgressIndicator()`: 진행 상태 표시 업데이트
- `saveCurrentPageData()`: 현재 페이지 데이터를 sessionStorage에 저장
- `restoreCurrentPageData()`: 저장된 데이터 복원
- `goToNextPage()`: 다음 페이지로 이동
- `goToPreviousPage()`: 이전 페이지로 이동
- `collectAllPageData()`: 모든 페이지 데이터 수집
- `handleFinalSubmit()`: 최종 제출 처리

#### `frontend/app.js`
- `getApiBaseUrl()`: API 기본 URL 자동 감지
- `handleFormSubmit()`: 폼 제출 처리 (단일 페이지용)
- `displayResults()`: 결과 표시
- `convertWikipediaImageUrl()`: Wikipedia URL을 직접 이미지 URL로 변환
- `handleImageError()`: 이미지 로드 실패 처리

---

## 8. 실행 방법

### 8.1 백엔드 실행
```bash
cd backend
pip install -r requirements.txt
python app.py
```

### 8.2 프론트엔드 실행
```bash
cd frontend
python -m http.server 8000
# 또는
start_frontend.bat (Windows)
```

### 8.3 ML 모델 사용 (선택적)
```bash
# 환경 변수 설정
export USE_ML_MODEL=true  # Linux/Mac
set USE_ML_MODEL=true     # Windows

# 모델 학습 (선택적)
python backend/train_model.py
```

---

## 9. 주요 알고리즘 및 로직

### 9.1 중복 제거 알고리즘
```python
# 종_한글명 정규화: 모든 공백 제거
normalized_name = species_name.strip().replace(' ', '').replace('\t', '').replace('\n', '')
# 정규화된 이름으로 중복 제거
```

### 9.2 점수 계산 알고리즘
1. 종류 필터 (하드 필터): 선택한 종류와 일치하지 않으면 점수 0
2. 각 질문별 점수 계산 (가중치 적용)
3. 점수를 0~100으로 클리핑
4. 점수 순으로 정렬

### 9.3 월 유지비 계산
```python
cost_score = 0.4 * 먹이빈도 + 0.4 * 온도습도 + 0.2 * (성체크기 * 1.7)
grade = max(1, min(5, int(round(cost_score))))
```

### 9.4 외형태그 정규화
- "멋지다", "멋있고" → "멋있다"
- 쉼표로 구분된 태그 파싱

---

## 10. 환경 변수 및 설정

### 10.1 백엔드 환경 변수
- `USE_ML_MODEL`: ML 모델 사용 여부 (기본값: false)
- `FLASK_HOST`: 서버 호스트 (기본값: 0.0.0.0)
- `FLASK_PORT`: 서버 포트 (기본값: 5000)
- `FLASK_DEBUG`: 디버그 모드 (기본값: True)
- `CORS_ORIGINS`: CORS 허용 도메인 (기본값: *)

---

## 11. 데이터 파일 우선순위

1. `도마뱀_cursor_ai_utf8_clean.csv` (최우선)
2. `도마뱀_정리_cursor_ai_clean_v3_images_links_direct_image.csv`
3. `도마뱀_정리_cursor_ai_clean_v3_images (1)_links_updated_filled_merged_photo_url.csv`
4. `도마뱀_정리_cursor_ai_clean_v3_images (1).csv`
5. `도마뱀_정리_cursor_ai_clean.csv`
6. `도마뱀_정리_cursor_ai_clean.xlsx`

---

## 12. 에러 처리

### 12.1 백엔드 에러 응답 형식
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지",
    "details": ["상세 에러 1", "상세 에러 2"]
  }
}
```

### 12.2 주요 에러 코드
- `DATASET_NOT_LOADED`: 데이터셋이 로드되지 않음
- `INVALID_INPUT`: 입력 값이 유효하지 않음
- `SPECIES_NOT_FOUND`: 종을 찾을 수 없음
- `INTERNAL_ERROR`: 내부 서버 오류

---

## 13. 테스트 및 검증

### 13.1 데이터 검증
- 필수 컬럼 존재 여부
- 등급 범위 검증 (1-5, 1-3)
- 허용된 값 검증
- 중복 제거 확인

### 13.2 API 검증
- 입력 값 검증
- 에러 응답 형식 확인
- 결과 형식 확인

---

## 14. 향후 개선 사항

1. ML 모델 성능 향상
2. 더 많은 종 데이터 추가
3. 사용자 피드백 수집 및 학습
4. 모바일 반응형 디자인 개선
5. 다국어 지원

---

## 15. 참고 사항

- 모든 질문은 선택 기반 (드롭다운, 체크박스)
- 자유 텍스트 입력 없음
- 중요도는 0, 1, 5, 10, 15, 20 중 선택
- "상관없음" 선택 시 중요도 자동 0 설정
- 종류는 복수 선택 가능하며 각각 개별 중요도 설정 가능

