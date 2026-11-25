@echo off
cd /d "%~dp0"

if not exist ".venv\Scripts\python.exe" goto novenv
rem start.bat is kept pure ASCII on purpose: cmd.exe garbles UTF-8 content.
rem Chinese messages are printed by run.py, which handles encoding itself.
".venv\Scripts\python.exe" run.py %*
goto end

:novenv
echo [!] .venv not found. Run these two commands first:
echo     python -m venv .venv
echo     .venv\Scripts\python -m pip install -r requirements.txt

:end
echo.
pause
