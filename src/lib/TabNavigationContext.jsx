import { createContext, useContext, useCallback } from 'react';

const TabNavigationContext = createContext(null);
const STORAGE_KEY = 'tabNavigation';

function loadPaths() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function TabNavigationProvider({ children }) {
  const getTabPath = useCallback((tabRoot) => {
    const paths = loadPaths();
    return paths[tabRoot] || null;
  }, []);

  const setTabPath = useCallback((tabRoot, path) => {
    const paths = loadPaths();
    paths[tabRoot] = path;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(paths));
  }, []);

  return (
    <TabNavigationContext.Provider value={{ getTabPath, setTabPath }}>
      {children}
    </TabNavigationContext.Provider>
  );
}

export function useTabNavigation() {
  const ctx = useContext(TabNavigationContext);
  if (!ctx) return { getTabPath: () => null, setTabPath: () => {} };
  return ctx;
}