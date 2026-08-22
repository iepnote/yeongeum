@echo off
chcp 65001 >nul
cd /d %~dp0
echo === 연금나침반 KIS 동기화 도우미 ===
node scripts\kis-serve.mjs
pause
