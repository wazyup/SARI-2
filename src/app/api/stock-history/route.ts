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
  const type = searchParams.get('type'); // 'ADD', 'LOSS', 'DEDUCT', or null for all

  try {
    const whereClause: any = {};
    if (type) {
      whereClause.type = type;
    }

    const history = await prisma.stockHistory.findMany({
      where: whereClause,
      include: {
        product: {
          include: {
            category: true
          }
        },
        supplier: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 200
    });

    return NextResponse.json(history);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
