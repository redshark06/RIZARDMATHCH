"""점수 계산 헬퍼 함수들"""
from typing import Dict, Any, Optional, List, Tuple
import pandas as pd


class ScoringContext:
    """점수 계산 컨텍스트"""
    def __init__(self, preferences: Dict[str, Any], custom_weights: Dict[str, int]):
        self.preferences = preferences
        self.custom_weights = custom_weights
        self.question_contributions = {}
        self.match_reasons = []
    
    def get_weight(self, question_key: str, default_weight: int) -> int:
        """질문별 가중치 가져오기 (custom_weights 우선)"""
        return self.custom_weights.get(question_key, default_weight)
    
    def add_contribution(self, question_key: str, score: float):
        """질문별 기여도 추가"""
        if question_key not in self.question_contributions:
            self.question_contributions[question_key] = 0
        self.question_contributions[question_key] += score
    
    def add_reason(self, reason: str):
        """추천 근거 추가"""
        self.match_reasons.append(reason)


def normalize_appearance_tag(tag: str) -> str:
    """외형태그 정규화: "멋지다", "멋있고" → "멋있다" """
    if pd.isna(tag) or not tag:
        return ""
    tag = str(tag).strip()
    # "멋지다", "멋있고" → "멋있다"
    if tag in ["멋지다", "멋있고", "멋지고"]:
        return "멋있다"
    return tag


def parse_appearance_tags(tags_str: str) -> List[str]:
    """외형태그 문자열 파싱"""
    if pd.isna(tags_str) or not tags_str:
        return []
    tags = [normalize_appearance_tag(t.strip()) for t in str(tags_str).split(',')]
    return [t for t in tags if t]


def calculate_difficulty_score(
    species_value: int,
    user_preference: Optional[int],
    context: ScoringContext
) -> float:
    """사육 난이도 점수 계산"""
    if user_preference is None:
        return 0
    
    weight = context.get_weight('사육_난이도_5단계', 20)
    if weight == 0:
        return 0
    
    diff = species_value - user_preference
    
    if diff == 0:
        score = 100
        context.add_reason("사육 난이도가 선호하신 난이도와 일치합니다")
    elif diff < 0:  # 더 쉬움
        if diff == -1:
            score = 90
            context.add_reason("사육 난이도가 선호하신 난이도보다 1단계 쉬움")
        elif diff == -2:
            score = 75
            context.add_reason("사육 난이도가 선호하신 난이도보다 2단계 쉬움")
        else:  # -3 이상
            score = 60
            context.add_reason("사육 난이도가 선호하신 난이도보다 훨씬 쉬움")
    else:  # 더 어려움
        if diff == 1:
            score = 50
            context.add_reason("사육 난이도가 선호하신 난이도보다 1단계 어려움")
        else:  # 2 이상
            score = 25
            context.add_reason("사육 난이도가 선호하신 난이도보다 훨씬 어려움")
    
    contribution = (score / 100) * weight
    context.add_contribution('사육_난이도', contribution)
    return contribution


def calculate_initial_cost_score(
    species_value: int,
    user_max: Optional[int],
    context: ScoringContext
) -> float:
    """초기 비용 점수 계산"""
    if user_max is None:
        return 0
    
    weight = context.get_weight('초기비용_등급_5단계', 15)
    if weight == 0:
        return 0
    
    if species_value <= user_max:
        score = 100
        context.add_reason("초기 비용이 예산 범위 내입니다")
    else:
        diff = species_value - user_max
        if diff == 1:
            score = 33
            context.add_reason("초기 비용이 예산 범위를 1단계 초과합니다")
        else:
            score = 0
            context.add_reason("초기 비용이 예산 범위를 크게 초과합니다")
    
    contribution = (score / 100) * weight
    context.add_contribution('초기비용', contribution)
    return contribution


def calculate_temperature_humidity_score(
    species_value: int,
    context: ScoringContext
) -> float:
    """온도/습도 점수 계산 (기본적으로 낮을수록 좋음)"""
    weight = context.get_weight('온도습도_5단계', 10)
    if weight == 0:
        return 0
    
    # 낮을수록 좋음 (1=100%, 2=80%, 3=60%, 4=40%, 5=20%)
    score = 100 - (species_value - 1) * 20
    score = max(0, min(100, score))
    
    contribution = (score / 100) * weight
    context.add_contribution('온도습도', contribution)
    return contribution


def calculate_activity_pattern_score(
    species_value: str,
    user_preference: Optional[str],
    context: ScoringContext
) -> float:
    """활동 패턴 점수 계산"""
    if user_preference is None or not user_preference:
        return 0
    
    weight = context.get_weight('활동패턴', 10)
    if weight == 0:
        return 0
    
    if str(species_value) == str(user_preference):
        score = 100
        context.add_reason(f"활동 패턴이 {user_preference}으로 일치합니다")
    else:
        score = 0
    
    contribution = (score / 100) * weight
    context.add_contribution('활동패턴', contribution)
    return contribution


def calculate_diet_type_score(
    species_value: str,
    user_preference: Optional[str],
    context: ScoringContext
) -> float:
    """식성 타입 점수 계산"""
    if user_preference is None or not user_preference:
        return 0
    
    weight = context.get_weight('식성타입', 5)
    if weight == 0:
        return 0
    
    if str(species_value) == str(user_preference):
        score = 100
        context.add_reason(f"식성 타입이 {user_preference}으로 일치합니다")
    else:
        score = 0
    
    contribution = (score / 100) * weight
    context.add_contribution('식성타입', contribution)
    return contribution


