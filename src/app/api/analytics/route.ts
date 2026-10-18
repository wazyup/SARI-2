import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { spawn } from 'child_process';
import path from 'path';

async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}

interface PythonAnalyticsOutput {
  success: boolean;
  engine: string;
  seasonalMultiplier: number;
  seasonalFactorName: string;
  fastMovers: any[];
  slowMovers: any[];
  trends: any[];
  associations: any[];
  recommendations: any[];
  groceryShoppingList: any;
  storeSummary: any;
}

function runPythonAnalyticsEngine(payload: any): Promise<PythonAnalyticsOutput> {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(process.cwd(), 'scripts', 'analytics_engine.py');
    const pyProcess = spawn('python', [scriptPath]);

    let stdoutData = '';
    let stderrData = '';

    pyProcess.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString();
    });

    pyProcess.stderr.on('data', (chunk) => {
      stderrData += chunk.toString();
    });

    pyProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdoutData);
          resolve(parsed);
        } catch (err) {
          reject(new Error(`Failed to parse Python output: ${stdoutData}`));
        }
      } else {
        reject(new Error(`Python process exited with code ${code}: ${stderrData}`));
      }
    });

    pyProcess.on('error', (err) => {
      reject(err);
    });

    pyProcess.stdin.write(JSON.stringify(payload));
    pyProcess.stdin.end();
  });
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const season = searchParams.get('season') || 'NORMAL';

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Fetch Store Data
    const [salesToday, salesMonth, products, customers] = await Promise.all([
      prisma.sale.aggregate({
        where: { saleDate: { gte: startOfToday } },
        _sum: { totalAmount: true }
      }),
      prisma.sale.aggregate({
        where: { saleDate: { gte: startOfMonth } },
        _sum: { totalAmount: true }
      }),
      prisma.product.findMany({
        include: {
          category: true,
          supplier: true
        }
      }),
      prisma.customer.findMany()
    ]);

    const lowStockItems = products.filter(p => p.stockQty <= p.lowStockThreshold);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiringItems = products.filter(p => p.expirationDate && p.expirationDate <= thirtyDaysFromNow);
    const totalUtang = customers.reduce((sum, c) => sum + c.balance, 0);

    // Calculate store profit and margin overview
    const totalInventoryValue = products.reduce((sum, p) => sum + (p.stockQty * p.price), 0);
    const totalInventoryCost = products.reduce((sum, p) => sum + (p.stockQty * (p.costPrice + p.transpoFee)), 0);
    const potentialProfit = totalInventoryValue - totalInventoryCost;

    // 2. Fetch 30-day Sales Items with timestamps and basket context
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          saleDate: { gte: thirtyDaysAgo }
        }
      },
      include: {
        sale: {
          select: { id: true, saleDate: true }
        },
        product: {
          select: { name: true }
        }
      }
    });

    const flattenedSaleItems = saleItems.map(item => ({
      saleId: item.sale.id,
      productId: item.productId,
      productName: item.product?.name,
      quantity: item.quantity,
      priceAtSale: item.priceAtSale,
      saleDate: item.sale.saleDate.toISOString()
    }));

    // 3. 7-Day Chart Data
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

    // 4. Delegate to Python EOQ & Dynamic Min-Max Predictive Engine
    let pythonResult: PythonAnalyticsOutput | null = null;
    try {
      pythonResult = await runPythonAnalyticsEngine({
        seasonalFactor: season,
        products,
        salesItems: flattenedSaleItems
      });
    } catch (pyErr) {
      console.warn('Python engine notice (fallback active):', pyErr);
    }

    // High quality Fallback if needed
    if (!pythonResult || !pythonResult.success) {
      const recs = products
        .filter(p => p.stockQty <= p.lowStockThreshold)
        .map(p => {
          const eoq = Math.max(5, Math.ceil(p.lowStockThreshold * 2.5));
          const minStock = p.lowStockThreshold + 3;
          const maxStock = minStock + eoq;
          const buyQty = Math.max(1, maxStock - p.stockQty);
          return {
            productId: p.id,
            productName: p.name,
            categoryName: p.category?.name || 'General',
            supplierName: p.supplier?.name || 'Direct Wholesale',
            currentStock: p.stockQty,
            costPrice: p.costPrice,
            transpoFee: p.transpoFee,
            unitPrice: p.price,
            profitPerUnit: p.price - (p.costPrice + p.transpoFee),
            profitMarginPct: p.price > 0 ? Math.round(((p.price - (p.costPrice + p.transpoFee)) / p.price) * 100) : 0,
            lowStockThreshold: p.lowStockThreshold,
            unit: p.unit,
            action: 'RESTOCK',
            recommendedRestockQty: buyQty,
            eoqQuantity: eoq,
            minTargetStock: minStock,
            maxTargetStock: maxStock,
            estimatedCost: buyQty * (p.costPrice + p.transpoFee),
            forecastedWeeklyDemand: 5,
            message: `Order ${buyQty} ${p.unit}(s) (Min: ${minStock}, Max: ${maxStock})`,
            reason: 'Low Stock Threshold Reached'
          };
        });

      pythonResult = {
        success: true,
        engine: 'TypeScript-EOQ-Fallback-v4',
        seasonalMultiplier: 1.0,
        seasonalFactorName: season,
        fastMovers: [],
        slowMovers: [],
        trends: [],
        associations: [],
        recommendations: recs,
        groceryShoppingList: {
          totalItemsCount: recs.length,
          totalUnitsToBuy: recs.reduce((sum, r) => sum + r.recommendedRestockQty, 0),
          totalEstimatedBudget: recs.reduce((sum, r) => sum + r.estimatedCost, 0),
          items: recs,
          groupedBySupplier: { 'Direct Wholesale': recs }
        },
        storeSummary: {
          headline: `Store Overview — ${season} Replenishment Pacing`,
          restockCount: recs.length,
          expiryRiskCount: expiringItems.length,
          summaryText: `${recs.length} items flagged for replenishment based on safety stock levels.`,
          trends: []
        }
      };
    }

    return NextResponse.json({
      kpis: {
        todaySales: salesToday._sum.totalAmount || 0,
        monthSales: salesMonth._sum.totalAmount || 0,
        lowStockCount: lowStockItems.length,
        expiringCount: expiringItems.length,
        totalUtang,
        totalInventoryValue,
        totalInventoryCost,
        potentialProfit
      },
      engine: pythonResult.engine,
      seasonalMultiplier: pythonResult.seasonalMultiplier,
      seasonalFactorName: pythonResult.seasonalFactorName,
      fastMovers: pythonResult.fastMovers,
      slowMovers: pythonResult.slowMovers,
      trends: pythonResult.trends,
      associations: pythonResult.associations || [],
      recommendations: pythonResult.recommendations,
      groceryShoppingList: pythonResult.groceryShoppingList,
      storeSummary: pythonResult.storeSummary,
      salesChartData
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
