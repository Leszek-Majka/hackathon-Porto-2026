import React, { createContext, useContext, useState } from 'react';
import type { DropPayload } from '../types/matrix';

interface DragContextValue {
  dragging: DropPayload | null;
  setDragging: (payload: DropPayload | null) => void;
}

const DragContext = createContext<DragContextValue>({ dragging: null, setDragging: () => {} });

export function DragProvider({ children }: { children: React.ReactNode }) {
  const [dragging, setDragging] = useState<DropPayload | null>(null);
  return <DragContext.Provider value={{ dragging, setDragging }}>{children}</DragContext.Provider>;
}

export function useDragContext() {
  return useContext(DragContext);
}
