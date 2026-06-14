
import { Product, Invoice, SalesInvoice, Supplier, SalesData, User, Purchase, Payment, PurchaseReturn, PCDPartner, PCDScheme, MedicalRepresentative, PCDTarget, RawMaterial, BillOfMaterial, ProductionOrder, Expense, Tab, UserRole, SaleTransaction, Task, Asset, MaintenanceRecord, Formulation, Experiment, DistributorOrder, Party, GSTReportEntry, Vendor, InsurancePolicy, AssetTransfer, AssetAlert, DocRecord, Document, DocumentVersion, DocumentWorkflow, DocumentAuditTrail, DocumentTag } from './types';

export const MOCK_USERS: User[] = [
  { id: '1', username: 'admin', name: 'Metapharsic Admin', role: 'ADMIN' },
  { id: '2', username: 'pharmacist', name: 'Priya Sharma', role: 'PHARMACIST' },
  { id: '3', username: 'cashier', name: 'Rahul Verma', role: 'CASHIER' },
  { id: '4', username: 'inventory', name: 'Vikram Singh', role: 'INVENTORY_MANAGER' },
];

export const ROLE_ACCESS: Record<Tab, UserRole[]> = {
  [Tab.DASHBOARD]: ['ADMIN', 'PHARMACIST', 'CASHIER', 'SALES_MANAGER', 'QC_MANAGER', 'INVENTORY_MANAGER'],
  [Tab.POS]: ['ADMIN', 'PHARMACIST', 'CASHIER'],
  [Tab.SALES_HISTORY]: ['ADMIN', 'PHARMACIST', 'CASHIER', 'SALES_MANAGER'],
  [Tab.CUSTOMER_DATABASE]: ['ADMIN', 'PHARMACIST', 'CASHIER', 'SALES_MANAGER'],
  [Tab.VOUCHER_SETUP]: ['ADMIN', 'PHARMACIST', 'SALES_MANAGER'],
  [Tab.INVENTORY_HUB]: ['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER'],
  [Tab.INVENTORY]: ['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER'],
  [Tab.INVENTORY_ANALYTICS]: ['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER'],
  [Tab.PURCHASE]: ['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER'],
  [Tab.ACCOUNTS]: ['ADMIN'],
  [Tab.INVENTORY_VOUCHERS]: ['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER'],
  [Tab.TALLY_VOUCHER_ENTRY]: ['ADMIN', 'FINANCE_MANAGER'],
  [Tab.FINANCIAL_STATEMENTS]: ['ADMIN', 'FINANCE_MANAGER'],
  [Tab.GENERAL_LEDGER]: ['ADMIN', 'FINANCE_MANAGER'],
  [Tab.STRATEGIC_ACCOUNTS]: ['ADMIN', 'FINANCE_MANAGER'],
  [Tab.STOCK_SUMMARY]: ['ADMIN', 'PHARMACIST', 'INVENTORY_MANAGER'],
  [Tab.PCD]: ['ADMIN', 'SALES_MANAGER'],
  [Tab.CRM]: ['ADMIN', 'SALES_MANAGER'],
  [Tab.OMS]: ['ADMIN', 'SALES_MANAGER', 'INVENTORY_MANAGER'],
  [Tab.SALES]: ['ADMIN', 'SALES_MANAGER', 'PHARMACIST'],
  [Tab.MANUFACTURING]: ['ADMIN', 'PHARMACIST', 'QC_MANAGER', 'INVENTORY_MANAGER'],
  [Tab.QC]: ['ADMIN', 'QC_MANAGER', 'PHARMACIST'],
  [Tab.R_AND_D]: ['ADMIN', 'PHARMACIST'],
  [Tab.LOGISTICS]: ['ADMIN', 'INVENTORY_MANAGER', 'SALES_MANAGER'],
  [Tab.ASSETS]: ['ADMIN', 'INVENTORY_MANAGER'],
  [Tab.DOCUMENTS]: ['ADMIN', 'PHARMACIST', 'QC_MANAGER'],
  [Tab.HRMS]: ['ADMIN', 'HR_MANAGER', 'FINANCE_MANAGER'],
  [Tab.EMPLOYEES]: ['ADMIN', 'SALES_MANAGER'],
  [Tab.REPORTS]: ['ADMIN', 'PHARMACIST', 'SALES_MANAGER'],
  [Tab.COMPLIANCE]: ['ADMIN', 'PHARMACIST', 'QC_MANAGER'],
  [Tab.AUDIT]: ['ADMIN'],
  [Tab.SETTINGS]: ['ADMIN'],
  [Tab.BUDGET]: ['ADMIN'],
  [Tab.MULTI_BRANCH]: ['ADMIN', 'INVENTORY_MANAGER'],

  [Tab.INTELLIGENCE_DASHBOARD]: ['ADMIN', 'PHARMACIST', 'SALES_MANAGER', 'INVENTORY_MANAGER'],
  [Tab.LEDGER_CREATION]: ['ADMIN', 'FINANCE_MANAGER'],
  [Tab.DEERFLOW_DASHBOARD]: ['ADMIN', 'HR_MANAGER', 'FINANCE_MANAGER', 'SALES_MANAGER'],
};

// Helper to create legacy fields for POS compatibility
const createProduct = (data: Partial<Product>): Product => {
  const primaryBatch = data.batches?.[0];
  return {
    ...data,
    source: data.source || 'TRADING', // Default to TRADING if not specified
    alias: data.alias || [], // Default to empty array if not specified
    // Map primary batch to top level for legacy POS compatibility
    batchNo: primaryBatch?.batchNumber || '',
    expiryDate: primaryBatch?.expiryDate || '',
    mrp: primaryBatch?.mrp || 0,
    rate: primaryBatch?.sellingRate || 0,
    stock: data.batches?.reduce((acc, b) => acc + b.stock, 0) || 0,
    totalStock: data.batches?.reduce((acc, b) => acc + b.stock, 0) || 0,
  } as Product;
};

