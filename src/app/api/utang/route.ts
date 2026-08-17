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
  const customerId = searchParams.get('customerId');

  if (!customerId) {
    return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
  }

  try {
    const records = await prisma.utangRecord.findMany({
      where: { customerId },
      orderBy: { date: 'desc' }
    });
    return NextResponse.json(records);
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
    const { customerId, type, amount, description } = body;

    if (!customerId || !type || !amount) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const value = parseFloat(amount);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the utang ledger record
      const record = await tx.utangRecord.create({
        data: {
          customerId,
          type,
          amount: value,
          description: description || (type === 'PAYMENT' ? 'Manual credit payment' : 'Manual credit adjustment')
        }
      });

      // 2. Adjust customer's total outstanding balance
      await tx.customer.update({
        where: { id: customerId },
        data: {
          balance: {
            increment: type === 'CREDIT' ? value : -value
          }
        }
      });

      return record;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
