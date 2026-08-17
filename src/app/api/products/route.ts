import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

// Helper to check authentication
async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lowStock = searchParams.get('lowStock') === 'true';
  const expiring = searchParams.get('expiring') === 'true';

  let whereClause: any = {};

  if (lowStock) {
    whereClause.stockQty = {
      lte: prisma.product.fields.lowStockThreshold
    };
  }

  if (expiring) {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    whereClause.expirationDate = {
      lte: thirtyDaysFromNow,
      not: null
    };
  }

  try {
    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: true,
        supplier: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    // Custom filtering for low stock since prisma.fields is not fully supported in some versions of sqlite/prisma fields interface
    let filteredProducts = products;
    if (lowStock) {
      filteredProducts = products.filter(p => p.stockQty <= p.lowStockThreshold);
    }

    return NextResponse.json(filteredProducts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, categoryId, stockQty, price, unit, imageUrl, expirationDate, supplierId, lowStockThreshold } = body;

    if (!name || !categoryId || price === undefined || stockQty === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        name,
        categoryId,
        stockQty: parseFloat(stockQty),
        price: parseFloat(price),
        unit,
        imageUrl,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        supplierId: supplierId || null,
        lowStockThreshold: lowStockThreshold ? parseFloat(lowStockThreshold) : 5,
      }
    });

    // Log stock history
    await prisma.stockHistory.create({
      data: {
        productId: product.id,
        type: 'ADD',
        quantity: parseFloat(stockQty),
        reason: 'INITIAL_STOCK'
      }
    });

    return NextResponse.json(product);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, name, categoryId, stockQty, price, unit, imageUrl, expirationDate, supplierId, lowStockThreshold, adjustmentReason } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const currentProduct = await prisma.product.findUnique({ where: { id } });
    if (!currentProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: name !== undefined ? name : currentProduct.name,
        categoryId: categoryId !== undefined ? categoryId : currentProduct.categoryId,
        stockQty: stockQty !== undefined ? parseFloat(stockQty) : currentProduct.stockQty,
        price: price !== undefined ? parseFloat(price) : currentProduct.price,
        unit: unit !== undefined ? unit : currentProduct.unit,
        imageUrl: imageUrl !== undefined ? imageUrl : currentProduct.imageUrl,
        expirationDate: expirationDate !== undefined ? (expirationDate ? new Date(expirationDate) : null) : currentProduct.expirationDate,
        supplierId: supplierId !== undefined ? (supplierId || null) : currentProduct.supplierId,
        lowStockThreshold: lowStockThreshold !== undefined ? parseFloat(lowStockThreshold) : currentProduct.lowStockThreshold,
      }
    });

    // If stock changed, log history
    if (stockQty !== undefined && parseFloat(stockQty) !== currentProduct.stockQty) {
      const diff = parseFloat(stockQty) - currentProduct.stockQty;
      await prisma.stockHistory.create({
        data: {
          productId: id,
          type: diff > 0 ? 'ADD' : 'DEDUCT',
          quantity: Math.abs(diff),
          reason: adjustmentReason || 'ADJUSTMENT'
        }
      });
    }

    return NextResponse.json(updatedProduct);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
