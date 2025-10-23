import { z } from 'zod';

// Schéma pour le type de jeu
export const GameTypeSchema = z.object({
  id: z.number(),
  domain: z.enum(['F95z', 'LewdCorner', 'Autre']),
  name: z.string(),
  link: z.string(),
  status: z.enum(['EN COURS', 'TERMINÉ', 'ABANDONNÉ', 'EN PAUSE']),
  tags: z.string(),
  type: z.enum(['VN', 'RPG', 'ADV', 'SIMULATION', 'AUTRE']),
  image: z.string(),
  version: z.string(),
  tversion: z.string(),
  tname: z.enum(['Pas de traduction', 'Intégrée', 'Séparée']),
  tlink: z.string(),
  traductor: z.string(),
  proofreader: z.string(),
  ttype: z.enum(['Automatique', 'VO Française', 'Manuelle', 'Semi-Automatique', 'À tester', 'Lien HS']),
  ac: z.boolean(),
});

export type GameType = z.infer<typeof GameTypeSchema>;

// Schéma pour le jeu avec validation
export const Game = {
  shape: {
    domain: {
      options: ['F95z', 'LewdCorner', 'Autre'] as const,
    },
    status: {
      options: ['EN COURS', 'TERMINÉ', 'ABANDONNÉ', 'EN PAUSE'] as const,
    },
    type: {
      options: ['VN', 'RPG', 'ADV', 'SIMULATION', 'AUTRE'] as const,
    },
    tname: {
      options: ['Pas de traduction', 'Intégrée', 'Séparée'] as const,
    },
    ttype: {
      options: ['Automatique', 'VO Française', 'Manuelle', 'Semi-Automatique', 'À tester', 'Lien HS'] as const,
    },
  },
};

// Schéma pour le scraping
export const ScrapeGameSchema = z.object({
  name: z.string().optional(),
  version: z.string().optional(),
  status: z.string().optional(),
  tags: z.string().optional(),
  type: z.string().optional(),
  image: z.string().optional(),
});

export const ScrapeGame = ScrapeGameSchema;
