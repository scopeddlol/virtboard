; ---------------------------------------------------------------------------
;  Virtboard — custom NSIS installer script (included by electron-builder)
; ---------------------------------------------------------------------------
!include "x64.nsh"
!include "LogicLib.nsh"

!macro customHeader
  BrandingText "Virtboard ${VERSION}  ·  Soundboard && Voice Changer"
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Virtboard ${VERSION}"
  !define MUI_WELCOMEPAGE_TITLE_3LINES
  !define MUI_WELCOMEPAGE_TEXT "Virtboard is a lightweight soundboard and real-time voice changer that plays straight into Discord, games and streaming apps through a virtual microphone.$\r$\n$\r$\n    •  Unlimited sounds with global hotkeys$\r$\n    •  Pages of sounds with their own keybinds$\r$\n    •  Custom voice-changer presets$\r$\n    •  Built-in sound trimmer$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customFinishPage
  Function StartApp
    ${if} ${isUpdated}
      StrCpy $1 "--updated"
    ${else}
      StrCpy $1 ""
    ${endif}
    ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
  FunctionEnd
  !define MUI_FINISHPAGE_RUN
  !define MUI_FINISHPAGE_RUN_TEXT "Launch Virtboard now"
  !define MUI_FINISHPAGE_RUN_FUNCTION "StartApp"
  !define MUI_FINISHPAGE_TITLE "You're all set!"
  !define MUI_FINISHPAGE_TITLE_3LINES
  !define MUI_FINISHPAGE_TEXT "Virtboard has been installed.$\r$\n$\r$\nTip: in Discord (Settings > Voice && Video) set your Input Device to $\"CABLE Output (VB-Audio Virtual Cable)$\" so everyone hears your voice effects and sounds."
  !define MUI_FINISHPAGE_LINK "Visit Virtboard on GitHub"
  !define MUI_FINISHPAGE_LINK_LOCATION "https://github.com/scopeddlol/virtboard"
  !insertmacro MUI_PAGE_FINISH
!macroend

; Returns "1" in $R9 when the VB-Audio Virtual Cable driver is present.
!macro DetectVBCable
  StrCpy $R9 "0"
  ${If} ${RunningX64}
    ${DisableX64FSRedirection}
  ${EndIf}
  FindFirst $R7 $R8 "$WINDIR\System32\drivers\vbaudio_cable*.sys"
  ${If} $R8 != ""
    StrCpy $R9 "1"
  ${EndIf}
  FindClose $R7
  ${If} ${RunningX64}
    ${EnableX64FSRedirection}
  ${EndIf}
!macroend

!macro customInstall
  ; Offer to set up the virtual microphone driver (skipped for silent installs / updates).
  IfSilent vb_done
  !insertmacro DetectVBCable
  StrCmp $R9 "1" vb_done
  MessageBox MB_YESNO|MB_ICONQUESTION "Virtboard sends your voice and sounds to other apps through a virtual microphone.$\r$\n$\r$\nThis uses the free VB-Audio Virtual Cable driver, which isn't installed yet.$\r$\n$\r$\nDownload and install it now? (Recommended — you can also do this later from Settings.)" /SD IDNO IDNO vb_done
    DetailPrint "Downloading VB-Audio Virtual Cable…"
    StrCpy $R6 "$TEMP\virtboard-vbcable"
    CreateDirectory "$R6"
    nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$$ProgressPreference=\"SilentlyContinue\"; [Net.ServicePointManager]::SecurityProtocol=\"Tls12\"; Invoke-WebRequest -UseBasicParsing -Uri \"https://download.vb-audio.com/Download_CABLE/VBCABLE_Driver_Pack45.zip\" -OutFile \"$R6\vbcable.zip\"; Expand-Archive -Force -LiteralPath \"$R6\vbcable.zip\" -DestinationPath \"$R6\""'
    Pop $0
    IfFileExists "$R6\VBCABLE_Setup_x64.exe" 0 vb_web
      DetailPrint "Launching VB-CABLE setup (click $\"Install Driver$\")…"
      ExecShellWait "open" "$R6\VBCABLE_Setup_x64.exe"
      Goto vb_done
    vb_web:
      MessageBox MB_OK|MB_ICONINFORMATION "The automatic download didn't work, so the VB-CABLE download page will open instead.$\r$\nInstall it, then restart Virtboard."
      ExecShell "open" "https://vb-audio.com/Cable/"
  vb_done:
!macroend

!macro customUnInstall
  ; Remove the "launch on startup" entry if the user enabled it.
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "com.virtboard.app"
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Virtboard"
!macroend
