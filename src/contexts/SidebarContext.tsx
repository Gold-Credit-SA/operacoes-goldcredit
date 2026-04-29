import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

const STORAGE_KEY = 'sidebar:collapsed';

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      // ignore
    }
  }, [collapsed]);

  const setCollapsed = (v: boolean) => setCollapsedState(v);
  const toggle = () => setCollapsedState((c) => !c);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebarState() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebarState must be used within SidebarProvider');
  return ctx;
}
