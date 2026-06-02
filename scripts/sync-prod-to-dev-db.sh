#!/usr/bin/env bash
# Copie la base Postgres prod vers une cible (dev local ou PTB).
# Usage:
#   ./scripts/sync-prod-to-dev-db.sh [--target dev|ptb] [--yes] [--include-drizzle|--no-include-drizzle]
#
# dev (défaut) : POSTGRES_DEV_* ou POSTGRES_* — schéma public, puis stamp + migrate.
# ptb          : POSTGRES_PTB_* ou POSTGRES_* — public + drizzle (défaut), puis migrate seul.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ -f "${ENV_FILE}" ]]; then
	set -a
	set +u
	# shellcheck disable=SC1090
	source "${ENV_FILE}"
	set -u
	set +a
fi

TARGET="dev"
YES_MODE=false
INCLUDE_DRIZZLE=""

while [[ $# -gt 0 ]]; do
	case "${1}" in
	--target)
		TARGET="${2:?--target requiert dev ou ptb}"
		shift 2
		;;
	--yes | -y)
		YES_MODE=true
		shift
		;;
	--include-drizzle)
		INCLUDE_DRIZZLE=true
		shift
		;;
	--no-include-drizzle)
		INCLUDE_DRIZZLE=false
		shift
		;;
	*)
		echo "Option inconnue: ${1}"
		exit 1
		;;
	esac
done

if [[ "${TARGET}" != "dev" && "${TARGET}" != "ptb" ]]; then
	echo "Erreur: --target doit être dev ou ptb (reçu: ${TARGET})"
	exit 1
fi

if [[ -z "${INCLUDE_DRIZZLE}" ]]; then
	if [[ "${TARGET}" == "ptb" ]]; then
		INCLUDE_DRIZZLE=true
	else
		INCLUDE_DRIZZLE=false
	fi
fi

# Charge POSTGRES_{PREFIX}_* dans PG_HOST, PG_PORT, PG_DB, PG_USER, PG_PASSWORD, PG_SSLMODE.
load_pg_config() {
	local prefix="${1:-}"
	local host_var port_var db_var user_var pass_var ssl_var

	if [[ -n "${prefix}" ]]; then
		host_var="POSTGRES_${prefix}_HOST"
		port_var="POSTGRES_${prefix}_PORT"
		db_var="POSTGRES_${prefix}_DB"
		user_var="POSTGRES_${prefix}_USER"
		pass_var="POSTGRES_${prefix}_PASSWORD"
		ssl_var="POSTGRES_${prefix}_SSL_MODE"
	else
		host_var="POSTGRES_HOST"
		port_var="POSTGRES_PORT"
		db_var="POSTGRES_DB"
		user_var="POSTGRES_USER"
		pass_var="POSTGRES_PASSWORD"
		ssl_var="POSTGRES_SSL_MODE"
	fi

	PG_HOST="$(printf '%s' "${!host_var:-${PGHOST:-}}" | xargs)"
	PG_PORT="$(printf '%s' "${!port_var:-${PGPORT:-5432}}" | xargs)"
	PG_DB="$(printf '%s' "${!db_var:-${PGDATABASE:-postgres}}" | xargs)"
	PG_USER="$(printf '%s' "${!user_var:-${PGUSER:-postgres}}" | xargs)"
	PG_PASSWORD="$(printf '%s' "${!pass_var:-${PGPASSWORD:-}}" | xargs)"
	PG_SSLMODE="$(printf '%s' "${!ssl_var:-${PGSSLMODE:-}}" | tr '[:upper:]' '[:lower:]' | xargs)"

	if [[ -z "${PG_HOST}" || -z "${PG_PASSWORD}" ]]; then
		return 1
	fi

	if [[ -z "${PG_SSLMODE}" ]]; then
		if [[ "${PG_HOST}" =~ ^(localhost|127\.0\.0\.1)$ ]]; then
			PG_SSLMODE="disable"
		else
			PG_SSLMODE="require"
		fi
	fi
}

pg_connection_label() {
	printf '%s@%s:%s/%s' "${PG_USER}" "${PG_HOST}" "${PG_PORT}" "${PG_DB}"
}

export_pg_env() {
	export PGHOST="${PG_HOST}"
	export PGPORT="${PG_PORT}"
	export PGUSER="${PG_USER}"
	export PGPASSWORD="${PG_PASSWORD}"
	export PGDATABASE="${PG_DB}"
	export PGSSLMODE="${PG_SSLMODE}"
}

wipe_target_database() {
	export_pg_env
	psql -v ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();

DO $drop_sub$
DECLARE
	sub record;
BEGIN
	FOR sub IN SELECT subname FROM pg_subscription LOOP
		EXECUTE format('DROP SUBSCRIPTION IF EXISTS %I', sub.subname);
	END LOOP;
END
$drop_sub$;

DO $drop_pub$
DECLARE
	pub record;
BEGIN
	FOR pub IN SELECT pubname FROM pg_publication LOOP
		EXECUTE format('DROP PUBLICATION IF EXISTS %I', pub.pubname);
	END LOOP;
END
$drop_pub$;

DO $wipe$
DECLARE
	sch text;
BEGIN
	FOR sch IN
		SELECT nspname
		FROM pg_namespace
		WHERE nspname NOT LIKE 'pg\_%' ESCAPE '\'
			AND nspname <> 'information_schema'
	LOOP
		EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', sch);
	END LOOP;
END
$wipe$;
SQL
}

