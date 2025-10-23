import { db } from '$lib/server/db';
import { translator } from '$lib/server/db/schema';

export const load = async () => {
  try {
    const traductors = await db.select().from(translator);
    return { traductors };
  } catch (error) {
    console.error('Error loading traductors:', error);
    return { traductors: [] };
  }
};
