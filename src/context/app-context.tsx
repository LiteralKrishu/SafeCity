'use client';

import React, { createContext, useState, ReactNode } from 'react';

type Page = 'dashboard' | 'settings' | 'helpline';

interface AppContextType {
  activePage: Page;
  setActivePage: (page: Page) => void;
  isMonitoring: boolean;
  toggleMonitoring: () => void;
}

export const AppContext = createContext<AppContextType>({
  activePage: 'dashboard',
  setActivePage: () => {},
  isMonitoring: true,
  toggleMonitoring: () => {},
});

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [activePage, setActivePage] = useState<Page>('dashboard');
  const [isMonitoring, setIsMonitoring] = useState(true);

  const toggleMonitoring = () => {
    setIsMonitoring(prev => !prev);
  }

  return (
    <AppContext.Provider value={{ activePage, setActivePage, isMonitoring, toggleMonitoring }}>
      {children}
    </AppContext.Provider>
  );
};
