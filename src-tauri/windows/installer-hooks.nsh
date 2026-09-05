!macro NSIS_HOOK_POSTINSTALL
  CreateShortCut "$DESKTOP\Mobile Shop System.lnk" "$INSTDIR\${MAINBINARYNAME}.exe" "" "$INSTDIR\${MAINBINARYNAME}.exe" 0
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  Delete "$DESKTOP\Mobile Shop System.lnk"
!macroend
