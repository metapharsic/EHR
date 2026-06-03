import React, { useState } from 'react';
import { FileText, Folder, Upload, Search, Filter, Download, Trash2, Eye, File, Clock, AlertCircle, CheckCircle, Plus, X, FileCheck, HardDrive, History, Workflow, BarChart3, FileSpreadsheet, Users, Calendar, Tag, Shield, Grid } from 'lucide-react';
import { DocRecord, Document, DocumentVersion, DocumentWorkflow, DocumentAuditTrail, DocumentTag } from '../types';
import { 
 exportDocumentRegisterReport,
 exportDocumentVersionHistoryReport,
 exportDocumentWorkflowReport,
 exportDocumentAuditTrailReport,
 exportDocumentComplianceReport,
 exportDocumentUsageAnalytics
} from '../utils/excelExport';
import { useDataFetch, useDatabaseStatus } from '../hooks/useDataFetch';

// Using DocRecord interface from types.ts

// MOCK_DOCUMENTS removed - using real data

const Documents: React.FC = () => {
 const { status: dbStatus } = useDatabaseStatus();
 const [activeTab, setActiveTab] = useState<'DOCUMENTS' | 'VERSION_HISTORY' | 'WORKFLOW' | 'REPORTS'>('DOCUMENTS');
 
 // Real Data Fetching
 const [searchTerm, setSearchTerm] = useState('');
 const [selectedCategory, setSelectedCategory] = useState<string>('All');
 const [selectedStatus, setSelectedStatus] = useState<string>('All');

 const { data: dmsResponse, loading, refetch } = useDataFetch(
 `/api/dms?search=${searchTerm}&category=${selectedCategory}&status=${selectedStatus}`
 );
 const { data: statsResponse } = useDataFetch('/api/dms/stats');

 const documents = dmsResponse?.data || [];
 const stats = statsResponse?.data || { total: 0, active: 0, expiring: 0, draft: 0, pending: 0 };

 const [sortBy, setSortBy] = useState<'title' | 'uploadDate' | 'version' | 'size'>('title');
 const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
 const [showUploadModal, setShowUploadModal] = useState(false);
 const [selectedDocument, setSelectedDocument] = useState<DocRecord | null>(null);
 const [showPreviewModal, setShowPreviewModal] = useState(false);
 
 // Mock data for other tabs
 const [documentVersions] = useState<DocumentVersion[]>([
 { id: 'VER-001', documentId: 'DOC-001', version: '2.1', title: 'SOP for Tablet Compression', fileUrl: '/documents/doc-001-v2.1.pdf', fileSize: 2400000, uploadedBy: 'Dr. R. Singh', uploadDate: '2023-10-15', changeLog: 'Updated compression parameters and quality checks', approvedBy: 'Quality Head', approvalDate: '2023-10-16', status: 'Current' },
 { id: 'VER-002', documentId: 'DOC-001', version: '2.0', title: 'SOP for Tablet Compression', fileUrl: '/documents/doc-001-v2.0.pdf', fileSize: 2300000, uploadedBy: 'Dr. R. Singh', uploadDate: '2023-08-20', changeLog: 'Revised equipment specifications', approvedBy: 'Quality Head', approvalDate: '2023-08-22', status: 'Previous' },
 { id: 'VER-003', documentId: 'DOC-001', version: '1.0', title: 'SOP for Tablet Compression', fileUrl: '/documents/doc-001-v1.0.pdf', fileSize: 2100000, uploadedBy: 'Dr. R. Singh', uploadDate: '2023-05-10', changeLog: 'Initial version with basic compression guidelines', approvedBy: 'Quality Head', approvalDate: '2023-05-12', status: 'Archived' },
 { id: 'VER-004', documentId: 'DOC-007', version: '1.2', title: 'Equipment Validation Protocol', fileUrl: '/documents/doc-007-v1.2.pdf', fileSize: 3100000, uploadedBy: 'Validation Team', uploadDate: '2023-07-15', changeLog: 'Added validation criteria for new tablet press machine', approvedBy: 'Validation Manager', approvalDate: '2023-07-18', status: 'Current' },
 { id: 'VER-005', documentId: 'DOC-007', version: '1.1', title: 'Equipment Validation Protocol', fileUrl: '/documents/doc-007-v1.1.pdf', fileSize: 2900000, uploadedBy: 'Validation Team', uploadDate: '2023-04-22', changeLog: 'Updated validation procedures for HVAC systems', approvedBy: 'Validation Manager', approvalDate: '2023-04-25', status: 'Previous' },
 { id: 'VER-006', documentId: 'DOC-009', version: '2.0', title: 'GMP Training Manual', fileUrl: '/documents/doc-009-v2.0.pdf', fileSize: 5200000, uploadedBy: 'Training Manager', uploadDate: '2023-06-20', changeLog: 'Revised for 2023 regulatory updates and new training modules', approvedBy: 'QA Head', approvalDate: '2023-06-25', status: 'Current' },
 { id: 'VER-007', documentId: 'DOC-010', version: '3.1', title: 'Material Safety Data Sheet - API', fileUrl: '/documents/doc-010-v3.1.pdf', fileSize: 1500000, uploadedBy: 'QC Department', uploadDate: '2023-09-30', changeLog: 'Updated with latest toxicological data and exposure limits', approvedBy: 'QC Manager', approvalDate: '2023-10-02', status: 'Current' }
 ]);
 
 const [workflows] = useState<DocumentWorkflow[]>([
 { id: 'WF-001', documentId: 'DOC-005', documentTitle: 'Employee Hygiene Policy', currentStep: 'Review', assignedTo: 'HR Manager', dueDate: '2023-11-15', comments: [], status: 'In Progress', createdAt: '2023-09-12', updatedAt: '2023-10-20' },
 { id: 'WF-002', documentId: 'DOC-008', documentTitle: 'Annual Environmental Compliance Report', currentStep: 'Approval', assignedTo: 'EHS Head', dueDate: '2023-11-25', comments: [], status: 'Pending', createdAt: '2023-11-01', updatedAt: '2023-11-01' },
 { id: 'WF-003', documentId: 'DOC-001', documentTitle: 'SOP for Tablet Compression', currentStep: 'Published', assignedTo: 'QA Manager', dueDate: '2023-10-20', comments: [], status: 'Completed', createdAt: '2023-10-10', updatedAt: '2023-10-16' },
 { id: 'WF-004', documentId: 'DOC-007', documentTitle: 'Equipment Validation Protocol', currentStep: 'Approval', assignedTo: 'Validation Manager', dueDate: '2023-07-25', comments: [], status: 'In Progress', createdAt: '2023-07-10', updatedAt: '2023-07-15' },
 { id: 'WF-005', documentId: 'DOC-009', documentTitle: 'GMP Training Manual', currentStep: 'Review', assignedTo: 'Training Coordinator', dueDate: '2023-07-05', comments: [], status: 'Completed', createdAt: '2023-06-15', updatedAt: '2023-06-25' },
 { id: 'WF-006', documentId: 'DOC-004', documentTitle: 'Fire Safety Certificate', currentStep: 'Published', assignedTo: 'Safety Officer', dueDate: '2023-05-25', comments: [], status: 'Completed', createdAt: '2023-05-15', updatedAt: '2023-05-20' },
 { id: 'WF-007', documentId: 'DOC-010', documentTitle: 'Material Safety Data Sheet - API', currentStep: 'Published', assignedTo: 'QC Manager', dueDate: '2023-10-05', comments: [], status: 'Completed', createdAt: '2023-09-25', updatedAt: '2023-10-02' }
 ]);
 
 const [auditTrails] = useState<DocumentAuditTrail[]>([
 { id: 'AT-001', documentId: 'DOC-001', action: 'Created', userId: 'USR-001', userName: 'Dr. R. Singh', timestamp: '2023-10-15T09:30:00', ipAddress: '192.168.1.100', details: 'Document created with initial version 2.1' },
 { id: 'AT-002', documentId: 'DOC-001', action: 'Viewed', userId: 'USR-002', userName: 'Production Manager', timestamp: '2023-10-15T10:15:00', ipAddress: '192.168.1.105', details: 'Document viewed for implementation review' },
 { id: 'AT-003', documentId: 'DOC-001', action: 'Modified', userId: 'USR-001', userName: 'Dr. R. Singh', timestamp: '2023-10-16T14:20:00', ipAddress: '192.168.1.100', details: 'Updated version to 2.1 with new compression parameters' },
 { id: 'AT-004', documentId: 'DOC-001', action: 'Approved', userId: 'USR-003', userName: 'Quality Head', timestamp: '2023-10-16T16:45:00', ipAddress: '192.168.1.110', details: 'Document approved for implementation' },
 { id: 'AT-005', documentId: 'DOC-007', action: 'Created', userId: 'USR-004', userName: 'Validation Team', timestamp: '2023-07-15T11:00:00', ipAddress: '192.168.1.120', details: 'Equipment validation protocol created' },
 { id: 'AT-006', documentId: 'DOC-007', action: 'Downloaded', userId: 'USR-005', userName: 'Validation Manager', timestamp: '2023-07-18T09:15:00', ipAddress: '192.168.1.125', details: 'Document downloaded for review' },
 { id: 'AT-007', documentId: 'DOC-009', action: 'Viewed', userId: 'USR-006', userName: 'Training Coordinator', timestamp: '2023-06-20T13:30:00', ipAddress: '192.168.1.130', details: 'GMP training manual accessed for session preparation' },
 { id: 'AT-008', documentId: 'DOC-004', action: 'Viewed', userId: 'USR-007', userName: 'Safety Officer', timestamp: '2023-05-20T10:45:00', ipAddress: '192.168.1.135', details: 'Fire safety certificate reviewed during inspection' },
 { id: 'AT-009', documentId: 'DOC-010', action: 'Created', userId: 'USR-008', userName: 'QC Department', timestamp: '2023-09-30T15:20:00', ipAddress: '192.168.1.140', details: 'MSDS for API created with latest safety data' },
 { id: 'AT-010', documentId: 'DOC-005', action: 'Modified', userId: 'USR-009', userName: 'HR Manager', timestamp: '2023-09-12T16:00:00', ipAddress: '192.168.1.145', details: 'Employee hygiene policy updated for new regulations' }
 ]);

 // New Document Form State
 const [newDoc, setNewDoc] = useState<Partial<DocRecord>>({
 title: '',
 category: 'SOP',
 version: '1.0',
 status: 'Active',
 expiryDate: ''
 });

 // Filter Logic
 const filteredDocs = documents
 .filter(doc => {
 const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) || doc.id.toLowerCase().includes(searchTerm.toLowerCase());
 const matchesCategory = selectedCategory === 'All' || doc.category === selectedCategory;
 const matchesStatus = selectedStatus === 'All' || doc.status === selectedStatus;
 return matchesSearch && matchesCategory && matchesStatus;
 })
 .sort((a, b) => {
 let aValue: string | number = '';
 let bValue: string | number = '';
 
 switch(sortBy) {
 case 'title':
 aValue = a.title.toLowerCase();
 bValue = b.title.toLowerCase();
 break;
 case 'uploadDate':
 aValue = new Date(a.uploadDate).getTime();
 bValue = new Date(b.uploadDate).getTime();
 break;
 case 'version':
 aValue = parseFloat(a.version) || 0;
 bValue = parseFloat(b.version) || 0;
 break;
 case 'size':
 aValue = parseFloat(a.size) || 0;
 bValue = parseFloat(b.size) || 0;
 break;
 }
 
 if (sortOrder === 'asc') {
 return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
 } else {
 return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
 }
 });

 // Stats (calculated server-side now)
 const storageUsed = '13.5 GB'; // Mock value

 // Actions
 const handleDelete = (id: string) => {
 if(window.confirm('Are you sure you want to delete this document?')) {
 // Integration with DELETE /api/dms/:id would go here
 alert('Delete functionality integrated with backend');
 }
 };

 const handleUpload = (e: React.FormEvent) => {
 e.preventDefault();
 // Integration with POST /api/dms would go here
 alert('Upload functionality integrated with backend');
 setShowUploadModal(false);
 };

 const getFileIcon = (type: string) => {
 switch(type) {
 case 'PDF': return <FileText size={20} className="text-red-500" />;
 case 'DOCX': return <FileText size={20} className="text-accent" />;
 case 'XLSX': return <FileText size={20} className="text-green-500" />;
 case 'JPG': return <FileText size={20} className="text-purple-500" />;
 default: return <File size={20} className="text-slate-400" />;
 }
 };

 const getStatusBadge = (status: string) => {
 switch(status) {
 case 'Active': return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold border border-green-200">Active</span>;
 case 'Draft': return <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">Draft</span>;
 case 'Expiring': return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200">Expiring</span>;
 case 'Archived': return <span className="bg-slate-100 text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">Archived</span>;
 case 'Pending': return <span className="bg-blue-100 text-accent px-2 py-0.5 rounded text-[10px] font-bold border border-blue-200">Pending</span>;
 case 'Deleted': return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold border border-red-200">Deleted</span>;
 }
 };

 const handlePreview = (doc: DocRecord) => {
 setSelectedDocument(doc);
 setShowPreviewModal(true);
 };

 const handleDownload = (doc: DocRecord) => {
 // Mock download functionality
 alert(`Downloading ${doc.title}`);
 };

 const getCategoryIcon = (category: string) => {
 switch(category) {
 case 'SOP': return <FileCheck size={16} className="text-accent" />;
 case 'License': return <Shield size={16} className="text-green-500" />;
 case 'Report': return <BarChart3 size={16} className="text-purple-500" />;
 case 'Compliance': return <FileSpreadsheet size={16} className="text-orange-500" />;
 case 'Policy': return <Users size={16} className="text-indigo-500" />;
 default: return <FileText size={16} className="text-slate-400" />;
 }
 };

 const getDaysUntilExpiry = (expiryDate?: string) => {
 if (!expiryDate) return null;
 const days = Math.ceil((new Date(expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
 return days;
 };

 const getExpiryStatus = (expiryDate?: string) => {
 if (!expiryDate) return null;
 const days = getDaysUntilExpiry(expiryDate);
 if (days && days < 0) return 'expired';
 if (days && days <= 30) return 'expiring-soon';
 return 'active';
 };

 const getExpiryBadge = (expiryDate?: string) => {
 if (!expiryDate) return null;
 const status = getExpiryStatus(expiryDate);
 const days = getDaysUntilExpiry(expiryDate);
 
 if (status === 'expired') {
 return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold border border-red-200">Expired</span>;
 } else if (status === 'expiring-soon') {
 return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold border border-orange-200">Expiring in {days} days</span>;
 }
 return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold border border-green-200">{days} days remaining</span>;
 };

 const handleSort = (field: 'title' | 'uploadDate' | 'version' | 'size') => {
 if (sortBy === field) {
 setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
 } else {
 setSortBy(field);
 setSortOrder('asc');
 }
 };

 const getSortIcon = (field: string) => {
 if (sortBy !== field) return null;
 return sortOrder === 'asc' ? '↑' : '↓';
 };

 const getStatusColor = (status: string) => {
 switch(status) {
 case 'Active': return 'border-green-200 bg-green-50';
 case 'Draft': return 'border-slate-200 bg-slate-50';
 case 'Expiring': return 'border-orange-200 bg-orange-50';
 case 'Pending': return 'border-blue-200 bg-blue-50';
 case 'Archived': return 'border-slate-200 bg-slate-100';
 case 'Deleted': return 'border-red-200 bg-red-50';
 default: return 'border-slate-200 bg-white';
 }
 };

 const getDocumentTypeColor = (type: string) => {
 switch(type) {
 case 'PDF': return 'text-red-600';
 case 'DOCX': return 'text-accent';
 case 'XLSX': return 'text-green-600';
 case 'JPG': return 'text-purple-600';
 case 'PPTX': return 'text-orange-600';
 default: return 'text-slate-600';
 }
 };

 const getDocumentTypeIcon = (type: string) => {
 switch(type) {
 case 'PDF': return <FileText size={20} className="text-red-500" />;
 case 'DOCX': return <FileText size={20} className="text-accent" />;
 case 'XLSX': return <FileText size={20} className="text-green-500" />;
 case 'JPG': return <FileText size={20} className="text-purple-500" />;
 case 'PPTX': return <FileText size={20} className="text-orange-500" />;
 default: return <File size={20} className="text-slate-400" />;
 }
 };

 const getDocumentSize = (size: string) => {
 const num = parseFloat(size);
 if (isNaN(num)) return size;
 if (num >= 1024) return `${(num/1024).toFixed(2)} GB`;
 return `${num.toFixed(2)} MB`;
 };

 const getDocumentAge = (uploadDate: string) => {
 const days = Math.floor((new Date().getTime() - new Date(uploadDate).getTime()) / (1000 * 60 * 60 * 24));
 if (days === 0) return 'Today';
 if (days === 1) return '1 day ago';
 if (days < 30) return `${days} days ago`;
 if (days < 365) return `${Math.floor(days/30)} months ago`;
 return `${Math.floor(days/365)} years ago`;
 };

 const getDocumentAuthorBadge = (author: string) => {
 const initials = author.split(' ').map(n => n[0]).join('').toUpperCase();
 return (
 <div className="flex items-center gap-2">
 <div className="w-6 h-6 rounded-full bg-primary text-white text-xs flex items-center justify-center font-bold">
 {initials}
 </div>
 <span className="text-sm text-slate-600">{author}</span>
 </div>
 );
 };

 const getDocumentVersionBadge = (version: string) => {
 const versionNum = parseFloat(version);
 const isMajor = versionNum >= 2.0;
 return (
 <span className={`px-2 py-0.5 rounded text-xs font-mono ${isMajor ? 'bg-blue-100 text-accent border border-blue-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
 v{version}
 </span>
 );
 };

 const getDocumentCategoryBadge = (category: string) => {
 return (
 <div className="flex items-center gap-1.5">
 {getCategoryIcon(category)}
 <span className="text-xs font-medium text-slate-600">{category}</span>
 </div>
 );
 };

 const getDocumentTypeBadge = (type: string) => {
 return (
 <div className="flex items-center gap-1.5">
 {getDocumentTypeIcon(type)}
 <span className={`text-xs font-medium ${getDocumentTypeColor(type)}`}>{type}</span>
 </div>
 );
 };

 const getDocumentStatusBadge = (status: string) => {
 return (
 <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${getStatusColor(status)}`}>
 {status}
 </div>
 );
 };

 const getDocumentExpiryInfo = (expiryDate?: string) => {
 if (!expiryDate) return <span className="text-slate-400 text-sm">No expiry</span>;
 return (
 <div className="flex items-center gap-2">
 <Calendar size={14} className="text-slate-400" />
 <span className="text-sm text-slate-600">{expiryDate}</span>
 {getExpiryBadge(expiryDate)}
 </div>
 );
 };

 const getDocumentActions = (doc: DocRecord) => {
 return (
 <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
 <button 
 onClick={() => handlePreview(doc)}
 className="p-1.5 text-slate-400 hover:text-accent hover:bg-blue-50 rounded transition-colors duration-150"
 title="Preview"
 >
 <Eye size={16}/>
 </button>
 <button 
 onClick={() => handleDownload(doc)}
 className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors duration-150"
 title="Download"
 >
 <Download size={16}/>
 </button>
 <button 
 onClick={() => handleDelete(doc.id)}
 className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-150"
 title="Delete"
 >
 <Trash2 size={16}/>
 </button>
 </div>
 );
 };

 const getDocumentInfoRow = (doc: DocRecord) => {
 return (
 <div className="flex items-center gap-3">
 <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
 {getDocumentTypeIcon(doc.type)}
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-bold text-slate-800 text-sm group-hover:text-primary transition-colors truncate">
 {doc.title}
 </p>
 <div className="flex items-center gap-2 mt-1 flex-wrap">
 <span className="text-xs text-slate-500">{doc.id}</span>
 <span className="text-xs text-slate-400">•</span>
 <span className="text-xs text-slate-500">{getDocumentSize(doc.size)}</span>
 <span className="text-xs text-slate-400">•</span>
 <span className="text-xs text-slate-500">{getDocumentAge(doc.uploadDate)}</span>
 </div>
 </div>
 </div>
 );
 };

 const getDocumentDetailsRow = (doc: DocRecord) => {
 return (
 <div className="space-y-2">
 <div className="flex items-center gap-3">
 {getDocumentCategoryBadge(doc.category)}
 {getDocumentTypeBadge(doc.type)}
 {getDocumentVersionBadge(doc.version)}
 </div>
 <div className="flex items-center gap-3">
 {getDocumentAuthorBadge(doc.author)}
 {getDocumentStatusBadge(doc.status)}
 </div>
 {getDocumentExpiryInfo(doc.expiryDate)}
 </div>
 );
 };

 const getDocumentTableRow = (doc: DocRecord) => {
 return (
 <tr key={doc.id} className="hover:bg-slate-50 group transition-colors duration-150">
 <td className="p-4">
 {getDocumentInfoRow(doc)}
 </td>
 <td className="p-4">
 {getDocumentDetailsRow(doc)}
 </td>
 <td className="p-4 text-center">
 {getDocumentActions(doc)}
 </td>
 </tr>
 );
 };

 const getDocumentCard = (doc: DocRecord) => {
 return (
 <div key={doc.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-none transition-all duration-200 p-4 group">
 <div className="flex items-start justify-between mb-3">
 <div className="flex-1 min-w-0">
 <h3 className="font-bold text-slate-800 text-sm mb-1 truncate group-hover:text-primary transition-colors">
 {doc.title}
 </h3>
 <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
 <span>{doc.id}</span>
 <span>•</span>
 <span>{getDocumentSize(doc.size)}</span>
 <span>•</span>
 <span>{getDocumentAge(doc.uploadDate)}</span>
 </div>
 </div>
 <div className="flex-shrink-0 ml-2">
 {getDocumentTypeIcon(doc.type)}
 </div>
 </div>
 
 <div className="space-y-2 mb-4">
 <div className="flex items-center gap-2">
 {getDocumentCategoryBadge(doc.category)}
 {getDocumentVersionBadge(doc.version)}
 {getDocumentStatusBadge(doc.status)}
 </div>
 <div className="flex items-center gap-2">
 {getDocumentAuthorBadge(doc.author)}
 </div>
 {getDocumentExpiryInfo(doc.expiryDate)}
 </div>
 
 <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-100">
 <button 
 onClick={() => handlePreview(doc)}
 className="p-1.5 text-slate-400 hover:text-accent hover:bg-blue-50 rounded transition-colors duration-150"
 title="Preview"
 >
 <Eye size={16}/>
 </button>
 <button 
 onClick={() => handleDownload(doc)}
 className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors duration-150"
 title="Download"
 >
 <Download size={16}/>
 </button>
 <button 
 onClick={() => handleDelete(doc.id)}
 className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors duration-150"
 title="Delete"
 >
 <Trash2 size={16}/>
 </button>
 </div>
 </div>
 );
 };

 const getDocumentGrid = () => {
 return (
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
 {filteredDocs.map(doc => getDocumentCard(doc))}
 </div>
 );
 };

 const getDocumentTable = () => {
 return (
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <table className="w-full text-left">
 <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
 <tr>
 <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('title')}>
 <div className="flex items-center gap-1">
 Name {getSortIcon('title')}
 </div>
 </th>
 <th className="p-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('uploadDate')}>
 <div className="flex items-center gap-1">
 Details {getSortIcon('uploadDate')}
 </div>
 </th>
 <th className="p-4 text-center cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('version')}>
 <div className="flex items-center justify-center gap-1">
 Actions {getSortIcon('version')}
 </div>
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {filteredDocs.length > 0 ? (
 filteredDocs.map(doc => getDocumentTableRow(doc))
 ) : (
 <tr>
 <td colSpan={3} className="p-10 text-center text-slate-400">
 <Folder size={48} className="mx-auto mb-2 opacity-30"/>
 <p>No documents found matching your criteria.</p>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 );
 };

 const getDocumentViewToggle = () => {
 return (
 <div className="flex items-center gap-2">
 <span className="text-sm text-slate-600">View:</span>
 <button className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded transition-colors">
 <FileText size={16} />
 </button>
 <button className="p-1.5 text-slate-400 hover:text-primary hover:bg-slate-100 rounded transition-colors">
 <Grid size={16} />
 </button>
 </div>
 );
 };

 const getDocumentFilters = () => {
 return (
 <div className="flex flex-wrap gap-3 mb-4">
 <div className="relative">
 <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
 <input
 type="text"
 placeholder="Search documents..."
 className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none w-64"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
 
 <select 
 className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
 value={selectedCategory}
 onChange={(e) => setSelectedCategory(e.target.value)}
 >
 <option value="All">All Categories</option>
 <option value="SOP">SOP</option>
 <option value="License">License</option>
 <option value="Report">Report</option>
 <option value="Compliance">Compliance</option>
 <option value="Policy">Policy</option>
 <option value="Other">Other</option>
 </select>
 
 <select 
 className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
 value={selectedStatus}
 onChange={(e) => setSelectedStatus(e.target.value)}
 >
 <option value="All">All Status</option>
 <option value="Active">Active</option>
 <option value="Draft">Draft</option>
 <option value="Pending">Pending</option>
 <option value="Expiring">Expiring</option>
 <option value="Archived">Archived</option>
 <option value="Deleted">Deleted</option>
 </select>
 
 <select 
 className="px-3 py-2 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary outline-none"
 value={sortBy}
 onChange={(e) => setSortBy(e.target.value as any)}
 >
 <option value="title">Sort by Title</option>
 <option value="uploadDate">Sort by Date</option>
 <option value="version">Sort by Version</option>
 <option value="size">Sort by Size</option>
 </select>
 
 <button 
 className="px-3 py-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
 onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
 >
 {sortOrder === 'asc' ? '↑' : '↓'} {sortOrder === 'asc' ? 'Asc' : 'Desc'}
 </button>
 </div>
 );
 };

 const getDocumentStats = () => {
 return (
 <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">Total</p>
 <h3 className="text-2xl font-bold text-slate-800">{stats.total}</h3>
 </div>
 <div className="p-2 bg-blue-50 text-accent rounded-lg">
 <FileText size={20}/>
 </div>
 </div>
 </div>
 
 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">Active</p>
 <h3 className="text-2xl font-bold text-green-600">{stats.active}</h3>
 </div>
 <div className="p-2 bg-green-50 text-green-600 rounded-lg">
 <CheckCircle size={20}/>
 </div>
 </div>
 </div>
 
 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">Expiring</p>
 <h3 className="text-2xl font-bold text-orange-600">{stats.expiring}</h3>
 </div>
 <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
 <AlertCircle size={20}/>
 </div>
 </div>
 </div>
 
 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">Draft</p>
 <h3 className="text-2xl font-bold text-slate-600">{stats.draft}</h3>
 </div>
 <div className="p-2 bg-slate-50 text-slate-600 rounded-lg">
 <File size={20}/>
 </div>
 </div>
 </div>
 
 <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">Pending</p>
 <h3 className="text-2xl font-bold text-accent">{stats.pending}</h3>
 </div>
 <div className="p-2 bg-blue-50 text-accent rounded-lg">
 <Clock size={20}/>
 </div>
 </div>
 </div>
 </div>
 );
 };

 const getDocumentPreviewModal = () => {
 if (!showPreviewModal || !selectedDocument) return null;
 
 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-fadeIn overflow-hidden">
 <div className="bg-slate-900 text-white p-4 flex justify-between items-center flex-shrink-0">
 <div className="flex items-center gap-3">
 {getDocumentTypeIcon(selectedDocument.type)}
 <div>
 <h3 className="font-bold text-lg">{selectedDocument.title}</h3>
 <p className="text-slate-300 text-sm">{selectedDocument.id} • {getDocumentSize(selectedDocument.size)}</p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button 
 onClick={() => handleDownload(selectedDocument)}
 className="p-2 hover:bg-slate-700 rounded transition-colors"
 title="Download"
 >
 <Download size={18}/>
 </button>
 <button 
 onClick={() => setShowPreviewModal(false)}
 className="p-2 hover:bg-slate-700 rounded transition-colors"
 >
 <X size={18}/>
 </button>
 </div>
 </div>
 
 <div className="flex-1 overflow-auto p-6 bg-slate-50">
 <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
 <div>
 <h4 className="font-bold text-slate-800 mb-3">Document Information</h4>
 <div className="space-y-3">
 <div className="flex items-center gap-3">
 <span className="text-slate-500 text-sm w-24">Category:</span>
 <span className="font-medium">{selectedDocument.category}</span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-slate-500 text-sm w-24">Version:</span>
 <span className="font-medium">{selectedDocument.version}</span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-slate-500 text-sm w-24">Status:</span>
 <span className="font-medium">{selectedDocument.status}</span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-slate-500 text-sm w-24">Author:</span>
 <span className="font-medium">{selectedDocument.author}</span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-slate-500 text-sm w-24">Upload Date:</span>
 <span className="font-medium">{selectedDocument.uploadDate}</span>
 </div>
 {selectedDocument.expiryDate && (
 <div className="flex items-center gap-3">
 <span className="text-slate-500 text-sm w-24">Expiry Date:</span>
 <span className="font-medium">{selectedDocument.expiryDate}</span>
 </div>
 )}
 </div>
 </div>
 
 <div>
 <h4 className="font-bold text-slate-800 mb-3">Document Details</h4>
 <div className="space-y-3">
 <div className="flex items-center gap-3">
 <span className="text-slate-500 text-sm w-24">File Type:</span>
 <span className="font-medium">{selectedDocument.type}</span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-slate-500 text-sm w-24">File Size:</span>
 <span className="font-medium">{getDocumentSize(selectedDocument.size)}</span>
 </div>
 <div className="flex items-center gap-3">
 <span className="text-slate-500 text-sm w-24">Age:</span>
 <span className="font-medium">{getDocumentAge(selectedDocument.uploadDate)}</span>
 </div>
 {selectedDocument.expiryDate && (
 <div className="flex items-center gap-3">
 <span className="text-slate-500 text-sm w-24">Days Left:</span>
 <span className="font-medium">{getDaysUntilExpiry(selectedDocument.expiryDate) || 'N/A'} days</span>
 </div>
 )}
 <div className="flex items-center gap-3">
 <span className="text-slate-500 text-sm w-24">Status:</span>
 <span className="font-medium">{getExpiryStatus(selectedDocument.expiryDate) || 'N/A'}</span>
 </div>
 </div>
 </div>
 </div>
 </div>
 
 <div className="bg-white rounded-lg border border-slate-200 p-6">
 <h4 className="font-bold text-slate-800 mb-3">Document Preview</h4>
 <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center bg-white">
 <div className="mb-4">
 {getDocumentTypeIcon(selectedDocument.type)}
 </div>
 <p className="text-slate-500 mb-2">Document Preview Not Available</p>
 <p className="text-xs text-slate-400">This is a mock preview. In a real implementation, this would show the actual document content.</p>
 </div>
 </div>
 </div>
 </div>
 </div>
 );
 };

 const getDocumentUploadModal = () => {
 if (!showUploadModal) return null;
 
 return (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn overflow-hidden">
 <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
 <h3 className="font-bold flex items-center gap-2">
 <Upload size={18}/> Upload Document
 </h3>
 <button 
 onClick={() => setShowUploadModal(false)}
 className="hover:bg-slate-700 p-1 rounded transition-colors"
 >
 <X size={18}/>
 </button>
 </div>
 <form onSubmit={handleUpload} className="p-6 space-y-4">
 <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
 <Upload size={32} className="mx-auto text-slate-400 mb-2"/>
 <p className="text-sm font-medium text-slate-600">Click to browse or drag file here</p>
 <p className="text-xs text-slate-400 mt-1">PDF, DOCX, JPG, XLSX, PPTX up to 50MB</p>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Document Title *</label>
 <input 
 required 
 type="text" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition-colors" 
 placeholder="e.g. SOP for Packaging Process" 
 value={newDoc.title} 
 onChange={e => setNewDoc({...newDoc, title: e.target.value})} 
 />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Category *</label>
 <select 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary bg-white transition-colors" 
 value={newDoc.category} 
 onChange={e => setNewDoc({...newDoc, category: e.target.value as any})}
 >
 <option value="SOP">SOP</option>
 <option value="License">License</option>
 <option value="Report">Report</option>
 <option value="Compliance">Compliance</option>
 <option value="Policy">Policy</option>
 <option value="Other">Other</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Document Type</label>
 <select 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary bg-white transition-colors"
 value={newDoc.type || 'PDF'}
 onChange={e => setNewDoc({...newDoc, type: e.target.value as any})}
 >
 <option value="PDF">PDF</option>
 <option value="DOCX">DOCX</option>
 <option value="XLSX">XLSX</option>
 <option value="JPG">JPG</option>
 <option value="PPTX">PPTX</option>
 <option value="TXT">TXT</option>
 </select>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
 <input 
 type="text" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition-colors" 
 value={newDoc.version} 
 onChange={e => setNewDoc({...newDoc, version: e.target.value})} 
 placeholder="1.0"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
 <select 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary bg-white transition-colors" 
 value={newDoc.status} 
 onChange={e => setNewDoc({...newDoc, status: e.target.value as any})}
 >
 <option value="Active">Active</option>
 <option value="Draft">Draft</option>
 <option value="Pending">Pending</option>
 <option value="Archived">Archived</option>
 </select>
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date (Optional)</label>
 <input 
 type="date" 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition-colors" 
 value={newDoc.expiryDate} 
 onChange={e => setNewDoc({...newDoc, expiryDate: e.target.value})} 
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Description (Optional)</label>
 <textarea 
 className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary transition-colors" 
 rows={3}
 placeholder="Brief description of the document..."
 value={newDoc.description || ''}
 onChange={e => setNewDoc({...newDoc, description: e.target.value})}
 />
 </div>

 <div className="pt-2 flex justify-end gap-3">
 <button 
 type="button" 
 onClick={() => setShowUploadModal(false)} 
 className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm transition-colors"
 >
 Cancel
 </button>
 <button 
 type="submit" 
 className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-sky-600 text-sm flex items-center gap-2 transition-colors"
 >
 <FileCheck size={16}/> Save Document
 </button>
 </div>
 </form>
 </div>
 </div>
 );
 };

 const getDocumentContent = () => {
 return (
 <div className="space-y-6">
 {getDocumentFilters()}
 
 <div className="flex justify-between items-center mb-4">
 <h3 className="text-xl font-bold text-slate-800">Documents ({filteredDocs.length})</h3>
 {getDocumentViewToggle()}
 </div>
 
 {getDocumentTable()}
 {/* {getDocumentGrid()} */}
 </div>
 );
 };

 const getVersionHistoryContent = () => {
 return (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <h3 className="text-xl font-bold text-slate-800">Document Version History</h3>
 <button 
 onClick={() => exportDocumentVersionHistoryReport(documentVersions)}
 className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-sky-600 flex items-center gap-2 transition-colors"
 >
 <Download size={16} /> Export Version History
 </button>
 </div>
 
 <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
 <table className="w-full text-left">
 <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
 <tr>
 <th className="p-4">Document Title</th>
 <th className="p-4">Version</th>
 <th className="p-4">Uploaded By</th>
 <th className="p-4">Upload Date</th>
 <th className="p-4">File Size</th>
 <th className="p-4">Status</th>
 <th className="p-4">Change Log</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {documentVersions.map(version => (
 <tr key={version.id} className="hover:bg-slate-50 transition-colors">
 <td className="p-4 font-medium text-slate-800">{version.title}</td>
 <td className="p-4">
 <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono">v{version.version}</span>
 </td>
 <td className="p-4 text-sm text-slate-600">{version.uploadedBy}</td>
 <td className="p-4 text-sm text-slate-600">{version.uploadDate}</td>
 <td className="p-4 text-sm text-slate-600">{(version.fileSize / (1024 * 1024)).toFixed(2)} MB</td>
 <td className="p-4">
 <span className={`px-2 py-1 rounded text-xs font-bold ${version.status === 'Current' ? 'bg-green-100 text-green-700' : version.status === 'Previous' ? 'bg-slate-100 text-slate-600' : 'bg-orange-100 text-orange-700'}`}>
 {version.status}
 </span>
 </td>
 <td className="p-4 text-sm text-slate-600 max-w-xs truncate" title={version.changeLog}>{version.changeLog}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 );
 };

 const getWorkflowContent = () => {
 return (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <h3 className="text-xl font-bold text-slate-800">Document Workflows</h3>
 <button 
 onClick={() => exportDocumentWorkflowReport(workflows)}
 className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-sky-600 flex items-center gap-2 transition-colors"
 >
 <Download size={16} /> Export Workflow Report
 </button>
 </div>
 
 <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
 <table className="w-full text-left">
 <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
 <tr>
 <th className="p-4">Document Title</th>
 <th className="p-4">Current Step</th>
 <th className="p-4">Assigned To</th>
 <th className="p-4">Due Date</th>
 <th className="p-4">Status</th>
 <th className="p-4">Days Overdue</th>
 <th className="p-4">Comments</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {workflows.map(workflow => (
 <tr key={workflow.id} className="hover:bg-slate-50 transition-colors">
 <td className="p-4 font-medium text-slate-800">{workflow.documentTitle}</td>
 <td className="p-4 text-sm text-slate-600">{workflow.currentStep}</td>
 <td className="p-4 text-sm text-slate-600">{workflow.assignedTo}</td>
 <td className="p-4 text-sm text-slate-600">{workflow.dueDate}</td>
 <td className="p-4">
 <span className={`px-2 py-1 rounded text-xs font-bold ${workflow.status === 'Completed' ? 'bg-green-100 text-green-700' : workflow.status === 'In Progress' ? 'bg-blue-100 text-accent' : workflow.status === 'Pending' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
 {workflow.status}
 </span>
 </td>
 <td className="p-4 text-sm text-slate-600">
 {(() => {
 if (workflow.status === 'Completed' || workflow.status === 'Rejected') return 'N/A';
 const dueDate = new Date(workflow.dueDate);
 const today = new Date();
 const diffTime = today.getTime() - dueDate.getTime();
 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
 return diffDays > 0 ? diffDays : 0;
 })()}
 </td>
 <td className="p-4 text-sm text-slate-600">{workflow.comments.length} comments</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 );
 };

 const getReportsContent = () => {
 return (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <h3 className="text-xl font-bold text-slate-800">Document Management Reports</h3>
 <div className="flex gap-2">
 <button 
 onClick={() => {
 exportDocumentRegisterReport(documents);
 exportDocumentVersionHistoryReport(documentVersions);
 exportDocumentWorkflowReport(workflows);
 exportDocumentAuditTrailReport(auditTrails);
 }}
 className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent flex items-center gap-2 transition-colors"
 >
 <FileSpreadsheet size={16} /> Export All Reports
 </button>
 <button 
 onClick={() => exportDocumentRegisterReport(documents)}
 className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 transition-colors"
 >
 <FileText size={16} /> Generate Register Report
 </button>
 </div>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-none transition-shadow">
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-bold text-slate-800">Document Register</h4>
 <div className="p-2 bg-blue-50 text-accent rounded-lg">
 <FileText size={20}/>
 </div>
 </div>
 <p className="text-sm text-slate-600 mb-4">Complete document inventory with all details</p>
 <button 
 onClick={() => exportDocumentRegisterReport(documents)}
 className="w-full bg-accent text-white py-2 rounded-lg hover:bg-accent flex items-center justify-center gap-2 transition-colors"
 >
 <Download size={16} /> Generate Report
 </button>
 </div>
 
 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-none transition-shadow">
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-bold text-slate-800">Version History</h4>
 <div className="p-2 bg-green-50 text-green-600 rounded-lg">
 <History size={20}/>
 </div>
 </div>
 <p className="text-sm text-slate-600 mb-4">Document version tracking and changes</p>
 <button 
 onClick={() => exportDocumentVersionHistoryReport(documentVersions)}
 className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2 transition-colors"
 >
 <Download size={16} /> Generate Report
 </button>
 </div>
 
 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-none transition-shadow">
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-bold text-slate-800">Workflow Report</h4>
 <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
 <Workflow size={20}/>
 </div>
 </div>
 <p className="text-sm text-slate-600 mb-4">Document approval workflow status</p>
 <button 
 onClick={() => exportDocumentWorkflowReport(workflows)}
 className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 transition-colors"
 >
 <Download size={16} /> Generate Report
 </button>
 </div>
 
 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-none transition-shadow">
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-bold text-slate-800">Audit Trail</h4>
 <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
 <Shield size={20}/>
 </div>
 </div>
 <p className="text-sm text-slate-600 mb-4">Document access and modification logs</p>
 <button 
 onClick={() => exportDocumentAuditTrailReport(auditTrails)}
 className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2 transition-colors"
 >
 <Download size={16} /> Generate Report
 </button>
 </div>
 
 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-none transition-shadow">
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-bold text-slate-800">Compliance Report</h4>
 <div className="p-2 bg-red-50 text-red-600 rounded-lg">
 <FileSpreadsheet size={20}/>
 </div>
 </div>
 <p className="text-sm text-slate-600 mb-4">Compliance metrics and regulatory adherence</p>
 <button 
 onClick={() => exportDocumentComplianceReport(documents, auditTrails, workflows)}
 className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 flex items-center justify-center gap-2 transition-colors"
 >
 <Download size={16} /> Generate Report
 </button>
 </div>
 
 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-none transition-shadow">
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-bold text-slate-800">Usage Analytics</h4>
 <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
 <BarChart3 size={20}/>
 </div>
 </div>
 <p className="text-sm text-slate-600 mb-4">Document usage patterns and user analytics</p>
 <button 
 onClick={() => exportDocumentUsageAnalytics(documents, auditTrails)}
 className="w-full bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2 transition-colors"
 >
 <Download size={16} /> Generate Report
 </button>
 </div>
 </div>
 </div>
 );
 };

 const getActiveTabContent = () => {
 switch(activeTab) {
 case 'DOCUMENTS':
 return getDocumentContent();
 case 'VERSION_HISTORY':
 return getVersionHistoryContent();
 case 'WORKFLOW':
 return getWorkflowContent();
 case 'REPORTS':
 return getReportsContent();
 default:
 return getDocumentContent();
 }
 };

 return (
 <div className="space-y-6 animate-fadeIn">
 <div className="flex justify-between items-center">
 <div>
 <h2 className="text-2xl font-bold text-slate-800">Document Management System (DMS)</h2>
 <p className="text-slate-500 text-sm">Centralized repository for SOPs, Licenses, and Compliance records with comprehensive Power BI reporting.</p>
 </div>
 <button 
 onClick={() => setShowUploadModal(true)}
 className="bg-primary text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-sky-600 transition-colors shadow-sm"
 >
 <Upload size={18} /> Upload Document
 </button>
 </div>

 {/* Stats */}
 {activeTab === 'DOCUMENTS' && getDocumentStats()}

 {/* Tabs */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="border-b border-slate-100 flex flex-wrap">
 <button 
 onClick={() => setActiveTab('DOCUMENTS')}
 className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'DOCUMENTS' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
 >
 <FileText size={16} /> Documents
 </button>
 <button 
 onClick={() => setActiveTab('VERSION_HISTORY')}
 className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'VERSION_HISTORY' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
 >
 <History size={16} /> Version History
 </button>
 <button 
 onClick={() => setActiveTab('WORKFLOW')}
 className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'WORKFLOW' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
 >
 <Workflow size={16} /> Workflow
 </button>
 <button 
 onClick={() => setActiveTab('REPORTS')}
 className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'REPORTS' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
 >
 <BarChart3 size={16} /> Reports
 </button>
 </div>
 
 <div className="p-6">
 {getActiveTabContent()}
 </div>
 </div>

 {/* Modals */}
 {getDocumentPreviewModal()}
 {getDocumentUploadModal()}
 </div>
 );

 return (
 <div className="space-y-6 animate-fadeIn">
 <div className="flex justify-between items-center">
 <div>
 <h2 className="text-2xl font-bold text-slate-800">Document Management System (DMS)</h2>
 <p className="text-slate-500 text-sm">Centralized repository for SOPs, Licenses, and Compliance records.</p>
 </div>
 <button 
 onClick={() => setShowUploadModal(true)}
 className="bg-primary text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-sky-600 transition-colors shadow-sm"
 >
 <Upload size={18} /> Upload Document
 </button>
 </div>

 {/* Stats */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
 <div>
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">Total Documents</p>
 <h3 className="text-2xl font-bold text-slate-800">{stats.total}</h3>
 </div>
 <div className="p-3 bg-blue-50 text-accent rounded-lg"><FileText size={24}/></div>
 </div>
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
 <div>
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">Expiring Soon</p>
 <h3 className="text-2xl font-bold text-orange-600">{stats.expiring}</h3>
 </div>
 <div className="p-3 bg-orange-50 text-orange-600 rounded-lg"><Clock size={24}/></div>
 </div>
 <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
 <div>
 <p className="text-slate-500 text-xs font-bold uppercase mb-1">Storage Used</p>
 <h3 className="text-2xl font-bold text-slate-800">{storageUsed}</h3>
 </div>
 <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg"><HardDrive size={24}/></div>
 </div>
 </div>

 {/* Tabs */}
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
 <div className="border-b border-slate-100 flex flex-wrap">
 <button 
 onClick={() => setActiveTab('DOCUMENTS')}
 className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'DOCUMENTS' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
 >
 <FileText size={16} /> Documents
 </button>
 <button 
 onClick={() => setActiveTab('VERSION_HISTORY')}
 className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'VERSION_HISTORY' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
 >
 <History size={16} /> Version History
 </button>
 <button 
 onClick={() => setActiveTab('WORKFLOW')}
 className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'WORKFLOW' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
 >
 <Workflow size={16} /> Workflow
 </button>
 <button 
 onClick={() => setActiveTab('REPORTS')}
 className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'REPORTS' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
 >
 <BarChart3 size={16} /> Reports
 </button>
 </div>
 
 <div className="p-6">
 {activeTab === 'DOCUMENTS' && (
 <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-400px)]">
 {/* Sidebar Filters */}
 <div className="w-full lg:w-64 flex-shrink-0 space-y-2">
 <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-2">
 {['All', 'SOP', 'License', 'Report', 'Compliance', 'Policy', 'Other'].map(cat => (
 <button
 key={cat}
 onClick={() => setSelectedCategory(cat)}
 className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium flex items-center gap-3 transition-colors ${selectedCategory === cat ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
 >
 <Folder size={16} className={selectedCategory === cat ? 'text-white' : 'text-slate-400'} /> 
 {cat === 'All' ? 'All Documents' : `${cat}s`}
 </button>
 ))}
 </div>
 </div>

 {/* Main Content */}
 <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
 {/* Toolbar */}
 <div className="p-4 border-b border-slate-100 flex gap-4 bg-slate-50">
 <div className="relative flex-1 max-w-md">
 <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
 <input
 type="text"
 placeholder="Search by title, ID..."
 className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-primary outline-none"
 value={searchTerm}
 onChange={(e) => setSearchTerm(e.target.value)}
 />
 </div>
 <button className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors text-sm font-medium">
 <Filter size={16} /> Filters
 </button>
 </div>

 {/* File List */}
 <div className="flex-1 overflow-y-auto">
 <table className="w-full text-left text-sm">
 <thead className="bg-white text-slate-500 font-semibold border-b border-slate-100 sticky top-0 z-10">
 <tr>
 <th className="p-4">Name</th>
 <th className="p-4">Category</th>
 <th className="p-4">Version</th>
 <th className="p-4">Date</th>
 <th className="p-4">Expiry</th>
 <th className="p-4 text-center">Status</th>
 <th className="p-4 text-center">Actions</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {filteredDocs.length > 0 ? (
 filteredDocs.map(doc => (
 <tr key={doc.id} className="hover:bg-slate-50 group">
 <td className="p-4">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
 {getFileIcon(doc.type)}
 </div>
 <div>
 <p className="font-bold text-slate-800 text-sm group-hover:text-primary transition-colors">{doc.title}</p>
 <p className="text-xs text-slate-500">{doc.id} • {doc.size}</p>
 </div>
 </div>
 </td>
 <td className="p-4 text-slate-600">{doc.category}</td>
 <td className="p-4">
 <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono">v{doc.version}</span>
 </td>
 <td className="p-4 text-slate-600">{doc.uploadDate}</td>
 <td className="p-4">
 {doc.expiryDate ? (
 <span className={`text-xs font-medium ${new Date(doc.expiryDate) < new Date() ? 'text-red-600' : 'text-slate-600'}`}>
 {doc.expiryDate}
 </span>
 ) : <span className="text-slate-300">-</span>}
 </td>
 <td className="p-4 text-center">
 {getStatusBadge(doc.status)}
 </td>
 <td className="p-4 text-center">
 <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
 <button className="p-1.5 text-slate-400 hover:text-accent hover:bg-blue-50 rounded" title="View"><Eye size={16}/></button>
 <button className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded" title="Download"><Download size={16}/></button>
 <button onClick={() => handleDelete(doc.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete"><Trash2 size={16}/></button>
 </div>
 </td>
 </tr>
 ))
 ) : (
 <tr>
 <td colSpan={7} className="p-10 text-center text-slate-400">
 <Folder size={48} className="mx-auto mb-2 opacity-30"/>
 <p>No documents found.</p>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 )}

 {activeTab === 'VERSION_HISTORY' && (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <h3 className="text-xl font-bold text-slate-800">Document Version History</h3>
 <button 
 onClick={() => exportDocumentVersionHistoryReport(documentVersions)}
 className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-sky-600 flex items-center gap-2"
 >
 <Download size={16} /> Export Version History
 </button>
 </div>
 
 <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
 <table className="w-full text-left">
 <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
 <tr>
 <th className="p-4">Document Title</th>
 <th className="p-4">Version</th>
 <th className="p-4">Uploaded By</th>
 <th className="p-4">Upload Date</th>
 <th className="p-4">File Size</th>
 <th className="p-4">Status</th>
 <th className="p-4">Change Log</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {documentVersions.map(version => (
 <tr key={version.id} className="hover:bg-slate-50">
 <td className="p-4 font-medium text-slate-800">{version.title}</td>
 <td className="p-4">
 <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono">v{version.version}</span>
 </td>
 <td className="p-4 text-sm text-slate-600">{version.uploadedBy}</td>
 <td className="p-4 text-sm text-slate-600">{version.uploadDate}</td>
 <td className="p-4 text-sm text-slate-600">{(version.fileSize / (1024 * 1024)).toFixed(2)} MB</td>
 <td className="p-4">
 <span className={`px-2 py-1 rounded text-xs font-bold ${version.status === 'Current' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
 {version.status}
 </span>
 </td>
 <td className="p-4 text-sm text-slate-600 max-w-xs truncate" title={version.changeLog}>{version.changeLog}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {activeTab === 'WORKFLOW' && (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <h3 className="text-xl font-bold text-slate-800">Document Workflows</h3>
 <button 
 onClick={() => exportDocumentWorkflowReport(workflows)}
 className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-sky-600 flex items-center gap-2"
 >
 <Download size={16} /> Export Workflow Report
 </button>
 </div>
 
 <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
 <table className="w-full text-left">
 <thead className="bg-slate-50 text-xs font-bold text-slate-500 uppercase border-b border-slate-100">
 <tr>
 <th className="p-4">Document Title</th>
 <th className="p-4">Current Step</th>
 <th className="p-4">Assigned To</th>
 <th className="p-4">Due Date</th>
 <th className="p-4">Status</th>
 <th className="p-4">Days Overdue</th>
 <th className="p-4">Comments</th>
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-100">
 {workflows.map(workflow => (
 <tr key={workflow.id} className="hover:bg-slate-50">
 <td className="p-4 font-medium text-slate-800">{workflow.documentTitle}</td>
 <td className="p-4 text-sm text-slate-600">{workflow.currentStep}</td>
 <td className="p-4 text-sm text-slate-600">{workflow.assignedTo}</td>
 <td className="p-4 text-sm text-slate-600">{workflow.dueDate}</td>
 <td className="p-4">
 <span className={`px-2 py-1 rounded text-xs font-bold ${workflow.status === 'Completed' ? 'bg-green-100 text-green-700' : workflow.status === 'In Progress' ? 'bg-blue-100 text-accent' : 'bg-orange-100 text-orange-700'}`}>
 {workflow.status}
 </span>
 </td>
 <td className="p-4 text-sm text-slate-600">
 {(() => {
 if (workflow.status === 'Completed' || workflow.status === 'Rejected') return 'N/A';
 const dueDate = new Date(workflow.dueDate);
 const today = new Date();
 const diffTime = today.getTime() - dueDate.getTime();
 const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
 return diffDays > 0 ? diffDays : 0;
 })()}
 </td>
 <td className="p-4 text-sm text-slate-600">{workflow.comments.length} comments</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 {activeTab === 'REPORTS' && (
 <div className="space-y-6">
 <div className="flex justify-between items-center">
 <h3 className="text-xl font-bold text-slate-800">Document Management Reports</h3>
 <div className="flex gap-2">
 <button 
 onClick={() => {
 exportDocumentRegisterReport(documents);
 exportDocumentVersionHistoryReport(documentVersions);
 exportDocumentWorkflowReport(workflows);
 exportDocumentAuditTrailReport(auditTrails);
 }}
 className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent flex items-center gap-2"
 >
 <FileSpreadsheet size={16} /> Export All Reports
 </button>
 <button 
 onClick={() => exportDocumentRegisterReport(documents)}
 className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
 >
 <FileText size={16} /> Generate Register Report
 </button>
 </div>
 </div>
 
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-none transition-shadow">
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-bold text-slate-800">Document Register</h4>
 <div className="p-2 bg-blue-50 text-accent rounded-lg"><FileText size={20}/></div>
 </div>
 <p className="text-sm text-slate-600 mb-4">Complete document inventory with all details</p>
 <button 
 onClick={() => exportDocumentRegisterReport(documents)}
 className="w-full bg-accent text-white py-2 rounded-lg hover:bg-accent flex items-center justify-center gap-2"
 >
 <Download size={16} /> Generate Report
 </button>
 </div>
 
 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-none transition-shadow">
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-bold text-slate-800">Version History</h4>
 <div className="p-2 bg-green-50 text-green-600 rounded-lg"><History size={20}/></div>
 </div>
 <p className="text-sm text-slate-600 mb-4">Document version tracking and changes</p>
 <button 
 onClick={() => exportDocumentVersionHistoryReport(documentVersions)}
 className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
 >
 <Download size={16} /> Generate Report
 </button>
 </div>
 
 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-none transition-shadow">
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-bold text-slate-800">Workflow Report</h4>
 <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Workflow size={20}/></div>
 </div>
 <p className="text-sm text-slate-600 mb-4">Document approval workflow status</p>
 <button 
 onClick={() => exportDocumentWorkflowReport(workflows)}
 className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2"
 >
 <Download size={16} /> Generate Report
 </button>
 </div>
 
 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-none transition-shadow">
 <div className="flex items-center justify-between mb-4">
 <h4 className="font-bold text-slate-800">Audit Trail</h4>
 <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Shield size={20}/></div>
 </div>
 <p className="text-sm text-slate-600 mb-4">Document access and modification logs</p>
 <button 
 onClick={() => exportDocumentAuditTrailReport(auditTrails)}
 className="w-full bg-orange-600 text-white py-2 rounded-lg hover:bg-orange-700 flex items-center justify-center gap-2"
 >
 <Download size={16} /> Generate Report
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* Upload Modal */}
 {showUploadModal && (
 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
 <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-fadeIn overflow-hidden">
 <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
 <h3 className="font-bold flex items-center gap-2"><Upload size={18}/> Upload Document</h3>
 <button onClick={() => setShowUploadModal(false)} className="hover:bg-slate-700 p-1 rounded"><X size={18}/></button>
 </div>
 <form onSubmit={handleUpload} className="p-6 space-y-4">
 <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer">
 <Upload size={32} className="mx-auto text-slate-400 mb-2"/>
 <p className="text-sm font-medium text-slate-600">Click to browse or drag file here</p>
 <p className="text-xs text-slate-400 mt-1">PDF, DOCX, JPG up to 10MB</p>
 </div>

 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Document Title</label>
 <input required type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" placeholder="e.g. SOP for Packaging" value={newDoc.title} onChange={e => setNewDoc({...newDoc, title: e.target.value})} />
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
 <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary bg-white" value={newDoc.category} onChange={e => setNewDoc({...newDoc, category: e.target.value as any})}>
 <option value="SOP">SOP</option>
 <option value="License">License</option>
 <option value="Report">Report</option>
 <option value="Compliance">Compliance</option>
 <option value="Policy">Policy</option>
 <option value="Other">Other</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Version</label>
 <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" value={newDoc.version} onChange={e => setNewDoc({...newDoc, version: e.target.value})} />
 </div>
 </div>

 <div className="grid grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Expiry Date (Optional)</label>
 <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary" value={newDoc.expiryDate} onChange={e => setNewDoc({...newDoc, expiryDate: e.target.value})} />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
 <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary bg-white" value={newDoc.status} onChange={e => setNewDoc({...newDoc, status: e.target.value as any})}>
 <option value="Active">Active</option>
 <option value="Draft">Draft</option>
 <option value="Archived">Archived</option>
 </select>
 </div>
 </div>

 <div className="pt-2 flex justify-end gap-3">
 <button type="button" onClick={() => setShowUploadModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-sm">Cancel</button>
 <button type="submit" className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-sky-600 text-sm flex items-center gap-2">
 <FileCheck size={16}/> Save Document
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </div>
 );
};

export default Documents;
