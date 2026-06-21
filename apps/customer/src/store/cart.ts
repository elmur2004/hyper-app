import { createStore } from 'zustand/vanilla';
import type { Piastres } from '@hyper/shared';

export interface CartLine {
  productId: string;
  nameAr: string;
  /** Display snapshot only — the server recomputes the charged price at checkout (Plan §6). */
  unitPrice: Piastres;
  qty: number;
}

export interface CartState {
  lines: CartLine[];
  add: (line: Omit<CartLine, 'qty'>, qty?: number) => void;
  setQty: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
  count: () => number;
  /** Display subtotal in piastres — informational; never sent as authoritative. */
  subtotal: () => number;
}

/** Local cart (ephemeral UI state, Plan §2.1: Zustand for pre-checkout cart). */
export function createCartStore() {
  return createStore<CartState>((set, get) => ({
    lines: [],
    add: (line, qty = 1) =>
      set((s) => {
        const existing = s.lines.find((l) => l.productId === line.productId);
        if (existing) {
          return {
            lines: s.lines.map((l) =>
              l.productId === line.productId ? { ...l, qty: l.qty + qty } : l,
            ),
          };
        }
        return { lines: [...s.lines, { ...line, qty }] };
      }),
    setQty: (productId, qty) =>
      set((s) => ({
        lines:
          qty <= 0
            ? s.lines.filter((l) => l.productId !== productId)
            : s.lines.map((l) => (l.productId === productId ? { ...l, qty } : l)),
      })),
    remove: (productId) => set((s) => ({ lines: s.lines.filter((l) => l.productId !== productId) })),
    clear: () => set({ lines: [] }),
    count: () => get().lines.reduce((n, l) => n + l.qty, 0),
    subtotal: () => get().lines.reduce((sum, l) => sum + l.unitPrice * l.qty, 0),
  }));
}
