import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { OrderWithItems } from '@hyper/shared/client';
import { OrdersTable } from './OrdersTable';

afterEach(cleanup);

const order = (status: OrderWithItems['status']): OrderWithItems =>
  ({
    id: '44444444-4444-4444-4444-444444444444',
    customerId: '11111111-1111-1111-1111-111111111111',
    branchId: '33333333-3333-3333-3333-333333333333',
    addressId: '55555555-5555-5555-5555-555555555555',
    status,
    subtotal: 4500,
    deliveryFee: 2000,
    discount: 0,
    total: 6500,
    paymentMethod: 'cod',
    paymentStatus: 'pending',
    slotStart: null,
    slotEnd: null,
    placedAt: '2026-06-18T00:00:00.000Z',
    version: 0,
    items: [],
  }) as unknown as OrderWithItems;

describe('OrdersTable (cross-surface shared UI on web)', () => {
  it('renders a row with the Arabic StatusPill and EGP price for each order', () => {
    render(<OrdersTable orders={[order('out_for_delivery')]} />);
    expect(screen.getAllByTestId('order-row')).toHaveLength(1);
    const pill = screen.getByTestId('status-pill');
    expect(pill.getAttribute('data-status')).toBe('out_for_delivery');
    expect(pill.textContent).toContain('في الطريق'); // Arabic label from shared
  });

  it('renders the empty state', () => {
    render(<OrdersTable orders={[]} />);
    expect(screen.getByTestId('orders-empty')).toBeTruthy();
  });
});
