import React from 'react';
import { X } from 'lucide-react';
import { ERP_SHORTCUTS, GLOBAL_SHORTCUTS } from '../constants/shortcuts';
import { Tab } from '../types';

interface KeyboardShortcutsHelpProps {
 isOpen: boolean;
 onClose: () => void;
}

const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({ isOpen, onClose }) => {
 if (!isOpen) return null;

 const renderShortcut = (shortcut: any) => {
 const keys = [];
 if (shortcut.ctrl) keys.push('Ctrl');
 if (shortcut.shift) keys.push('Shift');
 if (shortcut.alt) keys.push('Alt');
 keys.push(shortcut.key.toUpperCase());
 
 return (
 <kbd className="px-2 py-1 bg-slate-100 border border-slate-300 rounded text-xs font-mono font-bold text-slate-700 shadow-sm">
 {keys.join(' + ')}
 </kbd>
 );
 };

 return (
 <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
 <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
 <div className="flex justify-between items-center p-4 border-b border-slate-200">
 <h2 className="text-xl font-bold text-slate-800">Keyboard Shortcuts</h2>
 <button 
 onClick={onClose}
 className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
 >
 <X size={20} />
 </button>
 </div>
 
 <div className="overflow-y-auto flex-1 p-4">
 <div className="mb-6">
 <h3 className="font-semibold text-slate-700 mb-3">Navigation Shortcuts</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {Object.entries(ERP_SHORTCUTS).map(([tab, shortcut]) => (
 <div key={shortcut.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
 <span className="text-slate-700">{shortcut.description}</span>
 {renderShortcut(shortcut)}
 </div>
 ))}
 </div>
 </div>
 
 <div>
 <h3 className="font-semibold text-slate-700 mb-3">Global Shortcuts</h3>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {GLOBAL_SHORTCUTS.map((shortcut) => (
 <div key={shortcut.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
 <span className="text-slate-700">{shortcut.description}</span>
 {renderShortcut(shortcut)}
 </div>
 ))}
 </div>
 </div>
 </div>
 
 <div className="p-4 bg-slate-50 border-t border-slate-200 text-sm text-slate-500">
 <p>Press any shortcut key combination to navigate instantly</p>
 </div>
 </div>
 </div>
 );
};

export default KeyboardShortcutsHelp;
