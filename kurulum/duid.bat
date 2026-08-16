@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
REM Adim 1 — Developer Mode ac, DUID al, gonder.
REM Klasor: duid.bat + sdb.exe

echo.
echo  VELA — DUID al
echo  PC ve TV ayni Wi-Fi'de olsun.
echo.
echo  Bu PC'nin IP'si  (TV'de Host IP burasi):
for /f "tokens=2 delims=:" %%A in ('ipconfig ^| findstr /c:"IPv4"') do (
  set IP=%%A
  set IP=!IP: =!
  echo    !IP!
)
echo.
echo  TV: Uygulamalar ^> ayar / disli ^> 12345
echo      Developer Mode On
echo      Host IP = yukaridaki PC IP
echo      TV kapat-ac, Apps'te Develop Mode yazsin
echo.

set TV=%1
if "%TV%"=="" set /p TV=TV IP: 
if "%TV%"=="" (
  echo TV IP yok.
  pause
  exit /b 1
)

set SDB=%~dp0sdb.exe
if not exist "%SDB%" set SDB=%USERPROFILE%\tizen-studio\tools\sdb.exe
if not exist "%SDB%" (
  echo sdb.exe bu klasorde yok. README.md'ye bak.
  pause
  exit /b 1
)

echo.
echo  Baglaniyor %TV%:26101 ...
"%SDB%" connect %TV%:26101
if errorlevel 1 (
  echo Baglanamadi. Ayni Wi-Fi ve Host IP bu PC mi?
  pause
  exit /b 1
)
"%SDB%" devices
echo.
echo  DUID  (bunu gonder):
"%SDB%" shell 0 getduid
echo.
echo  Paket gelince VelaIPTV.wgt'yi bu klasore koy, kur.bat calistir.
pause
endlocal
