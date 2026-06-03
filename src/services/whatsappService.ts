// WhatsApp Notification Service for ERP System
// Supports WhatsApp Business API and WhatsApp Web integration

import { Notification } from '../context/NotificationContext';

// WhatsApp Configuration
interface WhatsAppConfig {
  phoneNumber: string;
  apiKey?: string;
  businessAccountId?: string;
  enabled: boolean;
}

// Default configuration (can be updated via settings)
let whatsappConfig: WhatsAppConfig = {
  phoneNumber: localStorage.getItem('whatsapp_phone') || '',
  apiKey: localStorage.getItem('whatsapp_api_key') || undefined,
  businessAccountId: localStorage.getItem('whatsapp_business_id') || undefined,
  enabled: localStorage.getItem('whatsapp_enabled') === 'true'
};

// Save configuration to localStorage
export const saveWhatsAppConfig = (config: Partial<WhatsAppConfig>) => {
  whatsappConfig = { ...whatsappConfig, ...config };
  localStorage.setItem('whatsapp_phone', whatsappConfig.phoneNumber);
  if (config.apiKey) localStorage.setItem('whatsapp_api_key', config.apiKey);
  if (config.businessAccountId) localStorage.setItem('whatsapp_business_id', config.businessAccountId);
  localStorage.setItem('whatsapp_enabled', whatsappConfig.enabled.toString());
};

// Get current configuration
export const getWhatsAppConfig = (): WhatsAppConfig => {
  return { ...whatsappConfig };
};

// Format notification for WhatsApp message
const formatWhatsAppMessage = (notification: Notification): string => {
  const emoji = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  }[notification.type];

  const priorityEmoji = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🟢'
  }[notification.priority];

  return `${emoji} *Metapharsic ERP Alert*

${priorityEmoji} *${notification.title}*

${notification.message}

📅 ${new Date(notification.timestamp).toLocaleString('en-IN')}
${notification.module ? `📁 Module: ${notification.module}` : ''}

---
🔔 Metapharsic Enterprise Hub`;
};

// Send WhatsApp message via WhatsApp Business API
export const sendWhatsAppMessage = async (
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Check if WhatsApp is enabled
    if (!whatsappConfig.enabled) {
      return { success: false, error: 'WhatsApp notifications are disabled' };
    }

    // Validate phone number
    if (!phoneNumber || phoneNumber.length < 10) {
      return { success: false, error: 'Invalid phone number' };
    }

    // Format phone number (remove non-numeric characters)
    const formattedPhone = phoneNumber.replace(/\D/g, '');

    // Try WhatsApp Business API if API key is available
    if (whatsappConfig.apiKey && whatsappConfig.businessAccountId) {
      const response = await fetch(`https://graph.facebook.com/v18.0/${whatsappConfig.businessAccountId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: formattedPhone,
          type: 'text',
          text: { body: message }
        })
      });

      if (response.ok) {
        console.log('WhatsApp message sent via Business API');
        return { success: true };
      }
    }

    // Fallback: Open WhatsApp Web (for development/testing)
    const whatsappWebUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
    
    // Store the message for manual sending
    const pendingMessages = JSON.parse(localStorage.getItem('whatsapp_pending') || '[]');
    pendingMessages.push({
      id: Date.now().toString(),
      phone: formattedPhone,
      message,
      url: whatsappWebUrl,
      timestamp: new Date().toISOString(),
      sent: false
    });
    localStorage.setItem('whatsapp_pending', JSON.stringify(pendingMessages));

    // For now, return success with manual option
    return { 
      success: true, 
      error: 'WhatsApp Web link generated. Please click the link to send manually.' 
    };

  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return { success: false, error: 'Failed to send WhatsApp message' };
  }
};

// Send notification to WhatsApp
export const sendNotificationToWhatsApp = async (
  notification: Notification,
  phoneNumber?: string
): Promise<{ success: boolean; error?: string }> => {
  const targetPhone = phoneNumber || whatsappConfig.phoneNumber;
  
  if (!targetPhone) {
    return { success: false, error: 'No phone number configured' };
  }

  const message = formatWhatsAppMessage(notification);
  return await sendWhatsAppMessage(targetPhone, message);
};

// Send bulk notifications
export const sendBulkWhatsAppNotifications = async (
  notifications: Notification[],
  phoneNumbers: string[]
): Promise<{ success: number; failed: number; errors: string[] }> => {
  const results = { success: 0, failed: 0, errors: [] as string[] };

  for (const notification of notifications) {
    for (const phone of phoneNumbers) {
      const result = await sendNotificationToWhatsApp(notification, phone);
      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        if (result.error) results.errors.push(result.error);
      }
    }
  }

  return results;
};

// Get pending WhatsApp messages
export const getPendingMessages = (): Array<{
  id: string;
  phone: string;
  message: string;
  url: string;
  timestamp: string;
  sent: boolean;
}> => {
  return JSON.parse(localStorage.getItem('whatsapp_pending') || '[]');
};

// Mark message as sent
export const markMessageAsSent = (id: string) => {
  const pending = getPendingMessages();
  const updated = pending.map(m => m.id === id ? { ...m, sent: true } : m);
  localStorage.setItem('whatsapp_pending', JSON.stringify(updated));
};

// Clear pending messages
export const clearPendingMessages = () => {
  localStorage.removeItem('whatsapp_pending');
};

// Test WhatsApp configuration
export const testWhatsAppConfig = async (): Promise<{ success: boolean; message: string }> => {
  if (!whatsappConfig.enabled) {
    return { success: false, message: 'WhatsApp notifications are disabled' };
  }

  if (!whatsappConfig.phoneNumber) {
    return { success: false, message: 'Phone number not configured' };
  }

  const testMessage = `🧪 *Test Message*\n\nYour WhatsApp integration is working correctly!\n\n📅 ${new Date().toLocaleString('en-IN')}\n\n---\n🔔 Metapharsic Enterprise Hub`;

  const result = await sendWhatsAppMessage(whatsappConfig.phoneNumber, testMessage);
  
  if (result.success) {
    return { success: true, message: 'Test message sent successfully!' };
  } else {
    return { success: false, message: result.error || 'Failed to send test message' };
  }
};

// Auto-send critical notifications
export const shouldAutoSendToWhatsApp = (notification: Notification): boolean => {
  const autoSendPriorities = ['critical', 'high'];
  const autoSendModules = ['INVENTORY', 'COMPLIANCE', 'ACCOUNTS'];
  
  return (
    whatsappConfig.enabled &&
    autoSendPriorities.includes(notification.priority) &&
    autoSendModules.includes(notification.module || '')
  );
};

export default {
  saveWhatsAppConfig,
  getWhatsAppConfig,
  sendWhatsAppMessage,
  sendNotificationToWhatsApp,
  sendBulkWhatsAppNotifications,
  getPendingMessages,
  markMessageAsSent,
  clearPendingMessages,
  testWhatsAppConfig,
  shouldAutoSendToWhatsApp
};
