# LizardMatch 프로젝트 재구축 프롬프트

다음 PRD 문서를 기반으로 LizardMatch 프로젝트를 처음부터 구현하세요.

## 프로젝트 개요
사용자의 설문 응답을 기반으로 파충류/양서류 종을 추천하는 웹 애플리케이션입니다.

## 기술 스택
- **백엔드**: Python Flask, Pandas, LightGBM (선택적)
- **프론트엔드**: HTML5, CSS3, JavaScript (Vanilla)
- **데이터**: CSV 파일 기반

## 필수 구현 사항

### 1. 백엔드 (Python Flask)

#### 1.1 파일 구조
```
backend/
├── app.py                    # Flask REST API 서버
├── data_loader.py            # CSV 데이터 로더 및 검증
├── recommendation_engine.py  # 추천 엔진
├── scoring_helpers.py        # 점수 계산 헬퍼 함수들
├── file_utils.py             # 파일 경로 유틸리티
├── feature_engineering.py   # ML 모델용 피처 생성 (선택적)
├── ltr_model.py              # LightGBM Ranker 모델 (선택적)
├── model_config.py           # ML 모델 설정 (선택적)
├── train_model.py            # ML 모델 학습 스크립트 (선택적)
└── requirements.txt          # Python 의존성
```

#### 1.2 핵심 기능

**`data_loader.py`:**
- CSV 파일 로드 (UTF-8 인코딩)
- 필수 컬럼 검증: 종_한글명, 사육_난이도_5단계, 초기비용_등급_5단계, 성체크기_등급_3단계, 온도습도_5단계, 활동패턴, 식성타입, 먹이빈도_등급, 핸들링적합도_5단계, 사육장_사이즈_3단계, 외형태그, 종류, 관상용_애완용, 사진_URL
- 등급형 컬럼 범위 검증 (1-5 또는 1-3)
- 범주형 컬럼 허용 값 검증
- 허용되지 않은 `종류` 값 필터링 (경고만 표시)
- 중복 제거: `종_한글명` 정규화 (모든 공백 제거) 후 중복 제거
- `사진_URL` 결측치를 빈 문자열로 변환

