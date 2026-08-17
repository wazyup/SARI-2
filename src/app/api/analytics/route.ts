import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Calculate general KPIs
    // Today's Sales
    const salesToday = await prisma.sale.aggregate({
      where: { saleDate: { gte: startOfToday } },
      _sum: { totalAmount: true }
    });

    // Month's Sales
    const salesMonth = await prisma.sale.aggregate({
      where: { saleDate: { gte: startOfMonth } },
      _sum: { totalAmount: true }
    });

    // Low Stock Count
    const products = await prisma.product.findMany({
      include: {
        category: true,
        supplier: true
      }
    });
    const lowStockItems = products.filter(p => p.stockQty <= p.lowStockThreshold);

    // Expiring Items (within next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const expiringItems = products.filter(p => 
      p.expirationDate && p.expirationDate <= thirtyDaysFromNow
    );

    // Outstanding credit (Utang)
    const customers = await prisma.customer.findMany();
    const totalUtang = customers.reduce((sum, c) => sum + c.balance, 0);

    // 2. Fetch Sale Items from last 30 days for forecasting and popularity
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          saleDate: { gte: thirtyDaysAgo }
        }
      },
      include: {
        sale: true,
        product: true
      }
    });

    // Group sales by product
    const productSalesMap: Record<string, { qty: number; sales: number; name: string; id: string }> = {};
    
    // Initialize map with all products
    for (const p of products) {
      productSalesMap[p.id] = { qty: 0, sales: 0, name: p.name, id: p.id };
    }

    for (const item of saleItems) {
      if (productSalesMap[item.productId]) {
        productSalesMap[item.productId].qty += item.quantity;
        productSalesMap[item.productId].sales += item.quantity * item.priceAtSale;
      }
    }

    const salesList = Object.values(productSalesMap);
    
    // Fast Movers (Top 3 by qty)
    const fastMovers = [...salesList]
      .filter(item => item.qty > 0)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 3);

    // Slow Movers (Bottom 3 by qty)
    const slowMovers = [...salesList]
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 3);

    // 3. Demand Forecasting & Restocking Recommendations (Moving Average of Sales)
    // We compute average weekly sales over last 4 weeks (30 days)
    const recommendations = [];
    for (const p of products) {
      const salesEntry = productSalesMap[p.id];
      const totalQtySold = salesEntry ? salesEntry.qty : 0;
      const weeklyAvgSales = totalQtySold / 4.2; // ~4.2 weeks in 30 days

      // Forecasted demand for next 7 days = weekly average (rounded up)
      const forecastedDemand = Math.max(1, Math.ceil(weeklyAvgSales * 1.2)); // +20% buffer

      // If stock is below lowStockThreshold OR stock is less than forecasted demand
      if (p.stockQty <= p.lowStockThreshold || p.stockQty < forecastedDemand) {
        const recommendQty = Math.ceil(forecastedDemand * 2 - p.stockQty); // Recommend enough for 2 weeks
        if (recommendQty > 0) {
          recommendations.push({
            productId: p.id,
            productName: p.name,
            currentStock: p.stockQty,
            lowStockThreshold: p.lowStockThreshold,
            forecastedWeeklyDemand: forecastedDemand,
            recommendedRestockQty: recommendQty,
            unit: p.unit,
            supplierName: p.supplier?.name || 'No Supplier Registered'
          });
        }
      }
    }

    // 4. Sales Trends (Daily sales for last 7 days for the chart)
    const salesChartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

      const daySales = await prisma.sale.aggregate({
        where: {
          saleDate: {
            gte: dayStart,
            lte: dayEnd
          }
        },
        _sum: {
          totalAmount: true
        }
      });

      salesChartData.push({
        date: dayStart.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' }),
        sales: daySales._sum.totalAmount || 0
      });
    }

    return NextResponse.json({
      kpis: {
        todaySales: salesToday._sum.totalAmount || 0,
        monthSales: salesMonth._sum.totalAmount || 0,
        lowStockCount: lowStockItems.length,
        expiringCount: expiringItems.length,
        totalUtang
      },
      fastMovers,
      slowMovers,
      recommendations,
      salesChartData
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
