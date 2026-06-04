import { supabase } from '@/lib/supabase';
import { makeCrud } from './crud';
import type { Team, User } from '@/types';

const teamCrud = makeCrud<Team>('teams');
const userCrud = makeCrud<User>('users');

export const teamsService = {
  ...teamCrud,
  list: () => teamCrud.list({ order: { column: 'name' } }),

  async members(team_id: string): Promise<User[]> {
    const { data, error } = await supabase
      .from('team_members')
      .select('user_id, team_role, users(*)')
      .eq('team_id', team_id);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({ ...r.users, team_role: r.team_role }));
  },
};

export const usersService = {
  ...userCrud,
  list: () => userCrud.list({ order: { column: 'full_name' } }),

  async me(): Promise<User | null> {
    const auth = (await supabase.auth.getUser()).data.user;
    if (!auth) return null;
    return userCrud.get(auth.id);
  },
};
