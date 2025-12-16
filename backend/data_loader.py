"""CSV/Excel 데이터 로더 및 검증"""
import pandas as pd
import warnings
from typing import Dict, List, Tuple


# 필수 컬럼 목록
REQUIRED_COLUMNS = [
    '종_한글명',
    '사육_난이도_5단계',
    '초기비용_등급_5단계',
    '성체크기_등급_3단계',
    '온도습도_5단계',
    '활동패턴',
    '식성타입',
    '먹이빈도_등급',
    '핸들링적합도_5단계',
    '사육장_사이즈_3단계',
    '외형태그',
    '종류',
    '관상용_애완용',
    '사진_URL'
]

# 허용된 값 목록
ALLOWED_ACTIVITY_PATTERNS = ['야행성', '주행성']
ALLOWED_DIET_TYPES = ['잡식', '초식', '육식']
ALLOWED_PURPOSES = ['관상용', '애완용', '둘 다']
ALLOWED_SPECIES_TYPES = [
    '도마뱀', '게코', '육지 거북', '수생 거북', '반수생 거북',
    '개구리', '도롱뇽', '카멜레온', '뱀'
]


def normalize_species_name(name: str) -> str:
    """종명 정규화: 모든 공백 제거"""
    if pd.isna(name):
        return ""
    return str(name).strip().replace(' ', '').replace('\t', '').replace('\n', '')


def load_and_validate_data(file_path: str) -> Tuple[pd.DataFrame, List[str]]:
    """
    CSV/Excel 파일을 로드하고 검증
    
    Returns:
        (DataFrame, warnings): 검증된 데이터프레임과 경고 메시지 리스트
    """
    warnings_list = []
    
    # 파일 확장자에 따라 로드
    if file_path.endswith('.xlsx'):
        df = pd.read_excel(file_path)
    else:
        df = pd.read_csv(file_path, encoding='utf-8')
    
    # 필수 컬럼 존재 여부 확인
    missing_columns = [col for col in REQUIRED_COLUMNS if col not in df.columns]
    if missing_columns:
        raise ValueError(f"필수 컬럼이 누락되었습니다: {missing_columns}")
    
    # 사진_URL 결측치를 빈 문자열로 변환
    df['사진_URL'] = df['사진_URL'].fillna('')
    
    # 등급형 컬럼 범위 검증
    grade_5_columns = ['사육_난이도_5단계', '초기비용_등급_5단계', '온도습도_5단계', 
                      '먹이빈도_등급', '핸들링적합도_5단계']
    grade_3_columns = ['성체크기_등급_3단계', '사육장_사이즈_3단계']
    
    for col in grade_5_columns:
        invalid = df[(df[col] < 1) | (df[col] > 5)]
        if len(invalid) > 0:
            warnings_list.append(f"{col}: 1-5 범위를 벗어난 값이 {len(invalid)}개 있습니다.")
            df = df[(df[col] >= 1) & (df[col] <= 5)]
    
    for col in grade_3_columns:
        invalid = df[(df[col] < 1) | (df[col] > 3)]
        if len(invalid) > 0:
            warnings_list.append(f"{col}: 1-3 범위를 벗어난 값이 {len(invalid)}개 있습니다.")
            df = df[(df[col] >= 1) & (df[col] <= 3)]
    
    # 범주형 컬럼 허용 값 검증
    if '활동패턴' in df.columns:
        invalid = df[~df['활동패턴'].isin(ALLOWED_ACTIVITY_PATTERNS + [None, ''])]
        if len(invalid) > 0:
            warnings_list.append(f"활동패턴: 허용되지 않은 값이 {len(invalid)}개 있습니다.")
            df = df[df['활동패턴'].isin(ALLOWED_ACTIVITY_PATTERNS + [None, ''])]
    
    if '식성타입' in df.columns:
        invalid = df[~df['식성타입'].isin(ALLOWED_DIET_TYPES + [None, ''])]
        if len(invalid) > 0:
            warnings_list.append(f"식성타입: 허용되지 않은 값이 {len(invalid)}개 있습니다.")
            df = df[df['식성타입'].isin(ALLOWED_DIET_TYPES + [None, ''])]
    
    if '관상용_애완용' in df.columns:
        invalid = df[~df['관상용_애완용'].isin(ALLOWED_PURPOSES + [None, ''])]
        if len(invalid) > 0:
            warnings_list.append(f"관상용_애완용: 허용되지 않은 값이 {len(invalid)}개 있습니다.")
            df = df[df['관상용_애완용'].isin(ALLOWED_PURPOSES + [None, ''])]
    
    # 종류 필터링 (허용되지 않은 값은 경고만 표시하고 필터링)
    if '종류' in df.columns:
        invalid = df[~df['종류'].isin(ALLOWED_SPECIES_TYPES + [None, ''])]
        if len(invalid) > 0:
            invalid_species = invalid['종류'].unique().tolist()
            warnings_list.append(f"종류: 허용되지 않은 값이 {len(invalid)}개 있습니다. (값: {invalid_species})")
            df = df[df['종류'].isin(ALLOWED_SPECIES_TYPES + [None, ''])]
    
    # 중복 제거: 종명 정규화 후 중복 제거
    df['_normalized_name'] = df['종_한글명'].apply(normalize_species_name)
    initial_count = len(df)
    df = df.drop_duplicates(subset=['_normalized_name'], keep='first')
    df = df.drop(columns=['_normalized_name'])
    removed_count = initial_count - len(df)
    if removed_count > 0:
        warnings_list.append(f"중복 제거: {removed_count}개의 중복 항목이 제거되었습니다.")
    
    return df, warnings_list

