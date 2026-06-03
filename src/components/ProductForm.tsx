
import React, { useState } from 'react';
import { Save, Layers, X, Box } from 'lucide-react';
import { Product } from '../types';

interface ProductFormProps {
 initialData?: Partial<Product>;
 onSubmit: (product: Partial<Product>, openingStock?: any) => void;
 onCancel: () => void;
 isEdit?: boolean;
}

const ProductForm: React.FC<ProductFormProps> = ({ initialData, onSubmit, onCancel, isEdit = false }) => {
 const [formData, setFormData] = useState<Partial<Product>>({
 name: '',
 alias: [],
 source: 'TRADING',
 genericName: '',
 manufacturer: '',
 therapeuticCategory: '',
 packing: '',
 uom: 'Strip',
 hsn: '',
 gst: 12,
 minStockLevel: 10,
 reorderLevel: 20,
 rack: '',
 scheduleType: 'OTC',
 isNarcotic: false,
 temperatureSensitive: false,
 stockCategory: 'General',
 taxType: 'GST 12%',
 ...initialData
 });

 const [openingStock, setOpeningStock] = useState({
 add: false,
 batchNumber: '',
 expiryDate: '',
 quantity: 0,
 mrp: 0,
 purchaseRate: 0,
 sellingRate: 0,
 location: initialData?.rack || ''
 });

 const [errors, setErrors] = useState<Record<string, string>>({});
 const [aliasInput, setAliasInput] = useState('');
 
 const addAlias = () => {
 if (aliasInput.trim() && !formData.alias?.includes(aliasInput.trim())) {
 setFormData({
 ...formData,
 alias: [...(formData.alias || []), aliasInput.trim()]
 });
 setAliasInput('');
 }
 };
 
 const removeAlias = (index: number) => {
 const newAlias = [...(formData.alias || [])];
 newAlias.splice(index, 1);
 setFormData({
 ...formData,
 alias: newAlias
 });
 };
 
 const handleAliasKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
 if (e.key === 'Enter' || e.key === ',') {
 e.preventDefault();
 addAlias();
 }
 };

 const validate = () => {
 const newErrors: Record<string, string> = {};
 if (!formData.name?.trim()) newErrors.name = "Brand Name is required";
 if (!formData.genericName?.trim()) newErrors.genericName = "Generic Name is required";
 if (!formData.manufacturer?.trim()) newErrors.manufacturer = "Manufacturer is required";
 if (!formData.packing?.trim()) newErrors.packing = "Packing is required";
 
 setErrors(newErrors);
 return Object.keys(newErrors).length === 0;
 };

 const handleSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (validate()) {
 onSubmit(formData, openingStock.add ? openingStock : undefined);
 }
 };

 return (
 <div className="flex flex-col h-full bg-white rounded-xl shadow-2xl overflow-hidden animate-fadeIn max-h-[90vh] w-full max-w-4xl">
 <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
 <h3 className="font-bold flex items-center gap-2">
 <Box size={18} /> {isEdit ? 'Edit Product' : 'Add New Product (SKU)'}
 </h3>
 <button onClick={onCancel} className="hover:bg-slate-700 p-1 rounded transition-colors"><X size={18} /></button>
 </div>
 
 <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1">
 {/* Section 1: Basic Info */}
 <h4 className="text-sm font-bold text-primary uppercase tracking-wide mb-3 border-b border-slate-100 pb-2">Basic Information</h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Brand Name *</label>
 <input 
 type="text" 
 className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none ${errors.name ? 'border-red-500' : 'border-slate-300'}`}
 placeholder="e.g. Dolo 650"
 value={formData.name}
 onChange={(e) => setFormData({...formData, name: e.target.value})}
 />
 {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
 </div>
 <div className="md:col-span-2">
 <label className="block text-sm font-medium text-slate-700 mb-1">Generic Name / Composition *</label>
 <input 
 type="text" 
 className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none ${errors.genericName ? 'border-red-500' : 'border-slate-300'}`}
 placeholder="e.g. Paracetamol 650mg"
 value={formData.genericName}
 onChange={(e) => setFormData({...formData, genericName: e.target.value})}
 />
 {errors.genericName && <p className="text-xs text-red-500 mt-1">{errors.genericName}</p>}
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Source *</label>
 <select
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
 value={formData.source}
 onChange={(e) => setFormData({...formData, source: e.target.value as 'PCD' | 'OWN_MANUFACTURING' | 'TRADING'})}
 >
 <option value="TRADING">Trading</option>
 <option value="PCD">PCD (Proprietary Concept Distribution)</option>
 <option value="OWN_MANUFACTURING">Own Manufacturing</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Manufacturer *</label>
 <input 
 type="text" 
 className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none ${errors.manufacturer ? 'border-red-500' : 'border-slate-300'}`}
 placeholder="e.g. Micro Labs"
 value={formData.manufacturer}
 onChange={(e) => setFormData({...formData, manufacturer: e.target.value})}
 />
 {errors.manufacturer && <p className="text-xs text-red-500 mt-1">{errors.manufacturer}</p>}
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Therapeutic Category</label>
 <input 
 type="text" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
 placeholder="e.g. Analgesic"
 value={formData.therapeuticCategory}
 onChange={(e) => setFormData({...formData, therapeuticCategory: e.target.value})}
 />
 </div>
 </div>
 <div className="grid grid-cols-1 gap-4 mb-6">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Aliases (Alternative Names)</label>
 <div className="flex gap-2">
 <input 
 type="text" 
 className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
 placeholder="e.g. Crocin, Paracip, Calpol"
 value={aliasInput}
 onChange={(e) => setAliasInput(e.target.value)}
 onKeyDown={handleAliasKeyDown}
 />
 <button 
 type="button" 
 onClick={addAlias}
 className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-300 transition-colors"
 >
 Add
 </button>
 </div>
 <div className="mt-2 flex flex-wrap gap-2">
 {formData.alias?.map((alias, index) => (
 <div key={index} className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-1 rounded text-sm">
 <span>{alias}</span>
 <button 
 type="button" 
 onClick={() => removeAlias(index)}
 className="text-slate-500 hover:text-red-600"
 >
 ×
 </button>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Section 2: Packing & Regulatory */}
 <h4 className="text-sm font-bold text-primary uppercase tracking-wide mb-3 border-b border-slate-100 pb-2">Packing & Compliance</h4>
 <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Packing *</label>
 <input 
 type="text" 
 className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none ${errors.packing ? 'border-red-500' : 'border-slate-300'}`}
 placeholder="e.g. 15 Tabs / Strip"
 value={formData.packing}
 onChange={(e) => setFormData({...formData, packing: e.target.value})}
 />
 {errors.packing && <p className="text-xs text-red-500 mt-1">{errors.packing}</p>}
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">UOM</label>
 <select 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
 value={formData.uom}
 onChange={(e) => setFormData({...formData, uom: e.target.value})}
 >
 <option>Strip</option>
 <option>Bottle</option>
 <option>Tube</option>
 <option>Vial</option>
 <option>Box</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Schedule Type</label>
 <select 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
 value={formData.scheduleType}
 onChange={(e: any) => setFormData({...formData, scheduleType: e.target.value})}
 >
 <option value="OTC">OTC (General)</option>
 <option value="H">Schedule H</option>
 <option value="H1">Schedule H1 (Tracking Req)</option>
 <option value="X">Schedule X (Narcotic)</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">HSN Code</label>
 <input 
 type="text" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
 value={formData.hsn}
 onChange={(e) => setFormData({...formData, hsn: e.target.value})}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">GST (%)</label>
 <select 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
 value={formData.gst}
 onChange={(e) => setFormData({...formData, gst: Number(e.target.value)})}
 >
 <option value={0}>0%</option>
 <option value={5}>5%</option>
 <option value={12}>12%</option>
 <option value={18}>18%</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Stock Category</label>
 <select 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
 value={formData.stockCategory}
 onChange={(e) => setFormData({...formData, stockCategory: e.target.value})}
 >
 <option value="General">General</option>
 <option value="Branded">Branded</option>
 <option value="Generic">Generic</option>
 <option value="Surgical">Surgical</option>
 <option value="Ayurvedic">Ayurvedic</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Tax Type</label>
 <select 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-white"
 value={formData.taxType}
 onChange={(e) => setFormData({...formData, taxType: e.target.value})}
 >
 <option value="GST 12%">GST 12%</option>
 <option value="GST 18%">GST 18%</option>
 <option value="GST 5%">GST 5%</option>
 <option value="Exempt">Exempt</option>
 </select>
 </div>
 
 <div className="md:col-span-2 flex items-center gap-4 mt-6">
 <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
 <input 
 type="checkbox" 
 className="w-4 h-4 text-primary rounded border-slate-300"
 checked={formData.temperatureSensitive}
 onChange={(e) => setFormData({...formData, temperatureSensitive: e.target.checked})}
 />
 Cold Storage (Fridge)
 </label>
 <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
 <input 
 type="checkbox" 
 className="w-4 h-4 text-primary rounded border-slate-300"
 checked={formData.isNarcotic}
 onChange={(e) => setFormData({...formData, isNarcotic: e.target.checked})}
 />
 Narcotic Flag
 </label>
 </div>
 </div>

 {/* Section 3: Inventory Settings */}
 <h4 className="text-sm font-bold text-primary uppercase tracking-wide mb-3 border-b border-slate-100 pb-2">Inventory Control</h4>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Rack / Shelf Location</label>
 <input 
 type="text" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
 placeholder="e.g. A1-Top"
 value={formData.rack}
 onChange={(e) => setFormData({...formData, rack: e.target.value})}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Min Stock Level</label>
 <input 
 type="number" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
 value={formData.minStockLevel}
 onChange={(e) => setFormData({...formData, minStockLevel: Number(e.target.value)})}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Reorder Level</label>
 <input 
 type="number" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
 value={formData.reorderLevel}
 onChange={(e) => setFormData({...formData, reorderLevel: Number(e.target.value)})}
 />
 </div>
 </div>

 {/* Section 4: Opening Stock (Optional - Only for Add Mode) */}
 {!isEdit && (
 <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
 <div className="flex items-center justify-between mb-3">
 <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2"><Layers size={16}/> Opening Stock (Initial Batch)</h4>
 <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
 <input 
 type="checkbox" 
 checked={openingStock.add}
 onChange={(e) => setOpeningStock({...openingStock, add: e.target.checked})}
 className="w-4 h-4 text-primary rounded border-slate-300"
 />
 Add Opening Stock?
 </label>
 </div>
 
 {openingStock.add && (
 <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-fadeIn">
 <div>
 <label className="block text-xs font-medium text-slate-500 mb-1">Batch No</label>
 <input type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="Batch" value={openingStock.batchNumber} onChange={e => setOpeningStock({...openingStock, batchNumber: e.target.value})} />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-500 mb-1">Expiry</label>
 <input type="text" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" placeholder="YYYY-MM-DD" value={openingStock.expiryDate} onChange={e => setOpeningStock({...openingStock, expiryDate: e.target.value})} />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>
 <input type="number" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" value={openingStock.quantity} onChange={e => setOpeningStock({...openingStock, quantity: Number(e.target.value)})} />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-500 mb-1">Purchase Rate</label>
 <input type="number" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" value={openingStock.purchaseRate} onChange={e => setOpeningStock({...openingStock, purchaseRate: Number(e.target.value)})} />
 </div>
 <div>
 <label className="block text-xs font-medium text-slate-500 mb-1">MRP</label>
 <input type="number" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" value={openingStock.mrp} onChange={e => setOpeningStock({...openingStock, mrp: Number(e.target.value)})} />
 </div>
 </div>
 )}
 </div>
 )}

 <div className="mt-6 flex justify-end gap-3">
 <button type="button" onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium transition-colors">Cancel</button>
 <button 
 type="submit"
 className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-sky-600 shadow-none shadow-primary/30 flex items-center gap-2 text-sm"
 >
 <Save size={18} /> {isEdit ? 'Update Product' : 'Save Product'}
 </button>
 </div>
 </form>
 </div>
 );
};

export default ProductForm;

