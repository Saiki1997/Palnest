; Palnest Windows Setup Wizard (NSIS 3 / MUI2)
; Compiled from Linux makensis wrapping the unpacked Electron app.
Unicode true
!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"

!ifndef VERSION
  !define VERSION "3.0.0"
!endif
!ifndef APP_DIR
  !error "Pass -DAPP_DIR= to the unpacked Palnest folder"
!endif
!ifndef OUT_FILE
  !error "Pass -DOUT_FILE= for the setup .exe"
!endif
!ifndef ICON
  !error "Pass -DICON="
!endif
!ifndef LICENSE
  !error "Pass -DLICENSE="
!endif
!ifndef SIDEBAR_BMP
  !error "Pass -DSIDEBAR_BMP="
!endif
!ifndef HEADER_BMP
  !error "Pass -DHEADER_BMP="
!endif
!ifndef README
  !define README "${APP_DIR}/README.txt"
!endif

Name "Palnest"
Caption "Palnest ${VERSION} Setup"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\Palnest"
InstallDirRegKey HKCU "Software\Palnest" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64
CRCCheck on
XPStyle on
ShowInstDetails show
ShowUnInstDetails show
BrandingText "Palnest — Palworld Server & Mod Manager ${VERSION}"

VIProductVersion "${VERSION}.0"
VIAddVersionKey "ProductName" "Palnest"
VIAddVersionKey "ProductVersion" "${VERSION}"
VIAddVersionKey "FileDescription" "Palnest Setup Wizard"
VIAddVersionKey "FileVersion" "${VERSION}"
VIAddVersionKey "LegalCopyright" "Copyright (c) 2026 Palnest"
VIAddVersionKey "CompanyName" "Palnest"
VIAddVersionKey "OriginalFilename" "Palnest-Setup-${VERSION}.exe"
VIAddVersionKey "Comments" "Palworld Server & Mod Manager. Choose install folder, desktop shortcut, and Start menu shortcut."

InstType "Typical"
InstType "Minimal (no shortcuts)"

!define MUI_ABORTWARNING
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "${HEADER_BMP}"
!define MUI_HEADERIMAGE_RIGHT
!define MUI_WELCOMEFINISHPAGE_BITMAP "${SIDEBAR_BMP}"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "${SIDEBAR_BMP}"
!define MUI_WELCOMEPAGE_TITLE "Welcome to Palnest Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will install Palnest ${VERSION} — Palworld Server & Mod Manager — on your computer.$\r$\n$\r$\nOn the next pages you can:$\r$\n    -  Choose optional Desktop and Start menu shortcuts$\r$\n    -  Pick the installation folder$\r$\n$\r$\nClose Palnest if it is already running, then click Next to continue."
!define MUI_LICENSEPAGE_TEXT_TOP "Please review the license before installing Palnest."
!define MUI_LICENSEPAGE_TEXT_BOTTOM "Click I Agree to continue. You must accept the license to install Palnest."
!define MUI_COMPONENTSPAGE_SMALLDESC
!define MUI_COMPONENTSPAGE_TEXT_TOP "Select the extra shortcuts you want. Palnest itself is always installed."
!define MUI_COMPONENTSPAGE_TEXT_COMPLIST "Shortcuts"
!define MUI_DIRECTORYPAGE_TEXT_TOP "Setup will install Palnest in the following folder. To install in a different folder, click Browse and choose another directory."
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Installation folder"
!define MUI_FINISHPAGE_RUN "$INSTDIR\Palnest.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Palnest now"
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\README.txt"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Open the getting-started notes"
!define MUI_FINISHPAGE_NOAUTOCLOSE
!define MUI_FINISHPAGE_NOREBOOTSUPPORT
!define MUI_UNABORTWARNING

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "${LICENSE}"
!insertmacro MUI_PAGE_COMPONENTS
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_OK|MB_ICONSTOP "Palnest requires 64-bit Windows 10 or later."
    Abort
  ${EndIf}
  System::Call "kernel32::CreateMutex(p 0, i 0, t 'PalnestSetupMutex') p .r0 ?e"
  Pop $1
  ${If} $1 <> 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Palnest Setup is already running."
    Abort
  ${EndIf}
FunctionEnd

Section "Palnest (required)" SecApp
  SectionIn RO 1 2
  SetOutPath "$INSTDIR"
  File /r "${APP_DIR}/*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "Software\Palnest" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest" "DisplayName" "Palnest"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest" "Publisher" "Palnest"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest" "DisplayIcon" "$INSTDIR\Palnest.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest" "URLInfoAbout" "https://github.com/Saiki1997/Palnest"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest" "HelpLink" "https://github.com/Saiki1997/Palnest/releases"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest" "NoRepair" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest" "EstimatedSize" 280000
SectionEnd

Section "Desktop shortcut" SecDesktop
  SectionIn 1
  CreateShortCut "$DESKTOP\Palnest.lnk" "$INSTDIR\Palnest.exe" "" "$INSTDIR\Palnest.exe" 0
SectionEnd

Section "Start menu shortcut" SecStart
  SectionIn 1
  CreateDirectory "$SMPROGRAMS\Palnest"
  CreateShortCut "$SMPROGRAMS\Palnest\Palnest.lnk" "$INSTDIR\Palnest.exe" "" "$INSTDIR\Palnest.exe" 0
  CreateShortCut "$SMPROGRAMS\Palnest\Uninstall Palnest.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\Palnest.lnk"
  Delete "$SMPROGRAMS\Palnest\Palnest.lnk"
  Delete "$SMPROGRAMS\Palnest\Uninstall Palnest.lnk"
  RMDir "$SMPROGRAMS\Palnest"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Palnest"
  DeleteRegKey HKCU "Software\Palnest"
  RMDir /r "$INSTDIR"
SectionEnd

LangString DESC_SecApp ${LANG_ENGLISH} "The Palnest application (required). Includes Palnest.exe and everything needed to run."
LangString DESC_SecDesktop ${LANG_ENGLISH} "Put a Palnest shortcut on your desktop. You can skip this."
LangString DESC_SecStart ${LANG_ENGLISH} "Put Palnest in the Start menu, plus an Uninstall shortcut."

!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecApp} $(DESC_SecApp)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecDesktop} $(DESC_SecDesktop)
  !insertmacro MUI_DESCRIPTION_TEXT ${SecStart} $(DESC_SecStart)
!insertmacro MUI_FUNCTION_DESCRIPTION_END
