FROM node:24-alpine

WORKDIR /app

COPY package.json bun.lock* ./

RUN npm install -g bun

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

EXPOSE 3000

CMD ["node", "run", "start"]
