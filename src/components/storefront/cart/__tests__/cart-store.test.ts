import { afterEach, describe, expect, it } from 'vitest';
import { emptyCartView } from '@/modules/cart/view';
import {
  closeCartDrawer,
  getCartView,
  openCartDrawer,
  resetCartStore,
  setCartView,
} from '../cart-store';

const view = (revision: string, count = 0) => ({ ...emptyCartView('BDT', null), revision, count });

afterEach(resetCartStore);

describe('bag store', () => {
  it('keeps the view with the newest revision, so a slow answer never overwrites a newer one', () => {
    setCartView(view('200:1', 1));
    setCartView(view('100:5', 5));
    expect(getCartView()?.count).toBe(1);
    setCartView(view('300:2', 2));
    expect(getCartView()?.count).toBe(2);
  });

  it('accepts an equal revision (the same bag read again)', () => {
    setCartView(view('200:1', 1));
    setCartView(view('200:1', 1));
    expect(getCartView()?.revision).toBe('200:1');
  });

  it('a bag that does not exist yet (revision 0) never replaces a real one', () => {
    setCartView(view('500:2', 2));
    setCartView(view('0:0', 0));
    expect(getCartView()?.count).toBe(2);
  });

  it('opens and closes the drawer', () => {
    openCartDrawer();
    closeCartDrawer();
    expect(getCartView()).toBeNull();
  });
});
