import { SalesInvoice } from '../types';
import apiClient from './apiClient';

/**
 * Saves an invoice to the database via API
 */
export const saveInvoiceToDB = async (invoice: SalesInvoice): Promise<boolean> => {
  try {
    const response = await apiClient.post('/api/pos', invoice);
    console.log(`Invoice ${invoice.invoiceNumber} saved to database`);
    return true;
  } catch (error) {
    console.error('Error saving invoice to database:', error);
    return false;
  }
};

/**
 * Gets all invoices from the database via API
 */
export const getAllInvoicesFromDB = async (): Promise<SalesInvoice[]> => {
  try {
    const data = await apiClient.get('/api/pos/invoices');
    return data.data || [];
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
};

/**
 * Gets an invoice by ID from the database via API
 */
export const getInvoiceByIdFromDB = async (id: string): Promise<SalesInvoice | undefined> => {
  try {
    const data = await apiClient.get(`/api/pos/invoices/${id}`);
    return data.data;
  } catch (error) {
    console.error(`Error fetching invoice ${id}:`, error);
    return undefined;
  }
};

/**
 * Updates an invoice in the database via API
 */
export const updateInvoiceInDB = async (invoice: SalesInvoice): Promise<boolean> => {
  try {
    await apiClient.put(`/api/pos/invoices/${invoice.id}`, invoice);
    console.log(`Invoice ${invoice.invoiceNumber} updated in database`);
    return true;
  } catch (error) {
    console.error('Error updating invoice in database:', error);
    return false;
  }
};

/**
 * Clears all invoices from the database (admin only)
 */
export const clearInvoiceDatabase = async (): Promise<boolean> => {
  try {
    await apiClient.delete('/api/pos/invoices/all');
    return true;
  } catch (error) {
    console.error('Error clearing database:', error);
    return false;
  }
};
