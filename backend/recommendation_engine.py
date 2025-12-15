"""추천 엔진"""
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import uuid

from scoring_helpers import (
    ScoringContext,
    calculate_difficulty_score,
    calculate_initial_cost_score,
    calculate_temperature_humidity_score,
    calculate_activity_pattern_score,
    calculate_diet_type_score,
    calculate_feeding_frequency_score,
    calculate_handling_score,
    calculate_enclosure_size_score,
    calculate_adult_size_score,
    calculate_appearance_tags_score,
    calculate_species_type_score,
    calculate_purpose_score
)


# 기본 가중치
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
    '외형태그': 5,
    '관상용_애완용': 10
}


class RecommendationEngine:
    """추천 엔진 클래스"""
    
    def __init__(self, dataframe: pd.DataFrame):
        self.df = dataframe.copy()
        self.dataset_version = "도마뱀_cursor_ai_utf8_clean.csv@DATASET"
    
    def calculate_match_score(
        self,
        species_row: pd.Series,
        preferences: Dict[str, Any],
        custom_weights: Dict[str, int]
    ) -> Tuple[float, ScoringContext]:
        """
        종과 선호도 매칭 점수 계산 (0-100)
        
        Returns:
            (점수, ScoringContext): 계산된 점수와 컨텍스트
        """
        context = ScoringContext(preferences, custom_weights)
        
        total_score = 0.0
        
        # 종류 점수 계산 (하드 필터)
        species_score = calculate_species_type_score(
            species_row['종류'],
            preferences.get('종류'),
            preferences.get('종류_가중치'),
            context
        )
        total_score += species_score
        
        # 종류가 일치하지 않으면 0점 반환
        if species_score == 0:
            return 0.0, context
        
        # 사육 난이도
        if '사육_난이도_5단계' in preferences:
            total_score += calculate_difficulty_score(
                int(species_row['사육_난이도_5단계']),
                preferences.get('사육_난이도_5단계'),
                context
            )
        
        # 초기 비용
        if '초기비용_등급_5단계_max' in preferences:
            total_score += calculate_initial_cost_score(
                int(species_row['초기비용_등급_5단계']),
                preferences.get('초기비용_등급_5단계_max'),
                context
            )
        
        # 온도/습도
        total_score += calculate_temperature_humidity_score(
            int(species_row['온도습도_5단계']),
            context
        )
        
        # 활동 패턴
        if '활동패턴' in preferences:
            total_score += calculate_activity_pattern_score(
                species_row['활동패턴'],
                preferences.get('활동패턴'),
                context
            )
        
        # 식성 타입
        if '식성타입' in preferences:
            total_score += calculate_diet_type_score(
                species_row['식성타입'],
                preferences.get('식성타입'),
                context
            )
        
        # 먹이 빈도
        if '먹이빈도_등급_prefer' in preferences:
            total_score += calculate_feeding_frequency_score(
                int(species_row['먹이빈도_등급']),
                preferences.get('먹이빈도_등급_prefer'),
                context
            )
        
        # 핸들링 적합도
        if '핸들링적합도_5단계_prefer' in preferences:
            total_score += calculate_handling_score(
                int(species_row['핸들링적합도_5단계']),
                preferences.get('핸들링적합도_5단계_prefer'),
                context
            )
        
        # 사육장 크기
        if '사육장_사이즈_3단계_max' in preferences:
            total_score += calculate_enclosure_size_score(
                int(species_row['사육장_사이즈_3단계']),
                preferences.get('사육장_사이즈_3단계_max'),
                context
            )
        
        # 성체 크기
        total_score += calculate_adult_size_score(
            int(species_row['성체크기_등급_3단계']),
            context
        )
        
        # 외형 태그
        if '외형태그' in preferences:
            total_score += calculate_appearance_tags_score(
                species_row['외형태그'],
                preferences.get('외형태그'),
                context
            )
        
        # 사육 목적
        if '관상용_애완용' in preferences:
            total_score += calculate_purpose_score(
                species_row['관상용_애완용'],
                preferences.get('관상용_애완용'),
                context
            )
        
        # 점수를 0-100으로 정규화
        max_possible_score = sum(custom_weights.values()) if custom_weights else sum(WEIGHTS.values())
        if max_possible_score > 0:
            normalized_score = min(100, max(0, (total_score / max_possible_score) * 100))
        else:
            normalized_score = 0
        
        return normalized_score, context
    
    def calculate_monthly_cost_grade(self, species_row: pd.Series) -> int:
        """
        월 유지비 등급 계산
        
        공식: cost_score = 0.4 * 먹이빈도 + 0.4 * 온도습도 + 0.2 * (성체크기 * 1.7)
        grade = max(1, min(5, int(round(cost_score))))
        """
        feeding = int(species_row['먹이빈도_등급'])
        temp_humid = int(species_row['온도습도_5단계'])
        size = int(species_row['성체크기_등급_3단계'])
        
        cost_score = 0.4 * feeding + 0.4 * temp_humid + 0.2 * (size * 1.7)
        grade = max(1, min(5, int(round(cost_score))))
        return grade
    
    def generate_care_summary(self, species_row: pd.Series) -> str:
        """사육 요약 생성"""
        difficulty = int(species_row['사육_난이도_5단계'])
        activity = species_row['활동패턴']
        
        difficulty_text = {
            1: "초보자에게 적합한 난이도",
            2: "초보자도 도전 가능한 난이도",
            3: "중급자에게 적합한 난이도",
            4: "고급자에게 적합한 난이도",
            5: "전문가 수준의 난이도"
        }.get(difficulty, "적당한 난이도")
        
        activity_text = "주행성으로 낮 시간 활동이 활발합니다" if activity == "주행성" else "야행성으로 밤 시간 활동이 활발합니다"
        
        return f"{difficulty_text}입니다. {activity_text}."
    
    def recommend(
        self,
        preferences: Dict[str, Any],
        options: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        추천 수행
        
        Args:
            preferences: 사용자 선호도
            options: 옵션 (top_n, include_reasons 등)
        
        Returns:
            추천 결과 딕셔너리
        """
        if options is None:
            options = {}
        
        top_n = options.get('top_n', 10)
        include_reasons = options.get('include_reasons', True)
        
        # custom_weights 준비
        custom_weights = preferences.get('custom_weights', {})
        if not custom_weights:
            custom_weights = WEIGHTS.copy()
        
        # 각 종에 대해 점수 계산
        results = []
        for idx, row in self.df.iterrows():
            score, context = self.calculate_match_score(row, preferences, custom_weights)
            
            if score > 0:  # 종류 필터를 통과한 경우만
                result = {
                    '종_한글명': row['종_한글명'],
                    '종류': row['종류'],
                    '관상용_애완용': row['관상용_애완용'],
                    '사진_URL': row.get('사진_URL', ''),
                    '사진_페이지_URL': row.get('사진_페이지_URL', ''),
                    'match_score': round(score, 1),
                    '초기비용_등급_5단계': int(row['초기비용_등급_5단계']),
                    '예상_월유지비_등급_5단계': self.calculate_monthly_cost_grade(row),
                    '사육_요약': self.generate_care_summary(row)
                }
                
                if include_reasons:
                    result['match_reasons'] = context.match_reasons[:2]  # 상위 2개
                    # 질문별 기여도 정렬 (상위 5개)
                    sorted_contributions = sorted(
                        context.question_contributions.items(),
                        key=lambda x: x[1],
                        reverse=True
                    )[:5]
                    result['question_contributions'] = {
                        k: round(v, 1) for k, v in sorted_contributions
                    }
                
                results.append((score, result))
        
        # 점수 순으로 정렬
        results.sort(key=lambda x: x[0], reverse=True)
        
        # 상위 N개 선택
        top_results = [r[1] for r in results[:top_n]]
        
        # 요청 ID 생성
        request_id = f"req_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"
        
        return {
            'request_id': request_id,
            'dataset_version': self.dataset_version,
            'top_n': top_n,
            'results': top_results,
            'scoring_policy_version': 'v1.0'
        }

