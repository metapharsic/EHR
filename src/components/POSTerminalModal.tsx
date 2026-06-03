import React from 'react';
import TallyVoucherEntry from './TallyVoucherEntry';
import { useAppStore } from '../store/useAppStore';

interface POSTerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialItems?: any[];
  editingInvoice?: any;
}

const POSTerminalModal: React.FC<POSTerminalModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialItems = [],
  editingInvoice,
}) => {
  const { posState } = useAppStore();

  if (!isOpen || posState === 'closed') return null;

  // The wrapper styling depends on the posState
  // If full or side, App.tsx handles the container size through the CSS Grid.
  // If mini, we need a floating position.
  const isMini = posState === 'mini';

  return (
    <div
      role="dialog"
      aria-modal={isMini ? 'false' : 'true'}
      aria-label="POS Billing Terminal"
      style={isMini ? {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        width: '300px',
        borderRadius: '14px',
        overflow: 'hidden',
        boxShadow: 'none',
        background: 'transparent',
        border: 'none',
        animation: 'flyIn 0.3s ease-in-out'
      } : {
        width: '100%',
        height: '100%',
        background: '#F5F5F5',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <style>{`
        @keyframes flyIn {
          0% { transform: scale(1); opacity: 0; }
          50% { transform: scale(0.95); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <TallyVoucherEntry
        key={String(isOpen)}
        initialType="Sales"
        hideTopBanner={true}
        initialItems={initialItems}
        editingInvoice={editingInvoice}
        onClose={onClose}
        onSuccess={() => {
          if (onSuccess) onSuccess();
        }}
      />
    </div>
  );
};

export default POSTerminalModal;
