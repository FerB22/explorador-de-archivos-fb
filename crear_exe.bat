@echo off
echo === Compilando Explorador FB ===
pyinstaller "Explorador FB.spec" --noconfirm
copy config.json "dist\Explorador FB\" >nul 2>&1
echo.
echo === Listo. El ejecutable esta en dist\Explorador FB\Explorador FB.exe ===
pause
