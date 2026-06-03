// ============================================
// RETURNS MANAGEMENT UI COMPONENT
// Path: components/ReturnsManagement.tsx
// Purpose: Create and manage supplier and customer return notes
// ============================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { RotateCw, Plus, Edit2, Trash2, Eye, Calendar, User, DollarSign, Save, X, AlertCircle, Check, Package } from 'lucide-react';
import { ReturnNotesService, ReturnNote } from '../services/inventoryService';

const ReturnsManagement: React.FC = () => {
 const [returnNotes, setReturnNotes] = useState<ReturnNote[]>([]);
 const [isLoading, setIsLoading] = useState(true);
 const [showForm, setShowForm] = useState(false);
 const [editingReturn, setEditingReturn] = useState<ReturnNote | null>(null);
 const [filterStatus, setFilterStatus] = useState('All');
 const [filterType, setFilterType] = useState('All');
 
 const [formData, setFormData] = useState({
 note_type: 'Supplier Return' as 'Supplier Return' | 'Customer Return',
 party_id: '',
 party_name: '',
 reference_invoice: '',
 return_date: new Date().toISOString().split('T')[0],
 reason: '',
 total_qty: 0,
 total_value: 0
 });

 const { hasPermission } = useAuth();
 const canEdit = hasPermission(['ADMIN', 'INVENTORY_MANAGER', 'QC_MANAGER']);

 // Load return notes on mount
 useEffect(() => {
 const loadReturnNotes = async () => {
 try {
 setIsLoading(true);
 const response = await ReturnNotesService.getReturnNotes({
 note_type: filterType === 'All' ? undefined : filterType,
 status: filterStatus === 'All' ? undefined : filterStatus,
 page: 1,
 limit: 100
 });
 setReturnNotes(response.notes);
 } catch (error) {
 console.error('❌ Error loading return notes:', error);
 } finally {
 setIsLoading(false);
 }
 };

 loadReturnNotes();
 }, [filterStatus, filterType]);

 // Handle create/edit
 const handleSubmit = async () => {
 try {
 if (!formData.party_name) {
 alert('Please fill required fields');
 return;
 }

 const submitData = {
 note_type: formData.note_type,
 party_id: formData.party_id || formData.party_name,
 party_name: formData.party_name,
 reference_invoice: formData.reference_invoice || undefined,
 return_date: formData.return_date || undefined,
 reason: formData.reason || undefined
 };

 // For now, we'll create a new return note (edit would need separate logic)
 const created = await ReturnNotesService.createReturnNote(submitData);
 setReturnNotes([created, ...returnNotes]);
 alert('✅ Return note created successfully');

 // Reset form
 setFormData({
 note_type: 'Supplier Return',
 party_id: '',
 party_name: '',
 reference_invoice: '',
 return_date: new Date().toISOString().split('T')[0],
 reason: '',
 total_qty: 0,
 total_value: 0
 });
 setEditingReturn(null);
 setShowForm(false);
 } catch (error) {
 console.error('❌ Error saving return note:', error);
 alert('Failed to save return note');
 }
 };

 // Handle cancel
 const handleCancel = () => {
 setFormData({
 note_type: 'Supplier Return',
 party_id: '',
 party_name: '',
 reference_invoice: '',
 return_date: new Date().toISOString().split('T')[0],
 reason: '',
 total_qty: 0,
 total_value: 0
 });
 setEditingReturn(null);
 setShowForm(false);
 };

 // Get status badge color
 const getStatusColor = (status: string) => {
 switch (status) {
 case 'Draft':
 return 'bg-slate-100 text-slate-700';
 case 'Submitted':
 return 'bg-blue-100 text-accent';
 case 'Approved':
 return 'bg-green-100 text-green-700';
 case 'Rejected':
 return 'bg-red-100 text-red-700';
 case 'Received':
 return 'bg-purple-100 text-purple-700';
 case 'Closed':
 return 'bg-gray-100 text-gray-700';
 default:
 return 'bg-slate-100 text-slate-700';
 }
 };

 return (
 <div className="space-y-6">
 {/* Header */}
 <div className="flex justify-between items-center">
 <h2 className="text-2xl font-bold text-slate-800">Return Notes Management</h2>
 {canEdit && (
 <button
 onClick={() => {
 handleCancel();
 setShowForm(true);
 }}
 className="bg-primary text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-sky-600 transition-colors shadow-sm"
 >
 <Plus size={18} /> Create Return Note
 </button>
 )}
 </div>

 {/* Filters */}
 <div className="flex gap-4 bg-white p-4 rounded-xl border border-slate-200">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
 <select
 value={filterType}
 onChange={(e) => setFilterType(e.target.value)}
 className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary"
 >
 <option value="All">All Types</option>
 <option value="Supplier Return">Supplier Return</option>
 <option value="Customer Return">Customer Return</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
 <select
 value={filterStatus}
 onChange={(e) => setFilterStatus(e.target.value)}
 className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary"
 >
 <option value="All">All Status</option>
 <option value="Draft">Draft</option>
 <option value="Submitted">Submitted</option>
 <option value="Approved">Approved</option>
 <option value="Rejected">Rejected</option>
 <option value="Received">Received</option>
 <option value="Closed">Closed</option>
 </select>
 </div>
 </div>

 {/* Return Notes List */}
 {isLoading ? (
 <div className="text-center py-8 text-slate-500">Loading return notes...</div>
 ) : returnNotes.length === 0 ? (
 <div className="border border-slate-200 rounded-lg p-8 text-center">
 <RotateCw size={48} className="mx-auto text-slate-300 mb-4" />
 <h3 className="text-lg font-bold text-slate-600">No Return Notes</h3>
 <p className="text-slate-500 max-w-md mx-auto mt-2">
 Create your first return note to track supplier or customer returns
 </p>
 </div>
 ) : (
 <div className="space-y-3">
 {returnNotes.map((returnNote) => (
 <div
 key={returnNote.id}
 className="bg-white border border-slate-200 rounded-lg p-4 hover:shadow-none transition-shadow"
 >
 <div className="flex justify-between items-start">
 <div className="flex-1">
 <div className="flex items-center gap-3 mb-2">
 <h3 className="text-lg font-bold text-slate-800">{returnNote.return_number}</h3>
 <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(returnNote.status)}`}>
 {returnNote.status}
 </span>
 <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
 {returnNote.note_type}
 </span>
 </div>
 <div className="grid grid-cols-3 gap-4 text-sm text-slate-600">
 <div className="flex items-center gap-2">
 <User size={16} className="text-slate-400" />
 {returnNote.party_name}
 </div>
 <div className="flex items-center gap-2">
 <Calendar size={16} className="text-slate-400" />
 {new Date(returnNote.return_date).toLocaleDateString()}
 </div>
 <div className="flex items-center gap-2">
 <Package size={16} className="text-slate-400" />
 {returnNote.total_qty} items
 </div>
 </div>
 {returnNote.total_value && (
 <div className="mt-2 flex items-center gap-2 text-sm font-medium text-slate-700">
 <DollarSign size={16} />
 ₹{returnNote.total_value.toLocaleString()}
 </div>
 )}
 </div>
 {canEdit && (
 <div className="flex gap-2">
 <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="View">
 <Eye size={18} className="text-slate-600" />
 </button>
 <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Edit">
 <Edit2 size={18} className="text-slate-600" />
 </button>
 </div>
 )}
 </div>
 </div>
 ))}
 </div>
 )}

 {/* Create/Edit Modal */}
 {showForm && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
 <div className="p-6 border-b border-slate-200 flex items-center justify-between">
 <h3 className="text-xl font-bold text-slate-800">
 {editingReturn ? 'Edit Return Note' : 'Create Return Note'}
 </h3>
 <button
 onClick={handleCancel}
 className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
 >
 <X size={20} className="text-slate-500" />
 </button>
 </div>

 <div className="p-6 space-y-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Return Type *</label>
 <select
 value={formData.note_type}
 onChange={(e) =>
 setFormData({
 ...formData,
 note_type: e.target.value as 'Supplier Return' | 'Customer Return'
 })
 }
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-primary"
 >
 <option value="Supplier Return">Supplier Return</option>
 <option value="Customer Return">Customer Return</option>
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Party Name *</label>
 <input
 type="text"
 value={formData.party_name}
 onChange={(e) => setFormData({ ...formData, party_name: e.target.value })}
 placeholder="e.g., ABC Pharma Ltd."
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Return Date</label>
 <input
 type="date"
 value={formData.return_date}
 onChange={(e) => setFormData({ ...formData, return_date: e.target.value })}
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Reference Invoice</label>
 <input
 type="text"
 value={formData.reference_invoice}
 onChange={(e) => setFormData({ ...formData, reference_invoice: e.target.value })}
 placeholder="e.g., INV-2024-001"
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Reason for Return</label>
 <textarea
 value={formData.reason}
 onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
 placeholder="Enter reason for return..."
 rows={3}
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary resize-none"
 />
 </div>

 <div className="flex gap-2 pt-4">
 <button
 onClick={handleCancel}
 className="flex-1 bg-slate-200 text-slate-700 py-2 px-4 rounded-lg font-medium hover:bg-slate-300 transition-colors flex items-center justify-center gap-2"
 >
 <X size={16} /> Cancel
 </button>
 <button
 onClick={handleSubmit}
 className="flex-1 bg-primary text-white py-2 px-4 rounded-lg font-medium hover:bg-sky-600 transition-colors flex items-center justify-center gap-2"
 >
 <Save size={16} /> Save
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 </div>
 );
};

export default ReturnsManagement;

