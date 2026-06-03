import React, { useState, useRef, useEffect } from 'react';
import { User, Building2, RotateCcw, Settings, Lock, Package, Archive, LogOut, UserCog, Shield, X, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Profile Modal Component
interface ProfileModalProps {
 user: { name: string; username: string; role: string } | null;
 onClose: () => void;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose }) => {
 const [isEditing, setIsEditing] = useState(false);
 const [formData, setFormData] = useState({
 name: user?.name || '',
 email: '',
 phone: '',
 department: ''
 });

 const handleSave = () => {
 // In a real implementation, this would save to backend
 alert('Profile updated successfully!');
 setIsEditing(false);
 };

 return (
 <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
 <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md">
 <div className="flex justify-between items-center p-4 border-b border-slate-200">
 <h2 className="text-xl font-bold text-slate-800">My Profile</h2>
 <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
 <X size={20} />
 </button>
 </div>
 
 <div className="p-6">
 <div className="flex items-center gap-4 mb-6">
 <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center text-white text-2xl font-bold">
 {user?.name.charAt(0) || 'U'}
 </div>
 <div>
 <h3 className="text-lg font-semibold text-slate-800">{user?.name}</h3>
 <p className="text-sm text-slate-500">{user?.role.replace('_', ' ')}</p>
 <p className="text-xs text-slate-400">@{user?.username}</p>
 </div>
 </div>

 {isEditing ? (
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
 <input 
 type="text" 
 value={formData.name}
 onChange={(e) => setFormData({...formData, name: e.target.value})}
 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
 <input 
 type="email" 
 value={formData.email}
 onChange={(e) => setFormData({...formData, email: e.target.value})}
 placeholder="your.email@company.com"
 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
 <input 
 type="tel" 
 value={formData.phone}
 onChange={(e) => setFormData({...formData, phone: e.target.value})}
 placeholder="+91 98765 43210"
 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
 <select 
 value={formData.department}
 onChange={(e) => setFormData({...formData, department: e.target.value})}
 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 >
 <option value="">Select Department</option>
 <option value="Sales">Sales</option>
 <option value="Inventory">Inventory</option>
 <option value="Finance">Finance</option>
 <option value="HR">HR</option>
 <option value="IT">IT</option>
 </select>
 </div>
 </div>
 ) : (
 <div className="space-y-3">
 <div className="flex justify-between py-2 border-b border-slate-100">
 <span className="text-slate-500">Email</span>
 <span className="text-slate-700">{formData.email || 'Not set'}</span>
 </div>
 <div className="flex justify-between py-2 border-b border-slate-100">
 <span className="text-slate-500">Phone</span>
 <span className="text-slate-700">{formData.phone || 'Not set'}</span>
 </div>
 <div className="flex justify-between py-2 border-b border-slate-100">
 <span className="text-slate-500">Department</span>
 <span className="text-slate-700">{formData.department || 'Not set'}</span>
 </div>
 <div className="flex justify-between py-2">
 <span className="text-slate-500">Member Since</span>
 <span className="text-slate-700">{new Date().toLocaleDateString()}</span>
 </div>
 </div>
 )}
 </div>

 <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
 {isEditing ? (
 <>
 <button 
 onClick={() => setIsEditing(false)}
 className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
 >
 Cancel
 </button>
 <button 
 onClick={handleSave}
 className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent transition-colors"
 >
 Save Changes
 </button>
 </>
 ) : (
 <button 
 onClick={() => setIsEditing(true)}
 className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent transition-colors"
 >
 Edit Profile
 </button>
 )}
 </div>
 </div>
 </div>
 );
};

// Settings Modal Component
interface SettingsModalProps {
 onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
 const [settings, setSettings] = useState({
 notifications: true,
 emailAlerts: true,
 darkMode: false,
 compactView: false,
 autoSave: true,
 language: 'en'
 });

 const handleSave = () => {
 alert('Settings saved successfully!');
 onClose();
 };

