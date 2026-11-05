@echo off
chcp 65001 >nul
rem Doble clic para actualizar el LUE desde el GEI. Pide usuario y clave en el momento.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\gei-barrido.ps1"
