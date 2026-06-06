#!/usr/bin/env bash
# Install the Hermes Bridge as a systemd service on the host.
# Run this AFTER Hermes is installed (`hermes setup` completed) and AFTER
# Mission Control's install.sh has generated a HERMES_BRIDGE_TOKEN in .env.
#
#   sudo ./scripts/install-hermes-bridge.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [ "${EUID}" -ne 0 ]; then
  echo "Run as root: sudo $0" >&2
  exit 1
fi

if [ ! -f .env ]; then
  echo "No .env found — run scripts/install.sh first." >&2
  exit 1
fi

# Read values out of .env without sourcing it (so quotes/spaces are safe).
TOKEN=$(grep -E '^HERMES_BRIDGE_TOKEN=' .env | head -1 | sed 's/^HERMES_BRIDGE_TOKEN=//; s/^"//; s/"$//')
HERMES_DIR=$(grep -E '^HERMES_DIR=' .env | head -1 | sed 's/^HERMES_DIR=//; s/^"//; s/"$//')
BRIDGE_PORT=$(grep -E '^HERMES_BRIDGE_PORT=' .env | head -1 | sed 's/^HERMES_BRIDGE_PORT=//; s/^"//; s/"$//')
BRIDGE_PORT=${BRIDGE_PORT:-7181}

if [ -z "${TOKEN}" ]; then
  echo "HERMES_BRIDGE_TOKEN not set in .env. Generate one and add it, then rerun." >&2
  echo "   suggested: HERMES_BRIDGE_TOKEN=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 40)" >&2
  exit 1
fi

HERMES_DIR=${HERMES_DIR:-${HOME}/.hermes}
# Locate the hermes binary
HERMES_BIN=$(command -v hermes || true)
if [ -z "${HERMES_BIN}" ]; then
  # Try common locations
  for cand in /root/.local/bin/hermes "${HERMES_DIR}/.venv/bin/hermes" "${HOME}/.local/bin/hermes"; do
    [ -x "${cand}" ] && HERMES_BIN="${cand}" && break
  done
fi
if [ -z "${HERMES_BIN}" ]; then
  echo "Couldn't find the 'hermes' binary on PATH or in common locations." >&2
  echo "Install Hermes first: curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash" >&2
  exit 1
fi

NODE_BIN=$(command -v node || true)
if [ -z "${NODE_BIN}" ]; then
  echo "Node.js not found on host. Install Node 18+ first: apt-get install -y nodejs npm" >&2
  exit 1
fi

REPO_DIR=$(pwd)
RUN_AS=${SUDO_USER:-root}

UNIT_PATH=/etc/systemd/system/hermes-bridge.service

cat > "${UNIT_PATH}" <<EOF
[Unit]
Description=Hermes Bridge (Mission Control)
After=network.target

[Service]
Type=simple
User=${RUN_AS}
WorkingDirectory=${REPO_DIR}
Environment=HERMES_BRIDGE_PORT=${BRIDGE_PORT}
Environment=HERMES_BRIDGE_HOST=0.0.0.0
Environment=HERMES_BRIDGE_TOKEN=${TOKEN}
Environment=HERMES_BIN=${HERMES_BIN}
Environment=HERMES_DIR=${HERMES_DIR}
ExecStart=${NODE_BIN} ${REPO_DIR}/scripts/hermes-bridge.mjs
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

chmod 644 "${UNIT_PATH}"
systemctl daemon-reload
systemctl enable --now hermes-bridge
sleep 1
systemctl --no-pager status hermes-bridge | head -20

echo
echo "=============================================================="
echo "  Hermes Bridge running on port ${BRIDGE_PORT}"
echo "  Logs:   journalctl -u hermes-bridge -f"
echo "  Stop:   systemctl stop hermes-bridge"
echo "  Health: curl http://127.0.0.1:${BRIDGE_PORT}/healthz"
echo "=============================================================="
