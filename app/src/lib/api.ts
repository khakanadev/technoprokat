// Клиент REST API. Адрес сервера задаётся в app.json → extra.apiUrl (секретов в приложении нет, ЗИ-11)
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const extra = (Constants.expoConfig?.extra ?? {}) as { apiUrl?: string };
export const API_URL = (extra.apiUrl ?? 'http://localhost:3100').replace(/\/$/, '');

export const mediaUrl = (photo?: string | null) => (photo ? `${API_URL}/media/${photo}` : undefined);

const TOKEN_KEY = 'technoprokat.token';

// На телефоне токен хранится в защищённом хранилище ОС, в веб-версии — в localStorage
export const tokenStore = {
  async get() {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null;
    return SecureStore.getItemAsync(TOKEN_KEY);
  },
  async set(token: string | null) {
    if (Platform.OS === 'web') {
      if (token) globalThis.localStorage?.setItem(TOKEN_KEY, token);
      else globalThis.localStorage?.removeItem(TOKEN_KEY);
      return;
    }
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setSession(t: string | null, unauthorized?: () => void) {
  token = t;
  if (unauthorized) onUnauthorized = unauthorized;
}

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Нет связи с сервером. Проверьте подключение к сети');
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? safeJson(text) : null;
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, (data as { error?: string } | null)?.error ?? `Ошибка ${res.status}`);
  }
  return data as T;
}

export async function apiText(path: string): Promise<string> {
  const res = await fetch(`${API_URL}/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, `Ошибка ${res.status}`);
  return res.text();
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Типы данных API
export type Role = 'admin' | 'manager' | 'client';
export type StatusCode = 'new' | 'confirmed' | 'issued' | 'returned' | 'closed' | 'cancelled';

export interface User { id: string; email: string; full_name: string; role: Role }

export interface Equipment {
  id: number; name: string; category_id: number; category: string; inventory_no: string;
  daily_price: number; deposit: number; condition: 'ok' | 'service' | 'broken';
  photo: string | null; is_active: boolean; is_busy?: boolean | null;
}

export interface Category { id: number; name: string; equipment_count: number }

export interface RentalListItem {
  id: number; status_code: StatusCode; status_title: string; date_from: string; date_to: string;
  days: number; items_count: number; total: number; is_overdue: boolean; created_at: string;
  client_name: string; manager_name: string | null; photo: string | null; items: string;
}

export interface RentalEvent { id: number; type: 'status' | 'comment'; text: string; created_at: string; author: string; author_role: Role }

export interface RentalItem { equipment_id: number; price_per_day: number; name: string; inventory_no: string; photo: string | null; condition: Equipment['condition']; deposit: number }

export interface RentalFull extends Omit<RentalListItem, 'items' | 'photo'> {
  client_id: string; manager_id: string | null; client_phone: string | null; client_email?: string;
  items: RentalItem[];
  events: RentalEvent[];
}
