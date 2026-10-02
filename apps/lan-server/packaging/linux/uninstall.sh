#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="obra-na-mao-server.service"
UNIT_PATH="/etc/systemd/system/$SERVICE_NAME"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "A remoção do Obra na Mão Server precisa ser executada como root/sudo." >&2
  exit 1
fi

if systemctl list-unit-files --type=service 2>/dev/null | grep -q "^$SERVICE_NAME"; then
  systemctl disable --now obra-na-mao-server.service || true
fi
rm -f "$UNIT_PATH"
rm -rf "/opt/obra-na-mao/server"
systemctl daemon-reload

printf '%s\n' 'Obra na Mão Server removido. Configuração e dados em /etc/obra-na-mao e /var/lib/obra-na-mao foram preservados.'