export const MOCK_PRODUCTS: Product[] = [
  createProduct({
    id: '1',
    name: 'MetaMol 650',
    genericName: 'Paracetamol 650mg',
    manufacturer: 'Metapharsic Mfg',
    therapeuticCategory: 'Analgesic / Antipyretic',
    packing: '15 Tabs / Strip',
    uom: 'Strip',
    hsn: '3004',
    gst: 12,
    minStockLevel: 100,
    reorderLevel: 150,
    rack: 'A1',
    scheduleType: 'OTC',
    scheme: '10+1',
    batches: [
      { id: 'b1', batchNumber: 'B123', expiryDate: '2025-12-31', stock: 500, mrp: 30, purchaseRate: 20, sellingRate: 25, location: 'A1' },
      { id: 'b2', batchNumber: 'B129', expiryDate: '2024-10-15', stock: 120, mrp: 30, purchaseRate: 20, sellingRate: 25, location: 'A1' }
    ]
  }),
  createProduct({
    id: '2',
    name: 'MetaClav 625',
    genericName: 'Amoxicillin 500mg + Clavulanic Acid 125mg',
    manufacturer: 'Metapharsic Mfg',
    therapeuticCategory: 'Antibiotic',
    packing: '6 Tabs / Strip',
    uom: 'Strip',
    hsn: '3004',
    gst: 12,
    minStockLevel: 50,
    reorderLevel: 80,
    rack: 'B2',
    scheduleType: 'H1', // Compliance Required
    batches: [
      { id: 'b3', batchNumber: 'MC-202', expiryDate: '2024-06-30', stock: 45, mrp: 200, purchaseRate: 140, sellingRate: 180, location: 'B2' }
    ]
  }),
  createProduct({
    id: '3',
    name: 'MetaPan 40',
    genericName: 'Pantoprazole 40mg',
    manufacturer: 'Metapharsic Mfg',
    therapeuticCategory: 'Antacid / PPI',
    packing: '10 Tabs / Strip',
    uom: 'Strip',
    hsn: '3004',
    gst: 12,
    minStockLevel: 30,
    reorderLevel: 50,
    rack: 'A2',
    scheduleType: 'H',
    batches: [
      { id: 'b4', batchNumber: 'MP-99', expiryDate: '2025-08-15', stock: 120, mrp: 150, purchaseRate: 90, sellingRate: 130, location: 'A2' }
    ]
  }),
  createProduct({
    id: '4',
    name: 'Azithral 500',
    genericName: 'Azithromycin 500mg',
    manufacturer: 'Alembic',
    therapeuticCategory: 'Antibiotic',
    packing: '5 Tabs / Strip',
    uom: 'Strip',
    hsn: '3004',
    gst: 12,
    minStockLevel: 20,
    reorderLevel: 40,
    rack: 'C1',
    scheduleType: 'H1',
    scheme: '5+1',
    batches: [
      { id: 'b5', batchNumber: 'AZ-55', expiryDate: '2023-12-01', stock: 10, mrp: 120, purchaseRate: 80, sellingRate: 110, location: 'C1' }
    ]
  }),
  createProduct({
    id: '5',
    name: 'Shelcal 500',
    genericName: 'Calcium 500mg + Vitamin D3',
    manufacturer: 'Torrent',
    therapeuticCategory: 'Supplement',
    packing: '15 Tabs / Strip',
    uom: 'Strip',
    hsn: '3004',
    gst: 12,
    minStockLevel: 50,
    reorderLevel: 80,
    rack: 'D1',
    scheduleType: 'OTC',
    batches: [
      { id: 'b6', batchNumber: 'SC-88', expiryDate: '2026-01-20', stock: 300, mrp: 110, purchaseRate: 70, sellingRate: 95, location: 'D1' }
    ]
  }),
  createProduct({
    id: '6',
    name: 'Glycomet 500',
    genericName: 'Metformin 500mg',
    manufacturer: 'USV',
    therapeuticCategory: 'Antidiabetic',
    packing: '10 Tabs / Strip',
    uom: 'Strip',
    hsn: '3004',
    gst: 5,
    minStockLevel: 100,
    reorderLevel: 200,
    rack: 'E3',
    scheduleType: 'H',
    batches: [
      { id: 'b7', batchNumber: 'GM-12', expiryDate: '2025-11-11', stock: 200, mrp: 45, purchaseRate: 25, sellingRate: 38, location: 'E3' }
    ]
  }),
];

export const MOCK_INVOICES: SalesInvoice[] = [
  { 
    id: 'INV-001', 
    invoiceNumber: 'SI-2023-1001',
    customerName: 'John Doe', 
    customerMobile: '9876543210',
    date: '2023-10-26', 
    time: '14:30',
    items: [], 
    totalItems: 0,
    totalQuantity: 0,
    subTotal: 450,
    taxableValue: 450,
    totalDiscount: 0,
    totalGst: 0,
    roundOff: 0,
    netAmount: 450,
    paymentMode: 'UPI', 
    amountReceived: 450,
    balanceDue: 0,
    status: 'Completed' 
  },
  { 
    id: 'INV-002', 
    invoiceNumber: 'SI-2023-1002',
    customerName: 'Jane Roe', 
    customerMobile: '9123456780',
    date: '2023-10-26', 
    time: '15:45',
    items: [], 
    totalItems: 0,
    totalQuantity: 0,
    subTotal: 1200,
    taxableValue: 1200,
    totalDiscount: 0,
    totalGst: 0,
    roundOff: 0,
    netAmount: 1200,
    paymentMode: 'Card', 
    amountReceived: 1200,
    balanceDue: 0,
    status: 'Completed' 
  },
  { 
    id: 'INV-003', 
    invoiceNumber: 'SI-2023-1003',
    customerName: 'Alice Bob', 
    customerMobile: '9988776655',
    date: '2023-10-26', 
    time: '16:20',
    items: [], 
    totalItems: 0,
    totalQuantity: 0,
    subTotal: 80,
    taxableValue: 80,
    totalDiscount: 0,
    totalGst: 0,
    roundOff: 0,
    netAmount: 80,
    paymentMode: 'Cash', 
    amountReceived: 80,
    balanceDue: 0,
    status: 'Completed' 
  },
];

export const MOCK_SUPPLIERS: Supplier[] = [
  { id: 'S1', name: 'Apex Labs (Procurement)', contact: '9876543210', gstin: '29ABCDE1234F1Z5', outstanding: 15000, type: 'Goods', city: 'Pune' },
  { id: 'S2', name: 'Sanjeevani Agencies', contact: '9123456780', gstin: '29FGHIJ5678K1Z9', outstanding: 5400, type: 'Goods', city: 'Mumbai' },
  { id: 'S3', name: 'Global API Source', contact: '9988776655', gstin: '29KLMNO9876P1Z2', outstanding: 0, type: 'Raw Material', city: 'Hyderabad' },
  { id: 'S4', name: 'Pune Packaging Sol', contact: '9111122222', gstin: '29QRSTU1122V1Z3', outstanding: 2500, type: 'Raw Material', city: 'Pune' },
];

