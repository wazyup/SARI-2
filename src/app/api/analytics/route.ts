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
  recommendations: any[];
  groceryShoppingList: any;
}

// Executes Python OOP analytics engine via child_process
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

    // Send payload via stdin
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

    // 1. Calculate General Store KPIs
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

    // 2. Fetch 30-day Sales Items for the Analytics Engine
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          saleDate: { gte: thirtyDaysAgo }
        }
      },
      select: {
        productId: true,
        quantity: true,
        priceAtSale: true
      }
    });

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

    // 4. Delegate to Python OOP Analytics Engine
    let pythonResult: PythonAnalyticsOutput | null = null;
    try {
      pythonResult = await runPythonAnalyticsEngine({
        seasonalFactor: season,
        products,
        salesItems: saleItems
      });
    } catch (pyErr) {
      console.warn('Python engine invocation notice (falling back to built-in TS logic):', pyErr);
    }

    // Fallback if Python process failed
    if (!pythonResult || !pythonResult.success) {
      const productSalesMap: Record<string, { qty: number; sales: number; name: string; id: string }> = {};
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
      const fastMovers = [...salesList].filter(i => i.qty > 0).sort((a, b) => b.qty - a.qty).slice(0, 3);
      const slowMovers = [...salesList].sort((a, b) => a.qty - b.qty).slice(0, 3);

      const recs = products
        .filter(p => p.stockQty <= p.lowStockThreshold)
        .map(p => ({
          productId: p.id,
          productName: p.name,
          categoryName: p.category?.name || 'General',
          supplierName: p.supplier?.name || 'Direct Wholesale',
          currentStock: p.stockQty,
          lowStockThreshold: p.lowStockThreshold,
          unit: p.unit,
          estimatedCost: p.price * 10,
          forecastedWeeklyDemand: 5,
          recommendedRestockQty: Math.max(5, Math.ceil(p.lowStockThreshold * 2)),
          reason: 'Low Stock Threshold'
        }));

      pythonResult = {
        success: true,
        engine: 'TypeScript-Fallback-v2',
        seasonalMultiplier: 1.0,
        seasonalFactorName: season,
        fastMovers,
        slowMovers,
        recommendations: recs,
        groceryShoppingList: {
          totalItemsCount: recs.length,
          totalUnitsToBuy: recs.reduce((sum, r) => sum + r.recommendedRestockQty, 0),
          totalEstimatedBudget: recs.reduce((sum, r) => sum + r.estimatedCost, 0),
          items: recs,
          groupedBySupplier: { 'Direct Wholesale': recs }
        }
      };
    }

    return NextResponse.json({
      kpis: {
        todaySales: salesToday._sum.totalAmount || 0,
        monthSales: salesMonth._sum.totalAmount || 0,
        lowStockCount: lowStockItems.length,
        expiringCount: expiringItems.length,
        totalUtang
      },
      engine: pythonResult.engine,
      seasonalMultiplier: pythonResult.seasonalMultiplier,
      seasonalFactorName: pythonResult.seasonalFactorName,
      fastMovers: pythonResult.fastMovers,
      slowMovers: pythonResult.slowMovers,
      recommendations: pythonResult.recommendations,
      groceryShoppingList: pythonResult.groceryShoppingList,
      salesChartData
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
