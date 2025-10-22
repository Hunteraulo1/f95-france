import type { User } from './server/db/schema';

const checkRole = (role: User['role'], roles: User['role'][]) => {
  return roles.includes(role) || role === 'superadmin';
}

export { checkRole };
