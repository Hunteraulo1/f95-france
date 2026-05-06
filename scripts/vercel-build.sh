#!/usr/bin/env bash
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ]; then
	echo "==> Running db:migrate (VERCEL_ENV=production)"
	bun run db:migrate
	echo "==> db:migrate finished"
fi

echo "==> Running vite build"
bun run build
echo "==> build finished"