export const MOCK_PARTIES: Party[] = [
  {
    id: 'P1', name: 'Wellness Distributors', type: 'Debtor', gstin: '27AAAAA0000A1Z5', mobile: '9888877777', city: 'Pune', currentBalance: 27000, route: 'Route A - City',
    ledger: [
      { id: 'L1', date: '2023-10-25', voucherType: 'Sale', voucherNo: 'INV-5501', debit: 27000, credit: 0, balance: 27000 }
    ]
  },
  {
    id: 'P2', name: 'MediCare Franchise', type: 'Debtor', gstin: '27BBBBB0000B1Z5', mobile: '9777766666', city: 'Nashik', currentBalance: 120000, route: 'Route B - North',
    ledger: [
      { id: 'L2', date: '2023-10-24', voucherType: 'Sale', voucherNo: 'INV-5502', debit: 120000, credit: 0, balance: 120000 }
    ]
  },
  {
    id: 'S1', name: 'Apex Labs (Procurement)', type: 'Creditor', gstin: '29ABCDE1234F1Z5', mobile: '9876543210', city: 'Pune', currentBalance: -15000,
    ledger: [
      { id: 'L3', date: '2023-10-20', voucherType: 'Purchase', voucherNo: 'PUR-23-001', debit: 0, credit: 15000, balance: -15000 }
    ]
  }
];

export const MOCK_GST_REPORT: GSTReportEntry[] = [
  { hsn: '3004', description: 'Medicaments', taxRate: 12, taxableValue: 120000, cgst: 7200, sgst: 7200, igst: 0, totalTax: 14400 },
  { hsn: '3004', description: 'Medicaments (Low Tax)', taxRate: 5, taxableValue: 45000, cgst: 1125, sgst: 1125, igst: 0, totalTax: 2250 },
  { hsn: '9018', description: 'Surgical Instruments', taxRate: 18, taxableValue: 15000, cgst: 1350, sgst: 1350, igst: 0, totalTax: 2700 }
];

export const MOCK_PCD_PARTNERS: PCDPartner[] = [
  { id: 'PCD-001', name: 'Wellness Distributors', territory: 'Pune District', contact: '9888877777', email: 'wellness@example.com', drugLicenseNo: 'MH-PUN-2023001', status: 'Active', joinDate: '2023-01-15', assignedMrIds: ['MR-01'] },
  { id: 'PCD-002', name: 'MediCare Franchise', territory: 'Nashik Region', contact: '9777766666', email: 'medicare@example.com', drugLicenseNo: 'MH-NSK-2023055', status: 'Active', joinDate: '2023-03-10', assignedMrIds: ['MR-02'] },
  { id: 'PCD-003', name: 'LifeLine Pharma', territory: 'Mumbai South', contact: '9666655555', email: 'lifeline@example.com', drugLicenseNo: 'MH-MUM-2023112', status: 'Inactive', joinDate: '2022-11-20', assignedMrIds: ['MR-03'] },
];

export const MOCK_PCD_SCHEMES: PCDScheme[] = [
    { id: 'SCH-001', name: 'Winter Bonanza', description: 'Buy 100 Boxes of Cough Syrup, Get 10 Free + 2% Cash Discount', validUntil: '2023-12-31', type: 'Volume' },
    { id: 'SCH-002', name: 'New Launch Special', description: 'Flat 10% off on first order of MetaClav range', validUntil: '2023-11-30', type: 'Product' },
];

export const MOCK_MRS: MedicalRepresentative[] = [
    { 
      id: 'MR-01', name: 'Rohan Deshmukh', contact: '9898989898', email: 'rohan.d@metapharsic.com', 
      headquarters: 'Pune', assignedArea: 'Pune City & PCMC', 
      salesTarget: 500000, totalSales: 425000, targetAchievement: 85, status: 'Active', joinDate: '2022-05-12',
      baseSalary: 25000, incentives: 5000, deductions: 1200
    },
    { 
      id: 'MR-02', name: 'Amit Singh', contact: '9797979797', email: 'amit.s@metapharsic.com',
      headquarters: 'Nashik', assignedArea: 'Nashik & Ahmednagar', 
      salesTarget: 300000, totalSales: 276000, targetAchievement: 92, status: 'Active', joinDate: '2023-01-20',
      baseSalary: 22000, incentives: 3000, deductions: 1000
    },
    { 
      id: 'MR-03', name: 'Suresh Patil', contact: '9696969696', email: 'suresh.p@metapharsic.com',
      headquarters: 'Mumbai', assignedArea: 'Mumbai South', 
      salesTarget: 800000, totalSales: 560000, targetAchievement: 70, status: 'Active', joinDate: '2021-11-15',
      baseSalary: 28000, incentives: 6000, deductions: 1500
    },
    { 
      id: 'MR-04', name: 'Priya Kulkarni', contact: '9595959595', email: 'priya.k@metapharsic.com',
      headquarters: 'Nagpur', assignedArea: 'Nagpur Region', 
      salesTarget: 250000, totalSales: 255000, targetAchievement: 102, status: 'Active', joinDate: '2023-06-01',
      baseSalary: 20000, incentives: 2000, deductions: 800
    },
];

export const MOCK_TRANSACTIONS: SaleTransaction[] = [
  { id: '1', mrId: 'MR-01', date: '2023-10-25', chemist: 'Wellness Pharmacy', area: 'Pune City', productName: 'MetaMol 650', quantity: 500, amount: 25000, category: 'PCD', status: 'Verified' },
  { id: '2', mrId: 'MR-01', date: '2023-10-22', chemist: 'City Care Medicos', area: 'Pune City', productName: 'Azithral 500', quantity: 100, amount: 12400, category: 'Metapharsic', status: 'Verified' },
  { id: '3', mrId: 'MR-01', date: '2023-10-18', chemist: 'HealthPlus Store', area: 'Pune City', productName: 'MetaPan 40', quantity: 300, amount: 45000, category: 'PCD', status: 'Verified' },
  { id: '4', mrId: 'MR-01', date: '2023-10-10', chemist: 'Sai Krupa Medical', area: 'Pune City', productName: 'Glycomet 500', quantity: 200, amount: 8500, category: 'Metapharsic', status: 'Verified' },
  { id: '5', mrId: 'MR-02', date: '2023-10-20', chemist: 'Nashik Pharma', area: 'Nashik', productName: 'MetaMol 650', quantity: 600, amount: 15000, category: 'PCD', status: 'Verified' },
  { id: '6', mrId: 'MR-02', date: '2023-10-21', chemist: 'Nashik Pharma', area: 'Nashik', productName: 'MetaClav 625', quantity: 50, amount: 12000, category: 'Metapharsic', status: 'Verified' },
  { id: '7', mrId: 'MR-03', date: '2023-10-15', chemist: 'Mumbai Medicos', area: 'Mumbai South', productName: 'Shelcal 500', quantity: 1000, amount: 80000, category: 'PCD', status: 'Verified' },
  { id: '8', mrId: 'MR-04', date: '2023-10-12', chemist: 'Nagpur Central', area: 'Nagpur', productName: 'Azithral 500', quantity: 200, amount: 24000, category: 'Metapharsic', status: 'Verified' },
];

