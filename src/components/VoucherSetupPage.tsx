import React, { useState, useEffect } from 'react';
import { 
  Settings, Plus, Database, AlertCircle, Check, X, Info
} from 'lucide-react';
import { getAllVoucherTypes, saveVoucherType } from '../services/databaseService';
import { useNotifications } from '../context/NotificationContext';
import { VoucherTypeMaster, VoucherType } from '../types';

const VoucherSetupPage: React.FC = () => {
  const { addNotification } = useNotifications();
  
  const [loading, setLoading] = useState(false);
  const [voucherTypeMasters, setVoucherTypeMasters] = useState<VoucherTypeMaster[]>([]);
  const [selectedVoucherType, setSelectedVoucherType] = useState<VoucherTypeMaster | null>(null);
  const [isEditingVT, setIsEditingVT] = useState(false);
  const [showWorkflowGuide, setShowWorkflowGuide] = useState(false);
  const [vtForm, setVtForm] = useState<Partial<VoucherTypeMaster>>({
    name: '',
    alias: '',
    typeOfVoucher: 'Sale' as VoucherType,
    abbreviation: '',
    methodOfVoucherNumbering: 'Automatic',
    useEffectiveDates: false,
    makeOptionalByDefault: false,
    allowNarration: true,
    provideNarrationsForEachLedger: false,
    printAfterSaving: false,
    nameOfClass: []
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const vtData = await getAllVoucherTypes();
      setVoucherTypeMasters(vtData || []);
    } catch (err: any) {
      console.error('VoucherSetupPage: Failed to load data', err);
      addNotification({
        type: 'error',
        title: 'Error Loading Voucher Types',
        message: err.message || 'Check your connection.',
        priority: 'high'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveVoucherType = async () => {
    if (!vtForm.name || !vtForm.typeOfVoucher) return;
    
    const newVT: VoucherTypeMaster = {
      id: selectedVoucherType?.id || `VT-${Date.now()}`,
      name: vtForm.name!,
      alias: vtForm.alias,
      typeOfVoucher: vtForm.typeOfVoucher as VoucherType,
      abbreviation: vtForm.abbreviation || vtForm.name!.substring(0, 4),
      methodOfVoucherNumbering: vtForm.methodOfVoucherNumbering as any || 'Automatic',
      useEffectiveDates: !!vtForm.useEffectiveDates,
      makeOptionalByDefault: !!vtForm.makeOptionalByDefault,
      allowNarration: !!vtForm.allowNarration,
      provideNarrationsForEachLedger: !!vtForm.provideNarrationsForEachLedger,
      printAfterSaving: !!vtForm.printAfterSaving,
      nameOfClass: vtForm.nameOfClass || []
    };

    const success = await saveVoucherType(newVT);
    if (success) {
      addNotification({
        type: 'success',
        title: 'Voucher Type Saved',
        message: `Voucher Type "${newVT.name}" successfully active.`,
        priority: 'low'
      });
      setIsEditingVT(false);
      setSelectedVoucherType(null);
      loadData();
    }
  };

  const loadTestCaseData = () => {
    setVtForm({
      name: 'Pharmacy Retail POS',
      alias: 'RETAIL_POS',
      typeOfVoucher: 'Sale' as VoucherType,
      abbreviation: 'POS',
      methodOfVoucherNumbering: 'Automatic',
      useEffectiveDates: true,
      makeOptionalByDefault: false,
      allowNarration: true,
      provideNarrationsForEachLedger: false,
      printAfterSaving: true,
      nameOfClass: ['Standard Billing', 'GST Exempt', 'Staff Discount']
    });
    addNotification({
      type: 'info',
      title: 'Voucher Setup Test Data',
      message: 'Test Case data loaded. Review and click Save.',
      priority: 'medium'
    });
  };

  return (
    <div className="flex h-full gap-6 bg-[#E3E8E3] p-6 rounded-2xl border border-slate-300 shadow-inner">
      {/* Sidebar: List of Voucher Types */}
      <div className="w-72 bg-[#F5F5F5] border border-slate-400 rounded-xl shadow-lg flex flex-col overflow-hidden">
        <div className="bg-[#1D3557] p-4 text-white flex items-center gap-3">
          <Settings size={20} className="text-blue-400" />
          <div>
            <h2 className="text-sm font-black uppercase tracking-widest leading-none">Voucher Masters</h2>
            <p className="text-[10px] text-blue-300 font-bold uppercase mt-1">Select to configure</p>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {voucherTypeMasters.map(vt => (
            <button 
              key={vt.id}
              onClick={() => {
                setSelectedVoucherType(vt);
                setVtForm(vt);
                setIsEditingVT(true);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg text-xs font-bold transition-all border ${selectedVoucherType?.id === vt.id ? 'bg-white border-blue-500 text-blue-700 shadow-sm' : 'border-transparent text-slate-600 hover:bg-white/50 hover:text-slate-900'}`}
            >
              {vt.name}
            </button>
          ))}
          <div className="pt-4 px-2 space-y-2">
            <button 
              onClick={() => {
                setSelectedVoucherType(null);
                setVtForm({
                  name: '',
                  alias: '',
                  typeOfVoucher: 'Sale' as VoucherType,
                  abbreviation: '',
                  methodOfVoucherNumbering: 'Automatic',
                  useEffectiveDates: false,
                  makeOptionalByDefault: false,
                  allowNarration: true,
                  provideNarrationsForEachLedger: false,
                  printAfterSaving: false,
                  nameOfClass: []
                });
                setIsEditingVT(true);
              }}
              className="w-full h-12 text-xs font-black text-blue-700 bg-blue-50/50 hover:bg-blue-50 flex items-center justify-center gap-2 border-2 border-dashed border-blue-200 rounded-xl transition-all"
            >
              <Plus size={16} /> CREATE NEW
            </button>

            <button 
              onClick={loadTestCaseData}
              className="w-full h-10 text-[10px] font-black text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50 flex items-center justify-center gap-2 border border-emerald-200 rounded-xl transition-all"
            >
              <Database size={14} /> LOAD TEST CASE
            </button>

            <button 
              onClick={() => setShowWorkflowGuide(true)}
              className="w-full h-10 text-[10px] font-black text-slate-500 bg-white hover:bg-slate-50 flex items-center justify-center gap-2 border border-slate-200 rounded-xl transition-all"
            >
              <Info size={14} /> WORKFLOW GUIDE
            </button>
          </div>
        </div>
      </div>

      {/* Main Form: Tally Style */}
      <div className="flex-1 bg-white border border-slate-400 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="bg-[#1D3557] p-4 text-white text-xs font-black flex justify-between items-center px-6">
          <div className="flex items-center gap-3">
             <div className="w-1.5 h-6 bg-blue-400 rounded-full"></div>
             <span className="uppercase tracking-widest">Voucher Type Configuration</span>
          </div>
          <span className="text-[10px] opacity-70 font-mono">Terminal ID: T01-ERP</span>
        </div>
        
        <div className="p-10 flex-1 overflow-auto bg-[#F9FBF9]">
          <div className="grid grid-cols-2 gap-x-16 gap-y-6">
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <label className="w-40 text-xs font-black text-slate-500 uppercase tracking-widest">Voucher Name</label>
                <div className="flex-1 flex gap-2">
                  <span className="text-slate-400">:</span>
                  <input 
                    type="text" 
                    value={vtForm.name}
                    onChange={e => setVtForm({...vtForm, name: e.target.value})}
                    placeholder="e.g. Retail POS"
                    className="flex-1 border-b-2 border-slate-200 focus:border-blue-500 outline-none text-sm font-black bg-transparent py-1 transition-all"
                  />
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="w-40 text-xs font-black text-slate-500 uppercase tracking-widest">Voucher Type</label>
                <div className="flex-1 flex gap-2">
                  <span className="text-slate-400">:</span>
                  <select 
                    value={vtForm.typeOfVoucher}
                    onChange={e => setVtForm({...vtForm, typeOfVoucher: e.target.value as VoucherType})}
                    className="flex-1 border-b-2 border-slate-200 focus:border-blue-500 outline-none text-sm font-black bg-transparent py-1"
                  >
                    <option value="Sale">Sales</option>
                    <option value="Purchase">Purchase</option>
                    <option value="Payment">Payment</option>
                    <option value="Receipt">Receipt</option>
                    <option value="Contra">Contra</option>
                    <option value="Journal">Journal</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="w-40 text-xs font-black text-slate-500 uppercase tracking-widest">Abbreviation</label>
                <div className="flex-1 flex gap-2">
                  <span className="text-slate-400">:</span>
                  <input 
                    type="text" 
                    value={vtForm.abbreviation}
                    onChange={e => setVtForm({...vtForm, abbreviation: e.target.value})}
                    className="flex-1 border-b-2 border-slate-200 focus:border-blue-500 outline-none text-sm font-black bg-transparent py-1"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
               <div className="flex items-center gap-4">
                <label className="w-48 text-xs font-black text-slate-500 uppercase tracking-widest">Numbering Method</label>
                <div className="flex-1 flex gap-2">
                  <span className="text-slate-400">:</span>
                  <select className="flex-1 border-b-2 border-slate-200 focus:border-blue-500 outline-none text-xs font-black bg-transparent">
                    <option>Automatic</option>
                    <option>Manual</option>
                    <option>None</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-xs font-black text-slate-500 uppercase tracking-widest">Use Effective Dates</label>
                <div className="flex-1 flex gap-2">
                  <span className="text-slate-400">:</span>
                  <select 
                    value={vtForm.useEffectiveDates ? 'Yes' : 'No'}
                    onChange={e => setVtForm({...vtForm, useEffectiveDates: e.target.value === 'Yes'})}
                    className="flex-1 border-b-2 border-slate-200 focus:border-blue-500 outline-none text-xs font-black bg-transparent"
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="w-48 text-xs font-black text-slate-500 uppercase tracking-widest">Print after Saving</label>
                <div className="flex-1 flex gap-2">
                  <span className="text-slate-400">:</span>
                  <select 
                    value={vtForm.printAfterSaving ? 'Yes' : 'No'}
                    onChange={e => setVtForm({...vtForm, printAfterSaving: e.target.value === 'Yes'})}
                    className="flex-1 border-b-2 border-slate-200 focus:border-blue-500 outline-none text-xs font-black bg-transparent"
                  >
                    <option>No</option>
                    <option>Yes</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-16 pt-8 border-t border-dashed border-slate-200">
             <div className="flex items-center gap-2 mb-6">
                <AlertCircle size={16} className="text-blue-500" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Advanced Options</h4>
             </div>
             <div className="grid grid-cols-2 gap-x-16 gap-y-4">
               {[
                 { label: 'Allow Narration in Voucher', value: vtForm.allowNarration },
                 { label: 'Provide Narrations for each Ledger', value: vtForm.provideNarrationsForEachLedger },
                 { label: 'Make Optional by Default', value: vtForm.makeOptionalByDefault },
                 { label: 'Set/Alter Name of Classes', value: vtForm.nameOfClass && vtForm.nameOfClass.length > 0 }
               ].map((opt, i) => (
                 <div key={i} className="flex items-center justify-between py-1">
                   <span className="text-xs font-bold text-slate-600">{opt.label}</span>
                   <span className={`text-xs font-black ${opt.value ? 'text-blue-600' : 'text-slate-400'}`}>{opt.value ? 'Yes' : 'No'}</span>
                 </div>
               ))}
             </div>
          </div>
        </div>
        
        <div className="bg-slate-50 p-6 border-t border-slate-200 flex justify-end gap-4 shadow-inner">
          <button 
            onClick={() => setIsEditingVT(false)}
            className="px-8 py-3 bg-white border border-slate-300 text-slate-600 text-[10px] font-black uppercase rounded-xl hover:bg-slate-50 transition-all"
          >
            Quit
          </button>
          <button 
            onClick={handleSaveVoucherType}
            disabled={!vtForm.name}
            className="px-12 py-3 bg-[#1D3557] text-white text-[10px] font-black uppercase rounded-xl shadow-xl hover:bg-blue-800 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            <Check size={16} /> Accept & Save
          </button>
        </div>
      </div>

      {showWorkflowGuide && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
              <div className="bg-[#1D3557] p-4 text-white flex justify-between items-center">
                 <h3 className="font-black text-sm uppercase tracking-widest">Workflow Guide: Voucher Setup</h3>
                 <X size={18} className="cursor-pointer" onClick={() => setShowWorkflowGuide(false)}/>
              </div>
              <div className="p-8 space-y-6">
                 <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">1</div>
                    <div>
                       <h4 className="text-sm font-black text-slate-800 uppercase">Define Voucher Master</h4>
                       <p className="text-xs text-slate-500 mt-1 leading-relaxed">Create specialized voucher types (e.g., 'Retail POS', 'Institutional Sale') under the Setup menu.</p>
                    </div>
                 </div>
                 <div className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-black flex-shrink-0">2</div>
                    <div>
                       <h4 className="text-sm font-black text-slate-800 uppercase">Synchronization</h4>
                       <p className="text-xs text-slate-500 mt-1 leading-relaxed">Click 'Accept'. The voucher type is instantly pushed to the central database.</p>
                    </div>
                 </div>
              </div>
              <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
                  <button onClick={() => setShowWorkflowGuide(false)} className="px-8 py-2 bg-[#1D3557] text-white text-xs font-black uppercase rounded shadow-lg">Close</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default VoucherSetupPage;
