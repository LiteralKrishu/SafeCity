'use client';

import React, { createContext, useState, ReactNode } from 'react';

type Page = 'dashboard' | 'settings' | 'helpline';

interface AppContextType {
  activePage: Page;
  setActivePage: (page: Page) => void;
}

export const AppContext = createContext<AppContextType>({
  activePage: 'dashboard',
  setActivePage: () => {},
});

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [activePage, setActivePage] = useState<Page>('dashboard');

  return (
    <AppContext.Provider value={{ activePage, setActivePage }}>
      {children}
    </AppContext.Provider>
  );
};
