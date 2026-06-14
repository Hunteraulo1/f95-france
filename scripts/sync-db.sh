#!/usr/bin/env bash
# Copie la base MariaDB prod vers une cible (dev local ou PTB).
# Usage:
#   ./scripts/sync-prod-to-dev-db.sh [--target dev|ptb] [--yes]
#
# dev (défaut) : MARIADB_DEV_* ou MARIADB_* — puis stamp + migrate.
# ptb          : MARIADB_PTB_* ou MARIADB_* — puis migrate seul.
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

# Charge MARIADB_{PREFIX}_* dans DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
load_db_config() {
	local prefix="${1:-}"
	local host_var port_var db_var user_var pass_var

	if [[ -n "${prefix}" ]]; then
		host_var="MARIADB_${prefix}_HOST"
		port_var="MARIADB_${prefix}_PORT"
		db_var="MARIADB_${prefix}_DATABASE"
		user_var="MARIADB_${prefix}_USER"
		pass_var="MARIADB_${prefix}_PASSWORD"
	else
		host_var="MARIADB_HOST"
		port_var="MARIADB_PORT"
		db_var="MARIADB_DATABASE"
		user_var="MARIADB_USER"
		pass_var="MARIADB_PASSWORD"
	fi

	DB_HOST="$(printf '%s' "${!host_var:-}" | xargs)"
	DB_PORT="$(printf '%s' "${!port_var:-3306}" | xargs)"
	DB_NAME="$(printf '%s' "${!db_var:-f95france}" | xargs)"
	DB_USER="$(printf '%s' "${!user_var:-f95france}" | xargs)"
	DB_PASSWORD="$(printf '%s' "${!pass_var:-}" | xargs)"

	if [[ -z "${DB_HOST}" || -z "${DB_PASSWORD}" ]]; then
		return 1
	fi
}

db_connection_label() {
	printf '%s@%s:%s/%s' "${DB_USER}" "${DB_HOST}" "${DB_PORT}" "${DB_NAME}"
}

mysql_cmd() {
	mysql --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" \
		--password="${DB_PASSWORD}" --database="${DB_NAME}" "$@"
}

mysqldump_cmd() {
	mysqldump --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" \
		--password="${DB_PASSWORD}" \
		--single-transaction --skip-lock-tables --no-tablespaces \
		"${DB_NAME}" "$@"
}

wipe_target_database() {
	mysql --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" \
		--password="${DB_PASSWORD}" \
		-e "DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
}

if ! command -v mysqldump >/dev/null 2>&1; then
	echo "Erreur: mysqldump introuvable. Installe le client MariaDB (nixpacks: mariadb)."
	exit 1
fi

if ! command -v mysql >/dev/null 2>&1; then
	echo "Erreur: mysql introuvable. Installe le client MariaDB."
	exit 1
fi

if ! load_db_config "PROD"; then
	echo "Erreur: configuration prod incomplète."
	echo "Définir dans .env / Coolify : MARIADB_PROD_HOST, MARIADB_PROD_PASSWORD"
	exit 1
fi
PROD_LABEL="$(db_connection_label)"
PROD_HOST="${DB_HOST}"
PROD_PORT="${DB_PORT}"
PROD_DB="${DB_NAME}"
PROD_USER="${DB_USER}"
PROD_PASSWORD="${DB_PASSWORD}"

TARGET_PREFIX=""
if [[ "${TARGET}" == "ptb" ]]; then
	TARGET_PREFIX="PTB"
fi

if load_db_config "${TARGET_PREFIX}"; then
	:
elif [[ "${TARGET}" == "dev" ]] && load_db_config ""; then
	:
else
	echo "Erreur: configuration cible (${TARGET}) incomplète."
	if [[ "${TARGET}" == "ptb" ]]; then
		echo "Définir MARIADB_PTB_* ou MARIADB_* (base de l'app PTB sur Coolify)."
	else
		echo "Définir MARIADB_DEV_* ou MARIADB_HOST + MARIADB_PASSWORD."
	fi
	exit 1
fi
TARGET_LABEL="$(db_connection_label)"
TARGET_HOST="${DB_HOST}"
TARGET_PORT="${DB_PORT}"
TARGET_DB="${DB_NAME}"
TARGET_USER="${DB_USER}"
TARGET_PASSWORD="${DB_PASSWORD}"

if [[ "${YES_MODE}" != "true" ]]; then
	echo "Cette action va ECRASER la base cible avec la base prod."
	echo "Cible: ${TARGET}"
	echo "Source (prod): ${PROD_LABEL}"
	echo "Destination:   ${TARGET_LABEL}"
	read -r -p "Continuer ? (yes/no) " confirm
	if [[ "${confirm}" != "yes" ]]; then
		echo "Annulé."
		exit 0
	fi
fi

echo "Vidage de la base cible (${TARGET})..."
DB_HOST="${TARGET_HOST}"
DB_PORT="${TARGET_PORT}"
DB_NAME="${TARGET_DB}"
DB_USER="${TARGET_USER}"
DB_PASSWORD="${TARGET_PASSWORD}"
wipe_target_database

echo "Import depuis prod..."
DB_HOST="${PROD_HOST}"
DB_PORT="${PROD_PORT}"
DB_NAME="${PROD_DB}"
DB_USER="${PROD_USER}"
DB_PASSWORD="${PROD_PASSWORD}"

mysqldump_cmd |
	{
		DB_HOST="${TARGET_HOST}"
		DB_PORT="${TARGET_PORT}"
		DB_NAME="${TARGET_DB}"
		DB_USER="${TARGET_USER}"
		DB_PASSWORD="${TARGET_PASSWORD}"
		mysql --host="${DB_HOST}" --port="${DB_PORT}" --user="${DB_USER}" \
			--password="${DB_PASSWORD}" "${DB_NAME}"
	}

echo "Terminé: base ${TARGET} synchronisée depuis prod."

if [[ "${TARGET}" == "dev" ]]; then
	echo "Marquage des migrations Drizzle..."
	(cd "${ROOT_DIR}" && bun run db:stamp-migrations)
fi

echo "Application des migrations en attente..."
(cd "${ROOT_DIR}" && bun run db:migrate)
