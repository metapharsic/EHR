// ============================================
// GODOWNS MANAGEMENT UI COMPONENT
// Path: components/GodownsManagement.tsx
// Purpose: Create, manage, and organize warehouse locations
// ============================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Warehouse, Plus, Edit2, Trash2, MapPin, User, Calendar, Save, X, AlertCircle, Check } from 'lucide-react';
import { 
 getAllGodowns, 
 createGodown, 
 updateGodown, 
 deleteGodown, 
 initializeGodownSampleData,
 Godown 
} from '../services/databaseService';

const GodownsManagement: React.FC = () => {
 const [godowns, setGodowns] = useState<Godown[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editingGodown, setEditingGodown] = useState<Godown | null>(null);
 
 const [formData, setFormData] = useState({
 name: '',
 address: '',
 manager_id: '',
 is_default: false
 });

 const { hasPermission } = useAuth();
 const canEdit = hasPermission(['ADMIN', 'INVENTORY_MANAGER']);
 const isActiveStatus = (status: string) => status.toLowerCase() === 'active';

 // Load godowns on mount
 useEffect(() => {
 const loadGodowns = async () => {
 try {
 setIsLoading(true);
 // Initialize sample data if empty
 initializeGodownSampleData();
 const data = await getAllGodowns();
 setGodowns(data);
 } catch (error) {
 console.error('❌ Error loading godowns:', error);
 } finally {
 setIsLoading(false);
 }
 };

 loadGodowns();
 }, []);

 // Handle create/edit
 const handleSubmit = async () => {
 try {
 if (!formData.name) {
 alert('Please fill required fields');
 return;
 }

 if (editingGodown) {
 // Edit mode
 const updated = await updateGodown(editingGodown.id, formData);
 setGodowns(godowns.map(g => g.id === editingGodown.id ? updated : g));
 alert('✅ Godown updated successfully');
 } else {
 // Create mode
 const created = await createGodown(formData);
 setGodowns([created, ...godowns]);
 alert('✅ Godown created successfully');
 }

 setFormData({ name: '', address: '', manager_id: '', is_default: false });
 setEditingGodown(null);
 setShowForm(false);
 } catch (error) {
 console.error('❌ Error saving godown:', error);
 alert('Failed to save godown');
 }
 };

 // Handle edit button
 const handleEdit = (godown: Godown) => {
 setEditingGodown(godown);
 setFormData({
 name: godown.name,
 address: godown.address || '',
 manager_id: godown.manager_id || '',
 is_default: godown.is_default
 });
 setShowForm(true);
 };

 // Handle cancel
 const handleCancel = () => {
 setFormData({ name: '', address: '', manager_id: '', is_default: false });
 setEditingGodown(null);
 setShowForm(false);
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex justify-between items-center">
 <h2 className="text-2xl font-bold text-slate-800">Warehouse Management</h2>
 {canEdit && (
 <button
 onClick={() => {
 setEditingGodown(null);
 setFormData({ name: '', address: '', manager_id: '', is_default: false });
 setShowForm(true);
 }}
 className="bg-primary text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-sky-600 transition-colors"
 >
 <Plus size={16} /> Add Warehouse
 </button>
 )}
 </div>

 {/* Stats Cards */}
 <div className="grid grid-cols-4 gap-4">
 <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
 <p className="text-slate-500 text-xs font-medium mb-1">Total Warehouses</p>
 <h3 className="text-2xl font-bold text-slate-800">{godowns.length}</h3>
 </div>
 <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
 <p className="text-slate-500 text-xs font-medium mb-1">Active Locations</p>
 <h3 className="text-2xl font-bold text-green-600">{godowns.filter(g => isActiveStatus(g.status)).length}</h3>
 </div>
 <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
 <p className="text-slate-500 text-xs font-medium mb-1">Default Warehouse</p>
 <h3 className="text-lg font-bold text-slate-800">{godowns.find(g => g.is_default)?.name || 'None'}</h3>
 </div>
 <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
 <p className="text-slate-500 text-xs font-medium mb-1">Inactive Locations</p>
 <h3 className="text-2xl font-bold text-orange-600">{godowns.filter(g => !isActiveStatus(g.status)).length}</h3>
 </div>
 </div>

 {/* Form Modal */}
 {showForm && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
 <div className="p-6 border-b border-slate-200">
 <div className="flex items-center justify-between">
 <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
 <Warehouse size={20} /> {editingGodown ? 'Edit Warehouse' : 'New Warehouse'}
 </h3>
 <button onClick={handleCancel} className="p-2 hover:bg-slate-100 rounded">
 <X size={20} className="text-slate-500" />
 </button>
 </div>
 </div>

 <div className="p-6 space-y-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Warehouse Name *</label>
 <input
 type="text"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 placeholder="e.g., Main Warehouse"
 value={formData.name}
 onChange={(e) => setFormData({ ...formData, name: e.target.value })}
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
 <textarea
 rows={2}
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 placeholder="Full address"
 value={formData.address}
 onChange={(e) => setFormData({ ...formData, address: e.target.value })}
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Manager ID</label>
 <input
 type="text"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-primary"
 placeholder="Manager user ID"
 value={formData.manager_id}
 onChange={(e) => setFormData({ ...formData, manager_id: e.target.value })}
 />
 </div>

 <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg">
 <input
 type="checkbox"
 id="is_default"
 checked={formData.is_default}
 onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
 className="w-4 h-4"
 />
 <label htmlFor="is_default" className="text-sm font-medium text-slate-700 cursor-pointer">
 Set as default warehouse
 </label>
 </div>
 </div>

 <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
 <button
 onClick={handleCancel}
 className="px-4 py-2 border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50"
 >
 Cancel
 </button>
 <button
 onClick={handleSubmit}
 className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-sky-600 flex items-center gap-2"
 >
 <Save size={16} /> Save Warehouse
 </button>
 </div>
 </div>
 </div>
 )}

 {/* Godowns List */}
 <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
 {isLoading ? (
 <div className="p-8 text-center text-slate-500">Loading warehouses...</div>
 ) : godowns.length === 0 ? (
 <div className="p-8 text-center">
 <Warehouse size={48} className="mx-auto text-slate-300 mb-3" />
 <p className="text-slate-500">No warehouses configured yet</p>
 <p className="text-sm text-slate-400 mt-2">Create your first warehouse to manage locations</p>
 </div>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-left">
 <thead className="bg-slate-50 border-b border-slate-200">
 <tr>
 <th className="p-4 font-semibold text-slate-700">Warehouse Name</th>
 <th className="p-4 font-semibold text-slate-700">Address</th>
 <th className="p-4 font-semibold text-slate-700">Manager</th>
 <th className="p-4 font-semibold text-slate-700">Status</th>
 <th className="p-4 font-semibold text-slate-700">Default</th>
 <th className="p-4 font-semibold text-slate-700">Created</th>
 {canEdit && <th className="p-4 font-semibold text-slate-700 text-center">Actions</th>}
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {godowns.map(godown => (
 <tr key={godown.id} className="hover:bg-slate-50">
 <td className="p-4">
 <div className="flex items-center gap-2">
 <Warehouse size={16} className="text-accent" />
 <span className="font-medium text-slate-800">{godown.name}</span>
 </div>
 </td>
 <td className="p-4 text-sm text-slate-600">
 <div className="flex items-center gap-2">
 <MapPin size={14} className="text-slate-400" />
 {godown.address || '-'}
 </div>
 </td>
 <td className="p-4 text-sm text-slate-600">
 <div className="flex items-center gap-2">
 <User size={14} className="text-slate-400" />
 {godown.manager_id ? godown.manager_id.substring(0, 8) : '-'}
 </div>
 </td>
 <td className="p-4">
 <span className={`px-3 py-1 rounded-full text-xs font-bold ${
 isActiveStatus(godown.status)
 ? 'bg-green-100 text-green-700 border border-green-200'
 : 'bg-orange-100 text-orange-700 border border-orange-200'
 }`}>
 {isActiveStatus(godown.status) ? 'Active' : 'Inactive'}
 </span>
 </td>
 <td className="p-4">
 {godown.is_default ? (
 <span className="flex items-center gap-1 text-green-600 text-sm font-bold">
 <Check size={14} /> Default
 </span>
 ) : (
 <span className="text-slate-400 text-sm">-</span>
 )}
 </td>
 <td className="p-4 text-sm text-slate-600 flex items-center gap-2">
 <Calendar size={14} className="text-slate-400" />
 {new Date(godown.created_at).toLocaleDateString()}
 </td>
 {canEdit && (
 <td className="p-4 text-center flex gap-2 justify-center">
 <button
 onClick={() => handleEdit(godown)}
 className="p-2 text-slate-600 hover:text-accent hover:bg-blue-50 rounded transition-colors"
 title="Edit"
 >
 <Edit2 size={16} />
 </button>
 </td>
 )}
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {/* Info Box */}
 <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
 <AlertCircle className="text-accent shrink-0" size={20} />
 <div>
 <h4 className="font-bold text-blue-900 mb-1">Warehouse Management Tips</h4>
 <ul className="text-sm text-blue-800 space-y-1">
 <li>• Set one warehouse as default for automatic stock allocation</li>
 <li>• Assign a manager to each warehouse for accountability</li>
 <li>• Use warehouses to organize stock across multiple locations</li>
 <li>• Stock reconciliation can be done warehouse-by-warehouse</li>
 </ul>
 </div>
 </div>
 </div>
 );
};

export default GodownsManagement;

