import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // 1. Inventory Valuation & Sourcing Logistics
    const products = await prisma.product.findMany({
      include: {
        category: true,
        supplier: true
      },
      orderBy: { name: 'asc' }
    });

    const totalSKUs = products.length;
    const totalInventoryValue = products.reduce((acc, p) => acc + (p.stockQty * p.price), 0);
    const totalInventoryCost = products.reduce((acc, p) => acc + (p.stockQty * (p.costPrice + p.transpoFee)), 0);
    const totalTranspoEmbedded = products.reduce((acc, p) => acc + (p.stockQty * p.transpoFee), 0);
    const projectedProfit = totalInventoryValue - totalInventoryCost;
    const lowStockItems = products.filter(p => p.stockQty <= p.lowStockThreshold);

    // 2. Sales Ledger Today
    const salesToday = await prisma.sale.findMany({
      where: { saleDate: { gte: startOfToday } },
      include: {
        Items: {
          include: { product: true }
        },
        UtangRecords: {
          include: { customer: true }
        }
      },
      orderBy: { saleDate: 'desc' }
    });

    const revenueToday = salesToday.reduce((acc, s) => acc + s.totalAmount, 0);
    const cashToday = salesToday.filter(s => s.paymentMethod === 'CASH').reduce((acc, s) => acc + s.totalAmount, 0);
    const creditToday = salesToday.filter(s => s.paymentMethod === 'CREDIT').reduce((acc, s) => acc + s.totalAmount, 0);

    // 3. Customer Utang & Credit Receivables
    const customers = await prisma.customer.findMany({
      where: { balance: { gt: 0 } },
      orderBy: { balance: 'desc' }
    });
    const totalOutstandingDebt = customers.reduce((acc, c) => acc + c.balance, 0);

    // 4. Stock Adjustments & Losses Today
    const stockHistoryToday = await prisma.stockHistory.findMany({
      where: { createdAt: { gte: startOfToday } },
      include: {
        product: true,
        supplier: true
      },
      orderBy: { createdAt: 'desc' }
    });

    const lossesToday = stockHistoryToday.filter(h => h.type === 'LOSS');
    const totalLossCost = lossesToday.reduce((acc, h) => acc + ((h.costPrice || 0) * h.quantity), 0);

    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      reportDate: today.toLocaleDateString('en-PH', { dateStyle: 'full' }),
      financialOverview: {
        totalSKUs,
        totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        totalInventoryCost: Math.round(totalInventoryCost * 100) / 100,
        totalTranspoEmbedded: Math.round(totalTranspoEmbedded * 100) / 100,
        projectedGrossProfit: Math.round(projectedProfit * 100) / 100,
        grossMarginPercentage: totalInventoryValue > 0 ? Math.round((projectedProfit / totalInventoryValue) * 100) : 0,
        revenueToday: Math.round(revenueToday * 100) / 100,
        cashToday: Math.round(cashToday * 100) / 100,
        creditToday: Math.round(creditToday * 100) / 100,
        totalReceivableDebt: Math.round(totalOutstandingDebt * 100) / 100,
        totalLossCostToday: Math.round(totalLossCost * 100) / 100
      },
      lowStockAlerts: lowStockItems.map(p => ({
        id: p.id,
        name: p.name,
        currentStock: p.stockQty,
        threshold: p.lowStockThreshold,
        supplier: p.supplier?.name || 'Direct Wholesale'
      })),
      sales: salesToday.map(s => ({
        id: s.id,
        time: new Date(s.saleDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        paymentMethod: s.paymentMethod,
        totalAmount: s.totalAmount,
        itemsCount: s.Items.reduce((acc, i) => acc + i.quantity, 0),
        itemsSummary: s.Items.map(i => `${i.product.name} (x${i.quantity})`).join(', ')
      })),
      debtors: customers.map(c => ({
        name: c.name,
        phone: c.phone || 'N/A',
        balance: c.balance
      })),
      adjustments: stockHistoryToday.map(h => ({
        productName: h.product?.name,
        type: h.type,
        quantity: h.quantity,
        reason: h.reason,
        time: new Date(h.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }))
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