export const MOCK_PCD_TARGETS: PCDTarget[] = [
    { id: 'TGT-001', partnerId: 'PCD-001', partnerName: 'Wellness Distributors', period: 'Q3 2023', targetAmount: 500000, achievedAmount: 350000, incentivePercentage: 2, status: 'Pending' },
    { id: 'TGT-002', partnerId: 'PCD-002', partnerName: 'MediCare Franchise', period: 'Q3 2023', targetAmount: 300000, achievedAmount: 310000, incentivePercentage: 3, status: 'Achieved' },
];

export const MOCK_PURCHASES: Purchase[] = [
  {
    id: 'PUR-2023-001',
    invoiceNo: 'INV/23-24/550',
    supplierId: 'S1',
    supplierName: 'Apex Labs (Procurement)',
    date: '2023-10-20',
    totalAmount: 12500,
    status: 'Received',
    paymentStatus: 'Paid',
    items: [
      { productId: '1', productName: 'MetaMol 650', batchNo: 'B123', expiryDate: '2025-12-31', quantity: 500, purchaseRate: 25, mrp: 30, amount: 12500 }
    ]
  },
  {
    id: 'PUR-2023-002',
    invoiceNo: 'SAN/992',
    supplierId: 'S2',
    supplierName: 'Sanjeevani Agencies',
    date: '2023-10-22',
    totalAmount: 5400,
    status: 'Received',
    paymentStatus: 'Unpaid',
    items: [
      { productId: '2', productName: 'MetaClav 625', batchNo: 'B124', expiryDate: '2024-06-30', quantity: 30, purchaseRate: 160, mrp: 200, amount: 4800 },
      { productId: '4', productName: 'Azithral 500', batchNo: 'B126', expiryDate: '2023-12-01', quantity: 10, purchaseRate: 60, mrp: 120, amount: 600 }
    ]
  },
  {
    id: 'PUR-2023-003',
    invoiceNo: 'MAH/881',
    supplierId: 'S1',
    supplierName: 'Apex Labs (Procurement)',
    date: '2023-10-25',
    totalAmount: 2500,
    status: 'Received',
    paymentStatus: 'Unpaid',
    items: [
       { productId: '5', productName: 'Shelcal 500', batchNo: 'B129', expiryDate: '2026-02-15', quantity: 50, purchaseRate: 50, mrp: 110, amount: 2500 }
    ]
  }
];

export const MOCK_PURCHASE_RETURNS: PurchaseReturn[] = [
  {
    id: 'PR-001',
    returnNo: 'RET-23/001',
    date: '2023-10-28',
    supplierId: 'S1',
    supplierName: 'Apex Labs (Procurement)',
    referenceInvoiceNo: 'INV/23-24/550',
    totalAmount: 500,
    status: 'Completed',
    items: [
      {
        productId: '1',
        productName: 'MetaMol 650',
        batchNo: 'B123',
        quantity: 20,
        returnRate: 25,
        amount: 500,
        reason: 'Damaged'
      }
    ]
  }
];

export const MOCK_PAYMENTS: Payment[] = [
  { id: 'PAY-001', supplierId: 'S1', supplierName: 'Apex Labs (Procurement)', amount: 5000, date: '2023-10-21', mode: 'Bank Transfer', referenceNo: 'txn_123456', notes: 'Part payment for INV/550' },
  { id: 'PAY-002', supplierId: 'S2', supplierName: 'Sanjeevani Agencies', amount: 2000, date: '2023-10-23', mode: 'UPI', referenceNo: 'upi_987654' },
];

export const MOCK_SALES_DATA: SalesData[] = [
  { date: 'Oct 01', sales: 12000, profit: 3000 },
  { date: 'Oct 05', sales: 15000, profit: 3800 },
  { date: 'Oct 10', sales: 18000, profit: 4500 },
  { date: 'Oct 15', sales: 14000, profit: 3500 },
  { date: 'Oct 20', sales: 22000, profit: 5500 },
  { date: 'Oct 25', sales: 19000, profit: 4800 },
  { date: 'Oct 30', sales: 25000, profit: 6200 },
];

export const DASHBOARD_STATS = {
  todaySales: 15400,
  todayProfit: 3200,
  lowStockCount: 4,
  nearExpiryCount: 2,
  outstandingCredit: 8500,
  paymentSummary: {
    Cash: 4000,
    UPI: 8400,
    Card: 3000,
  }
};

// --- NEW ERP MOCK DATA ---

export const MOCK_RAW_MATERIALS: RawMaterial[] = [
  { id: 'RM-001', name: 'Paracetamol IP', casNumber: '103-90-2', currentStock: 500, uom: 'Kg', minStockLevel: 100, costPerUnit: 600 },
  { id: 'RM-002', name: 'Starch Paste', casNumber: '9005-25-8', currentStock: 200, uom: 'Kg', minStockLevel: 50, costPerUnit: 80 },
  { id: 'RM-003', name: 'Magnesium Stearate', casNumber: '557-04-0', currentStock: 50, uom: 'Kg', minStockLevel: 10, costPerUnit: 250 },
  { id: 'RM-004', name: 'PVC Film (Blister)', currentStock: 1000, uom: 'Kg', minStockLevel: 200, costPerUnit: 150 },
  { id: 'RM-005', name: 'Amoxicillin Trihydrate', casNumber: '61336-70-7', currentStock: 100, uom: 'Kg', minStockLevel: 20, costPerUnit: 2200 },
  { id: 'RM-006', name: 'Potassium Clavulanate', casNumber: '61177-45-5', currentStock: 30, uom: 'Kg', minStockLevel: 10, costPerUnit: 8000 },
];

