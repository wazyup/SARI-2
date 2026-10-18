'use client';

import { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { recordFeatureUsage } from '@/lib/featureTracker';

interface SaleItem {
  id: string;
  quantity: number;
  priceAtSale: number;
  product: {
    name: string;
  };
}

interface Customer {
  name: string;
}

interface UtangRecord {
  customer: Customer;
}

interface Sale {
  id: string;
  saleDate: string;
  totalAmount: number;
  paymentMethod: string;
  receivedAmount: number;
  changeAmount: number;
  Items: SaleItem[];
  UtangRecords: UtangRecord[];
}

export default function ReportsClient() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [filterRange, setFilterRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    recordFeatureUsage('reports');
    fetch('/api/sales')
      .then(res => res.json())
      .then(data => {
        setSales(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const getFilteredSales = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return sales.filter(s => {
      const saleDate = new Date(s.saleDate);
      if (filterRange === 'TODAY') return saleDate >= startOfToday;
      if (filterRange === 'WEEK') return saleDate >= sevenDaysAgo;
      if (filterRange === 'MONTH') return saleDate >= startOfMonth;
      return true;
    });
  };

  const filteredSales = getFilteredSales();
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalCashSales = filteredSales.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.totalAmount, 0);
  const totalCreditSales = filteredSales.filter(s => s.paymentMethod === 'CREDIT').reduce((sum, s) => sum + s.totalAmount, 0);

  const handleExportCSV = () => {
    if (filteredSales.length === 0) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Transaction ID,Date/Time,Items,Payment Method,Amount Paid (₱)\n';

    filteredSales.forEach(s => {
      const itemsString = s.Items.map(item => `${item.product.name} (${item.quantity})`).join('; ');
      const date = new Date(s.saleDate).toLocaleString().replace(/,/g, '');
      csvContent += `"${s.id}","${date}","${itemsString}","${s.paymentMethod}",${s.totalAmount}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SARI2_Sales_Report_${filterRange}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadFullDailyPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const res = await fetch('/api/reports/daily-audit');
      if (!res.ok) throw new Error('Failed to load audit telemetry');
      const audit = await res.json();

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(18);
      doc.setTextColor(33, 43, 54);
      doc.text('SARI 2 — Complete Store Operations & Audit Report', 14, 18);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Generated on: ${audit.reportDate} | System Date: ${new Date().toLocaleTimeString()}`, 14, 25);

      // Section 1: Business Model & Financial Overview
      const f = audit.financialOverview;
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text('1. Business Model & Financial Valuation', 14, 34);

      const finData = [
        ['Total Tracked Inventory Value (Retail)', `PHP ${f.totalInventoryValue.toLocaleString()}`],
        ['Total Sourcing Cost (Capital + Logistics Transpo)', `PHP ${f.totalInventoryCost.toLocaleString()}`],
        ['Embedded Transportation/Delivery Fees', `PHP ${f.totalTranspoEmbedded.toLocaleString()}`],
        ['Projected Inventory Profit Margin', `PHP ${f.projectedGrossProfit.toLocaleString()} (${f.grossMarginPercentage}%)`],
        ['Today\'s Gross Revenue', `PHP ${f.revenueToday.toLocaleString()}`],
        ['Cash Collected Today', `PHP ${f.cashToday.toLocaleString()}`],
        ['Credit (Utang) Created Today', `PHP ${f.creditToday.toLocaleString()}`],
        ['Total Outstanding Customer Receivables', `PHP ${f.totalReceivableDebt.toLocaleString()}`],
        ['Stock Loss / Damaged Goods Today', `PHP ${f.totalLossCostToday.toLocaleString()}`],
      ];

      autoTable(doc, {
        startY: 38,
        head: [['Metric', 'Amount (PHP)']],
        body: finData,
        theme: 'striped',
        styles: { fontSize: 8.5 },
        headStyles: { fillColor: [79, 70, 229] },
      });

      // Section 2: Sales Transactions Log Today
      const afterFinY = (doc as any).lastAutoTable.finalY + 10;
      doc.text('2. Today\'s Sales & Cashflow Log', 14, afterFinY);

      const salesRows = audit.sales.length === 0
        ? [['No sales recorded today', '—', '—', 'PHP 0.00']]
        : audit.sales.map((s: any) => [s.time, s.paymentMethod, s.itemsSummary, `PHP ${s.totalAmount.toLocaleString()}`]);

      autoTable(doc, {
        startY: afterFinY + 4,
        head: [['Time', 'Payment', 'Items Summary', 'Total']],
        body: salesRows,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [14, 165, 233] },
      });

      // Section 3: Active Utang & Customer Balances
      const afterSalesY = (doc as any).lastAutoTable.finalY + 10;
      doc.text('3. Customer Credit Ledger (Receivable Balances)', 14, afterSalesY);

      const debtorRows = audit.debtors.length === 0
        ? [['All customer credit accounts are fully settled', '—', 'PHP 0.00']]
        : audit.debtors.map((d: any) => [d.name, d.phone, `PHP ${d.balance.toLocaleString()}`]);

      autoTable(doc, {
        startY: afterSalesY + 4,
        head: [['Customer Name', 'Contact Number', 'Balance Due']],
        body: debtorRows,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [245, 158, 11] },
      });

      // Section 4: Inventory Adjustments, Restock & Losses
      doc.addPage();
      doc.text('4. Stock Adjustments, Losses & Inventory Restock History', 14, 18);

      const adjRows = audit.adjustments.length === 0
        ? [['No adjustments or losses recorded today', '—', '—', '—']]
        : audit.adjustments.map((a: any) => [a.time, a.productName, `${a.type} (${a.quantity})`, a.reason]);

      autoTable(doc, {
        startY: 22,
        head: [['Time', 'Product', 'Adjustment Type & Qty', 'Reason / Classification']],
        body: adjRows,
        theme: 'striped',
        styles: { fontSize: 8 },
        headStyles: { fillColor: [239, 68, 68] },
      });

      doc.save(`SARI2_Full_Daily_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Failed to generate full daily report PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Store Reports & Audits</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Multi-period sales telemetry, downloadable daily PDF audits, and spreadsheet export.
          </p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowGuide(!showGuide)} className="btn btn-secondary">
            {showGuide ? 'Hide Guide' : 'How to Use'}
          </button>
          <button onClick={handleExportCSV} className="btn btn-secondary" disabled={filteredSales.length === 0}>
            Export CSV
          </button>
          <button onClick={handleDownloadFullDailyPdf} disabled={isGeneratingPdf} className="btn btn-primary">
            {isGeneratingPdf ? 'Generating PDF...' : 'Download Full Daily PDF'}
          </button>
        </div>
      </div>

      {showGuide && (
        <div className="tutorial-box">
          <div style={{ flex: 1 }}>
            <h4 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Reports & Audit Guide</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.45 }}>
              1. <strong>Download Full Daily PDF:</strong> Generates a formal, printable PDF audit compiling inventory valuations, embedded transpo fees, today's sales, utang debtors, and stock loss adjustments.<br />
              2. <strong>Date Filters:</strong> Filter the sales log below between Today, Last 7 Days, or This Month.<br />
              3. <strong>CSV Export:</strong> Exports raw transaction rows for spreadsheet bookkeeping.
            </p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="kpi-grid">
        <div className="glass-panel kpi-card">
          <div className="kpi-title">Selected Revenue ({filterRange})</div>
          <div className="kpi-value">₱{totalRevenue.toLocaleString()}</div>
          <div className="kpi-desc">Total sales within filter</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '3px solid var(--success)' }}>
          <div className="kpi-title">Cash Sales</div>
          <div className="kpi-value">₱{totalCashSales.toLocaleString()}</div>
          <div className="kpi-desc">Liquid cash collected</div>
        </div>

        <div className="glass-panel kpi-card" style={{ borderLeft: '3px solid var(--warning)' }}>
          <div className="kpi-title">Credit Sales (Utang)</div>
          <div className="kpi-value">₱{totalCreditSales.toLocaleString()}</div>
          <div className="kpi-desc">Customer credit balance created</div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="glass-panel" style={{ padding: '0.75rem', display: 'flex', gap: '0.45rem', marginBottom: '1.15rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterRange('ALL')}
          className={`btn ${filterRange === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          All Time
        </button>
        <button
          onClick={() => setFilterRange('TODAY')}
          className={`btn ${filterRange === 'TODAY' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          Today
        </button>
        <button
          onClick={() => setFilterRange('WEEK')}
          className={`btn ${filterRange === 'WEEK' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          Last 7 Days
        </button>
        <button
          onClick={() => setFilterRange('MONTH')}
          className={`btn ${filterRange === 'MONTH' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
        >
          This Month
        </button>
      </div>

      {/* Sales Logs Table */}
      {loading ? (
        <p style={{ color: 'var(--text-muted)' }}>Loading transaction logs...</p>
      ) : (
        <div className="glass-panel table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Items Purchased</th>
                <th>Payment Method</th>
                <th>Customer (Credit Only)</th>
                <th>Total Price</th>
              </tr>
            </thead>
            <tbody>
              {filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '2rem' }}>
                    No sales recorded in this range
                  </td>
                </tr>
              ) : (
                filteredSales.map(s => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(s.saleDate).toLocaleString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        {s.Items.map(item => (
                          <div key={item.id} style={{ fontSize: '0.82rem' }}>
                            <span style={{ fontWeight: 600 }}>{item.product?.name}</span> × {item.quantity}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.paymentMethod === 'CASH' ? 'badge-success' : 'badge-warning'}`}>
                        {s.paymentMethod}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>
                      {s.paymentMethod === 'CREDIT' ? s.UtangRecords[0]?.customer?.name || 'Customer' : '—'}
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--secondary)' }}>
                      ₱{s.totalAmount.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
