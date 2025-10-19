import type { User } from './types/data';

const checkRole = (role: User['role'], roles: User['role'][]) => {
  return roles.includes(role) || role === 'superadmin';
}

export { checkRole };
