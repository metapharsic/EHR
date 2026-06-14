import React, { useState, useEffect } from 'react';
import { Activity, RefreshCw, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useDeerflow } from '../context/DeerflowContext';
import { apiClient } from '../services/apiClient';

interface WorkflowInstance {
  id: string;
  workflowId: string;
  moduleId: string;
  status: string;
  createdAt: string;
}

export const DeerflowGlobalDashboard: React.FC = () => {
  const [workflows, setWorkflows] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const { refresh } = useDeerflow();

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/deerflow/workflows?limit=20');
      const data = response.data?.data ?? response.data ?? [];
      setWorkflows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to fetch global workflows', err);
      setWorkflows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="text-green-400 w-5 h-5" />;
      case 'IN_PROGRESS': return <Clock className="text-blue-400 w-5 h-5 animate-pulse" />;
      case 'FAILED': return <AlertTriangle className="text-red-400 w-5 h-5" />;
      default: return <Activity className="text-gray-400 w-5 h-5" />;
    }
  };

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-400" />
            Deerflow Global Dashboard
          </h1>
          <p className="text-gray-400 mt-2">Centralized overview of all cross-module workflow executions.</p>
        </div>
        <button 
          onClick={fetchWorkflows}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700 shadow-[0_4px_12px_rgba(0,0,0,0.15)]"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {!loading && workflows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-500">
          <Activity className="w-12 h-12 mb-4 opacity-30" />
          <p className="text-lg font-medium">No workflow executions recorded yet.</p>
          <p className="text-sm mt-1">Workflows triggered from HRMS, CRM, and Accounting will appear here.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workflows.map(wf => (
          <div key={wf.id} className="relative group p-6 rounded-xl bg-gray-800/50 border border-gray-700 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 shadow-lg overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="flex justify-between items-start mb-4">
              <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-300 bg-blue-900/30 rounded-full border border-blue-800/50">
                {wf.moduleId}
              </span>
              {getStatusIcon(wf.status)}
            </div>
            
            <h3 className="text-lg font-medium text-gray-100 mb-2 truncate" title={wf.workflowId}>
              {wf.workflowId.replace(/_/g, ' ')}
            </h3>
            
            <div className="flex justify-between items-end mt-6">
              <span className="text-sm text-gray-500">
                {new Date(wf.createdAt).toLocaleTimeString()}
              </span>
              <button 
                onClick={() => refresh(wf.workflowId)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
              >
                Sync Status
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