export const MOCK_BOMS: BillOfMaterial[] = [
  {
    id: 'BOM-001',
    productId: '1', // MetaMol 650
    productName: 'MetaMol 650',
    batchSize: 100000, // tablets
    ingredients: [
      { materialId: 'RM-001', materialName: 'Paracetamol IP', quantityRequired: 65 }, // 65kg
      { materialId: 'RM-002', materialName: 'Starch Paste', quantityRequired: 5 },
      { materialId: 'RM-003', materialName: 'Magnesium Stearate', quantityRequired: 1 },
      { materialId: 'RM-004', materialName: 'PVC Film (Blister)', quantityRequired: 10 },
    ]
  }
];

export const MOCK_PRODUCTION_ORDERS: ProductionOrder[] = [
  {
    id: 'PROD-JOB-001',
    batchNumber: 'B130-MFG',
    productId: '1',
    productName: 'MetaMol 650',
    bomId: 'BOM-001',
    plannedQuantity: 100000,
    startDate: '2023-10-28',
    status: 'In Process',
    currentStage: 'Granulation'
  },
  {
    id: 'PROD-JOB-002',
    batchNumber: 'B131-MFG',
    productId: '2',
    productName: 'MetaClav 625',
    bomId: 'BOM-002',
    plannedQuantity: 50000,
    startDate: '2023-11-01',
    status: 'Planned',
    currentStage: 'Pending'
  }
];

export const MOCK_EXPENSES: Expense[] = [
  { id: 'EXP-001', category: 'Rent', description: 'Office & Warehouse Rent - Oct', amount: 45000, date: '2023-10-01', paidBy: 'Admin', paymentMode: 'Bank Transfer' },
  { id: 'EXP-002', category: 'Utilities', description: 'Electricity Bill', amount: 8500, date: '2023-10-05', paidBy: 'Admin', paymentMode: 'Bank Transfer' },
  { id: 'EXP-003', category: 'Logistics', description: 'Delivery Van Fuel', amount: 3200, date: '2023-10-10', paidBy: 'Cashier', paymentMode: 'Cash' },
  { id: 'EXP-004', category: 'Marketing', description: 'Diwali Gift Printing', amount: 12000, date: '2023-10-15', paidBy: 'Admin', paymentMode: 'Card' },
];

export const MOCK_TASKS: Task[] = [
  { id: 'T1', title: 'Renew Drug License 20B', priority: 'High', completed: false, category: 'Compliance', dueDate: '2024-12-31', description: 'Submit renewal application to CDSCO' },
  { id: 'T2', title: 'Call Supplier Apex Labs for Invoice 550', priority: 'Medium', completed: false, category: 'Accounts', dueDate: '2024-11-20', description: 'Follow up on pending payment' },
  { id: 'T3', title: 'Check Refrigerator Temp Log', priority: 'High', completed: true, category: 'Medical', dueDate: '2024-11-15', description: 'Daily cold chain monitoring' },
  { id: 'T4', title: 'Order Office Stationery', priority: 'Low', completed: false, category: 'General', dueDate: '2024-11-25', description: 'Stock up on printer paper and pens' },
  { id: 'T5', title: 'Update Inventory for Paracetamol', priority: 'High', completed: false, category: 'Inventory', dueDate: '2024-11-18', description: 'Reconcile physical stock with system' },
  { id: 'T6', title: 'Schedule MR Performance Review', priority: 'Medium', completed: false, category: 'HR', dueDate: '2024-11-22', description: 'Q4 performance evaluations' },
  { id: 'T7', title: 'Follow up on PCD Partner Leads', priority: 'High', completed: false, category: 'Sales', dueDate: '2024-11-19', description: 'Contact 5 new franchise inquiries' },
  { id: 'T8', title: 'GST Filing for October', priority: 'High', completed: true, category: 'Compliance', dueDate: '2024-11-11', description: 'Monthly GST return submission' },
];

