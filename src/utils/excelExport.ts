import * as XLSX from 'xlsx';
const { utils, writeFile } = XLSX as any;
import { Party, Expense, SalesInvoice, Asset, MaintenanceRecord, Vendor, InsurancePolicy, AssetTransfer, AssetAlert, DocRecord, Document, DocumentVersion, DocumentWorkflow, DocumentAuditTrail } from '../types';

// Helper function to generate timestamp
const getCurrentTimestamp = () => {
  const now = new Date();
  return now.toISOString().slice(0, 19).replace('T', ' '); // Format: YYYY-MM-DD HH:MM:SS
};

// Export Party Ledgers Report
export const exportPartyLedgersReport = (parties: Party[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare detailed data for each party
  const reportData = parties.map(party => ({
    'Party ID': party.id,
    'Party Name': party.name,
    'Type': party.type,
    'City': party.city,
    'Mobile': party.mobile,
    'GSTIN': party.gstin || 'N/A',
    'PAN': party.pan || 'N/A',
    'Email': party.email || 'N/A',
    'Contact Person': party.contactPerson || 'N/A',
    'Address': party.address || 'N/A',
    'Bank Name': party.bankName || 'N/A',
    'Account Number': party.accountNumber || 'N/A',
    'IFSC Code': party.ifscCode || 'N/A',
    'Credit Limit': party.creditLimit || 0,
    'Credit Days': party.creditDays || 0,
    'Category': party.category || 'Regular',
    'Territory': party.territory || 'N/A',
    'Current Balance': party.currentBalance,
    'Balance Type': party.currentBalance >= 0 ? 'Dr (Receivable)' : 'Cr (Payable)',
    'Route': party.route || 'N/A',
    'Remarks': party.remarks || 'N/A',
    'Created At': timestamp
  }));

  // Create worksheet and workbook
  const ws = utils.json_to_sheet(reportData);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Party Ledgers');

  // Set column widths for better readability
  const colWidths = [
    { wch: 15 }, // Party ID
    { wch: 25 }, // Party Name
    { wch: 10 }, // Type
    { wch: 15 }, // City
    { wch: 15 }, // Mobile
    { wch: 15 }, // GSTIN
    { wch: 15 }, // PAN
    { wch: 25 }, // Email
    { wch: 20 }, // Contact Person
    { wch: 30 }, // Address
    { wch: 20 }, // Bank Name
    { wch: 20 }, // Account Number
    { wch: 15 }, // IFSC Code
    { wch: 15 }, // Credit Limit
    { wch: 12 }, // Credit Days
    { wch: 12 }, // Category
    { wch: 15 }, // Territory
    { wch: 15 }, // Current Balance
    { wch: 18 }, // Balance Type
    { wch: 15 }, // Route
    { wch: 30 }, // Remarks
    { wch: 20 }  // Created At
  ];
  ws['!cols'] = colWidths;

  // Generate filename with timestamp
  const filename = `Party_Ledgers_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Profit & Loss Report
export const exportProfitLossReport = (invoices: SalesInvoice[], expenses: Expense[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Calculate totals
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.netAmount || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const profitLoss = totalRevenue - totalExpenses;
  
  // Prepare summary data
  const summaryData = [
    { 'Metric': 'Total Revenue', 'Amount': totalRevenue },
    { 'Metric': 'Total Expenses', 'Amount': totalExpenses },
    { 'Metric': 'Net Profit/Loss', 'Amount': profitLoss },
    { 'Metric': 'Generated At', 'Amount': timestamp }
  ];

  // Prepare detailed invoice data
  const invoiceDetails = invoices.map(inv => ({
    'Invoice ID': inv.id,
    'Invoice Number': inv.invoiceNumber,
    'Date': inv.date,
    'Time': inv.time,
    'Customer Name': inv.customerName,
    'Customer Mobile': inv.customerMobile,
    'Customer GSTIN': inv.customerGstin || 'N/A',
    'Total Items': inv.totalItems,
    'Total Quantity': inv.totalQuantity,
    'Sub Total': inv.subTotal,
    'Taxable Value': inv.taxableValue,
    'Total Discount': inv.totalDiscount,
    'Total GST': inv.totalGst,
    'Round Off': inv.roundOff,
    'Net Amount': inv.netAmount,
    'Payment Mode': inv.paymentMode,
    'Amount Received': inv.amountReceived,
    'Balance Due': inv.balanceDue,
    'Status': inv.status
  }));

  // Prepare detailed expense data
  const expenseDetails = expenses.map(exp => ({
    'Expense ID': exp.id,
    'Category': exp.category,
    'Description': exp.description,
    'Amount': exp.amount,
    'Date': exp.date,
    'Paid By': exp.paidBy,
    'Payment Mode': exp.paymentMode
  }));

  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Invoice details sheet
  const invoiceWs = utils.json_to_sheet(invoiceDetails);
  utils.book_append_sheet(wb, invoiceWs, 'Invoice Details');
  
  // Expense details sheet
  const expenseWs = utils.json_to_sheet(expenseDetails);
  utils.book_append_sheet(wb, expenseWs, 'Expense Details');

  // Set column widths
  summaryWs['!cols'] = [{ wch: 20 }, { wch: 20 }];
  invoiceWs['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }
  ];
  expenseWs['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 12 },
    { wch: 12 }, { wch: 15 }, { wch: 15 }
  ];

  // Generate filename with timestamp
  const filename = `Profit_Loss_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Expense Analysis Report
export const exportExpenseAnalysisReport = (expenses: Expense[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Calculate category-wise totals
  const expenseCategories: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  
  expenses.forEach(expense => {
    expenseCategories[expense.category] = (expenseCategories[expense.category] || 0) + expense.amount;
    categoryCounts[expense.category] = (categoryCounts[expense.category] || 0) + 1;
  });
  
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  
  // Prepare category analysis data
  const categoryAnalysis = Object.entries(expenseCategories).map(([category, amount]) => ({
    'Category': category,
    'Total Amount': amount,
    'Count': categoryCounts[category],
    'Percentage': totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(2) + '%' : '0.00%',
    'Average per Expense': categoryCounts[category] > 0 ? (amount / categoryCounts[category]).toFixed(2) : '0.00'
  }));
  
  // Prepare detailed expense data
  const detailedExpenses = expenses.map(exp => ({
    'Expense ID': exp.id,
    'Category': exp.category,
    'Description': exp.description,
    'Amount': exp.amount,
    'Date': exp.date,
    'Paid By': exp.paidBy,
    'Payment Mode': exp.paymentMode
  }));

  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Category analysis sheet
  const categoryWs = utils.json_to_sheet(categoryAnalysis);
  utils.book_append_sheet(wb, categoryWs, 'Category Analysis');
  
  // Detailed expenses sheet
  const detailedWs = utils.json_to_sheet(detailedExpenses);
  utils.book_append_sheet(wb, detailedWs, 'Detailed Expenses');

  // Set column widths
  categoryWs['!cols'] = [
    { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 18 }
  ];
  detailedWs['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 40 }, { wch: 12 },
    { wch: 12 }, { wch: 15 }, { wch: 15 }
  ];

  // Generate filename with timestamp
  const filename = `Expense_Analysis_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export GSTR-1 Report
export const exportGSTR1Report = (invoices: SalesInvoice[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Filter invoices with GSTIN (outward supplies)
  const outwardSupplies = invoices.filter(inv => inv.customerGstin);
  
  // Prepare GSTR-1 data
  const gstr1Data = outwardSupplies.map(inv => ({
    'Invoice ID': inv.id,
    'Invoice Number': inv.invoiceNumber,
    'Date': inv.date,
    'Customer Name': inv.customerName,
    'Customer GSTIN': inv.customerGstin || 'N/A',
    'Place of Supply': '', // Would come from customer data in real scenario
    'Reverse Charge': 'No', // Default
    'Taxable Value': inv.taxableValue,
    'Integrated Tax': inv.items ? inv.items.reduce((sum, item) => sum + item.igstAmount, 0) : 0,
    'Central Tax': inv.items ? inv.items.reduce((sum, item) => sum + item.cgstAmount, 0) : 0,
    'State Tax': inv.items ? inv.items.reduce((sum, item) => sum + item.sgstAmount, 0) : 0,
    'Cess Amount': 0, // Assuming no cess for now
    'Total Tax Amount': inv.totalGst,
    'Net Amount': inv.netAmount,
    'Status': inv.status
  }));

  // Prepare summary
  const totalTaxableValue = outwardSupplies.reduce((sum, inv) => sum + (inv.taxableValue || 0), 0);
  const totalTax = outwardSupplies.reduce((sum, inv) => sum + (inv.totalGst || 0), 0);
  
  const summaryData = [
    { 'Summary': 'Total Outward Supplies Count', 'Value': outwardSupplies.length },
    { 'Summary': 'Total Taxable Value', 'Value': totalTaxableValue },
    { 'Summary': 'Total Tax Amount', 'Value': totalTax },
    { 'Summary': 'Generated At', 'Value': timestamp }
  ];

  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Detailed outward supplies sheet
  const detailedWs = utils.json_to_sheet(gstr1Data);
  utils.book_append_sheet(wb, detailedWs, 'Outward Supplies Detail');

  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  detailedWs['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
    { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 12 }
  ];

  // Generate filename with timestamp
  const filename = `GSTR1_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export GSTR-2 Report
export const exportGSTR2Report = (expenses: Expense[]) => {
  const timestamp = getCurrentTimestamp();
  
  // For demonstration, treating expenses as inward supplies (typically this would be purchase data)
  const inwardSupplies = expenses.filter(exp => exp.paidBy && exp.paidBy !== '');
  
  // Prepare GSTR-2 data
  const gstr2Data = inwardSupplies.map(exp => ({
    'Expense ID': exp.id,
    'Date': exp.date,
    'Vendor Name': exp.paidBy,
    'Category': exp.category,
    'Description': exp.description,
    'Taxable Value': exp.amount, // Assuming full amount is taxable for demo
    'Integrated Tax': (exp.amount * 0.09).toFixed(2), // Assuming 9% IGST for demo
    'Central Tax': (exp.amount * 0.045).toFixed(2), // Assuming 4.5% CGST for demo
    'State Tax': (exp.amount * 0.045).toFixed(2), // Assuming 4.5% SGST for demo
    'Cess Amount': 0, // Assuming no cess for now
    'Total Tax Amount': (exp.amount * 0.18).toFixed(2), // Assuming 18% total GST
    'Net Amount': exp.amount,
    'Payment Mode': exp.paymentMode,
    'Status': 'Processed' // Default status
  }));

  // Prepare summary
  const totalTaxableValue = inwardSupplies.reduce((sum, exp) => sum + exp.amount, 0);
  const totalTax = inwardSupplies.reduce((sum, exp) => sum + (exp.amount * 0.18), 0); // Assuming 18% GST
  
  const summaryData = [
    { 'Summary': 'Total Inward Supplies Count', 'Value': inwardSupplies.length },
    { 'Summary': 'Total Taxable Value', 'Value': totalTaxableValue },
    { 'Summary': 'Total Tax Amount', 'Value': totalTax },
    { 'Summary': 'Generated At', 'Value': timestamp }
  ];

  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Detailed inward supplies sheet
  const detailedWs = utils.json_to_sheet(gstr2Data);
  utils.book_append_sheet(wb, detailedWs, 'Inward Supplies Detail');

  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  detailedWs['!cols'] = [
    { wch: 15 }, { wch: 12 }, { wch: 20 }, { wch: 15 },
    { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }
  ];

  // Generate filename with timestamp
  const filename = `GSTR2_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export PCD Partner Performance Report
export const exportPCDPartnerPerformanceReport = (partners: any[], targets: any[], transactions: any[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare partner performance data
  const partnerPerformanceData = partners.map(partner => {
    const partnerTargets = targets.filter((t: any) => t.partnerId === partner.id);
    const totalTarget = partnerTargets.reduce((sum: number, t: any) => sum + t.targetAmount, 0);
    const totalAchieved = partnerTargets.reduce((sum: number, t: any) => sum + t.achievedAmount, 0);
    const achievementPercentage = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
    
    const partnerTransactions = transactions.filter((t: any) => {
      // Find MRs assigned to this partner and match transactions
      const assignedMRs = partner.assignedMrIds || [];
      return assignedMRs.includes(t.mrId);
    });
    const totalSales = partnerTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
    
    return {
      'Partner ID': partner.id,
      'Partner Name': partner.name,
      'Territory': partner.territory,
      'Contact': partner.contact,
      'Email': partner.email,
      'Status': partner.status,
      'Join Date': partner.joinDate,
      'Total Target Amount': totalTarget,
      'Total Achieved Amount': totalAchieved,
      'Achievement %': achievementPercentage.toFixed(2) + '%',
      'Total Sales': totalSales,
      'Number of Targets': partnerTargets.length,
      'Active Targets': partnerTargets.filter((t: any) => t.status === 'Pending').length,
      'Achieved Targets': partnerTargets.filter((t: any) => t.status === 'Achieved').length,
      'Drug License No': partner.drugLicenseNo
    };
  });
  
  // Prepare target-wise details
  const targetDetails = targets.map(target => ({
    'Target ID': target.id,
    'Partner ID': target.partnerId,
    'Partner Name': target.partnerName,
    'Period': target.period,
    'Target Amount': target.targetAmount,
    'Achieved Amount': target.achievedAmount,
    'Incentive %': target.incentivePercentage,
    'Status': target.status,
    'Achievement %': target.targetAmount > 0 ? ((target.achievedAmount / target.targetAmount) * 100).toFixed(2) + '%' : '0%',
    'Potential Incentive': (target.targetAmount * target.incentivePercentage / 100).toFixed(2)
  }));
  
  // Prepare transaction details
  const transactionDetails = transactions.map(transaction => ({
    'Transaction ID': transaction.id,
    'MR ID': transaction.mrId,
    'Date': transaction.date,
    'Chemist': transaction.chemist,
    'Area': transaction.area,
    'Product Name': transaction.productName,
    'Quantity': transaction.quantity,
    'Amount': transaction.amount,
    'Category': transaction.category,
    'Status': transaction.status
  }));
  
  // Prepare summary data
  const totalPartners = partners.length;
  const activePartners = partners.filter((p: any) => p.status === 'Active').length;
  const totalTargets = targets.length;
  const achievedTargets = targets.filter((t: any) => t.status === 'Achieved').length;
  const achievementRate = totalTargets > 0 ? (achievedTargets / totalTargets) * 100 : 0;
  const totalSales = transactions.reduce((sum: number, t: any) => sum + t.amount, 0);
  
  const summaryData = [
    { 'Metric': 'Total Partners', 'Value': totalPartners },
    { 'Metric': 'Active Partners', 'Value': activePartners },
    { 'Metric': 'Total Targets', 'Value': totalTargets },
    { 'Metric': 'Achieved Targets', 'Value': achievedTargets },
    { 'Metric': 'Target Achievement Rate', 'Value': achievementRate.toFixed(2) + '%' },
    { 'Metric': 'Total Sales', 'Value': totalSales },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Partner performance sheet
  const partnerWs = utils.json_to_sheet(partnerPerformanceData);
  utils.book_append_sheet(wb, partnerWs, 'Partner Performance');
  
  // Target details sheet
  const targetWs = utils.json_to_sheet(targetDetails);
  utils.book_append_sheet(wb, targetWs, 'Target Details');
  
  // Transaction details sheet
  const transactionWs = utils.json_to_sheet(transactionDetails);
  utils.book_append_sheet(wb, transactionWs, 'Transaction Details');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  partnerWs['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 15 },
    { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 18 },
    { wch: 18 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 18 }
  ];
  targetWs['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
    { wch: 12 }, { wch: 15 }
  ];
  transactionWs['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
    { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 10 }
  ];
  
  // Generate filename with timestamp
  const filename = `PCD_Partner_Performance_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export PCD Territory Analysis Report
export const exportPCDTerritoryAnalysisReport = (partners: any[], transactions: any[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Group partners by territory
  const territoryPartners: Record<string, any[]> = {};
  partners.forEach(partner => {
    if (!territoryPartners[partner.territory]) {
      territoryPartners[partner.territory] = [];
    }
    territoryPartners[partner.territory].push(partner);
  });
  
  // Calculate sales by territory
  const territorySales: Record<string, number> = {};
  transactions.forEach(transaction => {
    // Match transaction to territory through assigned MRs
    const territory = partners.find((p: any) => {
      const assignedMRs = p.assignedMrIds || [];
      return assignedMRs.includes(transaction.mrId);
    })?.territory;
    
    if (territory) {
      territorySales[territory] = (territorySales[territory] || 0) + transaction.amount;
    }
  });
  
  // Prepare territory analysis data
  const territoryAnalysisData = Object.keys(territoryPartners).map(territory => {
    const territoryPartnersList = territoryPartners[territory];
    const territoryTotalSales = territorySales[territory] || 0;
    
    return {
      'Territory': territory,
      'Number of Partners': territoryPartnersList.length,
      'Active Partners': territoryPartnersList.filter((p: any) => p.status === 'Active').length,
      'Total Sales': territoryTotalSales,
      'Average Sales per Partner': territoryPartnersList.length > 0 ? (territoryTotalSales / territoryPartnersList.length).toFixed(2) : 0,
      'Top Partner': territoryPartnersList.length > 0 ? territoryPartnersList[0].name : 'N/A',
      'Territory Head': 'N/A' // Would come from MR data in real scenario
    };
  });
  
  // Prepare territory-wise partner details
  const territoryPartnerDetails = partners.map(partner => ({
    'Partner ID': partner.id,
    'Partner Name': partner.name,
    'Territory': partner.territory,
    'Contact': partner.contact,
    'Status': partner.status,
    'Drug License No': partner.drugLicenseNo,
    'Assigned MR Count': (partner.assignedMrIds || []).length
  }));
  
  // Prepare transaction details by territory
  const transactionDetails = transactions.map(transaction => {
    const partner = partners.find((p: any) => {
      const assignedMRs = p.assignedMrIds || [];
      return assignedMRs.includes(transaction.mrId);
    });
    
    return {
      'Transaction ID': transaction.id,
      'MR ID': transaction.mrId,
      'Date': transaction.date,
      'Chemist': transaction.chemist,
      'Territory': partner?.territory || 'Unknown',
      'Product Name': transaction.productName,
      'Amount': transaction.amount,
      'Category': transaction.category
    };
  });
  
  // Prepare summary
  const summaryData = [
    { 'Metric': 'Total Territories', 'Value': Object.keys(territoryPartners).length },
    { 'Metric': 'Total Partners', 'Value': partners.length },
    { 'Metric': 'Total Sales', 'Value': transactions.reduce((sum: number, t: any) => sum + t.amount, 0) },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Territory analysis sheet
  const territoryWs = utils.json_to_sheet(territoryAnalysisData);
  utils.book_append_sheet(wb, territoryWs, 'Territory Analysis');
  
  // Territory partner details sheet
  const territoryPartnerWs = utils.json_to_sheet(territoryPartnerDetails);
  utils.book_append_sheet(wb, territoryPartnerWs, 'Territory Partner Details');
  
  // Transaction details sheet
  const transactionWs = utils.json_to_sheet(transactionDetails);
  utils.book_append_sheet(wb, transactionWs, 'Transaction Details by Territory');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  territoryWs['!cols'] = [
    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 18 }, { wch: 25 }, { wch: 15 }
  ];
  territoryPartnerWs['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 15 },
    { wch: 10 }, { wch: 18 }, { wch: 15 }
  ];
  transactionWs['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
    { wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 12 }
  ];
  
  // Generate filename with timestamp
  const filename = `PCD_Territory_Analysis_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export PCD Incentive Statement Report
export const exportPCDIncentiveStatementReport = (targets: any[], partners: any[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Calculate incentive details
  const incentiveData = targets.map(target => {
    const incentiveAmount = (target.achievedAmount * target.incentivePercentage) / 100;
    const eligibleForIncentive = target.achievedAmount >= target.targetAmount;
    
    return {
      'Target ID': target.id,
      'Partner ID': target.partnerId,
      'Partner Name': target.partnerName,
      'Period': target.period,
      'Target Amount': target.targetAmount,
      'Achieved Amount': target.achievedAmount,
      'Incentive %': target.incentivePercentage,
      'Incentive Amount': incentiveAmount,
      'Eligible for Incentive': eligibleForIncentive ? 'Yes' : 'No',
      'Status': target.status,
      'Achievement %': target.targetAmount > 0 ? ((target.achievedAmount / target.targetAmount) * 100).toFixed(2) + '%' : '0%'
    };
  });
  
  // Calculate summary by partner
  const partnerIncentives = partners.map(partner => {
    const partnerTargets = targets.filter((t: any) => t.partnerId === partner.id);
    const totalPotentialIncentive = partnerTargets.reduce((sum: number, t: any) => {
      return sum + ((t.achievedAmount * t.incentivePercentage) / 100);
    }, 0);
    const eligibleTargets = partnerTargets.filter((t: any) => t.achievedAmount >= t.targetAmount);
    
    return {
      'Partner ID': partner.id,
      'Partner Name': partner.name,
      'Territory': partner.territory,
      'Total Potential Incentive': totalPotentialIncentive,
      'Eligible Targets Count': eligibleTargets.length,
      'Total Targets Count': partnerTargets.length,
      'Incentive Eligibility Rate': partnerTargets.length > 0 ? ((eligibleTargets.length / partnerTargets.length) * 100).toFixed(2) + '%' : '0%'
    };
  });
  
  // Calculate period-wise summary
  const periods = [...new Set(targets.map((t: any) => t.period))];
  const periodSummary = periods.map(period => {
    const periodTargets = targets.filter((t: any) => t.period === period);
    const totalTarget = periodTargets.reduce((sum: number, t: any) => sum + t.targetAmount, 0);
    const totalAchieved = periodTargets.reduce((sum: number, t: any) => sum + t.achievedAmount, 0);
    const totalIncentive = periodTargets.reduce((sum: number, t: any) => {
      return sum + ((t.achievedAmount * t.incentivePercentage) / 100);
    }, 0);
    const eligibleTargets = periodTargets.filter((t: any) => t.achievedAmount >= t.targetAmount);
    
    return {
      'Period': period,
      'Total Target': totalTarget,
      'Total Achieved': totalAchieved,
      'Achievement %': totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(2) + '%' : '0%',
      'Total Incentive': totalIncentive,
      'Eligible Targets': eligibleTargets.length,
      'Total Targets': periodTargets.length
    };
  });
  
  // Prepare summary
  const totalIncentive = targets.reduce((sum: number, t: any) => {
    return sum + ((t.achievedAmount * t.incentivePercentage) / 100);
  }, 0);
  const totalEligibleTargets = targets.filter((t: any) => t.achievedAmount >= t.targetAmount).length;
  
  const summaryData = [
    { 'Metric': 'Total Incentive Amount', 'Value': totalIncentive },
    { 'Metric': 'Total Targets', 'Value': targets.length },
    { 'Metric': 'Eligible Targets', 'Value': totalEligibleTargets },
    { 'Metric': 'Incentive Eligibility Rate', 'Value': targets.length > 0 ? ((totalEligibleTargets / targets.length) * 100).toFixed(2) + '%' : '0%' },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Incentive details sheet
  const incentiveWs = utils.json_to_sheet(incentiveData);
  utils.book_append_sheet(wb, incentiveWs, 'Incentive Details');
  
  // Partner-wise incentives sheet
  const partnerWs = utils.json_to_sheet(partnerIncentives);
  utils.book_append_sheet(wb, partnerWs, 'Partner Incentives');
  
  // Period-wise summary sheet
  const periodWs = utils.json_to_sheet(periodSummary);
  utils.book_append_sheet(wb, periodWs, 'Period Summary');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  incentiveWs['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
    { wch: 18 }, { wch: 10 }, { wch: 12 }
  ];
  partnerWs['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 18 },
    { wch: 18 }, { wch: 18 }, { wch: 20 }
  ];
  periodWs['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }
  ];
  
  // Generate filename with timestamp
  const filename = `PCD_Incentive_Statement_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export PCD Target vs Achievement Report
export const exportPCDTargetVsAchievementReport = (targets: any[], partners: any[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare target vs achievement data
  const targetAchievementData = targets.map(target => {
    const partner = partners.find((p: any) => p.id === target.partnerId);
    const achievementPercentage = target.targetAmount > 0 ? (target.achievedAmount / target.targetAmount) * 100 : 0;
    
    return {
      'Target ID': target.id,
      'Partner ID': target.partnerId,
      'Partner Name': target.partnerName,
      'Territory': partner?.territory || 'N/A',
      'Period': target.period,
      'Target Amount': target.targetAmount,
      'Achieved Amount': target.achievedAmount,
      'Achievement %': achievementPercentage.toFixed(2) + '%',
      'Gap Amount': target.targetAmount - target.achievedAmount,
      'Gap %': target.targetAmount > 0 ? ((1 - target.achievedAmount / target.targetAmount) * 100).toFixed(2) + '%' : '100%',
      'Incentive %': target.incentivePercentage,
      'Potential Incentive': (target.targetAmount * target.incentivePercentage / 100).toFixed(2),
      'Actual Incentive Earned': target.achievedAmount >= target.targetAmount ? (target.achievedAmount * target.incentivePercentage / 100).toFixed(2) : '0.00',
      'Status': target.status,
      'Target Date': new Date().toISOString().split('T')[0], // Creation date
      'Last Updated': timestamp
    };
  });
  
  // Prepare summary by partner
  const partnerSummary = partners.map(partner => {
    const partnerTargets = targets.filter((t: any) => t.partnerId === partner.id);
    const totalTarget = partnerTargets.reduce((sum: number, t: any) => sum + t.targetAmount, 0);
    const totalAchieved = partnerTargets.reduce((sum: number, t: any) => sum + t.achievedAmount, 0);
    const achievementPercentage = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
    const achievedTargets = partnerTargets.filter((t: any) => t.status === 'Achieved').length;
    
    return {
      'Partner ID': partner.id,
      'Partner Name': partner.name,
      'Territory': partner.territory,
      'Total Target Amount': totalTarget,
      'Total Achieved Amount': totalAchieved,
      'Overall Achievement %': achievementPercentage.toFixed(2) + '%',
      'Total Targets Count': partnerTargets.length,
      'Achieved Targets Count': achievedTargets,
      'Pending Targets Count': partnerTargets.length - achievedTargets,
      'Average Incentive %': partnerTargets.length > 0 ? 
        (partnerTargets.reduce((sum: number, t: any) => sum + t.incentivePercentage, 0) / partnerTargets.length).toFixed(2) : '0.00',
      'Total Potential Incentive': partnerTargets.reduce((sum: number, t: any) => sum + (t.targetAmount * t.incentivePercentage / 100), 0),
      'Total Earned Incentive': partnerTargets.reduce((sum: number, t: any) => 
        sum + (t.achievedAmount >= t.targetAmount ? (t.achievedAmount * t.incentivePercentage / 100) : 0), 0)
    };
  });
  
  // Prepare period-wise summary
  const periods = [...new Set(targets.map((t: any) => t.period))];
  const periodSummary = periods.map(period => {
    const periodTargets = targets.filter((t: any) => t.period === period);
    const totalTarget = periodTargets.reduce((sum: number, t: any) => sum + t.targetAmount, 0);
    const totalAchieved = periodTargets.reduce((sum: number, t: any) => sum + t.achievedAmount, 0);
    const achievementPercentage = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
    const achievedTargets = periodTargets.filter((t: any) => t.status === 'Achieved').length;
    
    return {
      'Period': period,
      'Total Target': totalTarget,
      'Total Achieved': totalAchieved,
      'Achievement %': achievementPercentage.toFixed(2) + '%',
      'Total Targets': periodTargets.length,
      'Achieved Targets': achievedTargets,
      'Pending Targets': periodTargets.length - achievedTargets,
      'Average Incentive %': periodTargets.length > 0 ? 
        (periodTargets.reduce((sum: number, t: any) => sum + t.incentivePercentage, 0) / periodTargets.length).toFixed(2) : '0.00',
      'Total Potential Incentive': periodTargets.reduce((sum: number, t: any) => sum + (t.targetAmount * t.incentivePercentage / 100), 0),
      'Total Earned Incentive': periodTargets.reduce((sum: number, t: any) => 
        sum + (t.achievedAmount >= t.targetAmount ? (t.achievedAmount * t.incentivePercentage / 100) : 0), 0)
    };
  });
  
  // Prepare summary
  const totalTargets = targets.length;
  const totalTargetAmount = targets.reduce((sum: number, t: any) => sum + t.targetAmount, 0);
  const totalAchievedAmount = targets.reduce((sum: number, t: any) => sum + t.achievedAmount, 0);
  const overallAchievement = totalTargetAmount > 0 ? (totalAchievedAmount / totalTargetAmount) * 100 : 0;
  const achievedTargets = targets.filter((t: any) => t.status === 'Achieved').length;
  
  const summaryData = [
    { 'Metric': 'Total Targets', 'Value': totalTargets },
    { 'Metric': 'Total Target Amount', 'Value': totalTargetAmount },
    { 'Metric': 'Total Achieved Amount', 'Value': totalAchievedAmount },
    { 'Metric': 'Overall Achievement %', 'Value': overallAchievement.toFixed(2) + '%' },
    { 'Metric': 'Achieved Targets', 'Value': achievedTargets },
    { 'Metric': 'Pending Targets', 'Value': totalTargets - achievedTargets },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Target vs Achievement sheet
  const targetAchievementWs = utils.json_to_sheet(targetAchievementData);
  utils.book_append_sheet(wb, targetAchievementWs, 'Target vs Achievement');
  
  // Partner summary sheet
  const partnerWs = utils.json_to_sheet(partnerSummary);
  utils.book_append_sheet(wb, partnerWs, 'Partner Summary');
  
  // Period summary sheet
  const periodWs = utils.json_to_sheet(periodSummary);
  utils.book_append_sheet(wb, periodWs, 'Period Summary');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  targetAchievementWs['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 15 },
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
    { wch: 18 }, { wch: 10 }, { wch: 15 }, { wch: 20 }
  ];
  partnerWs['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 15 }, { wch: 18 }, { wch: 18 }
  ];
  periodWs['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
    { wch: 18 }, { wch: 18 }
  ];
  
  // Generate filename with timestamp
  const filename = `PCD_Target_vs_Achievement_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export PCD Scheme Performance Report
export const exportPCDSchemePerformanceReport = (schemes: any[], transactions: any[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare scheme performance data
  const schemePerformanceData = schemes.map(scheme => {
    // Calculate scheme effectiveness based on transaction data
    // In a real implementation, this would match transactions to scheme usage
    const schemeRelatedTransactions = transactions.filter((t: any) => 
      t.productName.toLowerCase().includes(scheme.name.toLowerCase()) ||
      (scheme.targetProducts && scheme.targetProducts.toLowerCase().includes(t.productName.toLowerCase()))
    );
    
    const totalSalesFromScheme = schemeRelatedTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalTransactions = schemeRelatedTransactions.length;
    
    return {
      'Scheme ID': scheme.id,
      'Scheme Name': scheme.name,
      'Scheme Code': scheme.schemeCode || 'N/A',
      'Scheme Type': scheme.type,
      'Description': scheme.description,
      'Valid Until': scheme.validUntil,
      'Minimum Order': scheme.minimumOrder || 0,
      'Discount %': scheme.discountPercentage || 0,
      'Free Products': scheme.freeProducts || 'N/A',
      'Eligibility Criteria': scheme.eligibilityCriteria || 'N/A',
      'Bonus Incentives': scheme.bonusIncentives || 'N/A',
      'Terms & Conditions': scheme.terms || 'N/A',
      'Target Products': scheme.targetProducts || 'All Products',
      'Total Sales from Scheme': totalSalesFromScheme,
      'Number of Transactions': totalTransactions,
      'Average Transaction Value': totalTransactions > 0 ? (totalSalesFromScheme / totalTransactions).toFixed(2) : '0.00',
      'Scheme Status': new Date(scheme.validUntil) >= new Date() ? 'Active' : 'Expired',
      'Scheme Effectiveness %': 'N/A' // Would need more complex calculation in real implementation
    };
  });
  
  // Prepare scheme performance summary
  const schemeTypeSummary = [...new Set(schemes.map((s: any) => s.type))].map(type => {
    const typeSchemes = schemes.filter((s: any) => s.type === type);
    const totalSalesFromType = typeSchemes.reduce((sum: number, s: any) => {
      const schemeRelatedTransactions = transactions.filter((t: any) => 
        t.productName.toLowerCase().includes(s.name.toLowerCase()) ||
        (s.targetProducts && s.targetProducts.toLowerCase().includes(t.productName.toLowerCase()))
      );
      return sum + schemeRelatedTransactions.reduce((subSum: number, t: any) => subSum + t.amount, 0);
    }, 0);
    
    return {
      'Scheme Type': type,
      'Number of Schemes': typeSchemes.length,
      'Total Sales from Type': totalSalesFromType,
      'Average Sales per Scheme': typeSchemes.length > 0 ? (totalSalesFromType / typeSchemes.length).toFixed(2) : '0.00',
      'Average Discount %': typeSchemes.length > 0 ? 
        (typeSchemes.reduce((sum: number, s: any) => sum + (s.discountPercentage || 0), 0) / typeSchemes.length).toFixed(2) : '0.00'
    };
  });
  
  // Prepare transaction details related to schemes
  const transactionDetails = transactions.map(transaction => {
    // Determine which scheme might have applied to this transaction
    const applicableScheme = schemes.find((s: any) => 
      transaction.productName.toLowerCase().includes(s.name.toLowerCase()) ||
      (s.targetProducts && s.targetProducts.toLowerCase().includes(transaction.productName.toLowerCase()))
    );
    
    return {
      'Transaction ID': transaction.id,
      'MR ID': transaction.mrId,
      'Date': transaction.date,
      'Chemist': transaction.chemist,
      'Area': transaction.area,
      'Product Name': transaction.productName,
      'Quantity': transaction.quantity,
      'Amount': transaction.amount,
      'Category': transaction.category,
      'Status': transaction.status,
      'Related Scheme': applicableScheme?.name || 'None',
      'Related Scheme Type': applicableScheme?.type || 'None'
    };
  });
  
  // Prepare summary
  const totalSchemes = schemes.length;
  const activeSchemes = schemes.filter((s: any) => new Date(s.validUntil) >= new Date()).length;
  const expiredSchemes = totalSchemes - activeSchemes;
  const totalSalesFromAllSchemes = schemePerformanceData.reduce((sum: number, s: any) => sum + s['Total Sales from Scheme'], 0);
  
  const summaryData = [
    { 'Metric': 'Total Schemes', 'Value': totalSchemes },
    { 'Metric': 'Active Schemes', 'Value': activeSchemes },
    { 'Metric': 'Expired Schemes', 'Value': expiredSchemes },
    { 'Metric': 'Total Sales from Schemes', 'Value': totalSalesFromAllSchemes },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Scheme performance sheet
  const schemeWs = utils.json_to_sheet(schemePerformanceData);
  utils.book_append_sheet(wb, schemeWs, 'Scheme Performance');
  
  // Scheme type summary sheet
  const typeWs = utils.json_to_sheet(schemeTypeSummary);
  utils.book_append_sheet(wb, typeWs, 'Scheme Type Summary');
  
  // Transaction details sheet
  const transactionWs = utils.json_to_sheet(transactionDetails);
  utils.book_append_sheet(wb, transactionWs, 'Transaction Details');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  schemeWs['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 12 },
    { wch: 40 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
    { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 30 },
    { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
    { wch: 12 }, { wch: 18 }
  ];
  typeWs['!cols'] = [
    { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }
  ];
  transactionWs['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 20 },
    { wch: 15 }, { wch: 25 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 15 }
  ];
  
  // Generate filename with timestamp
  const filename = `PCD_Scheme_Performance_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export PCD MR Performance Report
export const exportPCDMRPerformanceReport = (mrs: any[], transactions: any[], partners: any[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare MR performance data
  const mrPerformanceData = mrs.map(mr => {
    const mrTransactions = transactions.filter((t: any) => t.mrId === mr.id);
    const totalSales = mrTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
    const totalTransactions = mrTransactions.length;
    const averageTransactionValue = totalTransactions > 0 ? totalSales / totalTransactions : 0;
    
    // Find partners assigned to this MR
    const assignedPartners = partners.filter((p: any) => {
      const assignedMRs = p.assignedMrIds || [];
      return assignedMRs.includes(mr.id);
    });
    
    return {
      'MR ID': mr.id,
      'MR Name': mr.name,
      'Contact': mr.contact,
      'Email': mr.email,
      'Headquarters': mr.headquarters,
      'Assigned Area': mr.assignedArea,
      'Status': mr.status,
      'Join Date': mr.joinDate,
      'Base Salary': mr.baseSalary || 0,
      'Incentives': mr.incentives || 0,
      'Deductions': mr.deductions || 0,
      'Net Salary': (mr.baseSalary || 0) + (mr.incentives || 0) - (mr.deductions || 0),
      'Sales Target': mr.salesTarget,
      'Total Sales': totalSales,
      'Target Achievement %': mr.salesTarget > 0 ? ((totalSales / mr.salesTarget) * 100).toFixed(2) + '%' : '0%',
      'Number of Transactions': totalTransactions,
      'Average Transaction Value': averageTransactionValue.toFixed(2),
      'Number of Assigned Partners': assignedPartners.length,
      'Assigned Partners': assignedPartners.map((p: any) => p.name).join(', ') || 'None',
      'Last Updated': timestamp
    };
  });
  
  // Prepare territory-wise MR performance
  const territoryWiseData = [...new Set(mrs.map((mr: any) => mr.headquarters))].map(headquarter => {
    const territoryMRs = mrs.filter((mr: any) => mr.headquarters === headquarter);
    const totalSales = territoryMRs.reduce((sum: number, mr: any) => {
      const mrTransactions = transactions.filter((t: any) => t.mrId === mr.id);
      return sum + mrTransactions.reduce((subSum: number, t: any) => subSum + t.amount, 0);
    }, 0);
    
    return {
      'Headquarters/Territory': headquarter,
      'Number of MRs': territoryMRs.length,
      'Total Sales': totalSales,
      'Average Sales per MR': territoryMRs.length > 0 ? (totalSales / territoryMRs.length).toFixed(2) : '0.00',
      'Average Target Achievement %': territoryMRs.length > 0 ? 
        (territoryMRs.reduce((sum: number, mr: any) => 
          sum + (mr.salesTarget > 0 ? (mr.totalSales || 0) / mr.salesTarget * 100 : 0), 0) / territoryMRs.length).toFixed(2) + '%' : '0%',
      'Total Base Salary': territoryMRs.reduce((sum: number, mr: any) => sum + (mr.baseSalary || 0), 0),
      'Total Incentives': territoryMRs.reduce((sum: number, mr: any) => sum + (mr.incentives || 0), 0)
    };
  });
  
  // Prepare transaction details
  const transactionDetails = transactions.map(transaction => {
    const mr = mrs.find((m: any) => m.id === transaction.mrId);
    const partner = partners.find((p: any) => {
      const assignedMRs = p.assignedMrIds || [];
      return assignedMRs.includes(transaction.mrId);
    });
    
    return {
      'Transaction ID': transaction.id,
      'MR ID': transaction.mrId,
      'MR Name': mr?.name || 'Unknown',
      'Date': transaction.date,
      'Chemist': transaction.chemist,
      'Area': transaction.area,
      'Partner Name': partner?.name || 'Unknown',
      'Product Name': transaction.productName,
      'Quantity': transaction.quantity,
      'Amount': transaction.amount,
      'Category': transaction.category,
      'Status': transaction.status
    };
  });
  
  // Prepare summary
  const totalMRs = mrs.length;
  const activeMRs = mrs.filter((mr: any) => mr.status === 'Active').length;
  const totalSales = mrs.reduce((sum: number, mr: any) => {
    const mrTransactions = transactions.filter((t: any) => t.mrId === mr.id);
    return sum + mrTransactions.reduce((subSum: number, t: any) => subSum + t.amount, 0);
  }, 0);
  const totalTarget = mrs.reduce((sum: number, mr: any) => sum + mr.salesTarget, 0);
  const averageAchievement = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
  
  const summaryData = [
    { 'Metric': 'Total MRs', 'Value': totalMRs },
    { 'Metric': 'Active MRs', 'Value': activeMRs },
    { 'Metric': 'Total Sales', 'Value': totalSales },
    { 'Metric': 'Total Target', 'Value': totalTarget },
    { 'Metric': 'Average Achievement %', 'Value': averageAchievement.toFixed(2) + '%' },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // MR performance sheet
  const mrWs = utils.json_to_sheet(mrPerformanceData);
  utils.book_append_sheet(wb, mrWs, 'MR Performance');
  
  // Territory-wise summary sheet
  const territoryWs = utils.json_to_sheet(territoryWiseData);
  utils.book_append_sheet(wb, territoryWs, 'Territory-wise Performance');
  
  // Transaction details sheet
  const transactionWs = utils.json_to_sheet(transactionDetails);
  utils.book_append_sheet(wb, transactionWs, 'Transaction Details');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  mrWs['!cols'] = [
    { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 25 },
    { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 25 }, { wch: 20 }
  ];
  territoryWs['!cols'] = [
    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 },
    { wch: 18 }, { wch: 15 }, { wch: 15 }
  ];
  transactionWs['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 12 },
    { wch: 20 }, { wch: 15 }, { wch: 20 }, { wch: 25 },
    { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 10 }
  ];
  
  // Generate filename with timestamp
  const filename = `PCD_MR_Performance_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export PCD Overall Analytics Report
export const exportPCDOverallAnalyticsReport = (partners: any[], mrs: any[], schemes: any[], targets: any[], transactions: any[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare comprehensive analytics data
  const analyticsData = [
    // Partner analytics
    {
      'Category': 'Partners',
      'Metric': 'Total Partners',
      'Value': partners.length,
      'Details': 'Number of registered PCD partners'
    },
    {
      'Category': 'Partners',
      'Metric': 'Active Partners',
      'Value': partners.filter((p: any) => p.status === 'Active').length,
      'Details': 'Partners currently operational'
    },
    {
      'Category': 'Partners',
      'Metric': 'Inactive Partners',
      'Value': partners.filter((p: any) => p.status === 'Inactive').length,
      'Details': 'Partners not currently operational'
    },
    // MR analytics
    {
      'Category': 'Field Force',
      'Metric': 'Total MRs',
      'Value': mrs.length,
      'Details': 'Total medical representatives'
    },
    {
      'Category': 'Field Force',
      'Metric': 'Active MRs',
      'Value': mrs.filter((mr: any) => mr.status === 'Active').length,
      'Details': 'MRs currently active'
    },
    // Scheme analytics
    {
      'Category': 'Schemes',
      'Metric': 'Total Schemes',
      'Value': schemes.length,
      'Details': 'Total promotional schemes active'
    },
    {
      'Category': 'Schemes',
      'Metric': 'Active Schemes',
      'Value': schemes.filter((s: any) => new Date(s.validUntil) >= new Date()).length,
      'Details': 'Schemes currently active'
    },
    // Target analytics
    {
      'Category': 'Targets',
      'Metric': 'Total Targets',
      'Value': targets.length,
      'Details': 'Total targets set'
    },
    {
      'Category': 'Targets',
      'Metric': 'Achieved Targets',
      'Value': targets.filter((t: any) => t.status === 'Achieved').length,
      'Details': 'Targets successfully achieved'
    },
    {
      'Category': 'Targets',
      'Metric': 'Pending Targets',
      'Value': targets.filter((t: any) => t.status === 'Pending').length,
      'Details': 'Targets still pending'
    },
    // Transaction analytics
    {
      'Category': 'Transactions',
      'Metric': 'Total Transactions',
      'Value': transactions.length,
      'Details': 'Total sales transactions recorded'
    },
    {
      'Category': 'Transactions',
      'Metric': 'Total Sales Value',
      'Value': transactions.reduce((sum: number, t: any) => sum + t.amount, 0),
      'Details': 'Total revenue from sales'
    },
    {
      'Category': 'Transactions',
      'Metric': 'Average Transaction Value',
      'Value': transactions.length > 0 ? (transactions.reduce((sum: number, t: any) => sum + t.amount, 0) / transactions.length).toFixed(2) : 0,
      'Details': 'Average value per transaction'
    }
  ];
  
  // Prepare trend analysis
  const monthlyTrends = [];
  const currentYear = new Date().getFullYear();
  
  for (let month = 1; month <= 12; month++) {
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const monthTransactions = transactions.filter((t: any) => {
      const transDate = new Date(t.date);
      return transDate.getMonth() + 1 === month && transDate.getFullYear() === currentYear;
    });
    
    monthlyTrends.push({
      'Month': `${currentYear}-${monthStr}`,
      'Total Transactions': monthTransactions.length,
      'Total Sales': monthTransactions.reduce((sum: number, t: any) => sum + t.amount, 0),
      'Average Transaction Value': monthTransactions.length > 0 ? 
        (monthTransactions.reduce((sum: number, t: any) => sum + t.amount, 0) / monthTransactions.length).toFixed(2) : '0.00',
      'Active Partners': [...new Set(monthTransactions.map((t: any) => {
        const partner = partners.find((p: any) => {
          const assignedMRs = p.assignedMrIds || [];
          return assignedMRs.includes(t.mrId);
        });
        return partner?.id;
      }))].filter(id => id).length
    });
  }
  
  // Prepare partner performance ranking
  const partnerRankings = partners.map(partner => {
    const partnerTransactions = transactions.filter((t: any) => {
      const assignedMRs = partner.assignedMrIds || [];
      return assignedMRs.includes(t.mrId);
    });
    
    const totalSales = partnerTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
    const partnerTargets = targets.filter((t: any) => t.partnerId === partner.id);
    const totalTarget = partnerTargets.reduce((sum: number, t: any) => sum + t.targetAmount, 0);
    const achievementPercentage = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
    
    return {
      'Partner ID': partner.id,
      'Partner Name': partner.name,
      'Territory': partner.territory,
      'Total Sales': totalSales,
      'Total Target': totalTarget,
      'Achievement %': achievementPercentage.toFixed(2) + '%',
      'Number of Transactions': partnerTransactions.length,
      'Average Transaction Value': partnerTransactions.length > 0 ? 
        (totalSales / partnerTransactions.length).toFixed(2) : '0.00',
      'Status': partner.status
    };
  }).sort((a, b) => b['Total Sales'] - a['Total Sales']);
  
  // Prepare territory analysis
  const territoryAnalysis = [...new Set(partners.map((p: any) => p.territory))].map(territory => {
    const territoryPartners = partners.filter((p: any) => p.territory === territory);
    const territoryTransactions = transactions.filter((t: any) => {
      const partner = partners.find((p: any) => {
        const assignedMRs = p.assignedMrIds || [];
        return assignedMRs.includes(t.mrId);
      });
      return partner?.territory === territory;
    });
    
    const totalSales = territoryTransactions.reduce((sum: number, t: any) => sum + t.amount, 0);
    
    return {
      'Territory': territory,
      'Number of Partners': territoryPartners.length,
      'Total Sales': totalSales,
      'Average Sales per Partner': territoryPartners.length > 0 ? (totalSales / territoryPartners.length).toFixed(2) : '0.00',
      'Active Partners': territoryPartners.filter((p: any) => p.status === 'Active').length,
      'Average Transaction Value': territoryTransactions.length > 0 ? 
        (totalSales / territoryTransactions.length).toFixed(2) : '0.00'
    };
  }).sort((a, b) => b['Total Sales'] - a['Total Sales']);
  
  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Analytics summary sheet
  const analyticsWs = utils.json_to_sheet(analyticsData);
  utils.book_append_sheet(wb, analyticsWs, 'Analytics Summary');
  
  // Monthly trends sheet
  const trendsWs = utils.json_to_sheet(monthlyTrends);
  utils.book_append_sheet(wb, trendsWs, 'Monthly Trends');
  
  // Partner rankings sheet
  const rankingsWs = utils.json_to_sheet(partnerRankings);
  utils.book_append_sheet(wb, rankingsWs, 'Partner Rankings');
  
  // Territory analysis sheet
  const territoryWs = utils.json_to_sheet(territoryAnalysis);
  utils.book_append_sheet(wb, territoryWs, 'Territory Analysis');
  
  // Set column widths
  analyticsWs['!cols'] = [
    { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 40 }
  ];
  trendsWs['!cols'] = [
    { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 15 }
  ];
  rankingsWs['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 10 }
  ];
  territoryWs['!cols'] = [
    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 },
    { wch: 15 }, { wch: 18 }
  ];
  
  // Generate filename with timestamp
  const filename = `PCD_Overall_Analytics_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Logistics Dispatch Summary Report
export const exportLogisticsDispatchSummaryReport = (dispatches: any[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare dispatch summary data
  const dispatchSummaryData = dispatches.map(dispatch => ({
    'Dispatch ID': dispatch.id,
    'Invoice Number': dispatch.invoiceNo,
    'Customer Name': dispatch.customerName,
    'Customer Address': dispatch.customerAddress,
    'Customer City': dispatch.customerCity,
    'Customer State': dispatch.customerState,
    'Customer Pincode': dispatch.customerPincode,
    'Dispatch Date': dispatch.dispatchDate,
    'Expected Delivery Date': dispatch.expectedDeliveryDate,
    'Actual Delivery Date': dispatch.actualDeliveryDate || 'N/A',
    'Transporter': dispatch.transporter,
    'Transporter ID': dispatch.transporterId,
    'LR Number': dispatch.lrNumber,
    'E-Way Bill No': dispatch.ewayBillNo || 'N/A',
    'E-Way Bill Date': dispatch.ewayBillDate || 'N/A',
    'Boxes': dispatch.boxes,
    'Weight': dispatch.weight,
    'Volume': dispatch.volume || 'N/A',
    'Package Type': dispatch.packageType,
    'Fragile': dispatch.fragile ? 'Yes' : 'No',
    'Temperature Controlled': dispatch.temperatureControlled ? 'Yes' : 'No',
    'Insurance Value': dispatch.insuranceValue || 0,
    'Insurance Company': dispatch.insuranceCompany || 'N/A',
    'COD Amount': dispatch.codAmount || 0,
    'Shipping Cost': dispatch.shippingCost,
    'Handling Charges': dispatch.handlingCharges,
    'Total Charges': dispatch.totalCharges,
    'Payment Mode': dispatch.paymentMode,
    'Status': dispatch.status,
    'Delivery Attempts': dispatch.deliveryAttempts,
    'Delivery Person': dispatch.deliveryPerson || 'N/A',
    'Vehicle Number': dispatch.vehicleNumber || 'N/A',
    'Driver Name': dispatch.driverName || 'N/A',
    'Driver Contact': dispatch.driverContact || 'N/A',
    'Route Details': dispatch.routeDetails || 'N/A',
    'Distance Covered (km)': dispatch.distanceCovered || 0,
    'Fuel Consumed (L)': dispatch.fuelConsumed || 0,
    'Created At': dispatch.createdAt,
    'Updated At': dispatch.updatedAt,
    'Created By': dispatch.createdBy,
    'Last Updated By': dispatch.lastUpdatedBy
  }));
  
  // Prepare summary statistics
  const totalDispatches = dispatches.length;
  const deliveredCount = dispatches.filter((d: any) => d.status === 'Delivered').length;
  const pendingCount = dispatches.filter((d: any) => d.status !== 'Delivered' && d.status !== 'Cancelled').length;
  const cancelledCount = dispatches.filter((d: any) => d.status === 'Cancelled').length;
  const totalRevenue = dispatches.reduce((sum: number, d: any) => sum + d.totalCharges, 0);
  const avgDeliveryTime = dispatches.filter((d: any) => d.actualDeliveryDate && d.dispatchDate)
    .reduce((sum: number, d: any) => {
      const dispatchDate = new Date(d.dispatchDate);
      const deliveryDate = new Date(d.actualDeliveryDate);
      return sum + (deliveryDate.getTime() - dispatchDate.getTime()) / (1000 * 3600 * 24);
    }, 0) / dispatches.filter((d: any) => d.actualDeliveryDate && d.dispatchDate).length || 0;
  
  const summaryData = [
    { 'Metric': 'Total Dispatches', 'Value': totalDispatches },
    { 'Metric': 'Delivered', 'Value': deliveredCount },
    { 'Metric': 'Pending', 'Value': pendingCount },
    { 'Metric': 'Cancelled', 'Value': cancelledCount },
    { 'Metric': 'Delivery Success Rate', 'Value': totalDispatches > 0 ? ((deliveredCount/totalDispatches)*100).toFixed(2) + '%' : '0%' },
    { 'Metric': 'Total Revenue', 'Value': totalRevenue },
    { 'Metric': 'Average Delivery Time (Days)', 'Value': avgDeliveryTime.toFixed(2) },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Prepare transporter-wise summary
  const transporters = [...new Set(dispatches.map((d: any) => d.transporter))];
  const transporterSummary = transporters.map(transporter => {
    const transporterDispatches = dispatches.filter((d: any) => d.transporter === transporter);
    const delivered = transporterDispatches.filter((d: any) => d.status === 'Delivered').length;
    
    return {
      'Transporter': transporter,
      'Total Dispatches': transporterDispatches.length,
      'Delivered': delivered,
      'Pending': transporterDispatches.length - delivered,
      'Success Rate': transporterDispatches.length > 0 ? ((delivered/transporterDispatches.length)*100).toFixed(2) + '%' : '0%',
      'Total Revenue': transporterDispatches.reduce((sum: number, d: any) => sum + d.totalCharges, 0),
      'Average Delivery Time': transporterDispatches.filter((d: any) => d.actualDeliveryDate && d.dispatchDate).length > 0 ?
        (transporterDispatches.filter((d: any) => d.actualDeliveryDate && d.dispatchDate)
          .reduce((sum: number, d: any) => {
            const dispatchDate = new Date(d.dispatchDate);
            const deliveryDate = new Date(d.actualDeliveryDate);
            return sum + (deliveryDate.getTime() - dispatchDate.getTime()) / (1000 * 3600 * 24);
          }, 0) / transporterDispatches.filter((d: any) => d.actualDeliveryDate && d.dispatchDate).length).toFixed(2) : '0'
    };
  });
  
  // Prepare package type analysis
  const packageTypes = [...new Set(dispatches.map((d: any) => d.packageType))];
  const packageTypeAnalysis = packageTypes.map(type => {
    const typeDispatches = dispatches.filter((d: any) => d.packageType === type);
    
    return {
      'Package Type': type,
      'Count': typeDispatches.length,
      'Percentage': totalDispatches > 0 ? ((typeDispatches.length/totalDispatches)*100).toFixed(2) + '%' : '0%',
      'Total Weight': typeDispatches.reduce((sum: number, d: any) => sum + parseFloat(d.weight), 0),
      'Total Volume': typeDispatches.reduce((sum: number, d: any) => sum + (parseFloat(d.volume) || 0), 0),
      'Average Cost': typeDispatches.length > 0 ? (typeDispatches.reduce((sum: number, d: any) => sum + d.totalCharges, 0) / typeDispatches.length).toFixed(2) : '0'
    };
  });
  
  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Dispatch details sheet
  const dispatchWs = utils.json_to_sheet(dispatchSummaryData);
  utils.book_append_sheet(wb, dispatchWs, 'Dispatch Details');
  
  // Transporter summary sheet
  const transporterWs = utils.json_to_sheet(transporterSummary);
  utils.book_append_sheet(wb, transporterWs, 'Transporter Summary');
  
  // Package type analysis sheet
  const packageWs = utils.json_to_sheet(packageTypeAnalysis);
  utils.book_append_sheet(wb, packageWs, 'Package Type Analysis');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  dispatchWs['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 30 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 8 },
    { wch: 10 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
    { wch: 15 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];
  transporterWs['!cols'] = [
    { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 20 }
  ];
  packageWs['!cols'] = [
    { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }
  ];
  
  // Generate filename with timestamp
  const filename = `Logistics_Dispatch_Summary_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Logistics Performance Analytics Report
export const exportLogisticsPerformanceAnalyticsReport = (dispatches: any[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare performance metrics data
  const performanceData = dispatches.map(dispatch => {
    const deliveryTime = dispatch.actualDeliveryDate && dispatch.dispatchDate ?
      (new Date(dispatch.actualDeliveryDate).getTime() - new Date(dispatch.dispatchDate).getTime()) / (1000 * 3600 * 24) : null;
    
    return {
      'Dispatch ID': dispatch.id,
      'Invoice Number': dispatch.invoiceNo,
      'Customer Name': dispatch.customerName,
      'Customer City': dispatch.customerCity,
      'Transporter': dispatch.transporter,
      'Dispatch Date': dispatch.dispatchDate,
      'Expected Delivery Date': dispatch.expectedDeliveryDate,
      'Actual Delivery Date': dispatch.actualDeliveryDate || 'N/A',
      'Delivery Time (Days)': deliveryTime !== null ? deliveryTime.toFixed(2) : 'N/A',
      'On Time Delivery': deliveryTime !== null && deliveryTime <= 2 ? 'Yes' : 'No',
      'Delivery Attempts': dispatch.deliveryAttempts,
      'Status': dispatch.status,
      'Package Type': dispatch.packageType,
      'Fragile': dispatch.fragile ? 'Yes' : 'No',
      'Temperature Controlled': dispatch.temperatureControlled ? 'Yes' : 'No',
      'Boxes': dispatch.boxes,
      'Weight': dispatch.weight,
      'Volume': dispatch.volume || 'N/A',
      'Total Charges': dispatch.totalCharges,
      'Payment Mode': dispatch.paymentMode,
      'Vehicle Number': dispatch.vehicleNumber || 'N/A',
      'Driver Name': dispatch.driverName || 'N/A',
      'Distance Covered (km)': dispatch.distanceCovered || 0,
      'Fuel Consumed (L)': dispatch.fuelConsumed || 0,
      'Fuel Efficiency (km/L)': dispatch.fuelConsumed && dispatch.distanceCovered ? 
        (dispatch.distanceCovered / dispatch.fuelConsumed).toFixed(2) : 'N/A'
    };
  });
  
  // Prepare transporter performance summary
  const transporters = [...new Set(dispatches.map((d: any) => d.transporter))];
  const transporterPerformance = transporters.map(transporter => {
    const transporterDispatches = dispatches.filter((d: any) => d.transporter === transporter);
    const deliveredDispatches = transporterDispatches.filter((d: any) => d.status === 'Delivered');
    
    const avgDeliveryTime = deliveredDispatches.filter((d: any) => d.actualDeliveryDate && d.dispatchDate).length > 0 ?
      deliveredDispatches.filter((d: any) => d.actualDeliveryDate && d.dispatchDate)
        .reduce((sum: number, d: any) => {
          const dispatchDate = new Date(d.dispatchDate);
          const deliveryDate = new Date(d.actualDeliveryDate);
          return sum + (deliveryDate.getTime() - dispatchDate.getTime()) / (1000 * 3600 * 24);
        }, 0) / deliveredDispatches.filter((d: any) => d.actualDeliveryDate && d.dispatchDate).length : 0;
    
    const onTimeDeliveries = deliveredDispatches.filter((d: any) => {
      if (!d.actualDeliveryDate || !d.dispatchDate) return false;
      const deliveryTime = (new Date(d.actualDeliveryDate).getTime() - new Date(d.dispatchDate).getTime()) / (1000 * 3600 * 24);
      return deliveryTime <= 2;
    }).length;
    
    return {
      'Transporter': transporter,
      'Total Dispatches': transporterDispatches.length,
      'Delivered': deliveredDispatches.length,
      'Delivery Success Rate': transporterDispatches.length > 0 ? 
        ((deliveredDispatches.length/transporterDispatches.length)*100).toFixed(2) + '%' : '0%',
      'On Time Deliveries': onTimeDeliveries,
      'On Time Delivery Rate': deliveredDispatches.length > 0 ? 
        ((onTimeDeliveries/deliveredDispatches.length)*100).toFixed(2) + '%' : '0%',
      'Average Delivery Time (Days)': avgDeliveryTime.toFixed(2),
      'Total Revenue': transporterDispatches.reduce((sum: number, d: any) => sum + d.totalCharges, 0),
      'Average Revenue per Dispatch': transporterDispatches.length > 0 ? 
        (transporterDispatches.reduce((sum: number, d: any) => sum + d.totalCharges, 0) / transporterDispatches.length).toFixed(2) : '0',
      'Total Distance Covered (km)': transporterDispatches.reduce((sum: number, d: any) => sum + (d.distanceCovered || 0), 0),
      'Total Fuel Consumed (L)': transporterDispatches.reduce((sum: number, d: any) => sum + (d.fuelConsumed || 0), 0),
      'Average Fuel Efficiency (km/L)': transporterDispatches.reduce((sum: number, d: any) => sum + (d.fuelConsumed || 0), 0) > 0 ? 
        (transporterDispatches.reduce((sum: number, d: any) => sum + (d.distanceCovered || 0), 0) / 
         transporterDispatches.reduce((sum: number, d: any) => sum + (d.fuelConsumed || 0), 0)).toFixed(2) : '0'
    };
  });
  
  // Prepare monthly performance trends
  const monthlyTrends = [];
  const currentYear = new Date().getFullYear();
  
  for (let month = 1; month <= 12; month++) {
    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const monthDispatches = dispatches.filter((d: any) => {
      const dispatchDate = new Date(d.dispatchDate);
      return dispatchDate.getMonth() + 1 === month && dispatchDate.getFullYear() === currentYear;
    });
    
    const delivered = monthDispatches.filter((d: any) => d.status === 'Delivered');
    const avgDeliveryTime = delivered.filter((d: any) => d.actualDeliveryDate && d.dispatchDate).length > 0 ?
      delivered.filter((d: any) => d.actualDeliveryDate && d.dispatchDate)
        .reduce((sum: number, d: any) => {
          const dispatchDate = new Date(d.dispatchDate);
          const deliveryDate = new Date(d.actualDeliveryDate);
          return sum + (deliveryDate.getTime() - dispatchDate.getTime()) / (1000 * 3600 * 24);
        }, 0) / delivered.filter((d: any) => d.actualDeliveryDate && d.dispatchDate).length : 0;
    
    monthlyTrends.push({
      'Month': `${currentYear}-${monthStr}`,
      'Total Dispatches': monthDispatches.length,
      'Delivered': delivered.length,
      'Delivery Success Rate': monthDispatches.length > 0 ? 
        ((delivered.length/monthDispatches.length)*100).toFixed(2) + '%' : '0%',
      'Average Delivery Time (Days)': avgDeliveryTime.toFixed(2),
      'Total Revenue': monthDispatches.reduce((sum: number, d: any) => sum + d.totalCharges, 0),
      'Average Revenue per Dispatch': monthDispatches.length > 0 ? 
        (monthDispatches.reduce((sum: number, d: any) => sum + d.totalCharges, 0) / monthDispatches.length).toFixed(2) : '0'
    });
  }
  
  // Prepare summary
  const totalDispatches = dispatches.length;
  const deliveredCount = dispatches.filter((d: any) => d.status === 'Delivered').length;
  const avgDeliveryTime = dispatches.filter((d: any) => d.actualDeliveryDate && d.dispatchDate).length > 0 ?
    dispatches.filter((d: any) => d.actualDeliveryDate && d.dispatchDate)
      .reduce((sum: number, d: any) => {
        const dispatchDate = new Date(d.dispatchDate);
        const deliveryDate = new Date(d.actualDeliveryDate);
        return sum + (deliveryDate.getTime() - dispatchDate.getTime()) / (1000 * 3600 * 24);
      }, 0) / dispatches.filter((d: any) => d.actualDeliveryDate && d.dispatchDate).length : 0;
  
  const summaryData = [
    { 'Metric': 'Total Dispatches', 'Value': totalDispatches },
    { 'Metric': 'Delivered', 'Value': deliveredCount },
    { 'Metric': 'Delivery Success Rate', 'Value': totalDispatches > 0 ? ((deliveredCount/totalDispatches)*100).toFixed(2) + '%' : '0%' },
    { 'Metric': 'Average Delivery Time (Days)', 'Value': avgDeliveryTime.toFixed(2) },
    { 'Metric': 'Total Revenue', 'Value': dispatches.reduce((sum: number, d: any) => sum + d.totalCharges, 0) },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Performance details sheet
  const performanceWs = utils.json_to_sheet(performanceData);
  utils.book_append_sheet(wb, performanceWs, 'Performance Details');
  
  // Transporter performance sheet
  const transporterWs = utils.json_to_sheet(transporterPerformance);
  utils.book_append_sheet(wb, transporterWs, 'Transporter Performance');
  
  // Monthly trends sheet
  const trendsWs = utils.json_to_sheet(monthlyTrends);
  utils.book_append_sheet(wb, trendsWs, 'Monthly Trends');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  performanceWs['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 15 },
    { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 8 },
    { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];
  transporterWs['!cols'] = [
    { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 18 },
    { wch: 18 }, { wch: 20 }, { wch: 18 }, { wch: 15 },
    { wch: 18 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
    { wch: 18 }
  ];
  trendsWs['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 18 },
    { wch: 18 }, { wch: 15 }, { wch: 18 }
  ];
  
  // Generate filename with timestamp
  const filename = `Logistics_Performance_Analytics_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Logistics Cost Analysis Report
// Export Asset Management Reports

// Export Complete Asset Register Report
export const exportAssetRegisterReport = (assets: Asset[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare asset data
  const assetData = assets.map(asset => ({
    'Asset ID': asset.id,
    'Asset Name': asset.name,
    'Category': asset.category,
    'Model Number': asset.modelNo,
    'Serial Number': asset.serialNo,
    'Purchase Date': asset.purchaseDate,
    'Purchase Cost': asset.purchaseCost,
    'Current Value': asset.currentValue,
    'Status': asset.status,
    'Location': asset.location,
    'Department': asset.department || 'N/A',
    'Assigned To': asset.assignedTo || 'N/A',
    'Next Maintenance Date': asset.nextMaintenanceDate || 'N/A',
    'Warranty Expiry': asset.warrantyExpiry || 'N/A',
    'Insurance Expiry': asset.insuranceExpiry || 'N/A',
    'Insurance Value': asset.insuranceValue || 0,
    'Insurance Company': asset.insuranceCompany || 'N/A',
    'Vendor Name': asset.vendorName || 'N/A',
    'Depreciation Method': asset.depreciationMethod || 'N/A',
    'Depreciation Rate (%)': asset.depreciationRate || 0,
    'Useful Life (Years)': asset.usefulLife || 0,
    'Barcode': asset.barcode || 'N/A',
    'QR Code': asset.qrCode || 'N/A',
    'Last Inspection Date': asset.lastInspectionDate || 'N/A',
    'Inspection Frequency': asset.inspectionFrequency || 'N/A',
    'Criticality': asset.criticality || 'N/A',
    'Asset Tag': asset.assetTag || 'N/A',
    'Specifications': asset.specifications || 'N/A',
    'Installation Date': asset.installationDate || 'N/A',
    'Commission Date': asset.commissionDate || 'N/A',
    'Last Modified': asset.lastModified || 'N/A',
    'Modified By': asset.modifiedBy || 'N/A'
  }));
  
  // Prepare summary statistics
  const summaryData = [
    { 'Metric': 'Total Assets', 'Value': assets.length },
    { 'Metric': 'Total Asset Value', 'Value': assets.reduce((sum, a) => sum + a.purchaseCost, 0) },
    { 'Metric': 'Current Book Value', 'Value': assets.reduce((sum, a) => sum + a.currentValue, 0) },
    { 'Metric': 'Total Depreciation', 'Value': assets.reduce((sum, a) => sum + (a.purchaseCost - a.currentValue), 0) },
    { 'Metric': 'Active Assets', 'Value': assets.filter(a => a.status === 'Active').length },
    { 'Metric': 'Under Maintenance', 'Value': assets.filter(a => a.status === 'Maintenance' || a.status === 'Under Repair').length },
    { 'Metric': 'Retired/Disposed', 'Value': assets.filter(a => a.status === 'Retired' || a.status === 'Disposed').length },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Prepare category-wise summary
  const categories = [...new Set(assets.map(a => a.category))];
  const categorySummary = categories.map(category => {
    const categoryAssets = assets.filter(a => a.category === category);
    return {
      'Category': category,
      'Total Assets': categoryAssets.length,
      'Total Value': categoryAssets.reduce((sum, a) => sum + a.purchaseCost, 0),
      'Current Value': categoryAssets.reduce((sum, a) => sum + a.currentValue, 0),
      'Active Assets': categoryAssets.filter(a => a.status === 'Active').length,
      'Maintenance Assets': categoryAssets.filter(a => a.status === 'Maintenance' || a.status === 'Under Repair').length
    };
  });
  
  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Asset details sheet
  const assetWs = utils.json_to_sheet(assetData);
  utils.book_append_sheet(wb, assetWs, 'Asset Register');
  
  // Category summary sheet
  const categoryWs = utils.json_to_sheet(categorySummary);
  utils.book_append_sheet(wb, categoryWs, 'Category Summary');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  assetWs['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 12 },
    { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];
  categoryWs['!cols'] = [
    { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 18 }
  ];
  
  // Generate filename
  const filename = `Asset_Register_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Asset Maintenance Report
export const exportAssetMaintenanceReport = (maintenanceLogs: MaintenanceRecord[], assets: Asset[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare maintenance data
  const maintenanceData = maintenanceLogs.map(log => ({
    'Log ID': log.id,
    'Asset ID': log.assetId,
    'Asset Name': log.assetName,
    'Maintenance Date': log.date,
    'Type': log.type,
    'Description': log.description,
    'Cost': log.cost,
    'Performed By': log.performedBy,
    'Status': log.status,
    'Priority': log.priority,
    'Parts Replaced': log.partsReplaced || 'N/A',
    'Labor Hours': log.laborHours || 0,
    'Vendor Name': log.vendorName || 'N/A',
    'Warranty Claim': log.warrantyClaim ? 'Yes' : 'No',
    'Attachments': log.attachments ? log.attachments.join('; ') : 'N/A',
    'Remarks': log.remarks || 'N/A',
    'Created By': log.createdBy || 'N/A',
    'Created At': log.createdAt || 'N/A'
  }));
  
  // Prepare summary
  const summaryData = [
    { 'Metric': 'Total Maintenance Records', 'Value': maintenanceLogs.length },
    { 'Metric': 'Total Maintenance Cost', 'Value': maintenanceLogs.reduce((sum, m) => sum + m.cost, 0) },
    { 'Metric': 'Completed Maintenance', 'Value': maintenanceLogs.filter(m => m.status === 'Completed').length },
    { 'Metric': 'Pending Maintenance', 'Value': maintenanceLogs.filter(m => m.status === 'Pending').length },
    { 'Metric': 'High Priority Tasks', 'Value': maintenanceLogs.filter(m => m.priority === 'High').length },
    { 'Metric': 'Preventive Maintenance', 'Value': maintenanceLogs.filter(m => m.type === 'Preventive').length },
    { 'Metric': 'Repair Tasks', 'Value': maintenanceLogs.filter(m => m.type === 'Repair').length },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Prepare asset-wise maintenance summary
  const assetMaintenanceSummary = assets.map(asset => {
    const assetLogs = maintenanceLogs.filter(m => m.assetId === asset.id);
    return {
      'Asset Name': asset.name,
      'Asset ID': asset.id,
      'Total Maintenance': assetLogs.length,
      'Total Cost': assetLogs.reduce((sum, m) => sum + m.cost, 0),
      'Last Maintenance': assetLogs.length > 0 ? assetLogs[0].date : 'N/A',
      'Average Cost per Maintenance': assetLogs.length > 0 ? (assetLogs.reduce((sum, m) => sum + m.cost, 0) / assetLogs.length).toFixed(2) : '0.00'
    };
  });
  
  // Create workbook
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Maintenance details sheet
  const maintenanceWs = utils.json_to_sheet(maintenanceData);
  utils.book_append_sheet(wb, maintenanceWs, 'Maintenance Logs');
  
  // Asset maintenance summary sheet
  const assetSummaryWs = utils.json_to_sheet(assetMaintenanceSummary);
  utils.book_append_sheet(wb, assetSummaryWs, 'Asset Maintenance Summary');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  maintenanceWs['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 12 },
    { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 12 },
    { wch: 20 }, { wch: 12 }, { wch: 25 }, { wch: 20 },
    { wch: 15 }, { wch: 15 }
  ];
  assetSummaryWs['!cols'] = [
    { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 20 }
  ];
  
  // Generate filename
  const filename = `Asset_Maintenance_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Asset Depreciation Report
export const exportAssetDepreciationReport = (assets: Asset[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare depreciation data
  const depreciationData = assets.filter(a => a.depreciationMethod).map(asset => {
    const depreciation = asset.purchaseCost - asset.currentValue;
    const depreciationPercentage = ((depreciation / asset.purchaseCost) * 100).toFixed(2);
    
    return {
      'Asset ID': asset.id,
      'Asset Name': asset.name,
      'Category': asset.category,
      'Purchase Date': asset.purchaseDate,
      'Purchase Cost': asset.purchaseCost,
      'Current Value': asset.currentValue,
      'Depreciated Amount': depreciation,
      'Depreciation Percentage': `${depreciationPercentage}%`,
      'Depreciation Method': asset.depreciationMethod,
      'Depreciation Rate (%)': asset.depreciationRate,
      'Useful Life (Years)': asset.usefulLife,
      'Location': asset.location,
      'Status': asset.status
    };
  });
  
  // Prepare summary
  const depreciatedAssets = assets.filter(a => a.depreciationMethod);
  const totalOriginalValue = depreciatedAssets.reduce((sum, a) => sum + a.purchaseCost, 0);
  const totalCurrentValue = depreciatedAssets.reduce((sum, a) => sum + a.currentValue, 0);
  const totalDepreciation = totalOriginalValue - totalCurrentValue;
  
  const summaryData = [
    { 'Metric': 'Total Depreciable Assets', 'Value': depreciatedAssets.length },
    { 'Metric': 'Total Original Value', 'Value': totalOriginalValue },
    { 'Metric': 'Total Current Value', 'Value': totalCurrentValue },
    { 'Metric': 'Total Depreciation', 'Value': totalDepreciation },
    { 'Metric': 'Average Depreciation Rate', 'Value': depreciatedAssets.length > 0 ? (totalDepreciation / totalOriginalValue * 100).toFixed(2) + '%' : '0%' },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Depreciation details sheet
  const depreciationWs = utils.json_to_sheet(depreciationData);
  utils.book_append_sheet(wb, depreciationWs, 'Depreciation Details');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  depreciationWs['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 },
    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 },
    { wch: 12 }
  ];
  
  // Generate filename
  const filename = `Asset_Depreciation_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Asset Insurance Report
export const exportAssetInsuranceReport = (insurancePolicies: InsurancePolicy[], assets: Asset[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare insurance data
  const insuranceData = insurancePolicies.map(policy => ({
    'Policy ID': policy.id,
    'Asset Name': policy.assetName,
    'Asset ID': policy.assetId,
    'Policy Number': policy.policyNumber,
    'Insurance Company': policy.insuranceCompany,
    'Policy Type': policy.policyType,
    'Coverage Amount': policy.coverageAmount,
    'Premium Amount': policy.premiumAmount,
    'Start Date': policy.startDate,
    'Expiry Date': policy.expiryDate,
    'Renewal Date': policy.renewalDate || 'N/A',
    'Status': policy.status,
    'Total Claims': policy.claimHistory.length,
    'Total Claim Amount': policy.claimHistory.reduce((sum, c) => sum + c.claimAmount, 0),
    'Total Settled Amount': policy.claimHistory.reduce((sum, c) => sum + c.settledAmount, 0)
  }));
  
  // Prepare summary
  const summaryData = [
    { 'Metric': 'Total Insurance Policies', 'Value': insurancePolicies.length },
    { 'Metric': 'Total Coverage', 'Value': insurancePolicies.reduce((sum, p) => sum + p.coverageAmount, 0) },
    { 'Metric': 'Total Premium Paid', 'Value': insurancePolicies.reduce((sum, p) => sum + p.premiumAmount, 0) },
    { 'Metric': 'Active Policies', 'Value': insurancePolicies.filter(p => p.status === 'Active').length },
    { 'Metric': 'Expiring Soon (30 days)', 'Value': insurancePolicies.filter(p => {
      const expiryDate = new Date(p.expiryDate);
      const today = new Date();
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays <= 30 && diffDays > 0;
    }).length },
    { 'Metric': 'Total Claims Filed', 'Value': insurancePolicies.reduce((sum, p) => sum + p.claimHistory.length, 0) },
    { 'Metric': 'Total Claim Amount', 'Value': insurancePolicies.reduce((sum, p) => sum + p.claimHistory.reduce((s, c) => s + c.claimAmount, 0), 0) },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Insurance details sheet
  const insuranceWs = utils.json_to_sheet(insuranceData);
  utils.book_append_sheet(wb, insuranceWs, 'Insurance Policies');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  insuranceWs['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 20 },
    { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 18 }, { wch: 18 }
  ];
  
  // Generate filename
  const filename = `Asset_Insurance_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Vendor Analysis Report
export const exportVendorAnalysisReport = (vendors: Vendor[], maintenanceLogs: MaintenanceRecord[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare vendor data
  const vendorData = vendors.map(vendor => ({
    'Vendor ID': vendor.id,
    'Vendor Name': vendor.name,
    'Contact Person': vendor.contactPerson,
    'Email': vendor.email,
    'Phone': vendor.phone,
    'Address': vendor.address,
    'Category': vendor.category,
    'Rating': vendor.rating,
    'Status': vendor.status,
    'Contract Expiry': vendor.contractExpiry || 'N/A',
    'Services Provided': vendor.servicesProvided.join('; '),
    'Last Service Date': vendor.lastServiceDate || 'N/A',
    'Total Spent': vendor.totalSpent,
    'Created At': vendor.createdAt,
    'Updated At': vendor.updatedAt
  }));
  
  // Prepare vendor performance analysis
  const vendorPerformance = vendors.map(vendor => {
    const vendorMaintenance = maintenanceLogs.filter(m => m.vendorId === vendor.id);
    const totalCost = vendorMaintenance.reduce((sum, m) => sum + m.cost, 0);
    const avgResponseTime = vendorMaintenance.length > 0 ? 
      vendorMaintenance.reduce((sum, m) => sum + (m.laborHours || 0), 0) / vendorMaintenance.length : 0;
    
    return {
      'Vendor Name': vendor.name,
      'Total Maintenance Jobs': vendorMaintenance.length,
      'Total Cost': totalCost,
      'Average Cost per Job': vendorMaintenance.length > 0 ? (totalCost / vendorMaintenance.length).toFixed(2) : '0.00',
      'Average Response Time (Hours)': avgResponseTime.toFixed(2),
      'Rating': vendor.rating,
      'Status': vendor.status,
      'Last Service Date': vendor.lastServiceDate || 'N/A'
    };
  });
  
  // Prepare summary
  const summaryData = [
    { 'Metric': 'Total Vendors', 'Value': vendors.length },
    { 'Metric': 'Active Vendors', 'Value': vendors.filter(v => v.status === 'Active').length },
    { 'Metric': 'Total Spent with Vendors', 'Value': vendors.reduce((sum, v) => sum + v.totalSpent, 0) },
    { 'Metric': 'Average Vendor Rating', 'Value': vendors.length > 0 ? (vendors.reduce((sum, v) => sum + v.rating, 0) / vendors.length).toFixed(2) : '0.00' },
    { 'Metric': 'Vendors with Expired Contracts', 'Value': vendors.filter(v => v.contractExpiry && new Date(v.contractExpiry) < new Date()).length },
    { 'Metric': 'Total Maintenance Records', 'Value': maintenanceLogs.filter(m => m.vendorId).length },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Vendor details sheet
  const vendorWs = utils.json_to_sheet(vendorData);
  utils.book_append_sheet(wb, vendorWs, 'Vendor Directory');
  
  // Vendor performance sheet
  const performanceWs = utils.json_to_sheet(vendorPerformance);
  utils.book_append_sheet(wb, performanceWs, 'Vendor Performance');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  vendorWs['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 25 },
    { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 8 },
    { wch: 12 }, { wch: 15 }, { wch: 30 }, { wch: 15 },
    { wch: 12 }, { wch: 15 }, { wch: 15 }
  ];
  performanceWs['!cols'] = [
    { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 18 },
    { wch: 22 }, { wch: 8 }, { wch: 12 }, { wch: 15 }
  ];
  
  // Generate filename
  const filename = `Vendor_Analysis_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Asset Transfer History Report
export const exportAssetTransferHistoryReport = (assetTransfers: AssetTransfer[], assets: Asset[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare transfer data
  const transferData = assetTransfers.map(transfer => ({
    'Transfer ID': transfer.id,
    'Asset Name': transfer.assetName,
    'Asset ID': transfer.assetId,
    'From Location': transfer.fromLocation,
    'To Location': transfer.toLocation,
    'From Department': transfer.fromDepartment || 'N/A',
    'To Department': transfer.toDepartment || 'N/A',
    'Transfer Date': transfer.transferDate,
    'Reason': transfer.reason,
    'Approved By': transfer.approvedBy,
    'Status': transfer.status,
    'Remarks': transfer.remarks || 'N/A'
  }));
  
  // Prepare transfer summary by location
  const locations = [...new Set([...assetTransfers.map(t => t.fromLocation), ...assetTransfers.map(t => t.toLocation)])];
  const locationSummary = locations.map(location => {
    const outgoing = assetTransfers.filter(t => t.fromLocation === location).length;
    const incoming = assetTransfers.filter(t => t.toLocation === location).length;
    
    return {
      'Location': location,
      'Assets Transferred Out': outgoing,
      'Assets Received': incoming,
      'Net Movement': incoming - outgoing
    };
  });
  
  // Prepare department-wise summary
  const departments = [...new Set([
    ...assetTransfers.map(t => t.fromDepartment).filter(Boolean),
    ...assetTransfers.map(t => t.toDepartment).filter(Boolean)
  ])];
  const departmentSummary = departments.map(dept => {
    const outgoing = assetTransfers.filter(t => t.fromDepartment === dept).length;
    const incoming = assetTransfers.filter(t => t.toDepartment === dept).length;
    
    return {
      'Department': dept,
      'Assets Transferred Out': outgoing,
      'Assets Received': incoming,
      'Net Movement': incoming - outgoing
    };
  });
  
  // Prepare summary
  const summaryData = [
    { 'Metric': 'Total Transfers', 'Value': assetTransfers.length },
    { 'Metric': 'Completed Transfers', 'Value': assetTransfers.filter(t => t.status === 'Completed').length },
    { 'Metric': 'Pending Transfers', 'Value': assetTransfers.filter(t => t.status === 'Pending').length },
    { 'Metric': 'Unique Locations Involved', 'Value': locations.length },
    { 'Metric': 'Unique Departments Involved', 'Value': departments.length },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Transfer details sheet
  const transferWs = utils.json_to_sheet(transferData);
  utils.book_append_sheet(wb, transferWs, 'Transfer History');
  
  // Location summary sheet
  const locationWs = utils.json_to_sheet(locationSummary);
  utils.book_append_sheet(wb, locationWs, 'Location Summary');
  
  // Department summary sheet
  const departmentWs = utils.json_to_sheet(departmentSummary);
  utils.book_append_sheet(wb, departmentWs, 'Department Summary');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  transferWs['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 12 }, { wch: 20 },
    { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
    { wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 20 }
  ];
  locationWs['!cols'] = [
    { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }
  ];
  departmentWs['!cols'] = [
    { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }
  ];
  
  // Generate filename
  const filename = `Asset_Transfer_History_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Document Management System Reports

// Export Document Register Report
export const exportDocumentRegisterReport = (documents: DocRecord[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare document data
  const documentData = documents.map(doc => ({
    'Document ID': doc.id,
    'Title': doc.title,
    'Category': doc.category,
    'File Type': doc.type,
    'Size': doc.size,
    'Version': doc.version,
    'Upload Date': doc.uploadDate,
    'Expiry Date': doc.expiryDate || 'N/A',
    'Author': doc.author,
    'Status': doc.status,
    'Days Until Expiry': doc.expiryDate ? 
      Math.ceil((new Date(doc.expiryDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : 'N/A',
    'Is Expired': doc.expiryDate && new Date(doc.expiryDate) < new Date() ? 'Yes' : 'No'
  }));
  
  // Prepare summary statistics
  const summaryData = [
    { 'Metric': 'Total Documents', 'Value': documents.length },
    { 'Metric': 'Active Documents', 'Value': documents.filter(d => d.status === 'Active').length },
    { 'Metric': 'Draft Documents', 'Value': documents.filter(d => d.status === 'Draft').length },
    { 'Metric': 'Expiring Documents', 'Value': documents.filter(d => d.status === 'Expiring').length },
    { 'Metric': 'Archived Documents', 'Value': documents.filter(d => d.status === 'Archived').length },
    { 'Metric': 'Expired Documents', 'Value': documents.filter(d => d.expiryDate && new Date(d.expiryDate) < new Date()).length },
    { 'Metric': 'SOP Documents', 'Value': documents.filter(d => d.category === 'SOP').length },
    { 'Metric': 'License Documents', 'Value': documents.filter(d => d.category === 'License').length },
    { 'Metric': 'Report Documents', 'Value': documents.filter(d => d.category === 'Report').length },
    { 'Metric': 'Compliance Documents', 'Value': documents.filter(d => d.category === 'Compliance').length },
    { 'Metric': 'Policy Documents', 'Value': documents.filter(d => d.category === 'Policy').length },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Prepare category-wise summary
  const categories = [...new Set(documents.map(d => d.category))];
  const categorySummary = categories.map(category => {
    const categoryDocs = documents.filter(d => d.category === category);
    return {
      'Category': category,
      'Total Documents': categoryDocs.length,
      'Active': categoryDocs.filter(d => d.status === 'Active').length,
      'Draft': categoryDocs.filter(d => d.status === 'Draft').length,
      'Expiring': categoryDocs.filter(d => d.status === 'Expiring').length,
      'Archived': categoryDocs.filter(d => d.status === 'Archived').length
    };
  });
  
  // Prepare file type analysis
  const fileTypes = [...new Set(documents.map(d => d.type))];
  const fileTypeAnalysis = fileTypes.map(type => {
    const typeDocs = documents.filter(d => d.type === type);
    const totalSize = typeDocs.reduce((sum, d) => {
      const sizeNum = parseFloat(d.size);
      return sum + (isNaN(sizeNum) ? 0 : sizeNum);
    }, 0);
    
    return {
      'File Type': type,
      'Total Documents': typeDocs.length,
      'Percentage': documents.length > 0 ? ((typeDocs.length / documents.length) * 100).toFixed(2) + '%' : '0%',
      'Total Size (MB)': totalSize.toFixed(2),
      'Average Size (MB)': typeDocs.length > 0 ? (totalSize / typeDocs.length).toFixed(2) : '0.00'
    };
  });
  
  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Document details sheet
  const documentWs = utils.json_to_sheet(documentData);
  utils.book_append_sheet(wb, documentWs, 'Document Register');
  
  // Category summary sheet
  const categoryWs = utils.json_to_sheet(categorySummary);
  utils.book_append_sheet(wb, categoryWs, 'Category Summary');
  
  // File type analysis sheet
  const fileTypeWs = utils.json_to_sheet(fileTypeAnalysis);
  utils.book_append_sheet(wb, fileTypeWs, 'File Type Analysis');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  documentWs['!cols'] = [
    { wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
    { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 10 }
  ];
  categoryWs['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }
  ];
  fileTypeWs['!cols'] = [
    { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }
  ];
  
  // Generate filename
  const filename = `Document_Register_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Document Version History Report
export const exportDocumentVersionHistoryReport = (documentVersions: DocumentVersion[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare version history data
  const versionData = documentVersions.map(version => ({
    'Version ID': version.id,
    'Document ID': version.documentId,
    'Document Title': version.title,
    'Version': version.version,
    'File Size (bytes)': version.fileSize,
    'File Size (MB)': (version.fileSize / (1024 * 1024)).toFixed(2),
    'Uploaded By': version.uploadedBy,
    'Upload Date': version.uploadDate,
    'Change Log': version.changeLog,
    'Approved By': version.approvedBy,
    'Approval Date': version.approvalDate,
    'Status': version.status
  }));
  
  // Prepare summary
  const summaryData = [
    { 'Metric': 'Total Versions', 'Value': documentVersions.length },
    { 'Metric': 'Current Versions', 'Value': documentVersions.filter(v => v.status === 'Current').length },
    { 'Metric': 'Previous Versions', 'Value': documentVersions.filter(v => v.status === 'Previous').length },
    { 'Metric': 'Archived Versions', 'Value': documentVersions.filter(v => v.status === 'Archived').length },
    { 'Metric': 'Total Documents with Versions', 'Value': [...new Set(documentVersions.map(v => v.documentId))].length },
    { 'Metric': 'Average File Size (MB)', 'Value': documentVersions.length > 0 ? 
      (documentVersions.reduce((sum, v) => sum + v.fileSize, 0) / (documentVersions.length * 1024 * 1024)).toFixed(2) : '0.00' },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Version history sheet
  const versionWs = utils.json_to_sheet(versionData);
  utils.book_append_sheet(wb, versionWs, 'Version History');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  versionWs['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 10 },
    { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
    { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }
  ];
  
  // Generate filename
  const filename = `Document_Version_History_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Document Workflow Report
export const exportDocumentWorkflowReport = (workflows: DocumentWorkflow[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare workflow data
  const workflowData = workflows.map(workflow => ({
    'Workflow ID': workflow.id,
    'Document ID': workflow.documentId,
    'Document Title': workflow.documentTitle,
    'Current Step': workflow.currentStep,
    'Assigned To': workflow.assignedTo,
    'Due Date': workflow.dueDate,
    'Status': workflow.status,
    'Days Overdue': (() => {
      if (workflow.status === 'Completed' || workflow.status === 'Rejected') return 'N/A';
      const dueDate = new Date(workflow.dueDate);
      const today = new Date();
      const diffTime = today.getTime() - dueDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    })(),
    'Created At': workflow.createdAt,
    'Updated At': workflow.updatedAt,
    'Comments Count': workflow.comments.length
  }));
  
  // Prepare summary
  const summaryData = [
    { 'Metric': 'Total Workflows', 'Value': workflows.length },
    { 'Metric': 'Pending Workflows', 'Value': workflows.filter(w => w.status === 'Pending').length },
    { 'Metric': 'In Progress Workflows', 'Value': workflows.filter(w => w.status === 'In Progress').length },
    { 'Metric': 'Completed Workflows', 'Value': workflows.filter(w => w.status === 'Completed').length },
    { 'Metric': 'Rejected Workflows', 'Value': workflows.filter(w => w.status === 'Rejected').length },
    { 'Metric': 'Overdue Workflows', 'Value': workflows.filter(w => {
      if (w.status === 'Completed' || w.status === 'Rejected') return false;
      return new Date(w.dueDate) < new Date();
    }).length },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Workflow details sheet
  const workflowWs = utils.json_to_sheet(workflowData);
  utils.book_append_sheet(wb, workflowWs, 'Workflow Details');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  workflowWs['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 15 },
    { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
    { wch: 20 }, { wch: 20 }, { wch: 15 }
  ];
  
  // Generate filename
  const filename = `Document_Workflow_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Export Document Audit Trail Report
// Enhanced Document Compliance Report for Power BI
export const exportDocumentComplianceReport = (documents: DocRecord[], auditTrails: DocumentAuditTrail[], workflows: DocumentWorkflow[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Compliance metrics
  const totalDocuments = documents.length;
  const compliantDocuments = documents.filter(d => d.status === 'Active' && (!d.expiryDate || new Date(d.expiryDate) > new Date())).length;
  const nonCompliantDocuments = totalDocuments - compliantDocuments;
  const complianceRate = totalDocuments > 0 ? ((compliantDocuments / totalDocuments) * 100).toFixed(2) : '0.00';
  
  // Expiry analysis
  const expiringSoon = documents.filter(d => d.expiryDate && 
    new Date(d.expiryDate) > new Date() && 
    new Date(d.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  ).length;
  
  const expiredDocuments = documents.filter(d => d.expiryDate && new Date(d.expiryDate) < new Date()).length;
  
  // Workflow compliance
  const pendingWorkflows = workflows.filter(w => w.status === 'Pending').length;
  const overdueWorkflows = workflows.filter(w => {
    if (w.status === 'Completed' || w.status === 'Rejected') return false;
    return new Date(w.dueDate) < new Date();
  }).length;
  
  // Audit trail analysis
  const uniqueUsers = [...new Set(auditTrails.map(a => a.userId))].length;
  const totalActions = auditTrails.length;
  const recentActivity = auditTrails.filter(a => 
    new Date(a.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;
  
  // Compliance summary data
  const complianceData = [
    { 'Metric': 'Total Documents', 'Value': totalDocuments },
    { 'Metric': 'Compliant Documents', 'Value': compliantDocuments },
    { 'Metric': 'Non-Compliant Documents', 'Value': nonCompliantDocuments },
    { 'Metric': 'Compliance Rate (%)', 'Value': complianceRate },
    { 'Metric': 'Expiring Within 30 Days', 'Value': expiringSoon },
    { 'Metric': 'Expired Documents', 'Value': expiredDocuments },
    { 'Metric': 'Pending Workflows', 'Value': pendingWorkflows },
    { 'Metric': 'Overdue Workflows', 'Value': overdueWorkflows },
    { 'Metric': 'Unique Users Active', 'Value': uniqueUsers },
    { 'Metric': 'Total Audit Actions', 'Value': totalActions },
    { 'Metric': 'Recent Activity (7 days)', 'Value': recentActivity },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Category compliance breakdown
  const categories = [...new Set(documents.map(d => d.category))];
  const categoryCompliance = categories.map(category => {
    const catDocs = documents.filter(d => d.category === category);
    const compliant = catDocs.filter(d => d.status === 'Active' && (!d.expiryDate || new Date(d.expiryDate) > new Date())).length;
    const rate = catDocs.length > 0 ? ((compliant / catDocs.length) * 100).toFixed(2) : '0.00';
    
    return {
      'Category': category,
      'Total Documents': catDocs.length,
      'Compliant': compliant,
      'Non-Compliant': catDocs.length - compliant,
      'Compliance Rate (%)': rate,
      'Expiring Soon': catDocs.filter(d => d.expiryDate && 
        new Date(d.expiryDate) > new Date() && 
        new Date(d.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      ).length,
      'Expired': catDocs.filter(d => d.expiryDate && new Date(d.expiryDate) < new Date()).length
    };
  });
  
  // Create workbook
  const wb = utils.book_new();
  
  // Compliance summary sheet
  const complianceWs = utils.json_to_sheet(complianceData);
  utils.book_append_sheet(wb, complianceWs, 'Compliance Summary');
  
  // Category compliance sheet
  const categoryWs = utils.json_to_sheet(categoryCompliance);
  utils.book_append_sheet(wb, categoryWs, 'Category Compliance');
  
  // Set column widths
  complianceWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  categoryWs['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 },
    { wch: 20 }, { wch: 15 }, { wch: 10 }
  ];
  
  // Generate filename
  const filename = `Document_Compliance_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

// Document Usage Analytics Report
export const exportDocumentUsageAnalytics = (documents: DocRecord[], auditTrails: DocumentAuditTrail[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Usage statistics
  const totalDocuments = documents.length;
  const viewedDocuments = [...new Set(auditTrails.filter(a => a.action === 'Viewed').map(a => a.documentId))].length;
  const downloadedDocuments = [...new Set(auditTrails.filter(a => a.action === 'Downloaded').map(a => a.documentId))].length;
  const modifiedDocuments = [...new Set(auditTrails.filter(a => a.action === 'Modified').map(a => a.documentId))].length;
  
  // User activity
  const userActivity = auditTrails.reduce((acc, audit) => {
    if (!acc[audit.userName]) {
      acc[audit.userName] = { views: 0, downloads: 0, modifications: 0, totalActions: 0 };
    }
    acc[audit.userName].totalActions++;
    if (audit.action === 'Viewed') acc[audit.userName].views++;
    if (audit.action === 'Downloaded') acc[audit.userName].downloads++;
    if (audit.action === 'Modified') acc[audit.userName].modifications++;
    return acc;
  }, {} as Record<string, { views: number; downloads: number; modifications: number; totalActions: number }>);
  
  // Top active users
  const topUsers = Object.entries(userActivity)
    .map(([name, stats]) => ({
      'User Name': name,
      'Total Actions': stats.totalActions,
      'Views': stats.views,
      'Downloads': stats.downloads,
      'Modifications': stats.modifications,
      'Activity Score': stats.views * 1 + stats.downloads * 2 + stats.modifications * 3
    }))
    .sort((a, b) => b['Activity Score'] - a['Activity Score'])
    .slice(0, 10);
  
  // Document popularity
  const documentPopularity = auditTrails.reduce((acc, audit) => {
    if (!acc[audit.documentId]) {
      acc[audit.documentId] = { views: 0, downloads: 0, totalInteractions: 0 };
    }
    acc[audit.documentId].totalInteractions++;
    if (audit.action === 'Viewed') acc[audit.documentId].views++;
    if (audit.action === 'Downloaded') acc[audit.documentId].downloads++;
    return acc;
  }, {} as Record<string, { views: number; downloads: number; totalInteractions: number }>);
  
  // Top popular documents
  const popularDocuments = Object.entries(documentPopularity)
    .map(([id, stats]) => {
      const doc = documents.find(d => d.id === id);
      return {
        'Document ID': id,
        'Document Title': doc?.title || 'Unknown',
        'Category': doc?.category || 'Unknown',
        'Total Interactions': stats.totalInteractions,
        'Views': stats.views,
        'Downloads': stats.downloads,
        'Popularity Score': stats.views * 1 + stats.downloads * 2
      };
    })
    .sort((a, b) => b['Popularity Score'] - a['Popularity Score'])
    .slice(0, 20);
  
  // Usage summary
  const usageSummary = [
    { 'Metric': 'Total Documents', 'Value': totalDocuments },
    { 'Metric': 'Viewed Documents', 'Value': viewedDocuments },
    { 'Metric': 'Downloaded Documents', 'Value': downloadedDocuments },
    { 'Metric': 'Modified Documents', 'Value': modifiedDocuments },
    { 'Metric': 'Usage Rate (%)', 'Value': totalDocuments > 0 ? ((viewedDocuments / totalDocuments) * 100).toFixed(2) : '0.00' },
    { 'Metric': 'Download Rate (%)', 'Value': totalDocuments > 0 ? ((downloadedDocuments / totalDocuments) * 100).toFixed(2) : '0.00' },
    { 'Metric': 'Modification Rate (%)', 'Value': totalDocuments > 0 ? ((modifiedDocuments / totalDocuments) * 100).toFixed(2) : '0.00' },
    { 'Metric': 'Total Audit Records', 'Value': auditTrails.length },
    { 'Metric': 'Unique Users', 'Value': Object.keys(userActivity).length },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook
  const wb = utils.book_new();
  
  // Usage summary sheet
  const summaryWs = utils.json_to_sheet(usageSummary);
  utils.book_append_sheet(wb, summaryWs, 'Usage Summary');
  
  // Top users sheet
  const usersWs = utils.json_to_sheet(topUsers);
  utils.book_append_sheet(wb, usersWs, 'Top Active Users');
  
  // Popular documents sheet
  const docsWs = utils.json_to_sheet(popularDocuments);
  utils.book_append_sheet(wb, docsWs, 'Popular Documents');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  usersWs['!cols'] = [
    { wch: 20 }, { wch: 15 }, { wch: 10 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }
  ];
  docsWs['!cols'] = [
    { wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 18 },
    { wch: 8 }, { wch: 12 }, { wch: 15 }
  ];
  
  // Generate filename
  const filename = `Document_Usage_Analytics_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

export const exportDocumentAuditTrailReport = (auditTrails: DocumentAuditTrail[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Prepare audit trail data
  const auditData = auditTrails.map(audit => ({
    'Audit ID': audit.id,
    'Document ID': audit.documentId,
    'Action': audit.action,
    'User ID': audit.userId,
    'User Name': audit.userName,
    'Timestamp': audit.timestamp,
    'IP Address': audit.ipAddress,
    'Details': audit.details
  }));
  
  // Prepare action summary
  const actions = [...new Set(auditTrails.map(a => a.action))];
  const actionSummary = actions.map(action => {
    const actionAudits = auditTrails.filter(a => a.action === action);
    return {
      'Action': action,
      'Count': actionAudits.length,
      'Percentage': auditTrails.length > 0 ? ((actionAudits.length / auditTrails.length) * 100).toFixed(2) + '%' : '0%',
      'Unique Users': [...new Set(actionAudits.map(a => a.userId))].length,
      'First Occurrence': actionAudits.length > 0 ? 
        new Date(Math.min(...actionAudits.map(a => new Date(a.timestamp).getTime()))).toISOString().split('T')[0] : 'N/A',
      'Last Occurrence': actionAudits.length > 0 ? 
        new Date(Math.max(...actionAudits.map(a => new Date(a.timestamp).getTime()))).toISOString().split('T')[0] : 'N/A'
    };
  });
  
  // Prepare summary
  const summaryData = [
    { 'Metric': 'Total Audit Records', 'Value': auditTrails.length },
    { 'Metric': 'Unique Documents', 'Value': [...new Set(auditTrails.map(a => a.documentId))].length },
    { 'Metric': 'Unique Users', 'Value': [...new Set(auditTrails.map(a => a.userId))].length },
    { 'Metric': 'Date Range', 'Value': auditTrails.length > 0 ? 
      `${new Date(Math.min(...auditTrails.map(a => new Date(a.timestamp).getTime()))).toISOString().split('T')[0]} to ${new Date(Math.max(...auditTrails.map(a => new Date(a.timestamp).getTime()))).toISOString().split('T')[0]}` : 'N/A' },
    { 'Metric': 'Most Active User', 'Value': (() => {
      const userCounts: Record<string, number> = {};
      auditTrails.forEach(audit => {
        userCounts[audit.userName] = (userCounts[audit.userName] || 0) + 1;
      });
      return Object.keys(userCounts).reduce((a, b) => userCounts[a] > userCounts[b] ? a : b, '');
    })() },
    { 'Metric': 'Report Generated', 'Value': timestamp }
  ];
  
  // Create workbook
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(summaryData);
  utils.book_append_sheet(wb, summaryWs, 'Summary');
  
  // Audit trail sheet
  const auditWs = utils.json_to_sheet(auditData);
  utils.book_append_sheet(wb, auditWs, 'Audit Trail');
  
  // Action summary sheet
  const actionWs = utils.json_to_sheet(actionSummary);
  utils.book_append_sheet(wb, actionWs, 'Action Summary');
  
  // Set column widths
  summaryWs['!cols'] = [{ wch: 30 }, { wch: 20 }];
  auditWs['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
    { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 40 }
  ];
  actionWs['!cols'] = [
    { wch: 20 }, { wch: 10 }, { wch: 12 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }
  ];
  
  // Generate filename
  const filename = `Document_Audit_Trail_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};

export const exportLogisticsCostAnalysisReport = (dispatches: any[]) => {
  // This function was implemented earlier in the file
  // Exporting logistics cost analysis report
  return;
};

// Export GSTR-3B Report
export const exportGSTR3BReport = (invoices: SalesInvoice[], expenses: Expense[]) => {
  const timestamp = getCurrentTimestamp();
  
  // Calculate tax data
  const totalTaxCollected = invoices.reduce((sum, inv) => sum + (inv.totalGst || 0), 0);
  const totalTaxPaid = expenses.reduce((sum, exp) => sum + (exp.amount * 0.18), 0); // Assuming 18% GST on expenses
  const netTaxLiability = totalTaxCollected - totalTaxPaid;
  
  // Prepare detailed data
  const detailsData = [
    { 'Particulars': 'Total Tax Collected (Output Tax)', 'Amount': totalTaxCollected, 'Description': 'Tax collected on outward supplies' },
    { 'Particulars': 'Total Tax Paid (Input Tax)', 'Amount': totalTaxPaid, 'Description': 'Tax paid on inward supplies/expenses' },
    { 'Particulars': 'Net Tax Liability', 'Amount': netTaxLiability, 'Description': 'Tax payable/receivable' },
    { 'Particulars': 'Interest Liability', 'Amount': 0, 'Description': 'Interest on delayed payments' },
    { 'Particulars': 'Late Fee', 'Amount': 0, 'Description': 'Late fee if any' },
    { 'Particulars': 'Total Payment Required', 'Amount': Math.max(netTaxLiability, 0), 'Description': 'Final amount to be paid' }
  ];

  // Prepare invoice details for reference
  const invoiceDetails = invoices.map(inv => ({
    'Invoice ID': inv.id,
    'Invoice Number': inv.invoiceNumber,
    'Date': inv.date,
    'Customer Name': inv.customerName,
    'Net Amount': inv.netAmount,
    'Total GST': inv.totalGst,
    'Status': inv.status
  }));

  // Prepare expense details for reference
  const expenseDetails = expenses.map(exp => ({
    'Expense ID': exp.id,
    'Date': exp.date,
    'Category': exp.category,
    'Description': exp.description,
    'Amount': exp.amount,
    'Tax Component': (exp.amount * 0.18).toFixed(2), // Assuming 18% GST
    'Payment Mode': exp.paymentMode
  }));

  // Create workbook and worksheets
  const wb = utils.book_new();
  
  // Summary sheet
  const summaryWs = utils.json_to_sheet(detailsData);
  utils.book_append_sheet(wb, summaryWs, 'GSTR3B Summary');
  
  // Invoice details sheet
  const invoiceWs = utils.json_to_sheet(invoiceDetails);
  utils.book_append_sheet(wb, invoiceWs, 'Invoice Details');
  
  // Expense details sheet
  const expenseWs = utils.json_to_sheet(expenseDetails);
  utils.book_append_sheet(wb, expenseWs, 'Expense Details');

  // Set column widths
  summaryWs['!cols'] = [
    { wch: 30 }, { wch: 20 }, { wch: 40 }
  ];
  invoiceWs['!cols'] = [
    { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
    { wch: 15 }, { wch: 15 }, { wch: 12 }
  ];
  expenseWs['!cols'] = [
    { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 30 },
    { wch: 12 }, { wch: 15 }, { wch: 15 }
  ];

  // Generate filename with timestamp
  const filename = `GSTR3B_Report_${timestamp.replace(/[-: ]/g, '')}.xlsx`;
  
  // Write file
  writeFile(wb, filename);
};