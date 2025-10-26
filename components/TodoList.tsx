import { useCallback, useEffect, useState } from 'react';

import { createUser, listUsersRequest } from '../utils/api/sqlClient';

interface UserRecord {
  id: string;
  energy: number;
  boost_level: number;
  boost_expires_at: string | null;
  country_code: string | null;
  created_at: string;
}

export function TodoList() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listUsersRequest();
      setUsers(response.users);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const handleCreateUser = useCallback(async () => {
    if (creating) return;

    setCreating(true);
    setError(null);

    try {
      const anonymousId = `demo_${Date.now()}`;
      await createUser({ userId: anonymousId });
      await loadUsers();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create user';
      setError(message);
    } finally {
      setCreating(false);
    }
  }, [creating, loadUsers]);

  if (loading) {
    return <div className="text-white/60">Loading users…</div>;
  }

  if (error) {
    return (
      <div role="alert" className="text-red-400">
        Failed to load users: {error}
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm text-white/80">
      <button
        type="button"
        onClick={handleCreateUser}
        disabled={creating}
        className="rounded bg-[#FF0033] px-4 py-2 text-xs uppercase tracking-wide text-white disabled:opacity-60"
      >
        {creating ? 'Creating…' : 'Create Demo User'}
      </button>

      {users.length === 0 ? (
        <div className="text-white/60">No users found. Create one to get started.</div>
      ) : (
        <ul className="space-y-2">
          {users.map((user) => (
            <li key={user.id} className="rounded-md bg-white/5 px-4 py-3 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{user.id}</p>
                  <p className="text-xs text-white/60">
                    Energy: {user.energy} • Boost level: {user.boost_level}
                  </p>
                </div>
                <div className="text-right text-[10px] text-white/40">
                  <p>{user.country_code ?? '—'}</p>
                  <p>{new Date(user.created_at).toLocaleString()}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default TodoList;
