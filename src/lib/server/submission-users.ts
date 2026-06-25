import * as table from '$lib/server/db/schema';
import { alias } from 'drizzle-orm/mysql-core';

/** Alias pour joindre l’admin ayant ouvert la soumission (distinct du créateur). */
export const submissionOpenedByUser = alias(table.user, 'submission_opened_by_user');

/** Alias pour joindre le modérateur ayant accepté/refusé/marqué à corriger la soumission. */
export const submissionReviewedByUser = alias(table.user, 'submission_reviewed_by_user');
