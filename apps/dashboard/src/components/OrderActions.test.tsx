import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OrderActions } from './OrderActions';

afterEach(cleanup);

describe('OrderActions (legal transitions from the shared status machine)', () => {
  it('on a placed order offers confirm + cancel and fires the chosen transition', () => {
    const onTransition = vi.fn();
    render(<OrderActions status="placed" onTransition={onTransition} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2); // confirmed, cancelled
    fireEvent.click(screen.getByText('تأكيد'));
    expect(onTransition).toHaveBeenCalledWith('confirmed');
  });

  it('on a delivered order offers only refund', () => {
    render(<OrderActions status="delivered" onTransition={() => {}} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('استرجاع')).toBeTruthy();
  });

  it('on a terminal (cancelled) order offers no actions', () => {
    render(<OrderActions status="cancelled" onTransition={() => {}} />);
    expect(screen.getByTestId('no-actions')).toBeTruthy();
  });
});
