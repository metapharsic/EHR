import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { Bell, AlertCircle, CheckCircle, Info, X, MessageCircle } from 'lucide-react';
import { sendNotificationToWhatsApp, shouldAutoSendToWhatsApp, getWhatsAppConfig } from '../services/whatsappService';
import { Tab } from '../types';
import { useAppStore } from '../store/useAppStore';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  priority: 'low' | 'medium' | 'high' | 'critical';
  module?: string;
  targetTab?: Tab;
  sourceTable?: string;
  sourceLabel?: string;
  action?: () => void;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  getNotificationsByModule: (module: string) => Notification[];
  getUnreadByPriority: (priority: Notification['priority']) => Notification[];
  sendToWhatsApp: (notificationId: string, phoneNumber?: string) => Promise<{ success: boolean; error?: string }>;
  whatsappEnabled: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const moduleToTabMap: Record<string, Tab> = {
  DASHBOARD: Tab.DASHBOARD,
  SYSTEM: Tab.SETTINGS,
  INVENTORY: Tab.INVENTORY,
  POS: Tab.POS,
  REPORTS: Tab.REPORTS,
  ACCOUNTS: Tab.ACCOUNTS,
  CRM: Tab.CRM,
  PCD: Tab.PCD,
  SALES: Tab.SALES,
  DOCUMENTS: Tab.DOCUMENTS,
  DMS: Tab.DOCUMENTS,
  ASSETS: Tab.ASSETS,
  LOGISTICS: Tab.LOGISTICS,
  COMPLIANCE: Tab.COMPLIANCE,
  AUDIT: Tab.AUDIT,
  HR: Tab.EMPLOYEES
};

const moduleToSourceMap: Record<string, { table: string; label: string }> = {
  DASHBOARD: { table: 'users', label: 'Dashboard session state' },
  SYSTEM: { table: 'users', label: 'System settings data' },
  INVENTORY: { table: 'products', label: 'Products stock master' },
  POS: { table: 'sales_invoices', label: 'POS sales invoices' },
  REPORTS: { table: 'sales_invoices', label: 'Sales invoice register' },
  ACCOUNTS: { table: 'chart_of_accounts', label: 'Chart of accounts' },
  CRM: { table: 'leads', label: 'CRM leads' },
  PCD: { table: 'pcd_partners', label: 'PCD partner data' },
  SALES: { table: 'sales_invoices', label: 'Sales invoice register' },
  DOCUMENTS: { table: 'dms_documents', label: 'DMS documents' },
  DMS: { table: 'dms_documents', label: 'DMS documents' },
  ASSETS: { table: 'asset_alerts', label: 'Asset alert records' },
  LOGISTICS: { table: 'dispatches', label: 'Dispatch records' },
  COMPLIANCE: { table: 'compliance_checklists', label: 'Compliance checklist records' },
  AUDIT: { table: 'AuditLog', label: 'Audit trail' },
  HR: { table: 'employees', label: 'Employee records' }
};

