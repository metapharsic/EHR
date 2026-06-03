import { useNotifications } from '../context/NotificationContext';

// Hook for easy notification creation
export const useNotificationSystem = () => {
  const { addNotification: enqueueNotification } = useNotifications();

  const notifySuccess = (titleOrMessage: string, message?: string, module?: string) => {
    enqueueNotification({
      type: 'success',
      title: message ? titleOrMessage : 'Success',
      message: message || titleOrMessage,
      priority: 'low',
      module
    });
  };

  const notifyError = (titleOrMessage: string, message?: string, module?: string) => {
    enqueueNotification({
      type: 'error',
      title: message ? titleOrMessage : 'Error',
      message: message || titleOrMessage,
      priority: 'high',
      module
    });
  };

  const notifyWarning = (titleOrMessage: string, message?: string, module?: string) => {
    enqueueNotification({
      type: 'warning',
      title: message ? titleOrMessage : 'Warning',
      message: message || titleOrMessage,
      priority: 'medium',
      module
    });
  };

  const notifyInfo = (titleOrMessage: string, message?: string, module?: string) => {
    enqueueNotification({
      type: 'info',
      title: message ? titleOrMessage : 'Information',
      message: message || titleOrMessage,
      priority: 'medium',
      module
    });
  };

  const notifyCritical = (titleOrMessage: string, message?: string, module?: string) => {
    enqueueNotification({
      type: 'error',
      title: message ? titleOrMessage : 'Critical Error',
      message: message || titleOrMessage,
      priority: 'critical',
      module
    });
  };

  // Module-specific notifications
  const notifyInventory = {
    success: (message: string) => 
      notifySuccess('Inventory Success', message, 'INVENTORY'),
    error: (message: string) => 
      notifyError('Inventory Error', message, 'INVENTORY'),
    lowStock: (product: string, current: number, min: number) => 
      notifyWarning(
        'Low Stock Alert', 
        `${product} stock is low (${current} remaining, minimum: ${min})`, 
        'INVENTORY'
      ),
    expired: (product: string, batch: string) => 
      notifyCritical(
        'Expired Product', 
        `${product} batch ${batch} has expired`, 
        'INVENTORY'
      ),
    expiringSoon: (product: string, batch: string, days: number) => 
      notifyWarning(
        'Expiring Soon', 
        `${product} batch ${batch} expires in ${days} days`, 
        'INVENTORY'
      )
  };

  const notifySales = {
    largeOrder: (customer: string, amount: number) => 
      notifyInfo(
        'Large Order Received', 
        `New order from ${customer} worth ₹${amount.toLocaleString()}`, 
        'SALES'
      ),
    paymentReceived: (customer: string, amount: number) => 
      notifySuccess(
        'Payment Received', 
        `Payment of ₹${amount.toLocaleString()} received from ${customer}`, 
        'SALES'
      )
  };

  const notifySystem = {
    backupComplete: () => 
      notifySuccess(
        'Backup Complete', 
        'System backup has been completed successfully', 
        'SYSTEM'
      ),
    maintenance: (time: string) => 
      notifyWarning(
        'Scheduled Maintenance', 
        `System maintenance scheduled for ${time}`, 
        'SYSTEM'
      ),
    updateAvailable: (version: string) => 
      notifyInfo(
        'Update Available', 
        `ERP system update ${version} is now available`, 
        'SYSTEM'
      )
  };

  const notifyCompliance = {
    licenseExpiring: (license: string, days: number) => 
      notifyCritical(
        'License Expiring', 
        `${license} expires in ${days} days`, 
        'COMPLIANCE'
      ),
    auditRequired: (type: string, date: string) => 
      notifyWarning(
        'Audit Required', 
        `${type} audit required by ${date}`, 
        'COMPLIANCE'
      )
  };

  const notifyQuality = {
    testFailed: (product: string, test: string) => 
      notifyError(
        'Quality Test Failed', 
        `${product} failed ${test} quality test`, 
        'QC'
      ),
    deviation: (process: string) => 
      notifyCritical(
        'Process Deviation', 
        `Deviation detected in ${process}`, 
        'QC'
      )
  };

  const notifyManufacturing = {
    productionComplete: (batch: string, product: string) => 
      notifySuccess(
        'Production Complete', 
        `Batch ${batch} of ${product} production completed`, 
        'MANUFACTURING'
      ),
    equipmentDown: (equipment: string) => 
      notifyCritical(
        'Equipment Down', 
        `${equipment} is currently offline`, 
        'MANUFACTURING'
      )
  };

  const notifyFinance = {
    invoiceOverdue: (customer: string, days: number) => 
      notifyWarning(
        'Invoice Overdue', 
        `Invoice for ${customer} is ${days} days overdue`, 
        'ACCOUNTS'
      ),
    paymentDue: (supplier: string, amount: number) => 
      notifyInfo(
        'Payment Due', 
        `Payment of ₹${amount.toLocaleString()} due to ${supplier}`, 
        'ACCOUNTS'
      )
  };

  const addNotification = (
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    module?: string,
    title?: string
  ) => {
    const notifyByType = {
      success: notifySuccess,
      error: notifyError,
      warning: notifyWarning,
      info: notifyInfo
    };
    if (title) {
      notifyByType[type](title, message, module);
      return;
    }
    notifyByType[type](message, undefined, module);
  };

  const notifyAccounting = (
    title: string,
    message: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info'
  ) => {
    const notifyByType = {
      success: notifySuccess,
      error: notifyError,
      warning: notifyWarning,
      info: notifyInfo
    };
    notifyByType[type](title, message, 'ACCOUNTS');
  };

  const notifyLogistics = {
    shipped: (invoice: string, courier: string) => 
      notifySuccess(
        'Shipment Dispatched', 
        `Order ${invoice} has been shipped via ${courier}`, 
        'LOGISTICS'
      ),
    delivered: (invoice: string, customer: string) => 
      notifySuccess(
        'Shipment Delivered', 
        `Order ${invoice} successfully delivered to ${customer}`, 
        'LOGISTICS'
      ),
    delayed: (invoice: string, reason: string) => 
      notifyWarning(
        'Shipment Delayed', 
        `Order ${invoice} is delayed: ${reason}`, 
        'LOGISTICS'
      )
  };

  return {
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
    notifyCritical,
    notifyInventory,
    notifySales,
    notifySystem,
    notifyCompliance,
    notifyQuality,
    notifyManufacturing,
    notifyFinance,
    notifyLogistics,
    addNotification,
    notifyAccounting,
    // Standard aliases for simpler access
    success: notifySuccess,
    error: notifyError,
    warning: notifyWarning,
    info: notifyInfo,
    critical: notifyCritical
  };
};
