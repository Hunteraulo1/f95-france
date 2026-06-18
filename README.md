# F95 France

Plateforme communautaire de traduction de jeux F95Zone en français. Permet aux traducteurs de gérer et publier leurs traductions, et aux utilisateurs de les suivre et les télécharger.

## Stack

- **[SvelteKit](https://kit.svelte.dev/)** — framework full-stack
- **[MariaDB 11.4](https://mariadb.org/)** + **[Drizzle ORM](https://orm.drizzle.team/)** — base de données
- **[Bun](https://bun.sh/)** — runtime & package manager
- **[Tailwind CSS v4](https://tailwindcss.com/)** + **[DaisyUI 5](https://daisyui.com/)** — UI
- **Docker** — dev local & déploiement

## Prérequis

- [Bun](https://bun.sh/) ≥ 1.x
- [Node.js](https://nodejs.org/) ≥ 24
- [Docker](https://www.docker.com/) (pour la base de données de dev)

## Installation (dev local)

```sh
# 1. Cloner et installer les dépendances
git clone https://github.com/Hunteraulo1/f95-france.git
cd f95-france
bun install

# 2. Configurer l'environnement
cp .env.example .env
# Éditer .env avec vos valeurs (voir section Variables d'environnement)

# 3. Démarrer MariaDB
bun run dev:up

# 4. Appliquer les migrations
bun run db:migrate

# 5. Lancer le serveur de développement
bun run dev
```

L'app est disponible sur http://localhost:5173.

## Variables d'environnement

Copier `.env.example` en `.env`. Les variables essentielles pour démarrer :

| Variable                          | Description                                            |
| --------------------------------- | ------------------------------------------------------ |
| `PUBLIC_APP_ORIGIN`               | URL publique du site (ex: `https://f95france.site`)    |
| `MARIADB_HOST`                    | Hôte MariaDB (`localhost` en dev)                      |
| `MARIADB_DATABASE`                | Nom de la base                                         |
| `MARIADB_USER`                    | Utilisateur MariaDB                                    |
| `MARIADB_PASSWORD`                | Mot de passe MariaDB                                   |
| `DISCORD_WEBHOOK_UPDATES`         | Webhook Discord pour les mises à jour                  |
| `DISCORD_OAUTH_CLIENT_ID`         | OAuth Discord (connexion)                              |
| `DISCORD_OAUTH_CLIENT_SECRET`     | OAuth Discord (connexion)                              |
| `SERVICE_PASSWORD_64_CRON-SECRET` | Secret pour sécuriser `/api/cron/check-version`        |
| `CONFIG_TOKEN_ENCRYPTION_KEY`     | Clé de chiffrement des tokens OAuth (prod obligatoire) |

Voir `.env.example` pour la liste complète avec commentaires.

## Scripts

| Commande              | Description                                      |
| --------------------- | ------------------------------------------------ |
| `bun run dev`         | Serveur de développement                         |
| `bun run build`       | Build de production                              |
| `bun run preview`     | Prévisualiser le build (`http://localhost:4173`) |
| `bun run dev:up`      | Démarrer MariaDB (Docker)                        |
| `bun run dev:down`    | Arrêter MariaDB                                  |
| `bun run dev:logs`    | Logs MariaDB                                     |
| `bun run db:generate` | Générer une migration depuis le schéma           |
| `bun run db:migrate`  | Appliquer les migrations                         |
| `bun run db:studio`   | Interface Drizzle Studio                         |
| `bun run lint`        | Formater + linter                                |
| `bun run check`       | Vérification TypeScript                          |

## Schéma de base de données

La source de vérité est [`src/lib/server/db/schema.ts`](src/lib/server/db/schema.ts). **Ne pas** écrire de SQL à la main dans `drizzle/`.

Workflow pour modifier le schéma :

```sh
# 1. Modifier src/lib/server/db/schema.ts
# 2. Générer la migration
bun run db:generate
# 3. Relire le SQL généré dans drizzle/
# 4. Appliquer
bun run db:migrate
```

## Déploiement

### Docker (prod)

```sh
cp .env.example .env.prod
# Remplir .env.prod avec les valeurs de production

docker compose up -d
```

### Coolify

1. Créer une ressource depuis ce dépôt
2. Renseigner les variables d'environnement (voir `.env.example`)
3. La commande de démarrage est `bun run start`

Après chaque déploiement modifiant le schéma, appliquer les migrations :

```sh
bun run db:migrate
```

## Licence

[MIT + Commons Clause](LICENSE) — libre d'utilisation, modification et distribution, mais interdit à des fins commerciales.
