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

  const { searchParams } = new URL(request.url);
  const lowStock = searchParams.get('lowStock') === 'true';
  const expiring = searchParams.get('expiring') === 'true';

  let whereClause: any = {};

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
    const {
      name,
      categoryId,
      stockQty,
      costPrice,
      price,
      transpoFee,
      unit,
      imageUrl,
      expirationDate,
      supplierId,
      lowStockThreshold
    } = body;

    if (!name || !categoryId || price === undefined || stockQty === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedStock = parseFloat(stockQty) || 0;
    const parsedCost = parseFloat(costPrice) || 0;
    const parsedPrice = parseFloat(price) || 0;
    const parsedTranspo = parseFloat(transpoFee) || 0;
    const parsedThreshold = lowStockThreshold !== undefined ? parseFloat(lowStockThreshold) : 5;

    const product = await prisma.product.create({
      data: {
        name: name.trim(),
        categoryId,
        stockQty: parsedStock,
        costPrice: parsedCost,
        price: parsedPrice,
        transpoFee: parsedTranspo,
        unit: unit || 'pcs',
        imageUrl: imageUrl || null,
        expirationDate: expirationDate ? new Date(expirationDate) : null,
        supplierId: supplierId || null,
        lowStockThreshold: parsedThreshold,
      }
    });

    // Log initial stock history
    if (parsedStock > 0) {
      await prisma.stockHistory.create({
        data: {
          productId: product.id,
          type: 'ADD',
          quantity: parsedStock,
          costPrice: parsedCost,
          transpoFee: parsedTranspo,
          supplierId: supplierId || null,
          reason: 'INITIAL_STOCK'
        }
      });
    }

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
    const {
      id,
      name,
      categoryId,
      stockQty,
      costPrice,
      price,
      transpoFee,
      unit,
      imageUrl,
      expirationDate,
      supplierId,
      lowStockThreshold,
      adjustmentReason,
      isLossRecording,
      lossQuantity
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
    }

    const currentProduct = await prisma.product.findUnique({ where: { id } });
    if (!currentProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    let nextStock = stockQty !== undefined ? parseFloat(stockQty) : currentProduct.stockQty;

    // Handle dedicated loss recording (damaged, expired, lost, given away)
    if (isLossRecording && lossQuantity) {
      const parsedLoss = Math.abs(parseFloat(lossQuantity));
      nextStock = Math.max(0, currentProduct.stockQty - parsedLoss);

      await prisma.stockHistory.create({
        data: {
          productId: id,
          type: 'LOSS',
          quantity: parsedLoss,
          costPrice: currentProduct.costPrice,
          transpoFee: currentProduct.transpoFee,
          supplierId: currentProduct.supplierId,
          reason: adjustmentReason || 'DAMAGED'
        }
      });

      // Create notification for loss
      await prisma.notification.create({
        data: {
          type: 'LOSS_ALERT',
          title: `Stock Loss: ${currentProduct.name}`,
          message: `${parsedLoss} ${currentProduct.unit}(s) marked as ${adjustmentReason || 'LOSS'}.`
        }
      });
    } else if (stockQty !== undefined && parseFloat(stockQty) !== currentProduct.stockQty) {
      // General stock adjustment / restock
      const diff = parseFloat(stockQty) - currentProduct.stockQty;
      const isAdd = diff > 0;

      await prisma.stockHistory.create({
        data: {
          productId: id,
          type: isAdd ? 'ADD' : 'DEDUCT',
          quantity: Math.abs(diff),
          costPrice: costPrice !== undefined ? parseFloat(costPrice) : currentProduct.costPrice,
          transpoFee: transpoFee !== undefined ? parseFloat(transpoFee) : currentProduct.transpoFee,
          supplierId: supplierId !== undefined ? (supplierId || null) : currentProduct.supplierId,
          reason: adjustmentReason || (isAdd ? 'RESTOCK' : 'MANUAL_CORRECTION')
        }
      });
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : currentProduct.name,
        categoryId: categoryId !== undefined ? categoryId : currentProduct.categoryId,
        stockQty: nextStock,
        costPrice: costPrice !== undefined ? parseFloat(costPrice) : currentProduct.costPrice,
        price: price !== undefined ? parseFloat(price) : currentProduct.price,
        transpoFee: transpoFee !== undefined ? parseFloat(transpoFee) : currentProduct.transpoFee,
        unit: unit !== undefined ? unit : currentProduct.unit,
        imageUrl: imageUrl !== undefined ? imageUrl : currentProduct.imageUrl,
        expirationDate: expirationDate !== undefined ? (expirationDate ? new Date(expirationDate) : null) : currentProduct.expirationDate,
        supplierId: supplierId !== undefined ? (supplierId || null) : currentProduct.supplierId,
        lowStockThreshold: lowStockThreshold !== undefined ? parseFloat(lowStockThreshold) : currentProduct.lowStockThreshold,
      }
    });

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
