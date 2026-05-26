# Migrations Drizzle

Ce dossier est **généré** par Drizzle Kit. Ne pas ajouter ni modifier de fichiers `.sql` à la main.

1. Éditer `src/lib/server/db/schema.ts`
2. `bun run db:generate` — doit afficher « No schema changes » si rien n’a changé
3. Relire le nouveau `00XX_*.sql` s’il y en a un
4. `bun run db:migrate`

Ne pas enchaîner `db:generate && db:migrate` sans lire le SQL : si `generate` recrée une colonne déjà en base, supprimer la migration dupliquée du journal avant `migrate`.

Voir `.cursor/rules/drizzle-migrations.mdc` et le `README.md` à la racine.
