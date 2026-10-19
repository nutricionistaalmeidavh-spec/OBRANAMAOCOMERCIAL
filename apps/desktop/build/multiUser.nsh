# NSIS has a different built-in MultiUser.nsh (case-insensitive on Windows).
# Keep electron-builder's original elevation/install-location implementation.
!include "${PROJECT_DIR}\node_modules\app-builder-lib\templates\nsis\multiUser.nsh"
