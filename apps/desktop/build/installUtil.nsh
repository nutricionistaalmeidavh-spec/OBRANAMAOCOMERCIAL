# The overlay installer only needs these stock electron-builder 26.15.3 (MIT)
# copy helpers. Do not compile or call legacy recursive-uninstall functions.
!macro moveFile FROM TO
  ClearErrors
  Rename `${FROM}` `${TO}`
  ${if} ${errors}
    ClearErrors
    !insertmacro copyFile `${FROM}` `${TO}`
    Delete `${FROM}`
  ${endif}
!macroend

!macro copyFile FROM TO
  ${StdUtils.GetParentPath} $R5 `${TO}`
  CreateDirectory `$R5`
  ClearErrors
  CopyFiles /SILENT `${FROM}` `${TO}`
!macroend
