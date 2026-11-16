#!/usr/bin/env bash
set -euo pipefail
if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  exec sudo -- "$0" "$@"
fi
NODE=/opt/obra-na-mao/server/runtime/node
CONFIGURATOR=/opt/obra-na-mao/server/app/src/configurator.mjs
if [[ ! -x "$NODE" || ! -f "$CONFIGURATOR" ]]; then
  echo 'Arquivos do configurador não encontrados. Reinstale o Obra na Mão Server.' >&2
  exit 1
fi
exec "$NODE" "$CONFIGURATOR"
