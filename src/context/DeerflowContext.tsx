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
      // In a real scenario, this would go through your ERP's API Gateway
      const response = await fetch(`/api/deerflow/workflows/${id}/status`);
      const data = await response.json();
      setState({ workflowId: id, status: data.status });
    } catch (error) {
      console.error("Failed to refresh Deerflow status:", error);
    }
  };

  return (
    <DeerflowContext.Provider value={{ state, refresh }}>
      {children}
    </DeerflowContext.Provider>
  );
};

export const useDeerflow = () => useContext(DeerflowContext);
