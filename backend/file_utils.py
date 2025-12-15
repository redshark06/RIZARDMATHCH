"""파일 경로 유틸리티"""
import os
from pathlib import Path


def find_data_file():
    """
    데이터 파일을 우선순위에 따라 찾기
    
    우선순위:
    1. 종별_수집정보_가독성개선_최종.csv      (세부보기용 확장 데이터, 최신)
    2. 도마뱀_cursor_ai_utf8_clean.csv         (기존 추천용 기본 데이터)
    3. 도마뱀_정리_cursor_ai_clean_v3_images_links_direct_image.csv
    4. 도마뱀_정리_cursor_ai_clean_v3_images (1)_links_updated_filled_merged_photo_url.csv
    5. 도마뱀_정리_cursor_ai_clean_v3_images (1).csv
    6. 도마뱀_정리_cursor_ai_clean.csv
    7. 도마뱀_정리_cursor_ai_clean.xlsx
    """
    # 프로젝트 루트 디렉토리 찾기
    current_dir = Path(__file__).parent.parent
    
    # 우선순위에 따른 파일 목록
    file_priorities = [
        "종별_수집정보_가독성개선_최종.csv",
        "도마뱀_cursor_ai_utf8_clean.csv",
        "도마뱀_정리_cursor_ai_clean_v3_images_links_direct_image.csv",
        "도마뱀_정리_cursor_ai_clean_v3_images (1)_links_updated_filled_merged_photo_url.csv",
        "도마뱀_정리_cursor_ai_clean_v3_images (1).csv",
        "도마뱀_정리_cursor_ai_clean.csv",
        "도마뱀_정리_cursor_ai_clean.xlsx",
    ]
    
    # 각 파일 확인
    for filename in file_priorities:
        file_path = current_dir / filename
        if file_path.exists():
            return str(file_path)
    
    # 파일을 찾지 못한 경우
    raise FileNotFoundError(
        f"데이터 파일을 찾을 수 없습니다. 다음 위치에서 확인했습니다: {current_dir}"
    )

