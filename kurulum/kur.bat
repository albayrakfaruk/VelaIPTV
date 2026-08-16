@echo off
chcp 65001 >nul
setlocal
REM Adim 2 — VelaIPTV.wgt geldikten sonra kur.
REM Klasor: kur.bat + sdb.exe + VelaIPTV.wgt

echo.
echo  VELA — kur
echo.

set WGT=%~dp0VelaIPTV.wgt
if not exist "%WGT%" set WGT=%CD%\VelaIPTV.wgt
if not exist "%WGT%" (
  echo VelaIPTV.wgt yok. Once duid.bat ile DUID al, gonder.
  echo Paket gelince bu klasore koyup kur.bat calistir.
  pause
  exit /b 1
)

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

echo  Baglaniyor %TV%:26101 ...
"%SDB%" connect %TV%:26101
if errorlevel 1 (
  echo Baglanamadi. Developer Mode ve Host IP bu PC mi?
  pause
  exit /b 1
)
"%SDB%" devices
echo.
echo  Kuruluor...
"%SDB%" push "%WGT%" /home/owner/share/tmp/sdk_tools/VelaIPTV.wgt
"%SDB%" shell 0 vd_appinstall VelaIPTVtv /home/owner/share/tmp/sdk_tools/VelaIPTV.wgt
"%SDB%" shell 0 launch VelaIPTVtv.VelaIPTV
echo.
echo  Bitti. TV'de VELA IPTV PLAYER acilmali.
pause
endlocal
