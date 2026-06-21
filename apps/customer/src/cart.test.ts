import { describe, it, expect } from 'vitest';
import { createCartStore } from './store/cart';
import { toCheckoutItems, customerCanCancel, STATUS_LABEL_AR } from './checkout';

describe('cart store', () => {
  it('adds, merges quantities, and computes the display subtotal', () => {
    const store = createCartStore();
    const s = () => store.getState();
    s().add({ productId: 'p1', nameAr: 'لبن', unitPrice: 4500 });
    s().add({ productId: 'p1', nameAr: 'لبن', unitPrice: 4500 }, 2); // merge → qty 3
    s().add({ productId: 'p2', nameAr: 'عيش', unitPrice: 2000 });
    expect(s().count()).toBe(4);
    expect(s().subtotal()).toBe(4500 * 3 + 2000);
  });

  it('setQty to 0 removes the line; clear empties', () => {
    const store = createCartStore();
    store.getState().add({ productId: 'p1', nameAr: 'لبن', unitPrice: 4500 });
    store.getState().setQty('p1', 0);
    expect(store.getState().lines).toHaveLength(0);
    store.getState().add({ productId: 'p2', nameAr: 'عيش', unitPrice: 2000 });
    store.getState().clear();
    expect(store.getState().count()).toBe(0);
  });
});

describe('checkout view-model', () => {
  it('maps cart lines to server checkout items (no client price sent)', () => {
    const items = toCheckoutItems([{ productId: 'p1', nameAr: 'x', unitPrice: 4500, qty: 2 }]);
    expect(items).toEqual([{ productId: 'p1', qty: 2 }]);
  });

  it('reflects the shared status machine for cancel-ability + has every Arabic label', () => {
    expect(customerCanCancel('placed')).toBe(true);
    expect(customerCanCancel('out_for_delivery')).toBe(true);
    expect(customerCanCancel('delivered')).toBe(false);
    expect(customerCanCancel('cancelled')).toBe(false);
    for (const label of Object.values(STATUS_LABEL_AR)) expect(label.length).toBeGreaterThan(0);
  });
});