**`recommendation_engine.py`:**
- `RecommendationEngine` 클래스
- 기본 가중치 정의:
  ```python
  WEIGHTS = {
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
- `calculate_match_score()`: 종과 선호도 매칭 점수 계산 (0-100)
- `recommend()`: 추천 수행 (규칙 기반 또는 ML 모델)
- `calculate_monthly_cost_grade()`: 월 유지비 등급 계산
- `generate_care_summary()`: 사육 요약 생성
- 중복 제거: 정규화된 종명으로 중복 제거

**`scoring_helpers.py`:**
- `ScoringContext` 클래스: 점수 계산 컨텍스트 관리
- 각 질문별 점수 계산 함수:
  - `calculate_difficulty_score()`: 사육 난이도 (선호 등급 이하: 점수 부여, 초과: 감점)
  - `calculate_initial_cost_score()`: 초기 비용 (예산 내: 100%, 초과: 감점)
  - `calculate_temperature_humidity_score()`: 온도/습도
  - `calculate_activity_pattern_score()`: 활동 패턴
  - `calculate_diet_type_score()`: 식성 타입
  - `calculate_feeding_frequency_score()`: 먹이 빈도 (선호 빈도 이하: 점수 부여)
  - `calculate_handling_score()`: 핸들링 적합도 (선호 등급 이상: 점수 부여)
  - `calculate_enclosure_size_score()`: 사육장 크기 (선호 크기 이하: 점수 부여)
  - `calculate_adult_size_score()`: 성체 크기
  - `calculate_appearance_tags_score()`: 외형 태그 (태그 정규화: "멋지다", "멋있고" → "멋있다")
  - `calculate_species_type_score()`: 종류 (하드 필터, 일치하지 않으면 점수 0)
  - `calculate_purpose_score()`: 사육 목적
- `custom_weights` 지원: 사용자 정의 가중치로 기본 가중치 대체
- 중요도가 0이면 해당 질문 점수 계산에서 제외

**`app.py`:**
- Flask 애플리케이션
- CORS 설정 (개발용: 모든 도메인 허용)
- 데이터 초기화 (`init_data()`)
- API 엔드포인트:
  - `GET /api/health`: 헬스체크
  - `POST /api/recommend`: 추천 요청
  - `GET /api/species/<species_name>`: 종 상세 정보
  - `GET /api/metadata`: 메타데이터
  - `GET /api/dataset/info`: 데이터셋 정보
- 입력 검증 (`validate_preferences()`)
- 에러 응답 형식: `{"error": {"code": "...", "message": "...", "details": [...]}}`

**`file_utils.py`:**
- `find_data_file()`: 데이터 파일 우선순위에 따라 찾기
- 우선순위: `도마뱀_cursor_ai_utf8_clean.csv` > 직접 이미지 CSV > 이미지 포함 CSV > 기본 CSV > xlsx

#### 1.3 점수 계산 로직

**사육 난이도:**
- 사용자 선호 등급 이하: 정확히 일치(100%), 1단계 쉬움(90%), 2단계 쉬움(75%), 3단계 이상 쉬움(60%)
- 사용자 선호 등급 초과: 1단계 어려움(50%), 2단계 어려움(25%)

**초기 비용:**
- 예산 범위 내: 100%
- 예산 초과: 1단계 초과(33%)

**먹이 빈도:**
- 선호 빈도 이하 (덜 자주): 점수 부여
- 선호 빈도 초과: 감점

**핸들링 적합도:**
- 선호 등급 이상: 점수 부여
- 선호 등급 미만: 감점

**종류:**
- 하드 필터: 선택한 종류와 일치하지 않으면 점수 0
- 종류별 개별 가중치 지원

**외형태그:**
- 태그 정규화: "멋지다", "멋있고" → "멋있다"
- 선택한 태그와 일치하는 태그가 있으면 점수 부여

### 2. 프론트엔드 (HTML/CSS/JavaScript)

#### 2.1 파일 구조
```
frontend/
├── index.html                # 페이지 1: 기본 분류 (Q1)
├── survey_page2.html         # 페이지 2: 사육 조건 (Q2-Q7)
├── survey_page3.html         # 페이지 3: 목적 및 취향 (Q8-Q10)
├── survey_page4.html         # 페이지 4: 최종 제출
├── results.html               # 결과 표시 페이지
├── detail.html                # 종 상세 정보 페이지
├── app.js                     # API 호출 및 결과 표시
├── form_utils.js              # 폼 데이터 수집 유틸리티
├── survey_navigation.js      # 페이지 네비게이션 및 데이터 저장
└── styles.css                 # 스타일시트
```

#### 2.2 페이지 구성

**페이지 1 (index.html):**
- Q1: 종류 선택 (체크박스, 복수 선택)
  - 선택 가능: 도마뱀, 게코, 육지 거북, 수생 거북, 반수생 거북, 개구리, 도롱뇽, 카멜레온, 뱀
  - 각 종류별 개별 중요도 설정 (체크박스: 0, 1, 5, 10, 15, 20)
  - 종류 선택 시 해당 종류의 중요도 설정 표시
- 진행 표시 (1 / 4)
- "다음" 버튼

**페이지 2 (survey_page2.html):**
- Q2: 사육 난이도 (드롭다운: 1-5, "상관없음")
- Q3: 초기 비용 (드롭다운: 1-5, "상관없음")
- Q4: 사육장 크기 (드롭다운: 1-3, "상관없음")
- Q5: 활동 패턴 (드롭다운: "야행성"/"주행성", "상관없음")
- Q6: 먹이 급여 부담 (드롭다운: 1-5, "상관없음")
- Q7: 핸들링 적합도 (드롭다운: 1-5, "상관없음")
- 각 질문별 중요도 설정 (체크박스: 0, 1, 5, 10, 15, 20)
- 진행 표시 (2 / 4)
- "이전"/"다음" 버튼

**페이지 3 (survey_page3.html):**
- Q8: 사육 목적 (드롭다운: "관상용"/"애완용"/"둘 다")
- Q9: 식성 타입 (드롭다운: "잡식"/"초식"/"육식")
- Q10: 외형 태그 (체크박스: "귀엽다"/"화려하다"/"멋있다", "상관없음")
- 각 질문별 중요도 설정 (체크박스: 0, 1, 5, 10, 15, 20)
- 진행 표시 (3 / 4)
- "이전"/"다음" 버튼

**페이지 4 (survey_page4.html):**
- 최종 제출 페이지
- "상관없음" 선택한 질문의 중요도 자동 0 설정
- 진행 표시 (4 / 4)
- "이전"/"추천 받기" 버튼

**결과 페이지 (results.html):**
- 추천 결과 리스트 표시
- 각 결과 카드: 종 이름, 종류, 사진, 매칭 점수, 초기 비용(원화), 월 유지비(원화), 추천 근거(상위 2개), 질문별 기여도(상위 5개)
- "설문 다시하기" 버튼 (sessionStorage 초기화)

#### 2.3 핵심 기능

**`form_utils.js`:**
- `collectFormData(formData)`: 폼 데이터를 백엔드 형식으로 변환
  - Q1: 종류 배열 + 종류별 가중치 객체
  - Q2-Q10: 각 질문 값 + 중요도
  - `custom_weights` 객체 생성
- `resetFormToDefaults()`: 폼 초기화

**`survey_navigation.js`:**
- `getCurrentPage()`: 현재 페이지 번호 확인
- `updateProgressIndicator()`: 진행 상태 표시 업데이트
- `saveCurrentPageData()`: 현재 페이지 데이터를 sessionStorage에 저장 (키: `page1`, `page2`, `page3`, `page4`)
- `restoreCurrentPageData()`: 저장된 데이터 복원
- `goToNextPage()`: 다음 페이지로 이동
- `goToPreviousPage()`: 이전 페이지로 이동
- `collectAllPageData()`: 모든 페이지 데이터 수집
- `handleFinalSubmit()`: 최종 제출 처리 (API 호출)
- URL 파라미터 `reset=true` 확인하여 sessionStorage 초기화

**`app.js`:**
- `getApiBaseUrl()`: API 기본 URL 자동 감지 (file:// 프로토콜 처리)
- `handleFormSubmit()`: 폼 제출 처리
- `displayResults()`: 결과 표시
- `convertWikipediaImageUrl()`: Wikipedia URL을 직접 이미지 URL로 변환
- `handleImageError()`: 이미지 로드 실패 처리

#### 2.4 중요도 체크박스 동작
- 각 질문별로 하나만 선택 가능 (라디오 버튼처럼 동작)
- 기본값: Q2=20, Q3=15, Q4-Q8=10, Q9-Q10=5
- "상관없음" 선택 시 해당 질문의 중요도 자동 0 설정

#### 2.5 설문 다시하기
- `results.html`에서 "설문 다시하기" 클릭 시:
  - `clearSurveyData()` 함수 호출
  - sessionStorage의 모든 설문 데이터 삭제
  - `index.html?reset=true`로 이동
  - `survey_navigation.js`에서 `reset=true` 파라미터 확인 후 데이터 복원 건너뜀

### 3. 데이터 파일

#### 3.1 CSV 파일 형식
- UTF-8 인코딩
- 필수 컬럼: 종_한글명, 사육_난이도_5단계, 초기비용_등급_5단계, 성체크기_등급_3단계, 온도습도_5단계, 활동패턴, 식성타입, 먹이빈도_등급, 핸들링적합도_5단계, 사육장_사이즈_3단계, 외형태그, 종류, 관상용_애완용, 사진_URL
- 선택적 컬럼: 사진_페이지_URL

#### 3.2 데이터 검증 규칙
- 등급형 컬럼: 1-5 또는 1-3 범위
- 범주형 컬럼: 허용된 값 목록 검증
- 허용되지 않은 `종류` 값 필터링 (경고만 표시)
- 중복 제거: `종_한글명` 정규화 후 중복 제거

### 4. 실행 방법

#### 4.1 백엔드
```bash
cd backend
pip install -r requirements.txt
python app.py
```

#### 4.2 프론트엔드
```bash
cd frontend
python -m http.server 8000
```

### 5. 필수 구현 사항 요약

1. ✅ 4페이지 설문 시스템 (페이지 간 네비게이션, 데이터 저장/복원)
2. ✅ 중요도 설정 (각 질문별 0, 1, 5, 10, 15, 20 선택)
3. ✅ 종류별 개별 중요도 설정
4. ✅ "상관없음" 선택 시 중요도 자동 0 설정
5. ✅ 가중치 기반 추천 알고리즘
6. ✅ 중복 제거 (종명 정규화)
7. ✅ 외형태그 정규화 ("멋지다" → "멋있다")
8. ✅ 등급 이하 포함 로직 (사육 난이도, 먹이 빈도 등)
9. ✅ 설문 다시하기 시 sessionStorage 초기화
10. ✅ Wikipedia 이미지 URL 변환
11. ✅ 원화 표시 (초기 비용, 월 유지비)
12. ✅ 질문별 기여도 표시

### 6. 주의사항

- 모든 질문은 선택 기반 (드롭다운, 체크박스)
- 자유 텍스트 입력 없음
- 중요도 체크박스는 하나만 선택 가능
- 종류는 복수 선택 가능하며 각각 개별 중요도 설정 가능
- "상관없음" 선택 시 해당 질문은 점수 계산에서 제외
- 종류는 하드 필터 (일치하지 않으면 점수 0)
- 중복 제거는 종명 정규화 (모든 공백 제거) 후 수행

---

이 프롬프트를 기반으로 프로젝트를 처음부터 구현하세요. PRD 문서의 모든 요구사항을 충족해야 합니다.