const normalizeStoredNotification = (notification: any): Notification => ({
  ...notification,
  timestamp: new Date(notification.timestamp),
  targetTab: notification.targetTab || (notification.module ? moduleToTabMap[notification.module] : undefined),
  sourceTable: notification.sourceTable || (notification.module ? moduleToSourceMap[notification.module]?.table : undefined),
  sourceLabel: notification.sourceLabel || (notification.module ? moduleToSourceMap[notification.module]?.label : undefined)
});

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>(() => {
    const saved = localStorage.getItem('erp-notifications');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return parsed.map(normalizeStoredNotification);
    } catch {
      return [];
    }
  });
  const [whatsappEnabled] = useState(() => {
    return getWhatsAppConfig().enabled && !!getWhatsAppConfig().phoneNumber;
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    localStorage.setItem('erp-notifications', JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    if (notifications.length === 0) {
      const initialNotifications: Notification[] = [
        {
          id: '1',
          type: 'info',
          title: 'System Update',
          message: 'ERP system has been updated to version 2.1.0',
          timestamp: new Date(Date.now() - 3600000),
          read: false,
          priority: 'medium',
          module: 'SYSTEM',
          targetTab: Tab.SETTINGS,
          sourceTable: 'users',
          sourceLabel: 'System settings data'
        },
        {
          id: '2',
          type: 'warning',
          title: 'Inventory Alert',
          message: 'Product PARACETAMOL 500MG is below minimum stock level',
          timestamp: new Date(Date.now() - 7200000),
          read: false,
          priority: 'high',
          module: 'INVENTORY',
          targetTab: Tab.INVENTORY,
          sourceTable: 'products',
          sourceLabel: 'Products stock master'
        },
        {
          id: '3',
          type: 'success',
          title: 'Report Generated',
          message: 'Daily sales report has been successfully generated',
          timestamp: new Date(Date.now() - 10800000),
          read: true,
          priority: 'low',
          module: 'REPORTS',
          targetTab: Tab.REPORTS,
          sourceTable: 'sales_invoices',
          sourceLabel: 'Sales invoice register'
        }
      ];
      setNotifications(initialNotifications);
    }
  }, [notifications.length]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const sourceInfo = notification.sourceTable
      ? { table: notification.sourceTable, label: notification.sourceLabel || notification.sourceTable }
      : (notification.module ? moduleToSourceMap[notification.module] : undefined);

    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 11),
      timestamp: new Date(),
      read: false,
      targetTab: notification.targetTab || (notification.module ? moduleToTabMap[notification.module] : undefined),
      sourceTable: sourceInfo?.table,
      sourceLabel: sourceInfo?.label
    };
    setNotifications((prev) => [newNotification, ...prev]);

    if (shouldAutoSendToWhatsApp(newNotification)) {
      sendNotificationToWhatsApp(newNotification);
    }
  };

  const sendToWhatsApp = async (notificationId: string, phoneNumber?: string): Promise<{ success: boolean; error?: string }> => {
    const notification = notifications.find((n) => n.id === notificationId);
    if (!notification) {
      return { success: false, error: 'Notification not found' };
    }
    return sendNotificationToWhatsApp(notification, phoneNumber);
  };

  const markAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const getNotificationsByModule = (module: string) => notifications.filter((n) => n.module === module);
  const getUnreadByPriority = (priority: Notification['priority']) => notifications.filter((n) => !n.read && n.priority === priority);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAsRead,
        markAllAsRead,
        removeNotification,
        clearAllNotifications,
        getNotificationsByModule,
        getUnreadByPriority,
        sendToWhatsApp,
        whatsappEnabled
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification, sendToWhatsApp, whatsappEnabled } = useNotifications();
  const setActiveTab = useAppStore((state) => state.setActiveTab);
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState<string | null>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-green-500" size={16} />;
      case 'error': return <X className="text-red-500" size={16} />;
      case 'warning': return <AlertCircle className="text-orange-500" size={16} />;
      case 'info': return <Info className="text-blue-500" size={16} />;
      default: return <Bell className="text-slate-500" size={16} />;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-orange-500 bg-orange-50';
      case 'medium': return 'border-l-blue-500 bg-blue-50';
      case 'low': return 'border-l-slate-500 bg-slate-50';
      default: return 'border-l-slate-500 bg-slate-50';
    }
  };

  const getPriorityText = (priority: Notification['priority']) => {
    switch (priority) {
      case 'critical': return 'Critical';
      case 'high': return 'High';
      case 'medium': return 'Medium';
      case 'low': return 'Low';
      default: return 'Low';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const unreadNotifications = notifications.filter((n) => !n.read);
  const displayNotifications = showAll ? notifications : unreadNotifications.slice(0, 5);

  const openNotificationTarget = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.targetTab) {
      setActiveTab(notification.targetTab);
      setIsOpen(false);
      return;
    }
    if (notification.action) {
      notification.action();
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-10 w-10 flex items-center justify-center rounded-xl hover:bg-slate-50 text-slate-500 hover:text-blue-600 transition-all border border-transparent hover:border-slate-200"
        title="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[24px] h-6 px-1.5 rounded-full border-2 border-slate-50 shadow-sm flex items-center justify-center text-[10px] font-black ${
            unreadCount > 20 ? 'bg-red-600 text-white animate-pulse' : 'bg-red-500 text-white'
          }`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-[26rem] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-800">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Mark all as read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {unreadCount > 0 && (
              <p className="text-sm text-slate-600 mt-1">
                You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {displayNotifications.length > 0 ? (
              displayNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-l-4 ${getPriorityColor(notification.priority)} ${!notification.read ? 'bg-white' : 'bg-slate-50'} hover:bg-slate-50 transition-colors group`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => openNotificationTarget(notification)}
                          className={`text-left text-sm font-medium underline-offset-2 hover:underline ${notification.read ? 'text-slate-600' : 'text-slate-800'}`}
                        >
                          {notification.title}
                        </button>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            notification.priority === 'critical' ? 'bg-red-100 text-red-700' :
                            notification.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                            notification.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                            'bg-slate-100 text-slate-700'
                          }`}>
                            {getPriorityText(notification.priority)}
                          </span>
                          <button
                            onClick={() => removeNotification(notification.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                      <p className={`text-sm mt-1 ${notification.read ? 'text-slate-500' : 'text-slate-600'}`}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {notification.module || 'GENERAL'} • {formatTime(notification.timestamp)}
                      </p>
                      {notification.sourceTable && (
                        <p className="text-xs text-slate-500 mt-1">
                          DB source: <span className="font-semibold">{notification.sourceTable}</span>
                          {notification.sourceLabel ? ` • ${notification.sourceLabel}` : ''}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {notification.targetTab && (
                          <button
                            onClick={() => openNotificationTarget(notification)}
                            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                          >
                            Open page
                          </button>
                        )}
                        {notification.sourceTable && (
                          <button
                            onClick={() => openNotificationTarget(notification)}
                            className="text-xs text-slate-600 hover:text-slate-800 font-medium"
                            title={`Source table: ${notification.sourceTable}`}
                          >
                            View source table
                          </button>
                        )}
                        {!notification.read && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Mark as read
                          </button>
                        )}
                        {whatsappEnabled && (
                          <button
                            onClick={async () => {
                              setSendingWhatsApp(notification.id);
                              const result = await sendToWhatsApp(notification.id);
                              setSendingWhatsApp(null);
                              if (result.success) {
                                alert('Notification sent to WhatsApp!');
                              } else {
                                alert(`Failed to send: ${result.error}`);
                              }
                            }}
                            disabled={sendingWhatsApp === notification.id}
                            className="text-xs text-green-600 hover:text-green-800 font-medium flex items-center gap-1 disabled:opacity-50"
                          >
                            {sendingWhatsApp === notification.id ? (
                              <>
                                <div className="w-3 h-3 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <MessageCircle size={12} />
                                Send to WhatsApp
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center">
                <Bell className="mx-auto text-slate-300 mb-2" size={32} />
                <p className="text-slate-500">No notifications</p>
              </div>
            )}
          </div>

          {notifications.length > 5 && (
            <div className="p-3 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => setShowAll(!showAll)}
                className="w-full text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                {showAll ? 'Show less' : `Show all ${notifications.length} notifications`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
