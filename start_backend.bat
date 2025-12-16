@echo off
echo LizardMatch 백엔드 서버 시작 중...
cd backend
pip install -r requirements.txt
python app.py
pause

