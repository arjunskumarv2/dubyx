#!/bin/bash
# Dubyx — one-shot setup for a fresh Amazon Linux 2023 EC2 instance.
# Run as root (EC2 user-data runs as root), or with sudo.
#
#   DOMAIN=api.example.com REPO=https://github.com/arjunskumarv2/dubyx.git ./bootstrap.sh
#
set -euo pipefail

DOMAIN="${DOMAIN:?Set DOMAIN to the hostname pointed at this instance}"
REPO="${REPO:-https://github.com/arjunskumarv2/dubyx.git}"
APP_DIR="${APP_DIR:-/opt/dubyx}"

echo "==> Installing Docker and git"
dnf install -y docker git >/dev/null
systemctl enable --now docker
# Compose v2 plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

echo "==> Fetching the application"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only
else
  git clone "$REPO" "$APP_DIR"
fi
cd "$APP_DIR/deploy"

echo "==> Writing environment (secrets generated once, then reused)"
if [ ! -f .env ]; then
  cat > .env <<ENV
DOMAIN=$DOMAIN
DB_PASSWORD=$(openssl rand -hex 24)
JWT_SECRET=$(openssl rand -hex 32)
ENV
  chmod 600 .env
fi

echo "==> Building the admin portal against https://$DOMAIN/api"
rm -rf portal && mkdir -p portal
docker build -f Dockerfile.portal --target export \
  --output "type=local,dest=$APP_DIR/deploy/portal" \
  --build-arg "VITE_API_URL=https://$DOMAIN/api" "$APP_DIR"

echo "==> Starting Postgres, API and Caddy"
docker compose up -d --build

echo "==> Waiting for the API to report healthy"
for i in $(seq 1 30); do
  if docker compose logs api 2>/dev/null | grep -q "Dubyx API running"; then break; fi
  sleep 5
done

cat <<DONE

Dubyx is up.

  Portal   https://$DOMAIN
  API      https://$DOMAIN/api
  Health   https://$DOMAIN/health

The database schema is applied automatically on every start (prisma db push).
To create the initial accounts and sample data on a brand-new database:

  cd $APP_DIR/deploy && docker compose exec api node seed-dist/seed.js

Then sign in as superadmin@dubyx.sa and change every default password.
DONE
