"""Flask REST API 서버"""
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import traceback
import pandas as pd
from typing import Tuple, List

from file_utils import find_data_file
from data_loader import load_and_validate_data
from recommendation_engine import RecommendationEngine

app = Flask(__name__)

# CORS 설정 (개발용: 모든 도메인 허용)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# 전역 변수
dataset = None
engine = None
dataset_warnings = []


def init_data():
    """데이터 초기화"""
    global dataset, engine, dataset_warnings
    
    try:
        file_path = find_data_file()
        dataset, dataset_warnings = load_and_validate_data(file_path)
        engine = RecommendationEngine(dataset)
        print(f"데이터 로드 완료: {len(dataset)}개 종")
        if dataset_warnings:
            print("경고:")
            for warning in dataset_warnings:
                print(f"  - {warning}")
        return True
    except Exception as e:
        print(f"데이터 로드 실패: {str(e)}")
        traceback.print_exc()
        return False


def validate_preferences(data: dict) -> Tuple[bool, List[str]]:
    """선호도 입력 검증"""
    errors = []
    
    if 'preferences' not in data:
        errors.append("'preferences' 필드가 필요합니다")
        return False, errors
    
    prefs = data['preferences']
    
    # 종류 검증
    if '종류' not in prefs or not isinstance(prefs['종류'], list) or len(prefs['종류']) == 0:
        errors.append("'종류'는 최소 1개 이상 선택해야 합니다")
    
    # 등급 값 검증
    grade_fields = {
        '사육_난이도_5단계': (1, 5),
        '초기비용_등급_5단계_max': (1, 5),
        '사육장_사이즈_3단계_max': (1, 3),
        '먹이빈도_등급_prefer': (1, 5),
        '핸들링적합도_5단계_prefer': (1, 5)
    }
    
    for field, (min_val, max_val) in grade_fields.items():
        if field in prefs:
            val = prefs[field]
            if val is not None and (not isinstance(val, int) or val < min_val or val > max_val):
                errors.append(f"'{field}'는 {min_val}-{max_val} 범위의 정수여야 합니다")
    
    # 범주형 값 검증
    if '활동패턴' in prefs and prefs['활동패턴'] not in [None, '', '야행성', '주행성']:
        errors.append("'활동패턴'은 '야행성', '주행성' 또는 None이어야 합니다")
    
    if '식성타입' in prefs and prefs['식성타입'] not in [None, '', '잡식', '초식', '육식']:
        errors.append("'식성타입'은 '잡식', '초식', '육식' 또는 None이어야 합니다")
    
    if '관상용_애완용' in prefs and prefs['관상용_애완용'] not in [None, '', '관상용', '애완용', '둘 다']:
        errors.append("'관상용_애완용'은 '관상용', '애완용', '둘 다' 또는 None이어야 합니다")
    
    return len(errors) == 0, errors


@app.route('/api/health', methods=['GET'])
def health_check():
    """헬스체크"""
    return jsonify({
        'status': 'ok',
        'server': 'LizardMatch API',
        'data_loaded': dataset is not None and engine is not None
    })


@app.route('/api/recommend', methods=['POST'])
def recommend():
    """추천 요청"""
    if dataset is None or engine is None:
        return jsonify({
            'error': {
                'code': 'DATASET_NOT_LOADED',
                'message': '데이터셋이 로드되지 않았습니다',
                'details': []
            }
        }), 500
    
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                'error': {
                    'code': 'INVALID_INPUT',
                    'message': 'JSON 데이터가 필요합니다',
                    'details': []
                }
            }), 400
        
        # 입력 검증
        is_valid, errors = validate_preferences(data)
        if not is_valid:
            return jsonify({
                'error': {
                    'code': 'INVALID_INPUT',
                    'message': '입력 값이 유효하지 않습니다',
                    'details': errors
                }
            }), 400
        
        preferences = data.get('preferences', {})
        options = data.get('options', {})
        
        # 추천 수행
        result = engine.recommend(preferences, options)
        return jsonify(result)
    
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': f'서버 오류가 발생했습니다: {str(e)}',
                'details': []
            }
        }), 500


@app.route('/api/species/<species_name>', methods=['GET'])
def get_species(species_name):
    """종 상세 정보 조회"""
    if dataset is None:
        return jsonify({
            'error': {
                'code': 'DATASET_NOT_LOADED',
                'message': '데이터셋이 로드되지 않았습니다',
                'details': []
            }
        }), 500
    
    try:
        # 종명으로 검색 (정규화된 이름으로도 검색)
        from data_loader import normalize_species_name
        normalized_search = normalize_species_name(species_name)
        
        species = None
        for idx, row in dataset.iterrows():
            if (row['종_한글명'] == species_name or 
                normalize_species_name(row['종_한글명']) == normalized_search):
                species = row
                break
        
        if species is None:
            return jsonify({
                'error': {
                    'code': 'SPECIES_NOT_FOUND',
                    'message': f'종을 찾을 수 없습니다: {species_name}',
                    'details': []
                }
            }), 404
        
        # 종 정보를 딕셔너리로 변환
        result = species.to_dict()
        # NaN 값을 None으로 변환
        for key, value in result.items():
            if pd.isna(value):
                result[key] = None
        
        return jsonify(result)
    
    except Exception as e:
        traceback.print_exc()
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': f'서버 오류가 발생했습니다: {str(e)}',
                'details': []
            }
        }), 500


@app.route('/api/metadata', methods=['GET'])
def get_metadata():
    """메타데이터 조회"""
    return jsonify({
        'allowed_species_types': [
            '도마뱀', '게코', '육지 거북', '수생 거북', '반수생 거북',
            '개구리', '도롱뇽', '카멜레온', '뱀'
        ],
        'allowed_activity_patterns': ['야행성', '주행성'],
        'allowed_diet_types': ['잡식', '초식', '육식'],
        'allowed_purposes': ['관상용', '애완용', '둘 다'],
        'grade_ranges': {
            '5단계': {'min': 1, 'max': 5},
            '3단계': {'min': 1, 'max': 3}
        },
        'importance_levels': [0, 1, 5, 10, 15, 20]
    })


@app.route('/api/dataset/info', methods=['GET'])
def get_dataset_info():
    """데이터셋 정보 조회"""
    if dataset is None:
        return jsonify({
            'error': {
                'code': 'DATASET_NOT_LOADED',
                'message': '데이터셋이 로드되지 않았습니다',
                'details': []
            }
        }), 500
    
    try:
        return jsonify({
            'total_species': len(dataset),
            'species_types': dataset['종류'].value_counts().to_dict(),
            'warnings': dataset_warnings
        })
    except Exception as e:
        return jsonify({
            'error': {
                'code': 'INTERNAL_ERROR',
                'message': f'서버 오류가 발생했습니다: {str(e)}',
                'details': []
            }
        }), 500


if __name__ == '__main__':
    # 데이터 초기화
    if not init_data():
        print("데이터 초기화 실패. 서버를 시작할 수 없습니다.")
        exit(1)
    
    # 환경 변수에서 설정 읽기
    host = os.getenv('FLASK_HOST', '0.0.0.0')
    port = int(os.getenv('FLASK_PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    print(f"서버 시작: http://{host}:{port}")
    app.run(host=host, port=port, debug=debug)

