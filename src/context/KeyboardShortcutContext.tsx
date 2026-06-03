import React, { createContext, useContext, useEffect, useCallback } from 'react';

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

interface KeyboardShortcutContextProps {
  registerShortcut: (id: string, config: ShortcutConfig) => void;
  unregisterShortcut: (id: string) => void;
}

const KeyboardShortcutContext = createContext<KeyboardShortcutContextProps | undefined>(undefined);

export const useKeyboardShortcuts = () => {
  const context = useContext(KeyboardShortcutContext);
  if (!context) {
    throw new Error('useKeyboardShortcuts must be used within a KeyboardShortcutProvider');
  }
  return context;
};

interface KeyboardShortcutProviderProps {
  children: React.ReactNode;
}

export const KeyboardShortcutProvider: React.FC<KeyboardShortcutProviderProps> = ({ children }) => {
  const shortcutsMap = React.useRef<Map<string, ShortcutConfig>>(new Map());

  const registerShortcut = useCallback((id: string, config: ShortcutConfig) => {
    shortcutsMap.current.set(id, config);
  }, []);

  const unregisterShortcut = useCallback((id: string) => {
    shortcutsMap.current.delete(id);
  }, []);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Prevent shortcuts from triggering when typing in inputs
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes((event.target as HTMLElement).tagName)) {
      return;
    }

    for (const [_, config] of shortcutsMap.current.entries()) {
      if (
        event.key.toLowerCase() === config.key.toLowerCase() &&
        Boolean(event.ctrlKey) === Boolean(config.ctrl) &&
        Boolean(event.shiftKey) === Boolean(config.shift) &&
        Boolean(event.altKey) === Boolean(config.alt)
      ) {
        event.preventDefault();
        config.action();
        break;
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const value: KeyboardShortcutContextProps = {
    registerShortcut,
    unregisterShortcut
  };

  return (
    <KeyboardShortcutContext.Provider value={value}>
      {children}
    </KeyboardShortcutContext.Provider>
  );
};