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
mkdir -p /usr/local/lib/docker/cli-plugins
# Compose v2
curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
# Recent Compose needs buildx >= 0.17; Amazon Linux ships an older one
ARCH=$([ "$(uname -m)" = "aarch64" ] && echo arm64 || echo amd64)
BUILDX_TAG=$(curl -fsSL https://api.github.com/repos/docker/buildx/releases/latest | grep -o '"tag_name": "[^"]*"' | cut -d'"' -f4)
curl -fsSL "https://github.com/docker/buildx/releases/download/${BUILDX_TAG}/buildx-${BUILDX_TAG}.linux-${ARCH}" \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
usermod -aG docker ec2-user 2>/dev/null || true

# t3.micro has 1 GB of RAM — the portal build runs out of memory without swap
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

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

echo "==> Building the admin portal"
rm -rf portal && mkdir -p portal
# The portal is served from the same origin as the API, so a relative /api
# works over both HTTP and HTTPS and survives a change of hostname.
docker build -f Dockerfile.portal --target export \
  --output "type=local,dest=$APP_DIR/deploy/portal" \
  --build-arg "VITE_API_URL=/api" "$APP_DIR"

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