 return (
 <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
 <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md">
 <div className="flex justify-between items-center p-4 border-b border-slate-200">
 <h2 className="text-xl font-bold text-slate-800">Account Settings</h2>
 <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
 <X size={20} />
 </button>
 </div>
 
 <div className="p-6 space-y-6">
 <div>
 <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Preferences</h3>
 <div className="space-y-3">
 <label className="flex items-center justify-between cursor-pointer">
 <span className="text-slate-700">Enable Notifications</span>
 <input 
 type="checkbox" 
 checked={settings.notifications}
 onChange={(e) => setSettings({...settings, notifications: e.target.checked})}
 className="w-5 h-5 text-accent rounded focus:ring-blue-500"
 />
 </label>
 <label className="flex items-center justify-between cursor-pointer">
 <span className="text-slate-700">Email Alerts</span>
 <input 
 type="checkbox" 
 checked={settings.emailAlerts}
 onChange={(e) => setSettings({...settings, emailAlerts: e.target.checked})}
 className="w-5 h-5 text-accent rounded focus:ring-blue-500"
 />
 </label>
 <label className="flex items-center justify-between cursor-pointer">
 <span className="text-slate-700">Auto-save Forms</span>
 <input 
 type="checkbox" 
 checked={settings.autoSave}
 onChange={(e) => setSettings({...settings, autoSave: e.target.checked})}
 className="w-5 h-5 text-accent rounded focus:ring-blue-500"
 />
 </label>
 <label className="flex items-center justify-between cursor-pointer">
 <span className="text-slate-700">Compact View</span>
 <input 
 type="checkbox" 
 checked={settings.compactView}
 onChange={(e) => setSettings({...settings, compactView: e.target.checked})}
 className="w-5 h-5 text-accent rounded focus:ring-blue-500"
 />
 </label>
 </div>
 </div>

 <div>
 <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Language & Region</h3>
 <div>
 <label className="block text-sm font-medium text-slate-700 mb-1">Language</label>
 <select 
 value={settings.language}
 onChange={(e) => setSettings({...settings, language: e.target.value})}
 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 >
 <option value="en">English</option>
 <option value="hi">Hindi</option>
 <option value="mr">Marathi</option>
 <option value="gu">Gujarati</option>
 </select>
 </div>
 </div>
 </div>

 <div className="flex justify-end gap-3 p-4 border-t border-slate-200">
 <button 
 onClick={onClose}
 className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
 >
 Cancel
 </button>
 <button 
 onClick={handleSave}
 className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent transition-colors"
 >
 Save Settings
 </button>
 </div>
 </div>
 </div>
 );
};

// Security Modal Component
interface SecurityModalProps {
 onClose: () => void;
}

