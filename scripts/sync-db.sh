#!/usr/bin/env bash
# Copie la base MariaDB prod vers une cible (dev local ou PTB).
# Usage:
#   ./scripts/sync-prod-to-dev-db.sh [--target dev|ptb] [--yes]
#
# dev (défaut) : MARIADB_DEV_* ou MARIADB_* — puis migrate.
# ptb          : MARIADB_PTB_* ou MARIADB_* — puis migrate.
#
# Le dump prod inclut sa table `__drizzle_migrations` : après import, la cible
# connaît l'état réel des migrations de prod, et `db:migrate` applique seulement
# le delta (migrations présentes en local mais pas encore en prod). NE PAS
# « stamper » le journal complet ici : ça écraserait ce ledger importé et
# `db:migrate` croirait tout appliqué (→ schéma en retard, erreurs 500).
#
# L'étape Drizzle (migrate) utilise MARIADB_* : le script la surcharge avec la
# config de la cible (--target dev|ptb), pas celle du .env local.
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

TARGET_CONFIG_PREFIX=""

load_target_db_config() {
	TARGET_CONFIG_PREFIX=""
	if [[ "${TARGET}" == "ptb" ]]; then
		if load_db_config "PTB"; then
			TARGET_CONFIG_PREFIX="PTB"
			return 0
		fi
		if load_db_config ""; then
			return 0
		fi
		return 1
	fi

	if load_db_config "DEV"; then
		TARGET_CONFIG_PREFIX="DEV"
		return 0
	fi
	if load_db_config ""; then
		return 0
	fi
	return 1
}

run_on_target_db() {
	local ssl_mode="${MARIADB_SSL_MODE:-}"
	local ssl_var

	if [[ -n "${TARGET_CONFIG_PREFIX}" ]]; then
		ssl_var="MARIADB_${TARGET_CONFIG_PREFIX}_SSL_MODE"
		if [[ -n "${!ssl_var:-}" ]]; then
			ssl_mode="${!ssl_var}"
		fi
	fi

	echo "Connexion Drizzle: ${TARGET_USER}@${TARGET_HOST}:${TARGET_PORT}/${TARGET_DB}"
	MARIADB_HOST="${TARGET_HOST}" \
		MARIADB_PORT="${TARGET_PORT}" \
		MARIADB_DATABASE="${TARGET_DB}" \
		MARIADB_USER="${TARGET_USER}" \
		MARIADB_PASSWORD="${TARGET_PASSWORD}" \
		MARIADB_SSL_MODE="${ssl_mode}" \
		"$@"
}

MARIADB_CLIENT_IMAGE="${MARIADB_CLIENT_IMAGE:-mariadb:11.4}"
USE_DOCKER_MYSQL=0

resolve_mysql_client() {
	MYSQL_CLI=""
	MYSQLDUMP_CLI=""

	if command -v mysql >/dev/null 2>&1 && command -v mysqldump >/dev/null 2>&1; then
		MYSQL_CLI="mysql"
		MYSQLDUMP_CLI="mysqldump"
	elif command -v mariadb >/dev/null 2>&1 && command -v mariadb-dump >/dev/null 2>&1; then
		MYSQL_CLI="mariadb"
		MYSQLDUMP_CLI="mariadb-dump"
	fi

	if [[ -n "${MYSQL_CLI}" ]]; then
		return 0
	fi

	if command -v docker >/dev/null 2>&1; then
		USE_DOCKER_MYSQL=1
		echo "Client MariaDB local absent — utilisation de Docker (${MARIADB_CLIENT_IMAGE})."
		return 0
	fi

	echo "Erreur: client MariaDB introuvable (mysql/mysqldump ou mariadb/mariadb-dump)."
	echo "Installe le client MariaDB (ex. sudo apt install mariadb-client) ou installe Docker."
	exit 1
}

# Depuis un conteneur client Docker, localhost ≠ machine hôte (WSL2 / Linux).
docker_db_host() {
	local host="${1:-}"
	case "${host}" in
	localhost | 127.0.0.1)
		printf '%s' "host.docker.internal"
		;;
	*)
		printf '%s' "${host}"
		;;
	esac
}

docker_client_run_args() {
	printf '%s' "--add-host=host.docker.internal:host-gateway"
}

docker_mysql() {
	local docker_args=(--rm "$(docker_client_run_args)")
	if [[ "${1:-}" == "--stdin" ]]; then
		docker_args+=(-i)
		shift
	fi
	docker run "${docker_args[@]}" --entrypoint mariadb "${MARIADB_CLIENT_IMAGE}" "$@"
}

docker_mysqldump() {
	docker run --rm "$(docker_client_run_args)" --entrypoint mariadb-dump "${MARIADB_CLIENT_IMAGE}" "$@"
}

mysql_docker_host() {
	if [[ "${USE_DOCKER_MYSQL}" == "1" ]]; then
		docker_db_host "${DB_HOST}"
	else
		printf '%s' "${DB_HOST}"
	fi
}

mysql_cmd() {
	local host
	host="$(mysql_docker_host)"
	if [[ "${USE_DOCKER_MYSQL}" == "1" ]]; then
		docker_mysql --stdin \
			--host="${host}" --port="${DB_PORT}" --user="${DB_USER}" \
			--password="${DB_PASSWORD}" --database="${DB_NAME}" "$@"
	else
		"${MYSQL_CLI}" --host="${host}" --port="${DB_PORT}" --user="${DB_USER}" \
			--password="${DB_PASSWORD}" --database="${DB_NAME}" "$@"
	fi
}

mysqldump_cmd() {
	local host
	host="$(mysql_docker_host)"
	if [[ "${USE_DOCKER_MYSQL}" == "1" ]]; then
		docker_mysqldump \
			--host="${host}" --port="${DB_PORT}" --user="${DB_USER}" \
			--password="${DB_PASSWORD}" \
			--single-transaction --skip-lock-tables --no-tablespaces \
			"${DB_NAME}" "$@"
	else
		"${MYSQLDUMP_CLI}" --host="${host}" --port="${DB_PORT}" --user="${DB_USER}" \
			--password="${DB_PASSWORD}" \
			--single-transaction --skip-lock-tables --no-tablespaces \
			"${DB_NAME}" "$@"
	fi
}

wipe_target_database() {
	local host
	host="$(mysql_docker_host)"
	if [[ "${USE_DOCKER_MYSQL}" == "1" ]]; then
		docker_mysql \
			--host="${host}" --port="${DB_PORT}" --user="${DB_USER}" \
			--password="${DB_PASSWORD}" \
			-e "DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;"
	else
		"${MYSQL_CLI}" --host="${host}" --port="${DB_PORT}" --user="${DB_USER}" \
			--password="${DB_PASSWORD}" \
			-e "DROP DATABASE IF EXISTS \`${DB_NAME}\`; CREATE DATABASE \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;"
	fi
}

resolve_mysql_client

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

if load_target_db_config; then
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
		host="$(mysql_docker_host)"
		if [[ "${USE_DOCKER_MYSQL}" == "1" ]]; then
			docker_mysql --stdin \
				--host="${host}" --port="${DB_PORT}" --user="${DB_USER}" \
				--password="${DB_PASSWORD}" "${DB_NAME}"
		else
			"${MYSQL_CLI}" --host="${host}" --port="${DB_PORT}" --user="${DB_USER}" \
				--password="${DB_PASSWORD}" "${DB_NAME}"
		fi
	}

echo "Terminé: base ${TARGET} synchronisée depuis prod."

echo "Application des migrations en attente (delta prod -> local)..."
(cd "${ROOT_DIR}" && run_on_target_db bun run db:migrate)
