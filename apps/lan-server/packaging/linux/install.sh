#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="obra-na-mao-server.service"
SERVICE_USER="obra-na-mao"
SERVICE_GROUP="obra-na-mao"
INSTALL_ROOT="/opt/obra-na-mao/server"
CONFIG_DIR="/etc/obra-na-mao"
CONFIG_PATH="$CONFIG_DIR/server.env"
DATA_DIR="/var/lib/obra-na-mao"
LOG_DIR="/var/log/obra-na-mao"
UNIT_PATH="/etc/systemd/system/$SERVICE_NAME"
READY_TIMEOUT_SECONDS="${READY_TIMEOUT_SECONDS:-30}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "A instalação do Obra na Mão Server precisa ser executada como root/sudo." >&2
  exit 1
fi

ARCH="$(uname -m)"
case "$ARCH" in
  x86_64|amd64) ;;
  *) echo "Arquitetura não suportada: $ARCH. F20 suporta amd64/x86_64." >&2; exit 1 ;;
esac

if [[ -r /etc/os-release ]]; then
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}" in
    ubuntu|debian) ;;
    *)
      if [[ "${ID_LIKE:-}" != *debian* ]]; then
        echo "Distribuição não suportada nesta fase: ${ID:-desconhecida}. Use Ubuntu LTS ou Debian stable." >&2
        exit 1
      fi
      ;;
  esac
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="${PACKAGE_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
if [[ ! -x "$PACKAGE_DIR/runtime/node" || ! -f "$PACKAGE_DIR/app/src/index.mjs" || ! -f "$PACKAGE_DIR/platform/obra-na-mao-server.service" ]]; then
  echo "Pacote do Obra na Mão Server incompleto: $PACKAGE_DIR" >&2
  exit 1
fi
if [[ "$(readlink -f "$PACKAGE_DIR")" == "$INSTALL_ROOT" ]]; then
  echo "Execute install.sh a partir do pacote extraído, não do diretório final $INSTALL_ROOT." >&2
  exit 1
fi

if systemctl list-unit-files --type=service 2>/dev/null | grep -q "^$SERVICE_NAME"; then
  systemctl stop obra-na-mao-server.service || true
fi

if ! id -u "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin "$SERVICE_USER"
fi

mkdir -p "$CONFIG_DIR" "$DATA_DIR" "$DATA_DIR/backups" "$LOG_DIR" /opt/obra-na-mao
chown -R "$SERVICE_USER:$SERVICE_GROUP" "$DATA_DIR" "$LOG_DIR"
chmod 0750 "$DATA_DIR" "$DATA_DIR/backups" "$LOG_DIR"
chmod 0750 "$CONFIG_DIR"

if [[ ! -f /etc/obra-na-mao/server.env ]]; then
  cp "$PACKAGE_DIR/platform/server.env.template" "$CONFIG_PATH"
fi
chown root:"$SERVICE_GROUP" "$CONFIG_PATH"
chmod 0640 "$CONFIG_PATH"

STAGING="$(mktemp -d /opt/obra-na-mao/.server-new.XXXXXX)"
cleanup_staging() { [[ -d "$STAGING" ]] && rm -rf "$STAGING"; }
trap cleanup_staging EXIT
cp -a "$PACKAGE_DIR/." "$STAGING/"
chown -R root:root "$STAGING"
chmod -R go-w "$STAGING"
chmod 0755 "$STAGING/runtime/node" "$STAGING/platform/install.sh" "$STAGING/platform/uninstall.sh"
rm -rf "$INSTALL_ROOT"
mv "$STAGING" "$INSTALL_ROOT"
trap - EXIT

cp "$INSTALL_ROOT/platform/obra-na-mao-server.service" "$UNIT_PATH"
chown root:root "$UNIT_PATH"
chmod 0644 "$UNIT_PATH"
systemctl daemon-reload
systemctl enable --now obra-na-mao-server.service

PORT="$(sed -n 's/^OBRA_NA_MAO_SERVER_PORT=//p' "$CONFIG_PATH" | tail -n 1 | tr -d '[:space:]')"
PORT="${PORT:-4732}"
DEADLINE=$((SECONDS + READY_TIMEOUT_SECONDS))
READY=0
while (( SECONDS < DEADLINE )); do
  if OBRA_READY_URL="http://127.0.0.1:${PORT}/ready" "$INSTALL_ROOT/runtime/node" --input-type=module -e 'try { const r = await fetch(process.env.OBRA_READY_URL); const body = await r.json(); process.exit(r.ok && body?.ready === true ? 0 : 1) } catch { process.exit(1) }'; then
    READY=1
    break
  fi
  sleep 0.25
done

if [[ "$READY" -ne 1 ]]; then
  systemctl status "$SERVICE_NAME" --no-pager || true
  echo "Obra na Mão Server não ficou ready em ${READY_TIMEOUT_SECONDS}s. O estado persistente foi preservado." >&2
  exit 1
fi

printf 'Obra na Mão Server instalado e ready em 127.0.0.1:%s.\n' "$PORT"