export const MOCK_ASSETS: Asset[] = [
  { 
    id: 'A1', 
    name: 'Tablet Compression Machine', 
    category: 'Machinery', 
    modelNo: 'CMD-500', 
    serialNo: 'TCM-2345', 
    purchaseDate: '2022-05-10', 
    purchaseCost: 1500000, 
    currentValue: 1350000, 
    status: 'Active', 
    location: 'Production Unit 1', 
    department: 'Manufacturing',
    nextMaintenanceDate: '2023-11-15',
    warrantyExpiry: '2025-05-10',
    insuranceExpiry: '2024-05-10',
    insuranceValue: 1500000,
    insuranceCompany: 'ICICI Lombard',
    vendorId: 'V1',
    vendorName: 'PharmaTech Machinery Ltd',
    vendorContact: '9876543210',
    depreciationMethod: 'Written Down Value',
    depreciationRate: 15,
    usefulLife: 10,
    barcode: 'A1-BAR-001',
    qrCode: 'A1-QR-001',
    lastInspectionDate: '2023-10-15',
    inspectionFrequency: 'Monthly',
    criticality: 'High',
    assetTag: 'MCH-001',
    specifications: 'Capacity: 200,000 tablets/hr, Power: 15kW',
    installationDate: '2022-05-15',
    commissionDate: '2022-05-20',
    lastModified: '2023-10-20',
    modifiedBy: 'Admin'
  },
  { 
    id: 'A2', 
    name: 'Delivery Van', 
    category: 'Vehicle', 
    modelNo: 'Tata Ace', 
    serialNo: 'MH-12-KN-1234', 
    purchaseDate: '2021-08-20', 
    purchaseCost: 650000, 
    currentValue: 520000, 
    status: 'Active', 
    location: 'Warehouse', 
    department: 'Logistics',
    nextMaintenanceDate: '2023-12-01',
    warrantyExpiry: '2024-08-20',
    insuranceExpiry: '2024-02-20',
    insuranceValue: 650000,
    insuranceCompany: 'Bajaj Allianz',
    vendorId: 'V2',
    vendorName: 'Tata Motors',
    vendorContact: '9876543211',
    depreciationMethod: 'Straight Line',
    depreciationRate: 20,
    usefulLife: 5,
    barcode: 'A2-BAR-002',
    qrCode: 'A2-QR-002',
    lastInspectionDate: '2023-10-01',
    inspectionFrequency: 'Monthly',
    criticality: 'Medium',
    assetTag: 'VEH-001',
    specifications: 'Payload: 1000kg, Fuel: Diesel',
    installationDate: '2021-08-25',
    commissionDate: '2021-08-30',
    lastModified: '2023-10-15',
    modifiedBy: 'Admin'
  },
  { 
    id: 'A3', 
    name: 'Office Laptop', 
    category: 'IT', 
    modelNo: 'Dell Vostro', 
    serialNo: 'DL-998877', 
    purchaseDate: '2023-01-15', 
    purchaseCost: 55000, 
    currentValue: 48000, 
    status: 'Active', 
    location: 'Admin Office', 
    department: 'Administration',
    assignedTo: 'Rahul Verma',
    warrantyExpiry: '2026-01-15',
    vendorId: 'V3',
    vendorName: 'Dell Technologies',
    vendorContact: '9876543212',
    depreciationMethod: 'Straight Line',
    depreciationRate: 25,
    usefulLife: 4,
    barcode: 'A3-BAR-003',
    qrCode: 'A3-QR-003',
    lastInspectionDate: '2023-09-15',
    inspectionFrequency: 'Quarterly',
    criticality: 'Low',
    assetTag: 'IT-001',
    specifications: 'i5-11th Gen, 16GB RAM, 512GB SSD',
    installationDate: '2023-01-16',
    commissionDate: '2023-01-16',
    lastModified: '2023-10-10',
    modifiedBy: 'Admin'
  },
  { 
    id: 'A4', 
    name: 'Packing Machine', 
    category: 'Machinery', 
    modelNo: 'Blister Pack 200', 
    serialNo: 'BPM-1122', 
    purchaseDate: '2020-11-05', 
    purchaseCost: 800000, 
    currentValue: 550000, 
    status: 'Under Repair', 
    location: 'Packaging Unit', 
    department: 'Production',
    nextMaintenanceDate: '2023-10-30',
    warrantyExpiry: '2023-11-05',
    insuranceExpiry: '2024-11-05',
    insuranceValue: 800000,
    insuranceCompany: 'HDFC Ergo',
    vendorId: 'V1',
    vendorName: 'PharmaTech Machinery Ltd',
    vendorContact: '9876543210',
    depreciationMethod: 'Written Down Value',
    depreciationRate: 15,
    usefulLife: 10,
    barcode: 'A4-BAR-004',
    qrCode: 'A4-QR-004',
    lastInspectionDate: '2023-09-20',
    inspectionFrequency: 'Monthly',
    criticality: 'High',
    assetTag: 'MCH-002',
    specifications: 'Capacity: 200 blisters/min, Power: 8kW',
    installationDate: '2020-11-10',
    commissionDate: '2020-11-15',
    lastModified: '2023-10-25',
    modifiedBy: 'Admin'
  },
  { 
    id: 'A5', 
    name: 'HPLC Analyzer', 
    category: 'Lab Equipment', 
    modelNo: 'Agilent 1260', 
    serialNo: 'HPLC-5566', 
    purchaseDate: '2023-03-10', 
    purchaseCost: 1200000, 
    currentValue: 1150000, 
    status: 'Active', 
    location: 'QC Lab', 
    department: 'Quality Control',
    nextMaintenanceDate: '2024-03-10',
    warrantyExpiry: '2026-03-10',
    insuranceExpiry: '2024-03-10',
    insuranceValue: 1200000,
    insuranceCompany: 'New India Assurance',
    vendorId: 'V4',
    vendorName: 'Agilent Technologies',
    vendorContact: '9876543213',
    depreciationMethod: 'Written Down Value',
    depreciationRate: 10,
    usefulLife: 15,
    barcode: 'A5-BAR-005',
    qrCode: 'A5-QR-005',
    lastInspectionDate: '2023-10-05',
    inspectionFrequency: 'Quarterly',
    criticality: 'High',
    assetTag: 'LAB-001',
    specifications: 'Dual wavelength, Auto-sampler, 1260 Infinity',
    installationDate: '2023-03-15',
    commissionDate: '2023-03-20',
    lastModified: '2023-10-05',
    modifiedBy: 'Admin'
  },
  { 
    id: 'A6', 
    name: 'Production Line Conveyor', 
    category: 'Production Line', 
    modelNo: 'CONV-2000', 
    serialNo: 'PLC-7788', 
    purchaseDate: '2022-12-01', 
    purchaseCost: 2500000, 
    currentValue: 2200000, 
    status: 'Active', 
    location: 'Production Floor', 
    department: 'Manufacturing',
    nextMaintenanceDate: '2024-06-01',
    warrantyExpiry: '2027-12-01',
    insuranceExpiry: '2024-12-01',
    insuranceValue: 2500000,
    insuranceCompany: 'Bharti AXA',
    vendorId: 'V1',
    vendorName: 'PharmaTech Machinery Ltd',
    vendorContact: '9876543210',
    depreciationMethod: 'Written Down Value',
    depreciationRate: 12,
    usefulLife: 12,
    barcode: 'A6-BAR-006',
    qrCode: 'A6-QR-006',
    lastInspectionDate: '2023-09-25',
    inspectionFrequency: 'Monthly',
    criticality: 'High',
    assetTag: 'PROD-001',
    specifications: 'Length: 50m, Speed: 20m/min, Load: 500kg',
    installationDate: '2022-12-05',
    commissionDate: '2022-12-10',
    lastModified: '2023-09-25',
    modifiedBy: 'Admin'
  }
];

