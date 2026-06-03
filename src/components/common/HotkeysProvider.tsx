import React, { useEffect } from 'react';

type HotkeyMap = {
 [key: string]: (e: KeyboardEvent) => void;
};

interface HotkeysProviderProps {
 hotkeys: HotkeyMap;
 children: React.ReactNode;
}

export const HotkeysProvider: React.FC<HotkeysProviderProps> = ({ hotkeys, children }) => {
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 // Build a signature string like "Alt+S" or "F2"
 let keyCombo = '';
 if (e.ctrlKey) keyCombo += 'Ctrl+';
 if (e.shiftKey) keyCombo += 'Shift+';
 if (e.altKey) keyCombo += 'Alt+';
 
 // key map adjustments
 let key = e.key;
 if (key === ' ') key = 'Space';
 if (key.length === 1) key = key.toUpperCase(); // normalize letters
 
 if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
 keyCombo += key;
 }

 if (hotkeys[keyCombo]) {
 e.preventDefault(); // Prevent browser defaults (e.g. Save, Help)
 e.stopPropagation();
 hotkeys[keyCombo](e);
 }
 };

 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [hotkeys]);

 return <>{children}</>;
};

export const HOTKEYS = {
 NEW_VOUCHER: 'F2',
 SAVE: 'Alt+S',
 LIST_VIEW: 'F4',
 SALES: 'F8',
 PURCHASE: 'F9',
 PAYMENT: 'F5',
 RECEIPT: 'F6',
 JOURNAL: 'F7',
 CLOSE_TAB: 'Ctrl+W',
 SEARCH: 'Ctrl+F'
};

