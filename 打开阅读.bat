@echo off
cd /d "%~dp0"
echo 本机预览：http://127.0.0.1:8767/index.html
python -m http.server 8767 --bind 127.0.0.1
