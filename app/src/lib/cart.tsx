// Набор техники для одной заявки: клиент добавляет позиции из каталога и оформляет их одним листом
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Equipment } from './api';

interface CartValue {
  items: Equipment[];
  has: (id: number) => boolean;
  toggle: (e: Equipment) => void;
  remove: (id: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Equipment[]>([]);
  const value = useMemo<CartValue>(() => ({
    items,
    has: (id) => items.some((i) => i.id === id),
    toggle: (e) => setItems((prev) => (prev.some((i) => i.id === e.id) ? prev.filter((i) => i.id !== e.id) : [...prev, e])),
    remove: (id) => setItems((prev) => prev.filter((i) => i.id !== id)),
    clear: () => setItems([]),
  }), [items]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart вне CartProvider');
  return ctx;
}
