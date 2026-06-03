import { SalesInvoice } from '../types';

// Mock database for storing invoices
let mockInvoiceDatabase: SalesInvoice[] = [];

/**
 * Saves an invoice to the mock database
 */
export const saveInvoiceToDB = async (invoice: SalesInvoice): Promise<boolean> => {
  try {
    // Simulate database save operation
    mockInvoiceDatabase.push(invoice);
    console.log(`Invoice ${invoice.invoiceNumber} saved to database`);
    return true;
  } catch (error) {
    console.error('Error saving invoice to database:', error);
    return false;
  }
};

/**
 * Gets all invoices from the mock database
 */
export const getAllInvoicesFromDB = async (): Promise<SalesInvoice[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...mockInvoiceDatabase]);
    }, 100); // Simulate network delay
  });
};

/**
 * Gets an invoice by ID from the mock database
 */
export const getInvoiceByIdFromDB = async (id: string): Promise<SalesInvoice | undefined> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const invoice = mockInvoiceDatabase.find(inv => inv.id === id);
      resolve(invoice);
    }, 100); // Simulate network delay
  });
};

/**
 * Updates an invoice in the mock database
 */
export const updateInvoiceInDB = async (invoice: SalesInvoice): Promise<boolean> => {
  try {
    const index = mockInvoiceDatabase.findIndex(inv => inv.id === invoice.id);
    if (index !== -1) {
      mockInvoiceDatabase[index] = invoice;
      console.log(`Invoice ${invoice.invoiceNumber} updated in database`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating invoice in database:', error);
    return false;
  }
};

/**
 * Clears all invoices from the mock database (for testing)
 */
export const clearInvoiceDatabase = () => {
  mockInvoiceDatabase = [];
};