!include "MUI2.nsh"

!define MUI_WELCOMEPAGE_TITLE "Welcome to Palnest Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard installs Palnest — Palworld Server & Mod Manager ${VERSION} on your PC.$\r$\n$\r$\nYou can choose the folder, a desktop shortcut, and a Start menu shortcut on the next pages.$\r$\n$\r$\nClose Palnest if it is already running, then click Next."
!define MUI_DIRECTORYPAGE_TEXT_TOP "Setup will install Palnest in the following folder. To install in a different folder, click Browse and choose another directory."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Palnest.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Palnest"
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\README.txt"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "Open the getting-started notes"
