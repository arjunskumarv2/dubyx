# Deploying Dubyx to a single EC2 instance

One `t3.micro` runs everything: Postgres, the Node API, and Caddy serving the
admin portal with automatic HTTPS. Uploads and database files live on Docker
volumes on the instance, so customer photos and attendance selfies survive
redeploys (they do not on Render's ephemeral disk).

## 1. Permissions this needs

The `CTO` IAM user currently has no deployment permissions — every EC2, RDS, S3
and CloudFormation call is denied. For this single-instance setup, one policy is
enough:

- **`AmazonEC2FullAccess`** — launch the instance, security group, and key pair

Nothing else is required: the portal is served from the same box, so no S3 or
CloudFront, and Postgres runs in a container, so no RDS.

Also check the account is fully activated. `apprunner list-services` returned
`SubscriptionRequiredException`, which usually means sign-up is incomplete
(most often an unverified payment method) — services stay unusable until that
is resolved, whatever the IAM policy says.

## 2. A domain is required

The mobile app calls `https://`, and Android blocks cleartext HTTP by default,
so the instance needs a real hostname with a certificate. Point an A record at
the instance's Elastic IP before running the bootstrap — Caddy then obtains and
renews a Let's Encrypt certificate on its own.

## 3. Launch

- AMI: **Amazon Linux 2023**, type `t3.micro` (free tier eligible for 12 months)
- Storage: 20 GB gp3
- Security group inbound: `22` (your IP only), `80` and `443` (anywhere)
- Attach an **Elastic IP** so the address survives a stop/start

Then, on the instance:

```bash
sudo DOMAIN=api.yourdomain.com bash /opt/dubyx/deploy/bootstrap.sh
```

or paste `bootstrap.sh` into the launch wizard's **user data** with `DOMAIN` set
at the top. It installs Docker, clones the repo, generates the database password
and JWT secret, builds the portal against `https://$DOMAIN/api`, and starts
everything.

## 4. Seed a brand-new database

The schema is applied on every start (`prisma db push`), but a fresh database
has no users:

```bash
cd /opt/dubyx/deploy
docker compose exec api node seed-dist/seed.js
```

This creates `superadmin@dubyx.sa`, `admin@dubyx.sa` and `sales1@dubyx.sa`.
**Change every password immediately** — the default is in the public repo.

## 5. Point the apps at the new host

- **Portal** — already baked in at build time by `bootstrap.sh`.
- **Mobile** — pass the host at build time, no source edit needed:

  ```bash
  cd mobile-app
  flutter build apk --release --split-per-abi \
    --dart-define=API_BASE_URL=https://api.yourdomain.com/api
  ```

## No domain? Use a free one

The mobile app needs HTTPS, and a certificate needs a hostname — an EC2
public DNS name will not do. If you do not own a domain, create a free
subdomain at [duckdns.org](https://duckdns.org) (takes a minute), point it at
the instance's Elastic IP, and use it as `DOMAIN`. Caddy will get a valid
Let's Encrypt certificate for it.

## Moving existing data across

If the old database is still reachable, copy it over rather than re-seeding:

```bash
pg_dump "<old DATABASE_URL>" > dump.sql
docker compose exec -T db psql -U dubyx dubyx < dump.sql
```

## Operations

```bash
cd /opt/dubyx/deploy
docker compose logs -f api          # tail the API
docker compose pull && docker compose up -d --build   # deploy latest main
docker compose exec db pg_dump -U dubyx dubyx > backup-$(date +%F).sql
```

Take regular `pg_dump` backups to S3 or off-box — a single instance has no
managed backup, unlike RDS. ZATCA requires tax invoices to be retained for
six years, so this matters for compliance, not just uptime.
