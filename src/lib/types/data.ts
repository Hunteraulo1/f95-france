interface User {
  id: string;
  username: string;
  role: 'superadmin' | 'admin' | 'translator' | 'user';
}

export type { User };
