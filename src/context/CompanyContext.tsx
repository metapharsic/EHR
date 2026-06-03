import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Company } from '../types';

const COMPANY_STORAGE_KEY = 'erp_company_profile';

interface CompanyContextType {
  company: Company | null;
  setCompany: (company: Company) => void;
  initializeCompany: (companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateCompany: (companyData: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>) => void;
  clearCompany: () => void;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

/** Load saved company data from localStorage on startup */
const loadCompanyFromStorage = (): Company | null => {
  try {
    const raw = localStorage.getItem(COMPANY_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Company;
  } catch {
    return null;
  }
};

/** Persist company data to localStorage on every change */
const saveCompanyToStorage = (c: Company | null) => {
  try {
    if (c) {
      localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(c));
    } else {
      localStorage.removeItem(COMPANY_STORAGE_KEY);
    }
  } catch {
    // quota errors – silently ignore
  }
};

export const CompanyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [company, setCompanyState] = useState<Company | null>(() => loadCompanyFromStorage());

  // Persist every time company changes
  useEffect(() => {
    saveCompanyToStorage(company);
  }, [company]);

  const setCompany = (c: Company) => setCompanyState(c);

  const initializeCompany = (companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newCompany: Company = {
      ...companyData,
      id: `COMP-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setCompanyState(newCompany);
  };

  const updateCompany = (companyData: Partial<Omit<Company, 'id' | 'createdAt' | 'updatedAt'>>) => {
    setCompanyState(prev => {
      if (!prev) return prev;
      return { ...prev, ...companyData, updatedAt: new Date().toISOString() };
    });
  };

  const clearCompany = () => setCompanyState(null);

  return (
    <CompanyContext.Provider value={{ company, setCompany, initializeCompany, updateCompany, clearCompany }}>
      {children}
    </CompanyContext.Provider>
  );
};

export const useCompany = () => {
  const context = useContext(CompanyContext);
  if (context === undefined) {
    throw new Error('useCompany must be used within a CompanyProvider');
  }
  return context;
};