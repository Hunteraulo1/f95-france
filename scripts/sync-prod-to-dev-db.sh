#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
	set -a
	# shellcheck disable=SC1090
	source "${ENV_FILE}"
	set +a
fi

if [[ -z "${SUPABASE_DATABASE_URL:-}" ]]; then
	echo "Erreur: SUPABASE_DATABASE_URL est vide ou non défini."
	echo "Renseigne la variable dans .env (DB prod)."
	exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
	echo "Erreur: DATABASE_URL est vide ou non défini."
	echo "Renseigne la variable dans .env (DB dev)."
	exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
	echo "Erreur: pg_dump introuvable. Installe le client PostgreSQL."
	exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
	echo "Erreur: psql introuvable. Installe le client PostgreSQL."
	exit 1
fi

YES_MODE=false
if [[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]]; then
	YES_MODE=true
fi

if [[ "${YES_MODE}" != "true" ]]; then
	echo "Cette action va ECRASER la base dev avec la base prod."
	echo "Source (prod): SUPABASE_DATABASE_URL"
	echo "Cible (dev):  DATABASE_URL"
	read -r -p "Continuer ? (yes/no) " confirm
	if [[ "${confirm}" != "yes" ]]; then
		echo "Annulé."
		exit 0
	fi
fi

echo "Synchronisation prod -> dev en cours..."
pg_dump --clean --if-exists --no-owner --no-privileges "${SUPABASE_DATABASE_URL}" | psql "${DATABASE_URL}"
echo "Terminé: base dev synchronisée depuis prod."
