import { create } from 'zustand';
import { Tab } from '../types';

export type POSStateMode = 'full' | 'side' | 'mini' | 'closed';

interface AppState {
  // Sidebar/UI State
  sidebarOpen: boolean;
  activeModule: string;
  isDarkMode: boolean;
  
  // Tab Management
  openTabs: Tab[];
  activeTab: Tab;
  
  // Global POS Terminal
  posTerminalOpen: boolean; // Keep for backwards compatibility
  posState: POSStateMode;
  posInternalTab: string | null;
  posBillState: {
    items: any[];
    partyName: string;
    patientName: string;
    customerMobile: string;
    doctorName: string;
    abhaNo: string;
    salesLedger: string;
    narration: string;
    drugLicenseNo: string;
    ewayBillNo: string;
    voucherType: string;
    date: string;
    invoiceNo: string;
  };
  
  // Notifications
  notifications: Array<{
    id: string;
    type: 'success' | 'error' | 'info' | 'warning';
    message: string;
  }>;

  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setActiveModule: (module: string) => void;
  toggleDarkMode: () => void;
  setPosTerminalOpen: (open: boolean) => void; // Keep for backwards compatibility
  setPosState: (state: POSStateMode) => void;
  setPosInternalTab: (tabId: string | null) => void;
  setPosBillState: (billState: Partial<AppState['posBillState']>) => void;
  clearPosBillState: () => void;
  
  addTab: (tab: Tab) => void;
  removeTab: (tab: Tab) => void;
  setActiveTab: (tab: Tab) => void;
  
  addNotification: (notification: Omit<AppState['notifications'][0], 'id'>) => void;
  removeNotification: (id: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarOpen: true,
  activeModule: 'dashboard',
  isDarkMode: false,
  openTabs: [Tab.DASHBOARD],
  activeTab: Tab.DASHBOARD,
  posTerminalOpen: false, // Keep for backwards compatibility
  posState: 'closed',
  posInternalTab: null,
  posBillState: {
    items: [{ name: '', quantity: '', rate: '', amount: 0, stockAvailable: 0, batchNumber: '', expiryDate: '', mrp: 0, gstPercent: 0, discPercent: '0.00' }],
    partyName: 'Counter Customer',
    patientName: '',
    customerMobile: '',
    doctorName: '',
    abhaNo: '',
    salesLedger: 'Sales',
    narration: '',
    drugLicenseNo: '',
    ewayBillNo: '',
    voucherType: 'Sales',
    date: new Date().toISOString().split('T')[0],
    invoiceNo: ''
  },
  notifications: [],

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setActiveModule: (module) => set({ activeModule: module }),
  toggleDarkMode: () => set((state) => ({ isDarkMode: !state.isDarkMode })),
  setPosTerminalOpen: (open) => set({ posTerminalOpen: open, posState: open ? 'full' : 'closed' }), // Map old prop to new state
  setPosState: (posState) => set({ posState, posTerminalOpen: posState !== 'closed' }),
  setPosInternalTab: (tabId) => set({ posInternalTab: tabId }),
  setPosBillState: (billState) => set((state) => ({ posBillState: { ...state.posBillState, ...billState } })),
  clearPosBillState: () => set({ posBillState: {
    items: [{ name: '', quantity: '', rate: '', amount: 0, stockAvailable: 0, batchNumber: '', expiryDate: '', mrp: 0, gstPercent: 0, discPercent: '0.00' }],
    partyName: 'Counter Customer',
    patientName: '',
    customerMobile: '',
    doctorName: '',
    abhaNo: '',
    salesLedger: 'Sales',
    narration: '',
    drugLicenseNo: '',
    ewayBillNo: '',
    voucherType: 'Sales',
    date: new Date().toISOString().split('T')[0],
    invoiceNo: ''
  }}),

  addTab: (tab) => set((state) => ({
    openTabs: state.openTabs.includes(tab) ? state.openTabs : [...state.openTabs, tab],
    activeTab: tab
  })),
  
  removeTab: (tab) => set((state) => {
    const newTabs = state.openTabs.filter((t) => t !== tab);
    return {
      openTabs: newTabs,
      activeTab: state.activeTab === tab ? (newTabs[newTabs.length - 1] || Tab.DASHBOARD) : state.activeTab
    };
  }),
  
  setActiveTab: (tab) => set({ activeTab: tab }),

  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, { ...notification, id: Math.random().toString(36).substring(7) }]
  })),
  
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id)
  })),
}));
