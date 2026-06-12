import React, { createContext, useContext, useState } from 'react';
import { PrintResult } from '../lib/types';

interface PrintPreviewContextValue {
  /** The most recent successful print ceremony, available to the Print tab. */
  lastPrint: PrintResult | null;
  setLastPrint: (result: PrintResult | null) => void;
}

const PrintPreviewContext = createContext<PrintPreviewContextValue | undefined>(undefined);

export function PrintPreviewProvider({ children }: { children: React.ReactNode }) {
  const [lastPrint, setLastPrint] = useState<PrintResult | null>(null);
  return (
    <PrintPreviewContext.Provider value={{ lastPrint, setLastPrint }}>
      {children}
    </PrintPreviewContext.Provider>
  );
}

export function usePrintPreview(): PrintPreviewContextValue {
  const ctx = useContext(PrintPreviewContext);
  if (!ctx) throw new Error('usePrintPreview must be used inside PrintPreviewProvider');
  return ctx;
}