const SecurityModal: React.FC<SecurityModalProps> = ({ onClose }) => {
 const [currentPassword, setCurrentPassword] = useState('');
 const [newPassword, setNewPassword] = useState('');
 const [confirmPassword, setConfirmPassword] = useState('');
 const [showCurrentPassword, setShowCurrentPassword] = useState(false);
 const [showNewPassword, setShowNewPassword] = useState(false);
 const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

 const handleChangePassword = () => {
 if (newPassword !== confirmPassword) {
 alert('New passwords do not match!');
 return;
 }
 if (newPassword.length < 8) {
 alert('Password must be at least 8 characters long!');
 return;
 }
 alert('Password changed successfully!');
 setCurrentPassword('');
 setNewPassword('');
 setConfirmPassword('');
 };

 return (
 <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
 <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md">
 <div className="flex justify-between items-center p-4 border-b border-slate-200">
 <h2 className="text-xl font-bold text-slate-800">Security & Privacy</h2>
 <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
 <X size={20} />
 </button>
 </div>
 
 <div className="p-6 space-y-6">
 <div>
 <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Change Password</h3>
 <div className="space-y-3">
 <div className="relative">
 <input 
 type={showCurrentPassword ? 'text' : 'password'}
 value={currentPassword}
 onChange={(e) => setCurrentPassword(e.target.value)}
 placeholder="Current Password"
 className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 <button 
 onClick={() => setShowCurrentPassword(!showCurrentPassword)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
 >
 {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
 </button>
 </div>
 <div className="relative">
 <input 
 type={showNewPassword ? 'text' : 'password'}
 value={newPassword}
 onChange={(e) => setNewPassword(e.target.value)}
 placeholder="New Password"
 className="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 <button 
 onClick={() => setShowNewPassword(!showNewPassword)}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
 >
 {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
 </button>
 </div>
 <input 
 type="password"
 value={confirmPassword}
 onChange={(e) => setConfirmPassword(e.target.value)}
 placeholder="Confirm New Password"
 className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-accent"
 />
 <button 
 onClick={handleChangePassword}
 className="w-full px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent transition-colors"
 >
 Change Password
 </button>
 </div>
 </div>

 <div className="border-t border-slate-200 pt-4">
 <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Two-Factor Authentication</h3>
 <div className="flex items-center justify-between">
 <div>
 <p className="text-slate-700 font-medium">Enable 2FA</p>
 <p className="text-sm text-slate-500">Add an extra layer of security</p>
 </div>
 <label className="relative inline-flex items-center cursor-pointer">
 <input 
 type="checkbox" 
 checked={twoFactorEnabled}
 onChange={(e) => setTwoFactorEnabled(e.target.checked)}
 className="sr-only peer"
 />
 <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
 </label>
 </div>
 </div>

 <div className="border-t border-slate-200 pt-4">
 <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Active Sessions</h3>
 <div className="bg-slate-50 p-3 rounded-lg">
 <div className="flex items-center gap-2">
 <CheckCircle size={16} className="text-green-500" />
 <span className="text-sm text-slate-700">Current Session - Windows Chrome</span>
 </div>
 <p className="text-xs text-slate-500 mt-1 ml-6">IP: 192.168.1.1 • Active now</p>
 </div>
 </div>
 </div>

 <div className="flex justify-end p-4 border-t border-slate-200">
 <button 
 onClick={onClose}
 className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
 >
 Close
 </button>
 </div>
 </div>
 </div>
 );
};

// Logout Confirmation Modal
interface LogoutConfirmModalProps {
 onConfirm: () => void;
 onCancel: () => void;
}

const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({ onConfirm, onCancel }) => {
 return (
 <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
 <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm">
 <div className="p-6 text-center">
 <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
 <LogOut size={32} className="text-red-600" />
 </div>
 <h2 className="text-xl font-bold text-slate-800 mb-2">Sign Out</h2>
 <p className="text-slate-600 mb-6">Are you sure you want to sign out of your account?</p>
 
 <div className="flex gap-3 justify-center">
 <button 
 onClick={onCancel}
 className="px-6 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
 >
 Cancel
 </button>
 <button 
 onClick={onConfirm}
 className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
 >
 Sign Out
 </button>
 </div>
 </div>
 </div>
 </div>
 );
};

interface MenuOptionsProps {
 onCreateNewCompany: () => void;
 onRestoreDefaultDemo: () => void;
 onRestoreMyDemo: () => void;
 onDeleteSavedPassword: () => void;
 onChangeOperatorPowers: () => void;
 onChangeERPVersion: () => void;
 onBillRetail: () => void;
 onBillWholesale: () => void;
 onSalesReturnExpiry: () => void;
 onPurchaseReturnExpiry: () => void;
 onReceiptPayment: () => void;
 onCashBankBook: () => void;
 onLedgerAccount: () => void;
 onOutstanding: () => void;
 onStockStatus: () => void;
 onStockSalesAnalysis: () => void;
 onReorder: () => void;
 onSalesBook: () => void;
 onDispatchSummary: () => void;
 onBillTagging: () => void;
 onDailyAnalysis: () => void;
 onTodaysGrossProfit: () => void;
}

const MenuOptions: React.FC<MenuOptionsProps> = ({
 onCreateNewCompany,
 onRestoreDefaultDemo,
 onRestoreMyDemo,
 onDeleteSavedPassword,
 onChangeOperatorPowers,
 onChangeERPVersion,
 onBillRetail,
 onBillWholesale,
 onSalesReturnExpiry,
 onPurchaseReturnExpiry,
 onReceiptPayment,
 onCashBankBook,
 onLedgerAccount,
 onOutstanding,
 onStockStatus,
 onStockSalesAnalysis,
 onReorder,
 onSalesBook,
 onDispatchSummary,
 onBillTagging,
 onDailyAnalysis,
 onTodaysGrossProfit
}) => {
 const { user, logout } = useAuth();
 const [isOpen, setIsOpen] = useState(false);
 const [showProfileModal, setShowProfileModal] = useState(false);
 const [showSettingsModal, setShowSettingsModal] = useState(false);
 const [showSecurityModal, setShowSecurityModal] = useState(false);
 const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
 const menuRef = useRef<HTMLDivElement>(null);

 const toggleMenu = () => setIsOpen(!isOpen);

 const handleClickOutside = (event: MouseEvent) => {
 if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
 setIsOpen(false);
 }
 };

 useEffect(() => {
 document.addEventListener('mousedown', handleClickOutside);
 return () => {
 document.removeEventListener('mousedown', handleClickOutside);
 };
 }, []);

 const handleProfileClick = () => {
 setIsOpen(false);
 setShowProfileModal(true);
 };

 const handleSettingsClick = () => {
 setIsOpen(false);
 setShowSettingsModal(true);
 };

 const handleSecurityClick = () => {
 setIsOpen(false);
 setShowSecurityModal(true);
 };

 const handleLogoutClick = () => {
 setIsOpen(false);
 setShowLogoutConfirm(true);
 };

 const confirmLogout = () => {
 logout();
 setShowLogoutConfirm(false);
 // Reload page to return to login
 window.location.reload();
 };

 const menuItems = [
 // User Profile Section
 { id: 'user-profile', label: 'My Profile', icon: User, action: handleProfileClick, type: 'header' },
 { id: 'account-settings', label: 'Account Settings', icon: Settings, action: handleSettingsClick },
 { id: 'security', label: 'Security & Privacy', icon: Lock, action: handleSecurityClick },
 
 // System Section
 { id: 'divider-system', label: 'SYSTEM', type: 'divider' },
 { id: 'new-company', label: 'Create New Company', icon: Building2, action: () => { setIsOpen(false); onCreateNewCompany(); } },
 { id: 'restore-demo', label: 'Restore Demo Data', icon: RotateCcw, action: () => { setIsOpen(false); onRestoreDefaultDemo(); } },
 
 // Billing Section
 { id: 'divider-billing', label: 'BILLING & RETURNS', type: 'divider' },
 { id: 'bill-retail', label: 'Retail Billing', icon: Package, action: () => { setIsOpen(false); onBillRetail(); } },
 { id: 'bill-wholesale', label: 'Wholesale Billing', icon: Archive, action: () => { setIsOpen(false); onBillWholesale(); } },
 { id: 'sales-return', label: 'Sales Return', icon: RotateCcw, action: () => { setIsOpen(false); onSalesReturnExpiry(); } },
 
 // Logout Section
 { id: 'divider-logout', label: 'ACCOUNT', type: 'divider' },
 { id: 'logout', label: 'Sign Out', icon: LogOut, action: handleLogoutClick }
 ];

 return (
 <div className="relative" ref={menuRef}>
 <button
 onClick={toggleMenu}
 className="h-10 w-10 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-500 hover:text-blue-600 transition-all border border-transparent hover:border-slate-200"
 aria-label="User menu and system options"
 >
 <User size={20} />
 </button>
 
 {isOpen && (
 <div className="absolute right-0 mt-3 w-72 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden ring-4 ring-black/5">
 <div className="py-2.5">
 {menuItems.map((item) => {
 if (item.type === 'divider') {
 return (
 <div 
 key={item.id} 
 className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider border-t border-slate-100 mt-1 pt-3"
 >
 {item.label}
 </div>
 );
 }
 if (item.type === 'header') {
 return (
 <div 
 key={item.id} 
 className="px-4 py-3 bg-slate-50 border-b border-slate-100"
 >
 <div className="flex items-center gap-3.5">
 <item.icon size={20} className="text-accent" />
 <span className="text-base font-extrabold text-slate-800">{item.label}</span>
 </div>
 </div>
 );
 }
 return (
 <button
 key={item.id}
 onClick={() => {
 item.action();
 setIsOpen(false);
 }}
 className={`w-full flex items-center gap-3.5 px-5 py-3.5 text-left transition-colors ${item.id === 'logout' ? 'hover:bg-red-50 text-red-700' : 'hover:bg-slate-50 text-slate-700'}`}
 >
 <item.icon size={20} className={item.id === 'logout' ? 'text-red-500' : 'text-slate-500'} />
 <span className="text-base font-semibold">{item.label}</span>
 </button>
 );
 })}
 </div>
 </div>
 )}

 {/* Profile Modal */}
 {showProfileModal && (
 <ProfileModal 
 user={user} 
 onClose={() => setShowProfileModal(false)} 
 />
 )}

 {/* Settings Modal */}
 {showSettingsModal && (
 <SettingsModal 
 onClose={() => setShowSettingsModal(false)} 
 />
 )}

 {/* Security Modal */}
 {showSecurityModal && (
 <SecurityModal 
 onClose={() => setShowSecurityModal(false)} 
 />
 )}

 {/* Logout Confirmation Modal */}
 {showLogoutConfirm && (
 <LogoutConfirmModal 
 onConfirm={confirmLogout}
 onCancel={() => setShowLogoutConfirm(false)} 
 />
 )}
 </div>
 );
};

export default MenuOptions;

