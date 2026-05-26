# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```sh
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```sh
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Building

To create a production version of your app:

```sh
npm run build
```

Preview du build de production (serveur **adapter-node**, pas `vite preview`) :

```sh
bun run build
bun run preview
```

Ouvre http://127.0.0.1:4173/ — `ORIGIN` est fixé pour le preview local. Après un rebuild, fais un rechargement forcé (Ctrl+Shift+R) pour éviter un vieux `app.*.js` en cache (erreur `__sveltekit_* is undefined`).

Ne lance pas `vite preview` ni `bun run dev` en parallèle sur le même onglet.

> To deploy your app, you may need to install an [adapter](https://svelte.dev/docs/kit/adapters) for your target environment.

## Base de données de dev (Docker)

Lancer Postgres local:

```sh
npm run db:dev:up
```

Voir les logs:

```sh
npm run db:dev:logs
```

Arrêter la DB:

```sh
npm run db:dev:down
```

### Évolution du schéma (obligatoire)

La source de vérité est `src/lib/server/db/schema.ts`. **Ne pas** écrire de fichiers SQL à la main dans `drizzle/` ni utiliser `db:push`.

1. Modifier `src/lib/server/db/schema.ts`
2. Générer la migration : `bun run db:generate`
3. Relire le SQL généré dans `drizzle/`
4. Appliquer : `bun run db:migrate`

Première install sur une base vide : `bun run db:migrate` applique tout le journal.

Après sync prod → dev (`bun run db:sync:prod-to-dev`), les migrations Drizzle sont appliquées automatiquement.

**Production :** après chaque déploiement qui modifie le schéma :

```sh
bun run db:migrate
```