export const MOCK_MAINTENANCE_LOGS: MaintenanceRecord[] = [
  { 
    id: 'M1', 
    assetId: 'A1', 
    assetName: 'Tablet Compression Machine', 
    date: '2023-08-15', 
    type: 'Preventive', 
    description: 'Oil change and lubrication of all moving parts', 
    cost: 5000, 
    performedBy: 'Internal Tech',
    status: 'Completed',
    priority: 'High',
    laborHours: 4,
    vendorId: 'V1',
    vendorName: 'PharmaTech Machinery Ltd',
    attachments: ['maintenance_report_A1_20230815.pdf'],
    remarks: 'All parameters within normal range',
    createdBy: 'Maintenance Supervisor',
    createdAt: '2023-08-15T10:30:00'
  },
  { 
    id: 'M2', 
    assetId: 'A2', 
    assetName: 'Delivery Van', 
    date: '2023-09-10', 
    type: 'Repair', 
    description: 'Brake pad replacement and brake fluid change', 
    cost: 3500, 
    performedBy: 'Authorized Service Center',
    status: 'Completed',
    priority: 'High',
    partsReplaced: 'Front Brake Pads, Brake Fluid',
    laborHours: 3,
    vendorId: 'V2',
    vendorName: 'Tata Motors Service Center',
    warrantyClaim: true,
    attachments: ['service_invoice_A2_20230910.pdf', 'inspection_report.pdf'],
    remarks: 'Brake system functioning normally',
    createdBy: 'Fleet Manager',
    createdAt: '2023-09-10T14:15:00'
  },
  { 
    id: 'M3', 
    assetId: 'A4', 
    assetName: 'Packing Machine', 
    date: '2023-10-28', 
    type: 'Calibration', 
    description: 'Sensor calibration and weight verification', 
    cost: 2000, 
    performedBy: 'Vendor Tech',
    status: 'Completed',
    priority: 'Medium',
    laborHours: 2,
    vendorId: 'V1',
    vendorName: 'PharmaTech Machinery Ltd',
    nextScheduledDate: '2024-04-28',
    attachments: ['calibration_certificate_A4_20231028.pdf'],
    remarks: 'All sensors calibrated within ±0.1% tolerance',
    createdBy: 'Production Manager',
    createdAt: '2023-10-28T11:00:00'
  },
  { 
    id: 'M4', 
    assetId: 'A5', 
    assetName: 'HPLC Analyzer', 
    date: '2023-10-05', 
    type: 'Preventive', 
    description: 'Column replacement and system cleaning', 
    cost: 15000, 
    performedBy: 'Internal QC Team',
    status: 'Completed',
    priority: 'High',
    partsReplaced: 'C18 Column, Mobile Phase Filters',
    laborHours: 6,
    attachments: ['qc_maintenance_report_A5_20231005.pdf'],
    remarks: 'System performance verified with standard samples',
    createdBy: 'QC Manager',
    createdAt: '2023-10-05T16:45:00'
  },
  { 
    id: 'M5', 
    assetId: 'A6', 
    assetName: 'Production Line Conveyor', 
    date: '2023-09-25', 
    type: 'Inspection', 
    description: 'Monthly safety inspection and belt tension check', 
    cost: 1000, 
    performedBy: 'Internal Maintenance',
    status: 'Completed',
    priority: 'Medium',
    laborHours: 2,
    attachments: ['safety_inspection_report_A6_20230925.pdf'],
    remarks: 'All safety guards in place, belt tension optimal',
    createdBy: 'Maintenance Supervisor',
    createdAt: '2023-09-25T09:00:00'
  }
];

export const MOCK_FORMULATIONS: Formulation[] = [
  {
    id: 'F-001',
    productName: 'New PainRelief Fast',
    dosageForm: 'Tablet',
    stage: 'Pilot',
    version: '1.2',
    startDate: '2023-08-01',
    targetCost: 0.85,
    ingredients: [
      { materialId: 'RM-001', materialName: 'Paracetamol IP', quantity: 650, costPerUnit: 600 },
      { materialId: 'RM-002', materialName: 'Starch Paste', quantity: 50, costPerUnit: 80 }
    ]
  },
  {
    id: 'F-002',
    productName: 'MetaCough Syrup',
    dosageForm: 'Syrup',
    stage: 'Ideation',
    version: '0.1',
    startDate: '2023-10-15',
    targetCost: 12.0,
    ingredients: []
  }
];

export const MOCK_EXPERIMENTS: Experiment[] = [
  {
    id: 'EXP-101',
    formulationId: 'F-001',
    formulationName: 'New PainRelief Fast',
    testName: 'Accelerated Stability (1M)',
    startDate: '2023-09-01',
    endDate: '2023-10-01',
    status: 'Completed',
    resultData: 'Passed. No significant degradation.',
    assignedTo: 'Dr. Singh'
  },
  {
    id: 'EXP-102',
    formulationId: 'F-001',
    formulationName: 'New PainRelief Fast',
    testName: 'Dissolution Profile',
    startDate: '2023-10-20',
    endDate: '2023-10-22',
    status: 'In Progress',
    assignedTo: 'Priya K'
  }
];

export const MOCK_VENDORS: Vendor[] = [
  {
    id: 'V1',
    name: 'PharmaTech Machinery Ltd',
    contactPerson: 'Rajesh Kumar',
    email: 'rajesh@pharmatech.com',
    phone: '9876543210',
    address: 'Plot 123, Industrial Area, Pune - 411028',
    category: 'Equipment',
    rating: 4.8,
    status: 'Active',
    contractExpiry: '2025-12-31',
    servicesProvided: ['Installation', 'Maintenance', 'Calibration', 'Repair'],
    lastServiceDate: '2023-10-28',
    totalSpent: 185000,
    createdAt: '2022-01-15',
    updatedAt: '2023-10-28'
  },
  {
    id: 'V2',
    name: 'Tata Motors Service Center',
    contactPerson: 'Suresh Patil',
    email: 'suresh@tatamotors.com',
    phone: '9876543211',
    address: 'Auto Nagar, Mumbai - 400001',
    category: 'Vehicle',
    rating: 4.5,
    status: 'Active',
    contractExpiry: '2024-06-30',
    servicesProvided: ['Vehicle Service', 'Repairs', 'Spare Parts', 'Insurance Claims'],
    lastServiceDate: '2023-09-10',
    totalSpent: 3500,
    createdAt: '2021-05-20',
    updatedAt: '2023-09-10'
  },
  {
    id: 'V3',
    name: 'Dell Technologies',
    contactPerson: 'Priya Sharma',
    email: 'priya@dell.com',
    phone: '9876543212',
    address: 'Tech Park, Bangalore - 560001',
    category: 'IT',
    rating: 4.7,
    status: 'Active',
    servicesProvided: ['Hardware Supply', 'Setup', 'Warranty Service', 'Upgrades'],
    lastServiceDate: '2023-01-15',
    totalSpent: 55000,
    createdAt: '2023-01-10',
    updatedAt: '2023-01-15'
  },
  {
    id: 'V4',
    name: 'Agilent Technologies',
    contactPerson: 'Amit Desai',
    email: 'amit@agilent.com',
    phone: '9876543213',
    address: 'Scientific Complex, Hyderabad - 500001',
    category: 'Maintenance',
    rating: 4.9,
    status: 'Active',
    contractExpiry: '2026-03-31',
    servicesProvided: ['Calibration', 'Preventive Maintenance', 'Technical Support', 'Training'],
    lastServiceDate: '2023-10-05',
    totalSpent: 15000,
    createdAt: '2023-02-20',
    updatedAt: '2023-10-05'
  }
];

