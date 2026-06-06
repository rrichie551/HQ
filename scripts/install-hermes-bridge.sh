#!/usr/bin/env bash
# Install the Hermes Bridge as a systemd service on the host.
# Run this AFTER Hermes is installed (`hermes setup` completed) and AFTER
# Mission Control's install.sh has generated a HERMES_BRIDGE_TOKEN in .env.
#
#   sudo ./scripts/install-hermes-bridge.sh
#
set -euo pipefail

# Print each major step so silent exits are no longer possible.
step() { printf '\n==> %s\n' "$*"; }
die()  { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

cd "$(dirname "$0")/.."

step "preflight"
[ "${EUID}" -eq 0 ] || die "Run as root: sudo $0"
[ -f .env ] || die "No .env found at $(pwd)/.env — run scripts/install.sh first."
echo "    cwd: $(pwd)"

step "reading .env"
# Note the `|| true` on each pipeline — with `set -euo pipefail` enabled,
# a grep that doesn't match returns exit 1 and aborts the whole script
# even when the variable is legitimately optional (e.g. HERMES_DIR may
# not be set; we default to /root/.hermes a few lines down).
read_env() {
  grep -E "^$1=" .env 2>/dev/null | head -1 | sed "s/^$1=//; s/^\"//; s/\"\$//" || true
}
TOKEN=$(read_env HERMES_BRIDGE_TOKEN)
HERMES_DIR=$(read_env HERMES_DIR)
BRIDGE_PORT=$(read_env HERMES_BRIDGE_PORT)
BRIDGE_PORT=${BRIDGE_PORT:-7181}

if [ -z "${TOKEN}" ]; then
  echo "    HERMES_BRIDGE_TOKEN not set in .env." >&2
  echo "    suggested: HERMES_BRIDGE_TOKEN=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 40)" >&2
  die "Add HERMES_BRIDGE_TOKEN to .env and rerun."
fi
HERMES_DIR=${HERMES_DIR:-/root/.hermes}
echo "    HERMES_DIR=${HERMES_DIR}"
echo "    HERMES_BRIDGE_PORT=${BRIDGE_PORT}"
echo "    HERMES_BRIDGE_TOKEN length=${#TOKEN}"

# We're typically run via sudo. sudo strips PATH down to secure_path, so
# binaries installed in /root/.local/bin/ or per-user nvm paths aren't on
# PATH. Search a wide net before giving up.
find_bin() {
  local name="$1"; shift
  local found
  found=$(command -v "$name" 2>/dev/null || true)
  if [ -n "$found" ]; then printf '%s\n' "$found"; return; fi
  for cand in "$@"; do
    if [ -x "$cand" ]; then printf '%s\n' "$cand"; return; fi
  done
}

step "locating node"
NODE_CANDIDATES=(
  /root/.local/bin/node
  /usr/local/bin/node
  /usr/bin/node
  /opt/homebrew/bin/node
  "${HOME}/.local/bin/node"
)
# Add the newest nvm Node if present
if [ -d /root/.nvm/versions/node ]; then
  while IFS= read -r p; do NODE_CANDIDATES+=("$p"); done < <(ls -1d /root/.nvm/versions/node/*/bin/node 2>/dev/null | sort -V)
fi
NODE_BIN=$(find_bin node "${NODE_CANDIDATES[@]}" || true)
if [ -z "${NODE_BIN}" ]; then
  echo "    candidates searched:" >&2
  for c in "${NODE_CANDIDATES[@]}"; do echo "      $c" >&2; done
  die "Node.js not found. Install Node 18+ (e.g. apt install -y nodejs) or set HERMES_BRIDGE_NODE in .env to its absolute path."
fi
echo "    node: ${NODE_BIN} ($("${NODE_BIN}" --version))"

step "locating hermes"
HERMES_CANDIDATES=(
  /usr/local/bin/hermes
  /root/.local/bin/hermes
  "${HERMES_DIR}/.venv/bin/hermes"
  "${HOME}/.local/bin/hermes"
)
HERMES_BIN=$(find_bin hermes "${HERMES_CANDIDATES[@]}" || true)
if [ -z "${HERMES_BIN}" ]; then
  echo "    candidates searched:" >&2
  for c in "${HERMES_CANDIDATES[@]}"; do echo "      $c" >&2; done
  die "Hermes binary not found. Install it first: curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash"
fi
echo "    hermes: ${HERMES_BIN}"

REPO_DIR=$(pwd)
RUN_AS=${SUDO_USER:-root}
UNIT_PATH=/etc/systemd/system/hermes-bridge.service

step "writing systemd unit at ${UNIT_PATH}"
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

step "enabling + starting"
systemctl daemon-reload
systemctl enable --now hermes-bridge
sleep 1
systemctl --no-pager status hermes-bridge | head -20 || true

step "smoke test"
if curl -fsS "http://127.0.0.1:${BRIDGE_PORT}/healthz" >/dev/null 2>&1; then
  echo "    ✓ /healthz responding on port ${BRIDGE_PORT}"
else
  echo "    ✗ /healthz NOT responding — check: sudo journalctl -u hermes-bridge -n 50" >&2
  exit 1
fi

cat <<EOM

==============================================================
  Hermes Bridge running on port ${BRIDGE_PORT}.
  Health: curl http://127.0.0.1:${BRIDGE_PORT}/healthz
  Logs:   sudo journalctl -u hermes-bridge -f
  Stop:   sudo systemctl stop hermes-bridge
  Start:  sudo systemctl start hermes-bridge

  Now refresh /admin/crons in the dashboard — you should see a
  green "Hermes Bridge online" banner and Live mode active.
==============================================================
EOM
