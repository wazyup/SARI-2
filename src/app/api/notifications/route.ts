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
    // Proactively scan for expired items and low stock items to dynamically add notifications
    const products = await prisma.product.findMany();
    const now = new Date();

    for (const product of products) {
      // 1. Expiration scan
      if (product.expirationDate && product.expirationDate < now) {
        const expiredTitle = `Expired Item: ${product.name}`;
        const expiredMsg = `${product.name} expired on ${new Date(product.expirationDate).toLocaleDateString()}. Dispose immediately!`;

        const existingExpired = await prisma.notification.findFirst({
          where: { title: expiredTitle, read: false }
        });

        if (!existingExpired) {
          await prisma.notification.create({
            data: {
              type: 'EXPIRATION',
              title: expiredTitle,
              message: expiredMsg
            }
          });
        }
      }

      // 2. Low Stock scan
      if (product.stockQty <= product.lowStockThreshold) {
        const stockTitle = `Low Stock Alert: ${product.name}`;
        const stockMsg = `${product.name} is down to ${product.stockQty} ${product.unit}(s) (threshold: ${product.lowStockThreshold}).`;

        const existingStock = await prisma.notification.findFirst({
          where: { title: stockTitle, read: false }
        });

        if (!existingStock) {
          await prisma.notification.create({
            data: {
              type: 'LOW_STOCK',
              title: stockTitle,
              message: stockMsg
            }
          });
        }
      }
    }

    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(notifications);
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
    const { id, readAll } = body;

    if (readAll) {
      await prisma.notification.updateMany({
        data: { read: true }
      });
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });
    }

    const notification = await prisma.notification.update({
      where: { id },
      data: { read: true }
    });

    return NextResponse.json(notification);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
