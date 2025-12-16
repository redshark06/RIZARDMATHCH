@echo off
echo LizardMatch 프론트엔드 서버 시작 중...
cd frontend
python -m http.server 8000
pause

