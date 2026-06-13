#!/usr/bin/env bash
# Entrypoint au démarrage du conteneur (Coolify : `bun run start`).
# Sync prod → PTB uniquement si SYNC_PROD_TO_PTB_ON_DEPLOY=true (ressource PTB uniquement).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

run_migrate_and_server() {
	bun run db:migrate
	ORIGIN="${ORIGIN:-${PUBLIC_APP_ORIGIN:-http://localhost:${PORT:-3000}}}"
	export ORIGIN
	exec bun build/index.js
}

sync_enabled="$(printf '%s' "${SYNC_PROD_TO_PTB_ON_DEPLOY:-}" | tr '[:upper:]' '[:lower:]')"

if [[ "${sync_enabled}" == "true" || "${sync_enabled}" == "1" ]]; then
	echo "[coolify] SYNC_PROD_TO_PTB_ON_DEPLOY activé — copie prod → PTB (public + drizzle)…"
	bash "${ROOT_DIR}/scripts/sync-db.sh" --target ptb --yes
	ORIGIN="${ORIGIN:-${PUBLIC_APP_ORIGIN:-http://localhost:${PORT:-3000}}}"
	export ORIGIN
	exec bun build/index.js
fi

run_migrate_and_server
