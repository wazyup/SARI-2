import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

async function getAuthSession() {
  return await getSession();
}

export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sales = await prisma.sale.findMany({
      include: {
        Items: {
          include: {
            product: true
          }
        },
        UtangRecords: {
          include: {
            customer: true
          }
        }
      },
      orderBy: {
        saleDate: 'desc'
      }
    });
    return NextResponse.json(sales);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { items, paymentMethod, receivedAmount, changeAmount, customerId } = body;

    if (!items || !Array.isArray(items) || items.length === 0 || !paymentMethod) {
      return NextResponse.json({ error: 'Invalid checkout request data' }, { status: 400 });
    }

    // 1. Calculate total sale amount & verify stock
    let totalAmount = 0;
    const itemsToCreate: { productId: string; quantity: number; priceAtSale: number }[] = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (!product) {
        return NextResponse.json({ error: `Product with ID ${item.productId} not found` }, { status: 404 });
      }

      if (product.stockQty < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for product ${product.name}. Available: ${product.stockQty}` }, { status: 400 });
      }

      totalAmount += product.price * item.quantity;
      itemsToCreate.push({
        productId: product.id,
        quantity: parseFloat(item.quantity),
        priceAtSale: product.price
      });
    }

    // 2. Perform database transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Sale
      const sale = await tx.sale.create({
        data: {
          totalAmount,
          paymentMethod,
          receivedAmount: paymentMethod === 'CASH' ? parseFloat(receivedAmount) : 0,
          changeAmount: paymentMethod === 'CASH' ? parseFloat(changeAmount) : 0,
          userId: session.userId,
          Items: {
            create: itemsToCreate
          }
        },
        include: {
          Items: true
        }
      });

      // Deduct stock levels and log stock history for each item
      for (const item of itemsToCreate) {
        const product = await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQty: {
              decrement: item.quantity
            }
          }
        });

        await tx.stockHistory.create({
          data: {
            productId: item.productId,
            type: 'DEDUCT',
            quantity: item.quantity,
            reason: 'SALE'
          }
        });

        // Trigger notification check for low stock
        if (product.stockQty <= product.lowStockThreshold) {
          const notifyTitle = `Low Stock Alert: ${product.name}`;
          const notifyMsg = `${product.name} is down to ${product.stockQty} ${product.unit}(s) (threshold: ${product.lowStockThreshold}). Restock suggested.`;
          
          // Check if notification already active
          const existingNotification = await tx.notification.findFirst({
            where: {
              type: 'LOW_STOCK',
              title: notifyTitle,
              read: false
            }
          });

          if (!existingNotification) {
            await tx.notification.create({
              data: {
                type: 'LOW_STOCK',
                title: notifyTitle,
                message: notifyMsg
              }
            });
          }
        }
      }

      // Handle Utang (Credit)
      if (paymentMethod === 'CREDIT') {
        if (!customerId) {
          throw new Error('Customer is required for credit transactions');
        }

        const customer = await tx.customer.findUnique({
          where: { id: customerId }
        });

        if (!customer) {
          throw new Error('Selected customer not found');
        }

        // Add to customer's outstanding balance
        await tx.customer.update({
          where: { id: customerId },
          data: {
            balance: {
              increment: totalAmount
            }
          }
        });

        // Create Utang ledger record
        await tx.utangRecord.create({
          data: {
            customerId,
            type: 'CREDIT',
            amount: totalAmount,
            description: `Credit sale transaction (Ref: ${sale.id})`,
            saleId: sale.id
          }
        });
      }

      return sale;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
