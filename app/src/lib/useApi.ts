import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from './api';

interface Loaded<T> { path: string; data: T | null; error: string | null }

// Загрузка данных экрана: при каждом показе экрана и по «потянуть для обновления».
// Признак загрузки вычисляется: данные ещё не получены для текущего адреса.
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
    // Пока грузится новый адрес (смена фильтра), показываются прежние данные — список не мигает
    data: current?.data ?? state?.data ?? null,
    error: current?.error ?? null,
    loading: !!path && !current,
    refreshing,
    reload: () => load(true),
    setData: (data: T) => setState({ path: path ?? '', data, error: null }),
  };
}
