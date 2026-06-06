#!/usr/bin/env bash
# Mission Control installer — one-command client onboarding.
# Run from the repo root:  ./scripts/install.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo
  echo "==> No .env found — let's set one up."
  echo "    Press ENTER to accept defaults shown in [brackets]."
  echo

  read -rp "Client name [Darcy's Business]: " CLIENT_NAME
  CLIENT_NAME=${CLIENT_NAME:-Darcy\'s Business}

  read -rp "Client slug [darcy]: " CLIENT_SLUG
  CLIENT_SLUG=${CLIENT_SLUG:-darcy}

  read -rp "Owner name [Darcy Mitchell]: " CLIENT_OWNER
  CLIENT_OWNER=${CLIENT_OWNER:-Darcy Mitchell}

  read -rp "Owner role [Content creator]: " CLIENT_ROLE
  CLIENT_ROLE=${CLIENT_ROLE:-Content creator}

  read -rp "Timezone [America/Chicago]: " CLIENT_TIMEZONE
  CLIENT_TIMEZONE=${CLIENT_TIMEZONE:-America/Chicago}

  read -rp "Short TZ label [Chicago]: " CLIENT_TZ_LABEL
  CLIENT_TZ_LABEL=${CLIENT_TZ_LABEL:-Chicago}

  read -rp "Description [AI-powered ops]: " CLIENT_DESCRIPTION
  CLIENT_DESCRIPTION=${CLIENT_DESCRIPTION:-AI-powered ops}

  read -rp "Hermes -> Dashboard ingest API key (generate one): " INGEST_API_KEY
  if [ -z "${INGEST_API_KEY}" ]; then
    INGEST_API_KEY=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 40 || true)
    echo "    generated: ${INGEST_API_KEY}"
  fi

  read -rp "Hermes API URL (https://hermes.client.com) [optional]: " HERMES_API_URL
  read -rp "Hermes API key [optional]: " HERMES_API_KEY

  read -rp "Slack bot token (xoxb-…) [optional]: " SLACK_BOT_TOKEN
  read -rp "Slack channel ID (Cxxx) [optional]: " SLACK_CHANNEL_ID
  read -rp "Slack signing secret [optional]: " SLACK_SIGNING_SECRET

  read -srp "Dashboard login password (for the client): " DASHBOARD_PASSWORD
  echo
  read -srp "Owner password (you — unlocks /admin): " OWNER_PASSWORD
  echo

  # Detect where Hermes is installed on this host (defaults to the home of
  # whoever ran install.sh — usually ~/.hermes).
  DEFAULT_HERMES_DIR="${HOME}/.hermes"
  read -rp "Path to Hermes install on this host [${DEFAULT_HERMES_DIR}]: " HERMES_DIR_INPUT
  HERMES_DIR="${HERMES_DIR_INPUT:-${DEFAULT_HERMES_DIR}}"
  if [ ! -d "${HERMES_DIR}" ]; then
    echo "    note: ${HERMES_DIR} doesn't exist yet — admin UI will show 'not installed' until Hermes is set up."
  fi

  # NEXTAUTH_URL must match the URL the *browser* will load the dashboard at,
  # otherwise next-auth issues redirects to the wrong host (e.g. localhost)
  # and sign-out / sign-in callbacks 404. Auto-detect the public IP as a
  # default; the user can override if they already have a domain.
  DEFAULT_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
  DEFAULT_IP=${DEFAULT_IP:-localhost}
  DEFAULT_NEXTAUTH_URL="http://${DEFAULT_IP}:4180"
  read -rp "Public dashboard URL the client will open [${DEFAULT_NEXTAUTH_URL}]: " NEXTAUTH_URL_INPUT
  NEXTAUTH_URL="${NEXTAUTH_URL_INPUT:-${DEFAULT_NEXTAUTH_URL}}"
  # Strip a trailing slash so next-auth doesn't double it.
  NEXTAUTH_URL="${NEXTAUTH_URL%/}"

  NEXTAUTH_SECRET=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 48 || true)

  cat > .env <<EOF
CLIENT_NAME="${CLIENT_NAME}"
CLIENT_SLUG="${CLIENT_SLUG}"
CLIENT_OWNER="${CLIENT_OWNER}"
CLIENT_ROLE="${CLIENT_ROLE}"
CLIENT_INITIALS="$(echo "${CLIENT_OWNER}" | awk '{for(i=1;i<=NF;i++) printf "%s", toupper(substr($i,1,1));}' | cut -c1-2)"
CLIENT_TIMEZONE="${CLIENT_TIMEZONE}"
CLIENT_TZ_LABEL="${CLIENT_TZ_LABEL}"
CLIENT_DESCRIPTION="${CLIENT_DESCRIPTION}"

INGEST_API_KEY="${INGEST_API_KEY}"
HERMES_API_URL="${HERMES_API_URL}"
HERMES_API_KEY="${HERMES_API_KEY}"

SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN}"
SLACK_CHANNEL_ID="${SLACK_CHANNEL_ID}"
SLACK_SIGNING_SECRET="${SLACK_SIGNING_SECRET}"

NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL="${NEXTAUTH_URL}"
DASHBOARD_PASSWORD="${DASHBOARD_PASSWORD}"
OWNER_PASSWORD="${OWNER_PASSWORD}"

HERMES_DIR="${HERMES_DIR}"

DATABASE_URL="file:./data/db.sqlite"
PORT=3000

HERMES_BRIDGE_URL="http://host.docker.internal:7181"
HERMES_BRIDGE_TOKEN="$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 40 || true)"
HERMES_BRIDGE_PORT=7181
EOF

  echo
  echo "==> Wrote .env (HERMES_BRIDGE_TOKEN auto-generated)"
fi

mkdir -p data

echo
echo "==> Building & launching containers"
docker compose up -d --build

echo
echo "==> Running database migrations"
docker compose exec -T app npx prisma migrate deploy

read -rp "Seed with 30 days of demo data? [y/N] " seed
if [[ "${seed:-N}" =~ ^[Yy]$ ]]; then
  docker compose exec -T app npm run seed
fi

IP=$(hostname -I 2>/dev/null | awk '{print $1}')
IP=${IP:-localhost}

cat <<EOM

==============================================================
  Mission Control is live.
  Dashboard:        http://${IP}:4180/
  Ingest endpoint:  http://${IP}:4180/api/ingest/{event|draft|agent-comm|memory}

  Configure Hermes with:
    DASHBOARD_URL=http://${IP}:4180
    INGEST_API_KEY=  (the value in this .env)

  Slack interactive callback URL:
    http://${IP}:4180/api/slack/callback

  Optional — install the Hermes Bridge (lets /admin/crons run
  \`hermes cron list/add/remove\` live on the host):

    sudo ./scripts/install-hermes-bridge.sh
==============================================================
EOM
