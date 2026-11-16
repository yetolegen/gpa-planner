Unicode true
!define VER "1.3.1"
Name "GPA Planner"
OutFile "dist\GPA-Planner-Setup-${VER}.exe"
InstallDir "$LOCALAPPDATA\Programs\GPA Planner"
RequestExecutionLevel user
SetCompressor /SOLID lzma
AutoCloseWindow true
Icon "..\icons\app.ico"
UninstallIcon "..\icons\app.ico"
Page instfiles
UninstPage instfiles

Section
  nsExec::Exec 'taskkill /F /IM "GPA Planner.exe"'
  RMDir /r "$INSTDIR"
  SetOutPath "$INSTDIR"
  File /r "dist\app\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateShortcut "$DESKTOP\GPA Planner.lnk" "$INSTDIR\GPA Planner.exe"
  CreateShortcut "$SMPROGRAMS\GPA Planner.lnk" "$INSTDIR\GPA Planner.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GPAPlanner" "DisplayName" "GPA Planner"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GPAPlanner" "DisplayVersion" "${VER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GPAPlanner" "Publisher" "yetolegen"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GPAPlanner" "DisplayIcon" "$INSTDIR\GPA Planner.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GPAPlanner" "UninstallString" "$INSTDIR\Uninstall.exe"
  Exec '"$INSTDIR\GPA Planner.exe"'
SectionEnd

Section Uninstall
  nsExec::Exec 'taskkill /F /IM "GPA Planner.exe"'
  Delete "$DESKTOP\GPA Planner.lnk"
  Delete "$SMPROGRAMS\GPA Planner.lnk"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GPAPlanner"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "GPA Planner"
  RMDir /r "$INSTDIR"
SectionEnd
