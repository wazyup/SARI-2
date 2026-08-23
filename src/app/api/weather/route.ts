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
    const todayStr = new Date().toISOString().split('T')[0];
    const log = await prisma.dailyWeatherLog.findUnique({
      where: { date: todayStr }
    });

    return NextResponse.json({
      hasLoggedToday: !!log,
      weather: log ? log.weather : null,
      date: todayStr
    });
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
    const { weather } = body;

    if (!weather) {
      return NextResponse.json({ error: 'Weather is required' }, { status: 400 });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const log = await prisma.dailyWeatherLog.upsert({
      where: { date: todayStr },
      create: {
        date: todayStr,
        weather
      },
      update: {
        weather
      }
    });

    return NextResponse.json(log);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
