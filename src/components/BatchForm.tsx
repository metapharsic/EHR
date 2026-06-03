
import React, { useState, useEffect } from 'react';
import { Save, X, Box } from 'lucide-react';
import { Batch } from '../types';

interface BatchFormProps {
 initialData?: Partial<Batch>;
 productName: string;
 onSubmit: (batchData: Partial<Batch>) => void;
 onCancel: () => void;
 isEdit?: boolean;
}

const BatchForm: React.FC<BatchFormProps> = ({ initialData, productName, onSubmit, onCancel, isEdit = false }) => {
 const [formData, setFormData] = useState<Partial<Batch>>({
 batchNumber: '',
 manufacturingDate: '',
 expiryDate: '',
 stock: 0,
 mrp: 0,
 purchaseRate: 0,
 sellingRate: 0,
 location: '',
 ...initialData
 });

 const [errors, setErrors] = useState<Record<string, string>>({});

 const validate = () => {
 const newErrors: Record<string, string> = {};
 if (!formData.batchNumber) newErrors.batchNumber = 'Batch Number is required';
 if (!formData.expiryDate) newErrors.expiryDate = 'Expiry Date is required';
 if (formData.stock === undefined || formData.stock < 0) newErrors.stock = 'Valid stock quantity required';
 if (formData.mrp === undefined || formData.mrp < 0) newErrors.mrp = 'Valid MRP required';
 
 setErrors(newErrors);
 return Object.keys(newErrors).length === 0;
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (validate()) {
 onSubmit(formData);
 }
 };

 return (
 <div className="flex flex-col h-full bg-white rounded-xl shadow-2xl overflow-hidden animate-fadeIn max-h-[90vh] w-full max-w-md">
 {/* Header */}
 <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
 <div>
 <h3 className="font-bold flex items-center gap-2">
 <Box size={18}/> {isEdit ? 'Edit Batch' : 'Add New Batch'}
 </h3>
 <p className="text-xs text-slate-400 mt-1">{productName}</p>
 </div>
 <button onClick={onCancel} className="hover:bg-slate-700 p-1 rounded transition-colors"><X size={18} /></button>
 </div>

 <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
 <div className="space-y-4">
 <div className="grid grid-cols-3 gap-2">
 <div className="col-span-1">
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Batch *</label>
 <input 
 type="text" 
 className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary outline-none ${errors.batchNumber ? 'border-red-500' : 'border-slate-300'}`}
 value={formData.batchNumber} 
 onChange={e => setFormData({...formData, batchNumber: e.target.value})} 
 placeholder="B101" 
 autoFocus={!isEdit}
 />
 </div>
 <div className="col-span-1">
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mfg Date</label>
 <input 
 type="date" 
 className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary outline-none"
 value={formData.manufacturingDate} 
 onChange={e => setFormData({...formData, manufacturingDate: e.target.value})} 
 />
 </div>
 <div className="col-span-1">
 <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Expiry *</label>
 <input 
 type="date" 
 className={`w-full border rounded-lg px-2 py-1.5 text-sm focus:ring-2 focus:ring-primary outline-none ${errors.expiryDate ? 'border-red-500' : 'border-slate-300'}`}
 value={formData.expiryDate} 
 onChange={e => setFormData({...formData, expiryDate: e.target.value})} 
 />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-xs font-medium text-slate-700 mb-1">Stock Quantity</label>
 <input 
 type="number" 
 className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none ${errors.stock ? 'border-red-500' : 'border-slate-300'}`}
 value={formData.stock} 
 onChange={e => setFormData({...formData, stock: Number(e.target.value)})} 
 />
 {errors.stock && <p className="text-xs text-red-500 mt-1">{errors.stock}</p>}
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-700 mb-1">Location / Rack</label>
 <input 
 type="text" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
 value={formData.location} 
 onChange={e => setFormData({...formData, location: e.target.value})} 
 placeholder="Rack A1"
 />
 </div>
 </div>

 <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
 <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Pricing Details</h4>
 <div className="grid grid-cols-3 gap-3">
 <div>
 <label className="block text-xs font-medium text-slate-500 mb-1">MRP</label>
 <input 
 type="number" 
 className={`w-full border rounded px-2 py-1.5 text-sm ${errors.mrp ? 'border-red-500' : 'border-slate-300'}`}
 value={formData.mrp} 
 onChange={e => setFormData({...formData, mrp: Number(e.target.value)})} 
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-500 mb-1">Rate (Cost)</label>
 <input 
 type="number" 
 className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" 
 value={formData.purchaseRate} 
 onChange={e => setFormData({...formData, purchaseRate: Number(e.target.value)})} 
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-500 mb-1">Sell Rate</label>
 <input 
 type="number" 
 className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" 
 value={formData.sellingRate} 
 onChange={e => setFormData({...formData, sellingRate: Number(e.target.value)})} 
 />
 </div>
 </div>
 </div>
 </div>
 
 <div className="mt-6 flex justify-end gap-3">
 <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
 <button 
 type="submit"
 className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-sky-600 shadow-none shadow-primary/30 flex items-center gap-2 text-sm"
 >
 <Save size={16} /> {isEdit ? 'Update Batch' : 'Save Batch'}
 </button>
 </div>
 </form>
 </div>
 );
};

export default BatchForm;

