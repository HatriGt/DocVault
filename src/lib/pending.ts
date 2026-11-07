/** Holds the account chosen during onboarding until the vault key is ready. */
import type { Account } from './session';
let pending: Account | null = null;
export const setPendingAccount = (a: Account) => (pending = a);
export const getPendingAccount = () => pending;
