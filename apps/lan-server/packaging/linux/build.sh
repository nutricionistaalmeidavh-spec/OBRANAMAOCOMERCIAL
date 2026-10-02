#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
COMMON_DIR="$SCRIPT_DIR/../common"
LOCK_PATH="$COMMON_DIR/vendor-lock.json"
OUTPUT_DIR="${OUTPUT_DIR:-$REPO_ROOT/apps/lan-server/dist/server-linux-x64}"
CACHE_DIR="${CACHE_DIR:-${TMPDIR:-/tmp}/obra-na-mao-server-build}"
COMMIT_SHA="${COMMIT_SHA:-${GITHUB_SHA:-local-build}}"

NODE_VERSION="$(tr -d '\r\n ' < "$REPO_ROOT/.nvmrc")"
LOCK_NODE_VERSION="$(node -e "const x=require(process.argv[1]);process.stdout.write(x.node.version)" "$LOCK_PATH")"
if [[ "$NODE_VERSION" != "$LOCK_NODE_VERSION" ]]; then
  echo "Node do vendor lock ($LOCK_NODE_VERSION) diverge da .nvmrc ($NODE_VERSION)." >&2
  exit 1
fi

NODE_FILE="$(node -e "const x=require(process.argv[1]);process.stdout.write(x.node.linuxX64.file)" "$LOCK_PATH")"
NODE_URL="$(node -e "const x=require(process.argv[1]);process.stdout.write(x.node.linuxX64.url)" "$LOCK_PATH")"
NODE_SHA="$(node -e "const x=require(process.argv[1]);process.stdout.write(x.node.linuxX64.sha256)" "$LOCK_PATH")"

mkdir -p "$CACHE_DIR"
NODE_ARCHIVE="$CACHE_DIR/$NODE_FILE"
if [[ ! -f "$NODE_ARCHIVE" ]]; then
  curl --fail --location --silent --show-error "$NODE_URL" --output "$NODE_ARCHIVE"
fi
printf '%s  %s\n' "$NODE_SHA" "$NODE_ARCHIVE" | sha256sum --check --status || {
  rm -f "$NODE_ARCHIVE"
  echo "Falha de checksum SHA-256 do Node Linux x64." >&2
  exit 1
}

EXTRACT_DIR="$CACHE_DIR/node-$NODE_VERSION-linux-x64"
rm -rf "$EXTRACT_DIR"
mkdir -p "$EXTRACT_DIR"
tar -xJf "$NODE_ARCHIVE" -C "$EXTRACT_DIR"
NODE_BINARY="$EXTRACT_DIR/node-v$NODE_VERSION-linux-x64/bin/node"
if [[ ! -x "$NODE_BINARY" ]]; then
  echo "Runtime Node não encontrado após extração: $NODE_BINARY" >&2
  exit 1
fi

export OBRA_PACKAGE_BUILDER="$COMMON_DIR/build-package.mjs"
export OBRA_PACKAGE_REPO_ROOT="$REPO_ROOT"
export OBRA_PACKAGE_OUTPUT="$OUTPUT_DIR"
export OBRA_PACKAGE_NODE="$NODE_BINARY"
export OBRA_PACKAGE_COMMIT="$COMMIT_SHA"
export OBRA_PACKAGE_UNIT="$SCRIPT_DIR/obra-na-mao-server.service"
export OBRA_PACKAGE_ENV_TEMPLATE="$SCRIPT_DIR/server.env.template"
export OBRA_PACKAGE_INSTALL="$SCRIPT_DIR/install.sh"
export OBRA_PACKAGE_UNINSTALL="$SCRIPT_DIR/uninstall.sh"

node --input-type=module <<'NODE'
import { pathToFileURL } from 'node:url'
const { buildServerPackage } = await import(pathToFileURL(process.env.OBRA_PACKAGE_BUILDER).href)
buildServerPackage({
  repoRoot: process.env.OBRA_PACKAGE_REPO_ROOT,
  outputDir: process.env.OBRA_PACKAGE_OUTPUT,
  platform: 'linux',
  arch: 'x64',
  commitSha: process.env.OBRA_PACKAGE_COMMIT,
  nodeBinaryPath: process.env.OBRA_PACKAGE_NODE,
  platformFiles: [
    { source: process.env.OBRA_PACKAGE_UNIT, destination: 'obra-na-mao-server.service' },
    { source: process.env.OBRA_PACKAGE_ENV_TEMPLATE, destination: 'server.env.template' },
    { source: process.env.OBRA_PACKAGE_INSTALL, destination: 'install.sh' },
    { source: process.env.OBRA_PACKAGE_UNINSTALL, destination: 'uninstall.sh' }
  ]
})
NODE

chmod 0755 "$OUTPUT_DIR/runtime/node" "$OUTPUT_DIR/platform/install.sh" "$OUTPUT_DIR/platform/uninstall.sh"
SERVER_VERSION="$(node -e "const x=require(process.argv[1]);process.stdout.write(x.version)" "$REPO_ROOT/apps/lan-server/package.json")"
ARCHIVE_PATH="${ARCHIVE_PATH:-$(dirname "$OUTPUT_DIR")/Obra-na-Mao-Server-${SERVER_VERSION}-linux-x64.tar.gz}"
rm -f "$ARCHIVE_PATH"
tar --sort=name --mtime='UTC 2020-01-01' --owner=0 --group=0 --numeric-owner -czf "$ARCHIVE_PATH" -C "$OUTPUT_DIR" .
printf 'Linux Server package: %s\nArchive: %s\n' "$OUTPUT_DIR" "$ARCHIVE_PATH"
