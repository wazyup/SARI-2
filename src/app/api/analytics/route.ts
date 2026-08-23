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
  weatherFactorName: string;
  fastMovers: any[];
  slowMovers: any[];
  trends: any[];
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
    let weather = searchParams.get('weather') || 'NORMAL';

    // If weather not provided in query, check daily weather log in DB
    if (weather === 'NORMAL') {
      const todayStr = new Date().toISOString().split('T')[0];
      const weatherLog = await prisma.dailyWeatherLog.findUnique({
        where: { date: todayStr }
      });
      if (weatherLog) {
        weather = weatherLog.weather;
      }
    }

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

    // 2. Fetch 30-day Sales Items with timestamps for trends
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          saleDate: { gte: thirtyDaysAgo }
        }
      },
      include: {
        sale: {
          select: { saleDate: true }
        }
      }
    });

    const flattenedSaleItems = saleItems.map(item => ({
      productId: item.productId,
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

    // 4. Delegate to Python OOP Predictive Engine
    let pythonResult: PythonAnalyticsOutput | null = null;
    try {
      pythonResult = await runPythonAnalyticsEngine({
        seasonalFactor: season,
        weatherFactor: weather,
        products,
        salesItems: flattenedSaleItems
      });
    } catch (pyErr) {
      console.warn('Python engine notice (fallback active):', pyErr);
    }

    // Fallback if needed
    if (!pythonResult || !pythonResult.success) {
      pythonResult = {
        success: true,
        engine: 'TypeScript-Fallback-v3',
        seasonalMultiplier: 1.0,
        seasonalFactorName: season,
        weatherFactorName: weather,
        fastMovers: [],
        slowMovers: [],
        trends: [],
        recommendations: [],
        groceryShoppingList: {
          totalItemsCount: 0,
          totalUnitsToBuy: 0,
          totalEstimatedBudget: 0,
          items: [],
          groupedBySupplier: {}
        },
        storeSummary: {
          headline: 'Store Intelligence Summary (Fallback)',
          restockCount: lowStockItems.length,
          expiryRiskCount: expiringItems.length,
          summaryText: `${lowStockItems.length} items low on stock.`,
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
      weatherFactorName: pythonResult.weatherFactorName,
      fastMovers: pythonResult.fastMovers,
      slowMovers: pythonResult.slowMovers,
      trends: pythonResult.trends,
      recommendations: pythonResult.recommendations,
      groceryShoppingList: pythonResult.groceryShoppingList,
      storeSummary: pythonResult.storeSummary,
      salesChartData
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
