#!/usr/bin/env bash
set -euo pipefail
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo 'Execute: sudo /opt/obra-na-mao/server/platform/configure-server.sh' >&2
  exit 1
fi
exec /opt/obra-na-mao/server/runtime/node /opt/obra-na-mao/server/platform/config-wizard.mjs