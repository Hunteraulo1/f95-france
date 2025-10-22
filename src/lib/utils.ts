import { get } from 'svelte/store';
import type { User } from './server/db/schema';
import { user } from './stores';

const checkRole = (roles: User['role'][]) => {
  const loggedUser = get(user);

  if (!loggedUser) throw new Error('User is required');
  
  if (!loggedUser.role) throw new Error('Role is required');
  if (loggedUser.role === 'superadmin') return true;
  
  if (roles.includes('all')) return true;
  if (roles.includes(loggedUser.role)) return true;

  return false;
}

export { checkRole };
