'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * The choices a shopper makes on the product page: colour and size. They live in one provider that
 * wraps server-rendered children, so the gallery (cached shell) and the buy box (live stock) stay
 * in step without the page re-rendering on the server.
 */
interface PdpStateValue {
  colorId: string | null;
  sizeId: string | null;
  setColorId: (id: string) => void;
  setSizeId: (id: string | null) => void;
}

const PdpStateContext = createContext<PdpStateValue | null>(null);

export function usePdpState(): PdpStateValue {
  const value = useContext(PdpStateContext);
  if (!value) throw new Error('Product page parts must be inside <PdpState>');
  return value;
}

export function PdpState({
  initialColorId,
  children,
}: {
  initialColorId: string | null;
  children: ReactNode;
}) {
  const [colorId, setColorIdState] = useState<string | null>(initialColorId);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const value = useMemo<PdpStateValue>(
    () => ({
      colorId,
      sizeId,
      setColorId: (id) => {
        setColorIdState(id);
        // A size that does not exist in the new colour must not stay selected: the buy box
        // re-validates against live stock, so just keep it and let it show as unavailable.
      },
      setSizeId,
    }),
    [colorId, sizeId],
  );
  return <PdpStateContext.Provider value={value}>{children}</PdpStateContext.Provider>;
}
