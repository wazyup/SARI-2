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
    const customers = await prisma.customer.findMany({
      include: {
        _count: {
          select: { UtangRecords: true }
        }
      },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(customers);
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
    const { name, phone } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: phone ? phone.trim() : null,
        balance: 0
      }
    });
    return NextResponse.json(customer);
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
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    if (customer.balance > 0) {
      return NextResponse.json({
        error: `Cannot delete customer with an unpaid balance of ₱${customer.balance.toLocaleString()}. Please clear balance first.`
      }, { status: 400 });
    }

    await prisma.customer.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
