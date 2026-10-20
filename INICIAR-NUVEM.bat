@echo off
title DEV PATH V5 - TV na nuvem
rem Abre a TV (HDMI) e o painel apontando para o servidor na nuvem. Nao liga servidor local.
rem Troque o endereco abaixo pelo da sua publicacao: no Render, copie a linha "TV:" dos Logs.
set DEVPATH_URL=https://devpath-uhhd.onrender.com/presentation/FATEC2026/TELAO-01
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0abrir-telas.ps1" -Url "%DEVPATH_URL%"
