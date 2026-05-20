#!/usr/bin/env bash
# Copie la base Postgres prod vers la base Postgres dev (écrase le contenu dev).
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

# Charge POSTGRES_{PREFIX}_* dans PG_HOST, PG_PORT, PG_DB, PG_USER, PG_PASSWORD, PG_SSLMODE.
# PREFIX vide → POSTGRES_* / PG* (dev local par défaut).
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

# Vide tous les schémas applicatifs sur la dev (public, auth, etc.) avant import.
wipe_dev_database() {
	export_pg_env
	psql -v ON_ERROR_STOP=1 <<'SQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = current_database()
  AND pid <> pg_backend_pid();

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

CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO public;
SQL
}

if ! command -v pg_dump >/dev/null 2>&1; then
	echo "Erreur: pg_dump introuvable. Installe le client PostgreSQL."
	exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
	echo "Erreur: psql introuvable. Installe le client PostgreSQL."
	exit 1
fi

if ! load_pg_config "PROD"; then
	echo "Erreur: configuration prod incomplète."
	echo "Définir dans .env : POSTGRES_PROD_HOST, POSTGRES_PROD_PASSWORD"
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

if load_pg_config "DEV"; then
	:
elif load_pg_config ""; then
	:
else
	echo "Erreur: configuration dev incomplète."
	echo "Définir POSTGRES_DEV_* ou POSTGRES_HOST + POSTGRES_PASSWORD (Docker local)."
	exit 1
fi
DEV_LABEL="$(pg_connection_label)"
DEV_HOST="${PG_HOST}"
DEV_PORT="${PG_PORT}"
DEV_DB="${PG_DB}"
DEV_USER="${PG_USER}"
DEV_PASSWORD="${PG_PASSWORD}"
DEV_SSLMODE="${PG_SSLMODE}"

YES_MODE=false
if [[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]]; then
	YES_MODE=true
fi

if [[ "${YES_MODE}" != "true" ]]; then
	echo "Cette action va ECRASER la base dev avec la base prod."
	echo "Source (prod): ${PROD_LABEL} (ssl=${PROD_SSLMODE})"
	echo "Cible (dev):   ${DEV_LABEL} (ssl=${DEV_SSLMODE})"
	read -r -p "Continuer ? (yes/no) " confirm
	if [[ "${confirm}" != "yes" ]]; then
		echo "Annulé."
		exit 0
	fi
fi

echo "Vidage des schémas applicatifs sur la base dev..."
PG_HOST="${DEV_HOST}"
PG_PORT="${DEV_PORT}"
PG_DB="${DEV_DB}"
PG_USER="${DEV_USER}"
PG_PASSWORD="${DEV_PASSWORD}"
PG_SSLMODE="${DEV_SSLMODE}"
wipe_dev_database

echo "Import depuis prod..."
PG_HOST="${PROD_HOST}"
PG_PORT="${PROD_PORT}"
PG_DB="${PROD_DB}"
PG_USER="${PROD_USER}"
PG_PASSWORD="${PROD_PASSWORD}"
PG_SSLMODE="${PROD_SSLMODE}"
export_pg_env
# Sans --clean : le schéma dev est déjà vide, l’ordre CREATE évite les conflits FK.
pg_dump --no-owner --no-privileges --no-tablespaces | {
	PG_HOST="${DEV_HOST}"
	PG_PORT="${DEV_PORT}"
	PG_DB="${DEV_DB}"
	PG_USER="${DEV_USER}"
	PG_PASSWORD="${DEV_PASSWORD}"
	PG_SSLMODE="${DEV_SSLMODE}"
	export_pg_env
	psql -v ON_ERROR_STOP=1 -q
}

echo "Terminé: base dev synchronisée depuis prod."
