import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { counts, auditReason } = body;

    if (!counts || !Array.isArray(counts) || counts.length === 0) {
      return NextResponse.json({ error: 'No inventory count items provided' }, { status: 400 });
    }

    const updatedResults: any[] = [];

    await prisma.$transaction(async (tx) => {
      for (const item of counts) {
        const { productId, countedQty } = item;
        if (!productId || countedQty === undefined) continue;

        const currentProduct = await tx.product.findUnique({
          where: { id: productId },
        });

        if (!currentProduct) continue;

        const counted = Math.max(0, parseFloat(countedQty));
        const diff = counted - currentProduct.stockQty;

        if (diff !== 0) {
          const isAdd = diff > 0;
          const absQty = Math.abs(diff);

          // Update product stock
          const updated = await tx.product.update({
            where: { id: productId },
            data: { stockQty: counted },
          });

          // Log stock history
          await tx.stockHistory.create({
            data: {
              productId,
              type: isAdd ? 'ADD' : 'ADJUST',
              quantity: absQty,
              costPrice: currentProduct.costPrice,
              transpoFee: currentProduct.transpoFee,
              supplierId: currentProduct.supplierId,
              reason: auditReason || (isAdd ? 'FAST_COUNT_SURPLUS' : 'FAST_COUNT_DISCREPANCY'),
            },
          });

          updatedResults.push({
            id: productId,
            name: currentProduct.name,
            previousStock: currentProduct.stockQty,
            newStock: counted,
            difference: diff,
          });
        }
      }
    });

    return NextResponse.json({
      success: true,
      updatedCount: updatedResults.length,
      adjustments: updatedResults,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
