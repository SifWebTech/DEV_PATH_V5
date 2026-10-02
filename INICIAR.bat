@echo off
title DEV PATH V5 - Servidor do estande (nao feche esta janela)
cd /d "%~dp0"
where node >nul 2>nul || (echo Instale o Node.js em https://nodejs.org e rode novamente. & pause & exit /b)
rem apaga a porta da execucao anterior; o servidor grava a nova ao iniciar
if exist "data\.porta" del "data\.porta"
rem abre a apresentacao na TV (HDMI estendido) e o painel do operador no notebook
start "" /min powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0abrir-telas.ps1"
node server.js
pause