export const MOCK_INSURANCE_POLICIES: InsurancePolicy[] = [
  {
    id: 'IP1',
    assetId: 'A1',
    assetName: 'Tablet Compression Machine',
    policyNumber: 'ICICI/TCM/2022/001',
    insuranceCompany: 'ICICI Lombard',
    policyType: 'Comprehensive',
    coverageAmount: 1500000,
    premiumAmount: 15000,
    startDate: '2022-05-10',
    expiryDate: '2024-05-10',
    renewalDate: '2024-04-10',
    status: 'Active',
    claimHistory: [],
    createdAt: '2022-05-05',
    updatedAt: '2023-10-15'
  },
  {
    id: 'IP2',
    assetId: 'A2',
    assetName: 'Delivery Van',
    policyNumber: 'BAJAJ/DV/2021/001',
    insuranceCompany: 'Bajaj Allianz',
    policyType: 'Comprehensive',
    coverageAmount: 650000,
    premiumAmount: 19500,
    startDate: '2021-08-20',
    expiryDate: '2024-02-20',
    renewalDate: '2024-01-20',
    status: 'Pending Renewal',
    claimHistory: [
      {
        id: 'CL1',
        policyId: 'IP2',
        claimDate: '2023-09-15',
        claimAmount: 2500,
        settledAmount: 2000,
        status: 'Settled',
        description: 'Windshield replacement due to stone damage',
        documents: ['claim_form.pdf', 'repair_invoice.pdf'],
        settledDate: '2023-09-25',
        remarks: 'Claim settled after verification'
      }
    ],
    createdAt: '2021-08-15',
    updatedAt: '2023-09-25'
  },
  {
    id: 'IP3',
    assetId: 'A5',
    assetName: 'HPLC Analyzer',
    policyNumber: 'NEWINDIA/HPLC/2023/001',
    insuranceCompany: 'New India Assurance',
    policyType: 'Comprehensive',
    coverageAmount: 1200000,
    premiumAmount: 12000,
    startDate: '2023-03-10',
    expiryDate: '2024-03-10',
    renewalDate: '2024-02-10',
    status: 'Active',
    claimHistory: [],
    createdAt: '2023-03-05',
    updatedAt: '2023-10-05'
  }
];

export const MOCK_ASSET_TRANSFERS: AssetTransfer[] = [
  {
    id: 'AT1',
    assetId: 'A3',
    assetName: 'Office Laptop',
    fromLocation: 'Admin Office',
    toLocation: 'Quality Control Lab',
    fromDepartment: 'Administration',
    toDepartment: 'Quality Control',
    transferDate: '2023-10-10',
    reason: 'Required for QC data analysis',
    approvedBy: 'Quality Manager',
    status: 'Completed',
    remarks: 'Transferred for specialized software installation'
  },
  {
    id: 'AT2',
    assetId: 'A6',
    assetName: 'Production Line Conveyor',
    fromLocation: 'Production Floor',
    toLocation: 'Production Floor - New Section',
    fromDepartment: 'Manufacturing',
    toDepartment: 'Manufacturing',
    transferDate: '2023-09-30',
    reason: 'Relocation for new product line setup',
    approvedBy: 'Production Manager',
    status: 'Completed',
    remarks: 'Moved to accommodate new packaging line'
  }
];

export const MOCK_ASSET_ALERTS: AssetAlert[] = [
  {
    id: 'AL1',
    assetId: 'A2',
    assetName: 'Delivery Van',
    type: 'Insurance Expiry',
    message: 'Vehicle insurance expires in 30 days',
    priority: 'High',
    dueDate: '2024-02-20',
    status: 'Active',
    createdAt: '2023-10-25'
  },
  {
    id: 'AL2',
    assetId: 'A1',
    assetName: 'Tablet Compression Machine',
    type: 'Maintenance Due',
    message: 'Scheduled maintenance due in 15 days',
    priority: 'Medium',
    dueDate: '2023-11-15',
    status: 'Active',
    createdAt: '2023-10-30'
  },
  {
    id: 'AL3',
    assetId: 'A4',
    assetName: 'Packing Machine',
    type: 'Warranty Expiry',
    message: 'Warranty expires in 60 days',
    priority: 'Medium',
    dueDate: '2023-11-05',
    status: 'Active',
    createdAt: '2023-10-05'
  }
];

export const MOCK_DISTRIBUTOR_ORDERS: DistributorOrder[] = [
  {
    id: 'ORD-5501',
    distributorId: 'PCD-001',
    distributorName: 'Wellness Distributors',
    date: '2023-10-25',
    packingSpecs: 'Use extra bubble wrap for liquids. Do not stack more than 5 boxes.',
    labelingSpecs: 'Print "FRAGILE" on all sides.',
    items: [
      { productId: '1', productName: 'MetaMol 650', quantity: 500, approvedQuantity: 500, rate: 22, amount: 11000 },
      { productId: '2', productName: 'MetaClav 625', quantity: 100, approvedQuantity: 100, rate: 160, amount: 16000 }
    ],
    totalAmount: 27000,
    status: 'Pending Approval',
    priority: 'Normal',
    creditStatus: 'Clear'
  },
  {
    id: 'ORD-5502',
    distributorId: 'PCD-002',
    distributorName: 'MediCare Franchise',
    date: '2023-10-24',
    packingSpecs: 'Standard 7-ply Corrugated Box.',
    labelingSpecs: 'Include Distributor Name on label.',
    items: [
      { productId: '3', productName: 'MetaPan 40', quantity: 1000, approvedQuantity: 950, rate: 120, amount: 120000 }
    ],
    totalAmount: 120000,
    status: 'Approved',
    priority: 'High',
    creditStatus: 'Clear'
  },
  {
    id: 'ORD-5503',
    distributorId: 'PCD-003',
    distributorName: 'LifeLine Pharma',
    date: '2023-10-22',
    items: [
      { productId: '6', productName: 'Glycomet 500', quantity: 200, approvedQuantity: 200, rate: 35, amount: 7000 }
    ],
    totalAmount: 7000,
    status: 'Shipped',
    priority: 'Normal',
    creditStatus: 'Limit Exceeded'
  }
];
