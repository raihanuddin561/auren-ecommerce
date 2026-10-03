/** Radix Select items need non-empty values, so "None" travels as this sentinel. */
export const NONE = '__none';

/** Select value to the id (or null) the actions expect. */
export const fromSelect = (value: string): string | null => (value === NONE ? null : value);

/** Stored id (or null) to a Select value. */
export const toSelect = (id: string | null | undefined): string => id || NONE;