filter_dump_for_plain_postgres() {
	if [[ "${TARGET}" != "ptb" ]]; then
		cat
		return
	fi
	sed -E \
		-e '/^(CREATE|ALTER|DROP) PUBLICATION /d' \
		-e '/^(CREATE|ALTER|DROP) SUBSCRIPTION /d' \
		-e '/^CREATE EVENT TRIGGER /d' \
		-e '/^ALTER EVENT TRIGGER /d' \
		-e '/^CREATE POLICY /d' \
		-e '/^ALTER POLICY /d' \
		-e '/^DROP POLICY /d' \
		-e '/^REVOKE .* FROM (anon|authenticated)/d' \
		-e '/^GRANT .* TO (anon|authenticated)/d'
}

if ! command -v pg_dump >/dev/null 2>&1; then
	echo "Erreur: pg_dump introuvable. Installe le client PostgreSQL (nixpacks: postgresql)."
	exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
	echo "Erreur: psql introuvable. Installe le client PostgreSQL."
	exit 1
fi

if ! load_pg_config "PROD"; then
	echo "Erreur: configuration prod incomplète."
	echo "Définir dans .env / Coolify : POSTGRES_PROD_HOST, POSTGRES_PROD_PASSWORD"
	echo "Optionnel : POSTGRES_PROD_PORT, POSTGRES_PROD_DB, POSTGRES_PROD_USER, POSTGRES_PROD_SSL_MODE"
	exit 1
fi
PROD_LABEL="$(pg_connection_label)"
PROD_HOST="${PG_HOST}"
PROD_PORT="${PG_PORT}"
PROD_DB="${PG_DB}"
PROD_USER="${PG_USER}"
PROD_PASSWORD="${PG_PASSWORD}"
PROD_SSLMODE="${PG_SSLMODE}"

TARGET_PREFIX=""
if [[ "${TARGET}" == "ptb" ]]; then
	TARGET_PREFIX="PTB"
fi

if load_pg_config "${TARGET_PREFIX}"; then
	:
elif [[ "${TARGET}" == "dev" ]] && load_pg_config ""; then
	:
else
	echo "Erreur: configuration cible (${TARGET}) incomplète."
	if [[ "${TARGET}" == "ptb" ]]; then
		echo "Définir POSTGRES_PTB_* ou POSTGRES_* (base de l’app PTB sur Coolify)."
	else
		echo "Définir POSTGRES_DEV_* ou POSTGRES_HOST + POSTGRES_PASSWORD."
	fi
	exit 1
fi
TARGET_LABEL="$(pg_connection_label)"
TARGET_HOST="${PG_HOST}"
TARGET_PORT="${PG_PORT}"
TARGET_DB="${PG_DB}"
TARGET_USER="${PG_USER}"
TARGET_PASSWORD="${PG_PASSWORD}"
TARGET_SSLMODE="${PG_SSLMODE}"

if [[ "${YES_MODE}" != "true" ]]; then
	echo "Cette action va ECRASER la base cible avec la base prod."
	echo "Cible: ${TARGET}"
	echo "Source (prod): ${PROD_LABEL} (ssl=${PROD_SSLMODE})"
	echo "Destination:   ${TARGET_LABEL} (ssl=${TARGET_SSLMODE})"
	echo "Schémas: public$([[ "${INCLUDE_DRIZZLE}" == "true" ]] && echo ', drizzle')"
	read -r -p "Continuer ? (yes/no) " confirm
	if [[ "${confirm}" != "yes" ]]; then
		echo "Annulé."
		exit 0
	fi
fi

echo "Vidage des schémas applicatifs sur la base cible (${TARGET})..."
PG_HOST="${TARGET_HOST}"
PG_PORT="${TARGET_PORT}"
PG_DB="${TARGET_DB}"
PG_USER="${TARGET_USER}"
PG_PASSWORD="${TARGET_PASSWORD}"
PG_SSLMODE="${TARGET_SSLMODE}"
wipe_target_database

DUMP_SCHEMA_ARGS=(--schema=public)
if [[ "${INCLUDE_DRIZZLE}" == "true" ]]; then
	DUMP_SCHEMA_ARGS+=(--schema=drizzle)
fi

echo "Import depuis prod (${DUMP_SCHEMA_ARGS[*]})..."
PG_HOST="${PROD_HOST}"
PG_PORT="${PROD_PORT}"
PG_DB="${PROD_DB}"
PG_USER="${PROD_USER}"
PG_PASSWORD="${PROD_PASSWORD}"
PG_SSLMODE="${PROD_SSLMODE}"
export_pg_env

pg_dump --no-owner --no-privileges --no-tablespaces "${DUMP_SCHEMA_ARGS[@]}" |
	filter_dump_for_plain_postgres |
	{
		PG_HOST="${TARGET_HOST}"
		PG_PORT="${TARGET_PORT}"
		PG_DB="${TARGET_DB}"
		PG_USER="${TARGET_USER}"
		PG_PASSWORD="${TARGET_PASSWORD}"
		PG_SSLMODE="${TARGET_SSLMODE}"
		export_pg_env
		psql -v ON_ERROR_STOP=1 -q
	}

echo "Terminé: base ${TARGET} synchronisée depuis prod."

if [[ "${INCLUDE_DRIZZLE}" == "true" ]]; then
	echo "Journal Drizzle copié depuis prod — application des migrations en attente (code PTB)…"
	(cd "${ROOT_DIR}" && bun run db:migrate)
else
	echo "Marquage des migrations Drizzle (schéma public aligné prod)…"
	(cd "${ROOT_DIR}" && bun run db:stamp-migrations)
	echo "Application des migrations en attente…"
	(cd "${ROOT_DIR}" && bun run db:migrate)
fi
