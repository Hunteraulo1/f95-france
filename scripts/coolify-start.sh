#!/usr/bin/env bash
# Entrypoint au démarrage du conteneur (Coolify : `bun run start`).
# Sync prod → PTB uniquement si SYNC_PROD_TO_PTB_ON_DEPLOY=true (ressource PTB uniquement).
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

# adapter-node sert build/client depuis le dossier du chunk (build/server/chunks/).
fix_adapter_node_static_paths() {
	local chunks_client="${ROOT_DIR}/build/server/chunks/client"
	if [[ -d "${ROOT_DIR}/build/client" && ! -e "${chunks_client}" ]]; then
		ln -sfn ../../client "${chunks_client}"
	fi
}

run_migrate_and_server() {
	fix_adapter_node_static_paths
	bun run db:migrate
	ORIGIN="${ORIGIN:-${SERVICE_URL_APP:-http://localhost:${PORT:-3000}}}"
	export ORIGIN
	exec bun build/index.js
}

sync_enabled="$(printf '%s' "${SYNC_PROD_TO_PTB_ON_DEPLOY:-}" | tr '[:upper:]' '[:lower:]')"

if [[ "${sync_enabled}" == "true" || "${sync_enabled}" == "1" ]]; then
	echo "[coolify] SYNC_PROD_TO_PTB_ON_DEPLOY activé — copie prod → PTB (public + drizzle)…"
	bash "${ROOT_DIR}/scripts/sync-db.sh" --target ptb --yes
	fix_adapter_node_static_paths
	ORIGIN="${ORIGIN:-${SERVICE_URL_APP:-http://localhost:${PORT:-3000}}}"
	export ORIGIN
	exec bun build/index.js
fi

run_migrate_and_server
