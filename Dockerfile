# Utiliser Node.js 18 comme image de base
FROM node:18-alpine

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package.json bun.lock* ./

# Installer Bun (plus rapide que npm)
RUN npm install -g bun

# Installer les dépendances
RUN bun install --frozen-lockfile

# Copier le code source
COPY . .

# Construire l'application
RUN bun run build

# Exposer le port 3000
EXPOSE 3000

# Commande par défaut pour démarrer l'application
CMD ["bun", "run", "start"]
