import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from './api';

interface Loaded<T> { path: string; data: T | null; error: string | null }

export function useApi<T>(path: string | null) {
  const [state, setState] = useState<Loaded<T> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (!path) return;
    if (refresh) setRefreshing(true);
    try {
      const data = await api<T>(path);
      setState({ path, data, error: null });
    } catch (e) {
      setState((prev) => ({ path, data: prev?.path === path ? prev.data : null, error: (e as Error).message }));
    } finally {
      setRefreshing(false);
    }
  }, [path]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const current = state?.path === path ? state : null;
  return {
    data: current?.data ?? state?.data ?? null,
    error: current?.error ?? null,
    loading: !!path && !current,
    refreshing,
    reload: () => load(true),
    setData: (data: T) => setState({ path: path ?? '', data, error: null }),
  };
}
