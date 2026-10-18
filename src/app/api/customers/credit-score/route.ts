import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';

async function isAuthenticated() {
  const session = await getSession();
  return !!session;
}

export interface TrustScoreDetails {
  score: number; // 0 to 100
  tier: 'GREEN' | 'YELLOW' | 'RED';
  tierLabel: string;
  totalBalance: number;
  totalCreditVolume: number;
  totalPaymentsVolume: number;
  creditTransactionsCount: number;
  paymentTransactionsCount: number;
  repaymentRatio: number; // payments / credit
  avgDaysToRepay: number;
  frequencyOfPartialPayments: number;
  lastPaymentDate: string | null;
  reliabilityRecommendation: string;
}

export function computeCustomerTrustScore(customer: any): TrustScoreDetails {
  const records = customer.UtangRecords || [];
  const balance = customer.balance || 0;

  let totalCredit = 0;
  let totalPayments = 0;
  let creditCount = 0;
  let paymentCount = 0;
  let lastPaymentDate: Date | null = null;
  const paymentDates: Date[] = [];
  const creditDates: Date[] = [];

  records.forEach((r: any) => {
    const rDate = new Date(r.date);
    if (r.type === 'CREDIT') {
      totalCredit += r.amount;
      creditCount += 1;
      creditDates.push(rDate);
    } else if (r.type === 'PAYMENT') {
      totalPayments += r.amount;
      paymentCount += 1;
      paymentDates.push(rDate);
      if (!lastPaymentDate || rDate > lastPaymentDate) {
        lastPaymentDate = rDate;
      }
    }
  });

  // 1. Repayment Ratio (0 to 40 points)
  let repaymentRatio = 1.0;
  if (totalCredit > 0) {
    repaymentRatio = totalPayments / totalCredit;
  }
  const repaymentScore = Math.min(40, Math.max(0, repaymentRatio * 40));

  // 2. Outstanding Debt Pressure (0 to 30 points)
  // Higher balance relative to credit volume penalizes score
  let balanceScore = 30;
  if (balance > 0) {
    if (balance > 1500) balanceScore = 5;
    else if (balance > 800) balanceScore = 12;
    else if (balance > 400) balanceScore = 20;
    else balanceScore = 26;
  }

  // 3. Payment Frequency & Recency (0 to 20 points)
  let recencyScore = 15;
  if (paymentCount === 0 && balance > 0) {
    recencyScore = 0;
  } else if (lastPaymentDate) {
    const daysSinceLastPayment = Math.floor(
      (new Date().getTime() - new Date(lastPaymentDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceLastPayment <= 7) recencyScore = 20;
    else if (daysSinceLastPayment <= 15) recencyScore = 16;
    else if (daysSinceLastPayment <= 30) recencyScore = 10;
    else recencyScore = 4;
  }

  // 4. Payment Activity & Reliability Bonus (0 to 10 points)
  let activityScore = Math.min(10, paymentCount * 2);

  // Total Heuristic Score (0 - 100)
  const totalScore = Math.round(
    Math.min(100, Math.max(0, repaymentScore + balanceScore + recencyScore + activityScore))
  );

  // Categorize Tier
  let tier: 'GREEN' | 'YELLOW' | 'RED' = 'GREEN';
  let tierLabel = 'High Trust (Reliable)';
  let recommendation = 'Safe to extend standard credit terms.';

  if (totalScore >= 75) {
    tier = 'GREEN';
    tierLabel = 'High Trust (Reliable)';
    recommendation = 'Customer regularly repays on time. Eligible for extended credit.';
  } else if (totalScore >= 45) {
    tier = 'YELLOW';
    tierLabel = 'Moderate Trust (Watchlist)';
    recommendation = 'Monitor outstanding balance closely before granting large purchases.';
  } else {
    tier = 'RED';
    tierLabel = 'High Risk (Restricted)';
    recommendation = 'Requires clearing existing balance or cash payments before new credit.';
  }

  // Calculate approximate average days between credit and subsequent payments
  let avgDaysToRepay = 0;
  if (paymentDates.length > 0 && creditDates.length > 0) {
    const firstCredit = creditDates[creditDates.length - 1]; // oldest
    const lastP = paymentDates[0]; // newest
    const diffDays = Math.max(1, Math.round((lastP.getTime() - firstCredit.getTime()) / (1000 * 60 * 60 * 24)));
    avgDaysToRepay = Math.round(diffDays / Math.max(1, paymentCount));
  } else if (balance > 0) {
    avgDaysToRepay = 30;
  }

  return {
    score: totalScore,
    tier,
    tierLabel,
    totalBalance: balance,
    totalCreditVolume: totalCredit,
    totalPaymentsVolume: totalPayments,
    creditTransactionsCount: creditCount,
    paymentTransactionsCount: paymentCount,
    repaymentRatio: Math.round(repaymentRatio * 100) / 100,
    avgDaysToRepay,
    frequencyOfPartialPayments: paymentCount,
    lastPaymentDate: lastPaymentDate ? (lastPaymentDate as Date).toISOString() : null,
    reliabilityRecommendation: recommendation,
  };
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const customers = await prisma.customer.findMany({
      include: {
        UtangRecords: {
          orderBy: { date: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    });

    const scoredCustomers = customers.map((c) => {
      const trust = computeCustomerTrustScore(c);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        balance: c.balance,
        trustScore: trust,
      };
    });

    return NextResponse.json(scoredCustomers);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
