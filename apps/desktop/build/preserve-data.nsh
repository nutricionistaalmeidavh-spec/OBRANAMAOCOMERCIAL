# Keep electron-builder's normal installer/uninstaller generation and elevation.
# Only replace the install section: legacy uninstallers recursively delete the
# entire installation, including user-owned folders and SMB share targets.
# NSIS resolves relative includes from its compiler working directory first.
!addincludedir "${PROJECT_DIR}\node_modules\app-builder-lib\templates\nsis"
!cd "${BUILD_RESOURCES_DIR}"
