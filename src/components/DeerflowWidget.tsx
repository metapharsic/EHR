import React, { useEffect } from 'react';
import { useDeerflow } from '../context/DeerflowContext';
import { Activity } from 'lucide-react';

interface DeerflowWidgetProps {
  workflowId?: string;
}

export const DeerflowWidget: React.FC<DeerflowWidgetProps> = ({ workflowId }) => {
  const { state, refresh } = useDeerflow();

  useEffect(() => {
    if (workflowId) {
      refresh(workflowId);
    }
  }, [workflowId, refresh]);

  if (!workflowId) return null;

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 border border-slate-700 shadow-xl transform transition-all hover:-translate-y-1 hover:shadow-2xl flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="bg-accent/20 p-2 rounded-lg">
          <Activity size={20} className="text-accent animate-pulse" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Deerflow Sync</p>
          <h4 className="text-sm font-bold text-white capitalize">{state.status || 'Pending'}</h4>
        </div>
      </div>
      <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-1000 ${state.status === 'Completed' ? 'bg-green-500 w-full' : state.status === 'Failed' ? 'bg-red-500 w-full' : 'bg-accent w-1/3'}`}
        />
      </div>
    </div>
  );
};
