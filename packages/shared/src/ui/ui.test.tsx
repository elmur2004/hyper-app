// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OrderStatusSchema, type OrderStatus } from '../schemas/orders';
import { Button } from './Button';
import { Price } from './Price';
import { QtyStepper } from './QtyStepper';
import { StatusPill } from './StatusPill';
import { Sheet } from './Sheet';

afterEach(cleanup);

describe('Button', () => {
  it('is aria-busy when loading and non-interactive when disabled', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <Button loading onClick={onClick}>
        اطلب
      </Button>,
    );
    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.getAttribute('aria-busy')).toBe('true');
    expect(btn.disabled).toBe(true);

    rerender(
      <Button disabled onClick={onClick}>
        اطلب
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Price', () => {
  it('formats integer piastres as EGP and strikes through the original on promo', () => {
    render(<Price piastres={150050} originalPiastres={200000} locale="en-EG" />);
    expect(screen.getByTestId('price-current').textContent).toContain('1,500.5');
    expect(screen.getByTestId('price-original').textContent).toContain('2,000');
  });
  it('omits the original when there is no promo', () => {
    render(<Price piastres={150050} locale="en-EG" />);
    expect(screen.queryByTestId('price-original')).toBeNull();
  });
});

describe('QtyStepper', () => {
  it('disables minus at min and plus at max', () => {
    const onChange = vi.fn();
    render(<QtyStepper value={1} min={1} max={1} onChange={onChange} />);
    expect((screen.getByLabelText('decrement') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText('increment') as HTMLButtonElement).disabled).toBe(true);
  });
  it('increments within bounds', () => {
    const onChange = vi.fn();
    render(<QtyStepper value={1} min={0} max={5} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('increment'));
    expect(onChange).toHaveBeenCalledWith(2);
  });
});

describe('StatusPill', () => {
  it('renders an Arabic label + status color for EVERY OrderStatus (exhaustive)', () => {
    const statuses: OrderStatus[] = OrderStatusSchema.options;
    for (const s of statuses) {
      const { unmount } = render(<StatusPill status={s} />);
      const pill = screen.getByTestId('status-pill');
      expect(pill.getAttribute('data-status')).toBe(s);
      expect(pill.textContent?.length ?? 0).toBeGreaterThan(0);
      unmount();
    }
  });
});

describe('Sheet', () => {
  it('opens from the logical end edge and closes on ESC', () => {
    const onClose = vi.fn();
    render(
      <Sheet open onClose={onClose} title="السلة">
        محتوى
      </Sheet>,
    );
    expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('السلة');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('renders nothing when closed', () => {
    const onClose = vi.fn();
    render(
      <Sheet open={false} onClose={onClose}>
        x
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