def calculate_feeding_frequency_score(
    species_value: int,
    user_prefer: Optional[int],
    context: ScoringContext
) -> float:
    """먹이 빈도 점수 계산 (선호 빈도 이하: 점수 부여)"""
    if user_prefer is None:
        return 0
    
    weight = context.get_weight('먹이빈도_등급', 10)
    if weight == 0:
        return 0
    
    if species_value <= user_prefer:
        score = 100
        context.add_reason("먹이 급여 빈도가 선호하신 빈도 이하입니다")
    else:
        diff = species_value - user_prefer
        if diff == 1:
            score = 50
            context.add_reason("먹이 급여 빈도가 선호하신 빈도보다 1단계 높습니다")
        else:
            score = 25
            context.add_reason("먹이 급여 빈도가 선호하신 빈도보다 훨씬 높습니다")
    
    contribution = (score / 100) * weight
    context.add_contribution('먹이빈도', contribution)
    return contribution


def calculate_handling_score(
    species_value: int,
    user_prefer: Optional[int],
    context: ScoringContext
) -> float:
    """핸들링 적합도 점수 계산 (선호 등급 이상: 점수 부여)"""
    if user_prefer is None:
        return 0
    
    weight = context.get_weight('핸들링적합도_5단계', 10)
    if weight == 0:
        return 0
    
    if species_value >= user_prefer:
        score = 100
        context.add_reason("핸들링 적합도가 선호하신 등급 이상입니다")
    else:
        diff = user_prefer - species_value
        if diff == 1:
            score = 50
            context.add_reason("핸들링 적합도가 선호하신 등급보다 1단계 낮습니다")
        else:
            score = 25
            context.add_reason("핸들링 적합도가 선호하신 등급보다 훨씬 낮습니다")
    
    contribution = (score / 100) * weight
    context.add_contribution('핸들링적합도', contribution)
    return contribution


def calculate_enclosure_size_score(
    species_value: int,
    user_max: Optional[int],
    context: ScoringContext
) -> float:
    """사육장 크기 점수 계산 (선호 크기 이하: 점수 부여)"""
    if user_max is None:
        return 0
    
    weight = context.get_weight('사육장_사이즈_3단계', 10)
    if weight == 0:
        return 0
    
    if species_value <= user_max:
        score = 100
        context.add_reason("사육장 크기가 선호하신 크기 이하입니다")
    else:
        score = 0
        context.add_reason("사육장 크기가 선호하신 크기를 초과합니다")
    
    contribution = (score / 100) * weight
    context.add_contribution('사육장_사이즈', contribution)
    return contribution


def calculate_adult_size_score(
    species_value: int,
    context: ScoringContext
) -> float:
    """성체 크기 점수 계산 (기본적으로 작을수록 좋음)"""
    weight = context.get_weight('성체크기_등급_3단계', 5)
    if weight == 0:
        return 0
    
    # 작을수록 좋음 (1=100%, 2=50%, 3=0%)
    score = 100 - (species_value - 1) * 50
    score = max(0, min(100, score))
    
    contribution = (score / 100) * weight
    context.add_contribution('성체크기', contribution)
    return contribution


def calculate_appearance_tags_score(
    species_tags_str: str,
    user_tags: Optional[List[str]],
    context: ScoringContext
) -> float:
    """외형 태그 점수 계산"""
    if not user_tags or len(user_tags) == 0:
        return 0
    
    weight = context.get_weight('외형태그', 5)
    if weight == 0:
        return 0
    
    species_tags = parse_appearance_tags(species_tags_str)
    if not species_tags:
        return 0
    
    # 정규화된 사용자 태그
    normalized_user_tags = [normalize_appearance_tag(t) for t in user_tags]
    
    # 일치하는 태그 개수
    matched_tags = [tag for tag in normalized_user_tags if tag in species_tags]
    
    if matched_tags:
        match_ratio = len(matched_tags) / len(normalized_user_tags)
        score = match_ratio * 100
        context.add_reason(f"외형 태그가 일치합니다 ({', '.join(matched_tags)})")
    else:
        score = 0
    
    contribution = (score / 100) * weight
    context.add_contribution('외형태그', contribution)
    return contribution


def calculate_species_type_score(
    species_value: str,
    user_species: Optional[List[str]],
    species_weights: Optional[Dict[str, int]],
    context: ScoringContext
) -> float:
    """종류 점수 계산 (하드 필터)"""
    if not user_species or len(user_species) == 0:
        return 0
    
    # 하드 필터: 선택한 종류와 일치하지 않으면 점수 0
    if str(species_value) not in user_species:
        return 0
    
    # 종류별 가중치 적용
    if species_weights:
        weight = species_weights.get(str(species_value), 10)
    else:
        weight = 10
    
    score = 100
    context.add_reason(f"종류가 {species_value}으로 선택하신 종류와 일치합니다")
    
    contribution = (score / 100) * weight
    context.add_contribution('종류', contribution)
    return contribution


def calculate_purpose_score(
    species_value: str,
    user_preference: Optional[str],
    context: ScoringContext
) -> float:
    """사육 목적 점수 계산"""
    if user_preference is None or not user_preference:
        return 0
    
    weight = context.get_weight('관상용_애완용', 10)
    if weight == 0:
        return 0
    
    if str(species_value) == str(user_preference):
        score = 100
        context.add_reason(f"사육 목적이 {user_preference}으로 일치합니다")
    elif str(species_value) == "둘 다":
        score = 80
        context.add_reason("사육 목적이 '둘 다'로 모든 목적에 적합합니다")
    else:
        score = 0
    
    contribution = (score / 100) * weight
    context.add_contribution('관상용_애완용', contribution)
    return contribution

