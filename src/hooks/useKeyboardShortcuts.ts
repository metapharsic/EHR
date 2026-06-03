import { useEffect } from 'react';
import { useKeyboardShortcuts } from '../context/KeyboardShortcutContext';
import { Tab } from '../types';
import { ERP_SHORTCUTS, GLOBAL_SHORTCUTS } from '../constants/shortcuts';

interface UseKeyboardShortcutsHook {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  toggleSidebar: () => void;
  setShowHelpModal: (show: boolean) => void;
}

export const useRegisterKeyboardShortcuts = ({
  activeTab,
  setActiveTab,
  toggleSidebar,
  setShowHelpModal
}: UseKeyboardShortcutsHook) => {
  const { registerShortcut, unregisterShortcut } = useKeyboardShortcuts();

  useEffect(() => {
    // Register navigation shortcuts for each tab
    Object.values(Tab).forEach(tab => {
      const shortcut = ERP_SHORTCUTS[tab as Tab];
      if (shortcut) {
        registerShortcut(shortcut.id, {
          key: shortcut.key,
          ctrl: shortcut.ctrl,
          shift: shortcut.shift,
          alt: shortcut.alt,
          description: shortcut.description,
          action: () => setActiveTab(tab as Tab)
        });
      }
    });

    // Register global shortcuts
    GLOBAL_SHORTCUTS.forEach(shortcut => {
      registerShortcut(shortcut.id, {
        key: shortcut.key,
        ctrl: shortcut.ctrl,
        shift: shortcut.shift,
        alt: shortcut.alt,
        description: shortcut.description,
        action: () => {
          if (shortcut.id === 'toggle-sidebar') {
            toggleSidebar();
          } else if (shortcut.id === 'help-shortcuts') {
            setShowHelpModal(true);
          } else if (shortcut.id === 'global-search') {
            // Focus the search input if it exists
            const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
            if (searchInput) {
              searchInput.focus();
            }
          }
        }
      });
    });

    // Cleanup on unmount
    return () => {
      Object.values(Tab).forEach(tab => {
        const shortcut = ERP_SHORTCUTS[tab as Tab];
        if (shortcut) {
          unregisterShortcut(shortcut.id);
        }
      });
      
      GLOBAL_SHORTCUTS.forEach(shortcut => {
        unregisterShortcut(shortcut.id);
      });
    };
  }, [registerShortcut, unregisterShortcut, setActiveTab, toggleSidebar, setShowHelpModal]);
};