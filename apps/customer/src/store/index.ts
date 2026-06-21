import { createCartStore } from './cart';

/** App-wide cart store instance (consumed by the RN screens). */
export const cart = createCartStore();
