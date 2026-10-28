!macro preInit
  ; Kill running instance so app.asar is not locked during install
  nsExec::Exec 'taskkill /f /im "LiveChatCCB Desktop.exe"'
  Sleep 500
  ; Remove stale resources directory to guarantee clean ASAR replacement
  SetShellVarContext current
  RMDir /r "$LOCALAPPDATA\Programs\livechat-ccb-desktop\resources"
!macroend
