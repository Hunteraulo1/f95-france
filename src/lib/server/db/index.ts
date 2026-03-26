import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '$env/dynamic/private';
import { getPostgresConfig } from './connection';

const config = getPostgresConfig(env);
const client = typeof config === 'string' ? postgres(config, { prepare: false }) : postgres(config);

export const db = drizzle(client, { schema });
