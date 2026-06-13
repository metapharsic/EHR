
import React, { useState, useEffect } from 'react';
import { MedicalRepresentative, SalarySlip } from '../types';
import { apiClient } from '../services/apiClient';
import { IndianRupee, FileText, Download, Calculator, CheckCircle, AlertCircle, Building2, User, Trash2, Edit, Save, X, Eye, RefreshCw, Sparkles } from 'lucide-react';

const Payroll: React.FC = () => {
 const [selectedMonth, setSelectedMonth] = useState('October');
 const [selectedYear, setSelectedYear] = useState(2026);
 const [salarySlips, setSalarySlips] = useState<SalarySlip[]>([]);
 const [employees, setEmployees] = useState<MedicalRepresentative[]>([]);
 const [anomalies, setAnomalies] = useState<any[]>([]);
 const [loading, setLoading] = useState(true);

 useEffect(() => {
   const fetchData = async () => {
     setLoading(true);
     try {
       const empRes = await apiClient.get<MedicalRepresentative[]>('/hr/employees');
       const anomalyRes = await apiClient.get<any[]>('/hr/payroll/anomalies');
       const slipsRes = await apiClient.get<any[]>(`/hr/payroll/slips?month=${selectedMonth}&year=${selectedYear}`);
       
       if (empRes.success && Array.isArray(empRes.data)) {
         setEmployees(empRes.data);
       }
       if (anomalyRes.success && Array.isArray(anomalyRes.data)) {
         setAnomalies(anomalyRes.data);
       }
       if (slipsRes.success && Array.isArray(slipsRes.data)) {
         setSalarySlips(slipsRes.data);
       } else {
         setSalarySlips([]);
       }
     } catch (err) {
       console.error("Failed to fetch payroll data", err);
     } finally {
       setLoading(false);
     }
   };
   fetchData();
 }, [selectedMonth, selectedYear]);

 const handleRunBulkPayroll = async () => {
   if (window.confirm(`Run automated payroll engine for ${selectedMonth} ${selectedYear}? This will generate salary slips and post Journal Vouchers to the General Ledger.`)) {
     setLoading(true);
     try {
       const res = await apiClient.post('/hr/payroll/process-bulk', { month: selectedMonth, year: selectedYear });
       if (res.success) {
         // Refetch slips
         const slipsRes = await apiClient.get<any[]>(`/hr/payroll/slips?month=${selectedMonth}&year=${selectedYear}`);
         if (slipsRes.success && Array.isArray(slipsRes.data)) setSalarySlips(slipsRes.data);
         alert(`Success! Processed ${res.slipsProcessed} slips and generated Voucher: ${res.voucherId}`);
       }
     } catch (error: any) {
       alert(error.message || 'Failed to process bulk payroll');
     } finally {
       setLoading(false);
     }
   }
 };

 
 // Modal States
 const [showSlipModal, setShowSlipModal] = useState(false);
 const [modalMode, setModalMode] = useState<'VIEW' | 'EDIT' | 'CREATE'>('VIEW');
 const [currentSlip, setCurrentSlip] = useState<SalarySlip | null>(null);
 const [selectedEmployee, setSelectedEmployee] = useState<MedicalRepresentative | null>(null);

 // Editable fields state
 const [editForm, setEditForm] = useState({
 incentive: 0,
 otherDeductions: 0,
 specialAllowance: 0
 });

 // Helper to calculate salary structure
 const calculateSalary = (employee: MedicalRepresentative, overrides?: { incentive?: number, otherDeductions?: number, specialAllowance?: number }): SalarySlip => {
 const gross = employee.baseSalary || 20000;
 
 const basic = Math.round(gross * 0.5);
 const hra = Math.round(gross * 0.2); 
 const da = Math.round(gross * 0.1);
 
 // Allow overrides or default calculation
 const special = overrides?.specialAllowance !== undefined ? overrides.specialAllowance : (gross - basic - hra - da);
 
 // Incentives
 const incentive = overrides?.incentive !== undefined 
 ? overrides.incentive 
 : (employee.targetAchievement > 80 ? Math.round(employee.totalSales * 0.02) : 0);

 const fixedAllowance = employee.incentives || 0;
 const totalEarnings = basic + hra + da + special + incentive + fixedAllowance;

 // Deductions
 const pfEmployee = Math.round(basic * 0.12);
 const pfEmployer = Math.round(basic * 0.12);
 const pt = 200;
 const tds = totalEarnings > 50000 ? Math.round(totalEarnings * 0.05) : 0;
 const otherDeductions = overrides?.otherDeductions !== undefined ? overrides.otherDeductions : (employee.deductions || 0);

 const totalDeductions = pfEmployee + pt + tds + otherDeductions;
 const netPay = totalEarnings - totalDeductions;

 const tenureYears = new Date().getFullYear() - new Date(employee.joinDate).getFullYear() + 1;
 const gratuityAccrued = Math.round((15 * basic * tenureYears) / 26);

 return {
 id: `SLIP-${employee.id}-${selectedMonth}-${selectedYear}`,
 employeeId: employee.id,
 month: selectedMonth,
 year: selectedYear,
 basicSalary: basic,
 hra: hra,
 da: da,
 specialAllowance: special,
 performanceIncentive: incentive,
 fixedAllowance: fixedAllowance,
 grossSalary: totalEarnings,
 pfEmployee,
 pfEmployer,
 professionalTax: pt,
 tds,
 otherDeductions,
 totalDeductions,
 netPay,
 gratuityAccrued
 };
 };

 // --- CRUD Actions ---

 const handleProcessPayroll = (employee: MedicalRepresentative) => {
 const slip = calculateSalary(employee);
 setCurrentSlip(slip);
 setSelectedEmployee(employee);
 setEditForm({
 incentive: slip.performanceIncentive,
 otherDeductions: slip.otherDeductions,
 specialAllowance: slip.specialAllowance
 });
 setModalMode('CREATE');
 setShowSlipModal(true);
 };

 const handleViewSlip = (slip: SalarySlip, employee: MedicalRepresentative) => {
 setCurrentSlip(slip);
 setSelectedEmployee(employee);
 setModalMode('VIEW');
 setShowSlipModal(true);
 };

 const handleEditSlip = (slip: SalarySlip, employee: MedicalRepresentative) => {
 setCurrentSlip(slip);
 setSelectedEmployee(employee);
 setEditForm({
 incentive: slip.performanceIncentive,
 otherDeductions: slip.otherDeductions,
 specialAllowance: slip.specialAllowance
 });
 setModalMode('EDIT');
 setShowSlipModal(true);
 };

 const handleDeleteSlip = (slipId: string) => {
 if (window.confirm("Are you sure you want to delete this payroll record? It will be reset to Pending.")) {
 setSalarySlips(prev => prev.filter(s => s.id !== slipId));
 }
 };

 const handleSaveSlip = () => {
 if (!selectedEmployee || !currentSlip) return;

 // Recalculate with edited values
 const finalSlip = calculateSalary(selectedEmployee, {
 incentive: Number(editForm.incentive),
 otherDeductions: Number(editForm.otherDeductions),
 specialAllowance: Number(editForm.specialAllowance)
 });

 if (modalMode === 'CREATE') {
 setSalarySlips([...salarySlips, finalSlip]);
 } else if (modalMode === 'EDIT') {
 setSalarySlips(salarySlips.map(s => s.id === currentSlip.id ? finalSlip : s));
 }

 setShowSlipModal(false);
 };

 // Recalculate preview when form changes
 useEffect(() => {
 if ((modalMode === 'CREATE' || modalMode === 'EDIT') && selectedEmployee) {
 const preview = calculateSalary(selectedEmployee, {
 incentive: Number(editForm.incentive),
 otherDeductions: Number(editForm.otherDeductions),
 specialAllowance: Number(editForm.specialAllowance)
 });
 setCurrentSlip(preview);
 }
 }, [editForm, modalMode, selectedEmployee]);


 const handlePrint = () => {
 window.print();
 };

 return (
 <div className="space-y-6 animate-fadeIn">
 {anomalies.length > 0 && (
   <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3 shadow-sm">
     <Sparkles className="text-orange-500 flex-shrink-0 mt-0.5" size={20} />
     <div>
       <h4 className="font-bold text-orange-800 text-sm">AI Anomaly Detection</h4>
       <p className="text-xs text-orange-600 mt-1">Found {anomalies.length} unusual pattern(s) in current payroll data.</p>
       <ul className="mt-2 space-y-1">
         {anomalies.map((anom, idx) => (
           <li key={idx} className="text-xs text-orange-700 bg-orange-100 px-2 py-1 rounded">
             <strong className="text-orange-900">{anom.name}:</strong> {anom.description}
           </li>
         ))}
       </ul>
     </div>
   </div>
 )}

 {/* Filters */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
 <div className="flex items-center gap-4">
 <div className="bg-blue-50 p-3 rounded-lg text-accent">
 <Calculator size={24} />
 </div>
 <div>
 <h3 className="font-bold text-slate-800">Payroll Processing</h3>
 <p className="text-xs text-slate-500">Manage salaries, slips, and history</p>
 </div>
 </div>
 <div className="flex gap-2 items-center">
 <button 
   onClick={handleRunBulkPayroll}
   disabled={loading}
   className="mr-4 px-4 py-2 bg-slate-900 text-white font-bold text-sm rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-2"
 >
   <Sparkles size={16} /> Run Automated Payroll Batch
 </button>
 <select 
 value={selectedMonth} 
 onChange={(e) => setSelectedMonth(e.target.value)}
 className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
 >
 {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
 <option key={m} value={m}>{m}</option>
 ))}
 </select>
 <select
 value={selectedYear}
 onChange={(e) => setSelectedYear(Number(e.target.value))}
 className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary"
 >
 <option value={2026}>2026</option>
 <option value={2027}>2027</option>
 </select>
 </div>
 </div>

 {/* Payroll Table */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <table className="w-full text-left text-sm">
 <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-100">
 <tr>
 <th className="p-4">Employee</th>
 <th className="p-4">Designation</th>
 <th className="p-4 text-right">Fixed CTC</th>
 <th className="p-4 text-center">Status</th>
 <th className="p-4 text-right">Net Pay</th>
 <th className="p-4 text-center">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {loading ? (
    <tr><td colSpan={6} className="text-center p-8 text-slate-400">Loading Employees...</td></tr>
 ) : employees.map(emp => {
 // Check if slip exists in state
 const existingSlip = salarySlips.find(s => 
 s.employeeId === emp.id && s.month === selectedMonth && s.year === selectedYear
 );

 return (
 <tr key={emp.id} className="hover:bg-slate-50 transition-colors">
 <td className="p-4">
 <div className="font-bold text-slate-800">{emp.name}</div>
 <div className="text-xs text-slate-500">ID: {emp.id.slice(0, 8)}...</div>
 </td>
 <td className="p-4 text-slate-600">Medical Rep (Field)</td>
 <td className="p-4 text-right font-medium text-slate-500">?{(emp.baseSalary || 20000).toLocaleString()}</td>
 <td className="p-4 text-center">
 {existingSlip ? (
 <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
 <CheckCircle size={12}/> Processed
 </span>
 ) : (
 <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
 <AlertCircle size={12}/> Pending
 </span>
 )}
 </td>
 <td className="p-4 text-right font-bold text-slate-800">
 {existingSlip ? `?${existingSlip.netPay.toLocaleString()}` : '-'}
 </td>
 <td className="p-4 text-center">
 {existingSlip ? (
 <div className="flex justify-center gap-2">
 <button 
 onClick={() => handleViewSlip(existingSlip, emp)}
 className="p-1.5 text-slate-500 hover:text-accent hover:bg-blue-50 rounded transition-colors" 
 title="View"
 >
 <Eye size={16}/>
 </button>
 <button 
 onClick={() => handleEditSlip(existingSlip, emp)}
 className="p-1.5 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded transition-colors" 
 title="Edit"
 >
 <Edit size={16}/>
 </button>
 <button 
 onClick={() => handleDeleteSlip(existingSlip.id)}
 className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" 
 title="Delete"
 >
 <Trash2 size={16}/>
 </button>
 </div>
 ) : (
 <button 
 onClick={() => handleProcessPayroll(emp)}
 className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-700 transition-colors shadow-sm flex items-center gap-2 mx-auto"
 >
 <RefreshCw size={12}/> Process
 </button>
 )}
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 {!loading && employees.length === 0 && <div className="p-8 text-center text-slate-400">No employees found.</div>}
 </div>

 {/* SALARY SLIP MODAL */}
 {showSlipModal && currentSlip && selectedEmployee && (
 <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-fadeIn">
 <div className="bg-white w-full max-w-3xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
 {/* Modal Header */}
 <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
 <div>
 <h3 className="font-bold flex items-center gap-2">
 <FileText size={18}/> 
 {modalMode === 'VIEW' ? 'Salary Slip View' : modalMode === 'EDIT' ? 'Edit Payroll' : 'Process Payroll'}
 </h3>
 <p className="text-xs text-slate-400 mt-0.5">{selectedEmployee.name} • {currentSlip.month} {currentSlip.year}</p>
 </div>
 <div className="flex gap-2">
 {modalMode === 'VIEW' && (
 <button onClick={handlePrint} className="p-2 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white" title="Print">
 <Download size={18}/>
 </button>
 )}
 <button onClick={() => setShowSlipModal(false)} className="p-2 hover:bg-slate-700 rounded transition-colors text-slate-300 hover:text-white">
 <X size={18}/>
 </button>
 </div>
 </div>

 <div className="flex flex-col md:flex-row h-full overflow-hidden">
 
 {/* Editor Sidebar (Only for Create/Edit) */}
 {modalMode !== 'VIEW' && (
 <div className="w-full md:w-1/3 bg-slate-50 border-r border-slate-200 p-5 overflow-y-auto">
 <h4 className="text-xs font-bold text-slate-500 uppercase mb-4">Variable Components</h4>
 <div className="space-y-4">
 <div>
 <label className="block text-xs font-semibold text-slate-700 mb-1">Performance Incentive</label>
 <input 
 type="number" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
 value={editForm.incentive}
 onChange={(e) => setEditForm({...editForm, incentive: Number(e.target.value)})}
 />
 <p className="text-[10px] text-slate-400 mt-1">Based on {selectedEmployee.targetAchievement}% achievement</p>
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-700 mb-1">Other Deductions</label>
 <input 
 type="number" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
 value={editForm.otherDeductions}
 onChange={(e) => setEditForm({...editForm, otherDeductions: Number(e.target.value)})}
 />
 <p className="text-[10px] text-slate-400 mt-1">Advance / Penalties</p>
 </div>
 <div>
 <label className="block text-xs font-semibold text-slate-700 mb-1">Special Allowance</label>
 <input 
 type="number" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
 value={editForm.specialAllowance}
 onChange={(e) => setEditForm({...editForm, specialAllowance: Number(e.target.value)})}
 />
 </div>
 </div>
 <div className="mt-8 pt-4 border-t border-slate-200">
 <div className="flex justify-between items-center mb-4">
 <span className="text-sm font-bold text-slate-700">Net Payable</span>
 <span className="text-lg font-bold text-primary">?{currentSlip.netPay.toLocaleString()}</span>
 </div>
 <button 
 onClick={handleSaveSlip}
 className="w-full py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-sky-600 shadow-none flex items-center justify-center gap-2"
 >
 <Save size={16} /> Save & Generate
 </button>
 </div>
 </div>
 )}

 {/* Preview Area */}
 <div className={`flex-1 overflow-y-auto p-6 md:p-8 bg-slate-100 ${modalMode !== 'VIEW' ? 'hidden md:block' : ''}`}>
 <div className="bg-white border border-slate-200 shadow-sm p-8 max-w-xl mx-auto min-h-[600px]" id="salary-slip">
 {/* Slip Header */}
 <div className="text-center border-b-2 border-slate-800 pb-4 mb-6">
 <div className="flex items-center justify-center gap-2 text-slate-800 mb-1">
 <Building2 size={24} />
 <h1 className="text-xl font-bold uppercase tracking-wide">Metapharsic Lifesciences</h1>
 </div>
 <p className="text-xs text-slate-500">123, Pharma Park, MIDC, Pune - 411057</p>
 <h2 className="text-lg font-bold text-slate-700 mt-4 underline decoration-slate-300 underline-offset-4">PAYSLIP FOR {currentSlip.month.toUpperCase()} {currentSlip.year}</h2>
 </div>

 {/* Employee Details */}
 <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-6 pb-6 border-b border-slate-200 border-dashed">
 <div>
 <p className="text-slate-500 text-[10px] uppercase">Employee Name</p>
 <p className="font-bold text-slate-800">{selectedEmployee.name}</p>
 </div>
 <div className="text-right">
 <p className="text-slate-500 text-[10px] uppercase">Employee ID</p>
 <p className="font-bold text-slate-800">{selectedEmployee.id}</p>
 </div>
 <div>
 <p className="text-slate-500 text-[10px] uppercase">Designation</p>
 <p className="font-medium text-slate-800">Medical Representative</p>
 </div>
 <div className="text-right">
 <p className="text-slate-500 text-[10px] uppercase">Joining Date</p>
 <p className="font-medium text-slate-800">{selectedEmployee.joinDate}</p>
 </div>
 </div>

 {/* Earnings & Deductions Table */}
 <div className="flex border border-slate-300 text-xs mb-6">
 <div className="flex-1 border-r border-slate-300">
 <div className="bg-slate-100 p-2 font-bold text-slate-700 border-b border-slate-300 text-center">EARNINGS</div>
 <div className="p-3 space-y-2">
 <div className="flex justify-between"><span>Basic Salary</span><span>{currentSlip.basicSalary.toLocaleString()}</span></div>
 <div className="flex justify-between"><span>HRA</span><span>{currentSlip.hra.toLocaleString()}</span></div>
 <div className="flex justify-between"><span>DA</span><span>{currentSlip.da.toLocaleString()}</span></div>
 <div className="flex justify-between"><span>Special Allow.</span><span>{currentSlip.specialAllowance.toLocaleString()}</span></div>
 {currentSlip.fixedAllowance > 0 && (
 <div className="flex justify-between"><span>Fixed Allow.</span><span>{currentSlip.fixedAllowance.toLocaleString()}</span></div>
 )}
 {currentSlip.performanceIncentive > 0 && (
 <div className="flex justify-between text-green-700 font-bold"><span>Incentive</span><span>{currentSlip.performanceIncentive.toLocaleString()}</span></div>
 )}
 </div>
 </div>
 <div className="flex-1">
 <div className="bg-slate-100 p-2 font-bold text-slate-700 border-b border-slate-300 text-center">DEDUCTIONS</div>
 <div className="p-3 space-y-2">
 <div className="flex justify-between"><span>PF (Employee)</span><span>{currentSlip.pfEmployee.toLocaleString()}</span></div>
 <div className="flex justify-between"><span>Prof. Tax</span><span>{currentSlip.professionalTax.toLocaleString()}</span></div>
 <div className="flex justify-between"><span>TDS</span><span>{currentSlip.tds.toLocaleString()}</span></div>
 {currentSlip.otherDeductions > 0 && (
 <div className="flex justify-between text-red-600 font-bold"><span>Other</span><span>{currentSlip.otherDeductions.toLocaleString()}</span></div>
 )}
 </div>
 </div>
 </div>

 {/* Totals */}
 <div className="flex justify-between items-center bg-slate-100 p-3 border border-slate-300 mb-6 font-bold text-slate-800 text-xs">
 <div className="w-1/2 text-center">Gross Earnings: ?{currentSlip.grossSalary.toLocaleString()}</div>
 <div className="w-1/2 text-center border-l border-slate-300">Total Deductions: ?{currentSlip.totalDeductions.toLocaleString()}</div>
 </div>

 {/* Net Pay */}
 <div className="border-2 border-slate-800 p-4 mb-6 flex justify-between items-center bg-white shadow-sm">
 <div>
 <p className="text-[10px] text-slate-500 uppercase font-bold">Net Payable Amount</p>
 <p className="text-[10px] text-slate-400 italic">(Earnings - Deductions)</p>
 </div>
 <div className="text-2xl font-bold text-slate-900 tracking-tight">
 ? {currentSlip.netPay.toLocaleString()}
 </div>
 </div>
 
 <div className="mt-8 text-center text-[10px] text-slate-400">
 Computer Generated Document.
 </div>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default Payroll;

