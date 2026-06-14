import React, { createContext, useContext, useState } from 'react';

type DeerflowState = {
  workflowId?: string;
  status?: string;
};

const DeerflowContext = createContext<{
  state: DeerflowState;
  refresh: (id: string) => Promise<void>;
}>({ state: {}, refresh: async () => {} });

export const DeerflowProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [state, setState] = useState<DeerflowState>({});

  const refresh = async (id: string) => {
    try {
      const token = localStorage.getItem('erp_token') || localStorage.getItem('token') || '';
      const response = await fetch(`/api/deerflow/workflows/${id}/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      setState({ workflowId: id, status: data.status });
    } catch (error) {
      console.warn("Deerflow status refresh failed:", error);
    }
  };

  return (
    <DeerflowContext.Provider value={{ state, refresh }}>
      {children}
    </DeerflowContext.Provider>
  );
};

export const useDeerflow = () => useContext(DeerflowContext);
