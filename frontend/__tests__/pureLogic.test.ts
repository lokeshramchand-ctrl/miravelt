import { activeStageIndex } from '../src/screens/AnalysingScreen';
import { dayTotal, groupByDay } from '../src/screens/ActivityScreen';
import { aggregateCategory } from '../src/screens/CategoryDrilldownScreen';
import { netFlowDeltaPercent, trendCaption } from '../src/screens/OverviewScreen';
import { summarizeRecurring } from '../src/screens/RecurringScreen';
import { filterInsights, headlineSpendShare } from '../src/screens/SignalsScreen';
import { normalizeBaseUrl } from '../src/components/DeveloperSettings';
import { validateLogin } from '../src/screens/LoginScreen';
import { validateRegister } from '../src/screens/RegisterScreen';
import { summaryLine } from '../src/components/UploadSheet';
import { categoryExplanation, explainTransactionText } from '../src/lib/transactionText';
import { pickCurrentPeriod, pickPreviousPeriod } from '../src/hooks/periods';
import { looksLikePasswordIssue } from '../src/state/upload';
import { spendingBreakdown, userInitials } from '../src/domain/types';
import type { Insight, Statement, StatementAnalytics, Transaction } from '../src/domain/types';

const txn = (over: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  statementId: 's1',
  timestamp: new Date(2026, 5, 28, 16, 47),
  merchant: 'Zomato',
  category: 'Food',
  amount: 250,
  transactionType: 'DEBIT',
  status: 'SUCCESS',
  counterpartyRaw: null,
  referenceNumber: null,
  bank: null,
  accountLast4: null,
  paymentMethod: 'UPI',
  categorizationConfidence: 0.95,
  ...over,
});

const stmt = (id: string, status: Statement['processingStatus'], over: Partial<Statement> = {}): Statement =>
  ({ id, processingStatus: status, periodStart: new Date(2026, 0, 1), periodEnd: new Date(2026, 5, 30), ...over }) as Statement;

const analytics = (over: Partial<StatementAnalytics> = {}): StatementAnalytics => ({
  statementId: 's1',
  totalSpend: 1000,
  totalIncome: 400,
  net: -600,
  averageTransactionValue: 100,
  transactionCount: 10,
  failedTransactionCount: 0,
  categoryBreakdown: [],
  topMerchants: [],
  dailyTrend: [],
  recurringPayments: [],
  generatedAt: new Date(),
  ...over,
});

describe('periods', () => {
  const periods = [stmt('new', 'PROCESSING'), stmt('b', 'COMPLETED'), stmt('a', 'COMPLETED')];
  it('defaults to the most recent completed period', () => {
    expect(pickCurrentPeriod(periods, null)?.id).toBe('b');
  });
  it('honours an explicit selection, and ignores a stale one', () => {
    expect(pickCurrentPeriod(periods, 'a')?.id).toBe('a');
    expect(pickCurrentPeriod(periods, 'gone')?.id).toBe('b');
  });
  it('falls back to the newest period when none has completed', () => {
    expect(pickCurrentPeriod([stmt('x', 'PROCESSING')], null)?.id).toBe('x');
    expect(pickCurrentPeriod([], null)).toBeNull();
  });
  it('finds the completed period before the current one', () => {
    expect(pickPreviousPeriod(periods, periods[1])?.id).toBe('a');
    expect(pickPreviousPeriod(periods, periods[2])).toBeNull();
    expect(pickPreviousPeriod(periods, periods[0])).toBeNull();
  });
});

describe('overview math', () => {
  it('captions a category against the previous period', () => {
    const previous = [{ category: 'Food', totalAmount: 200, count: 1 }];
    expect(trendCaption('Food', 300, previous)).toBe('↑ 50% vs previous period');
    expect(trendCaption('Food', 100, previous)).toBe('↓ 50% vs previous period');
    expect(trendCaption('Travel', 100, previous)).toBeNull();
    expect(trendCaption('Food', 100, undefined)).toBeNull();
    expect(trendCaption('Food', 100, [{ category: 'Food', totalAmount: 0, count: 0 }])).toBeNull();
  });
  it('reports how net flow trended: further in the red is up', () => {
    const current = analytics({ totalIncome: 100, totalSpend: 300 }); // net -200
    const previous = analytics({ totalIncome: 100, totalSpend: 200 }); // net -100
    expect(netFlowDeltaPercent(current, previous)).toBeCloseTo(100);
    expect(netFlowDeltaPercent(previous, current)).toBeCloseTo(-50);
    expect(netFlowDeltaPercent(current, undefined)).toBeNull();
    expect(netFlowDeltaPercent(current, analytics({ totalIncome: 100, totalSpend: 100 }))).toBeNull();
  });
  it('leaves Income out of the spending breakdown', () => {
    const a = analytics({ categoryBreakdown: [{ category: 'Food', totalAmount: 1, count: 1 }, { category: 'Income', totalAmount: 9, count: 1 }] });
    expect(spendingBreakdown(a).map((e) => e.category)).toEqual(['Food']);
  });
});

describe('signals', () => {
  const insights: Insight[] = [
    { type: 'A', message: 'a', severity: 'WARNING' },
    { type: 'B', message: 'b', severity: 'POSITIVE' },
    { type: 'C', message: 'c', severity: 'INFO' },
  ];
  it('filters by severity', () => {
    expect(filterInsights(insights, 'all')).toHaveLength(3);
    expect(filterInsights(insights, 'watch').map((i) => i.type)).toEqual(['A']);
    expect(filterInsights(insights, 'good').map((i) => i.type)).toEqual(['B']);
  });
  it('computes the headline share over the top two spending categories', () => {
    const a = analytics({
      totalSpend: 1000,
      categoryBreakdown: [
        { category: 'Food', totalAmount: 400, count: 1 },
        { category: 'Travel', totalAmount: 300, count: 1 },
        { category: 'Bills', totalAmount: 300, count: 1 },
        { category: 'Income', totalAmount: 5000, count: 1 },
      ],
    });
    expect(headlineSpendShare(a)).toEqual({ top: 'Food and Travel', share: 70, count: 3 });
    expect(headlineSpendShare(analytics({ totalSpend: 0 })).share).toBe(0);
  });
});

describe('recurring', () => {
  it('summarises and sorts by monthly cost', () => {
    const a = analytics({
      totalSpend: 1000,
      recurringPayments: [
        { merchant: 'Netflix', estimatedMonthlyCost: 100, periodicityScore: 1, occurrences: 6 },
        { merchant: 'Gym', estimatedMonthlyCost: 300, periodicityScore: 0.5, occurrences: 3 },
      ],
    });
    const s = summarizeRecurring(a);
    expect(s.payments.map((p) => p.merchant)).toEqual(['Gym', 'Netflix']);
    expect(s.totalMonthly).toBe(400);
    expect(s.shareOfOutflow).toBe(40);
    expect(s.avgRegularity).toBe(75);
    expect(summarizeRecurring(undefined)).toMatchObject({ totalMonthly: 0, shareOfOutflow: 0, avgRegularity: 0 });
  });
});

describe('activity', () => {
  it('groups adjacent same-day transactions and totals a day net', () => {
    const list = [
      txn({ id: '1', timestamp: new Date(2026, 5, 28, 20, 0), amount: 100 }),
      txn({ id: '2', timestamp: new Date(2026, 5, 28, 9, 0), amount: 50, transactionType: 'CREDIT' }),
      txn({ id: '3', timestamp: new Date(2026, 5, 27, 9, 0), amount: 10 }),
    ];
    const groups = groupByDay(list);
    expect(groups.map((g) => g.transactions.length)).toEqual([2, 1]);
    expect(dayTotal(groups[0].transactions)).toBe(-50);
    expect(dayTotal(groups[1].transactions)).toBe(-10);
  });
});

describe('category drilldown', () => {
  it('aggregates merchants and fills every month of the period', () => {
    const period = { periodStart: new Date(2025, 10, 1), periodEnd: new Date(2026, 1, 28) };
    const list = [
      txn({ merchant: 'A', amount: 100, timestamp: new Date(2025, 10, 5) }),
      txn({ merchant: 'A', amount: 50, timestamp: new Date(2026, 0, 5) }),
      txn({ merchant: 'B', amount: 500, timestamp: new Date(2026, 0, 9) }),
      txn({ merchant: null, amount: 5, timestamp: new Date(2026, 1, 9) }),
    ];
    const result = aggregateCategory(list, period);
    expect(result.merchants.map((m) => [m.merchant, m.total, m.count])).toEqual([
      ['B', 500, 1],
      ['A', 150, 2],
      ['Unknown merchant', 5, 1],
    ]);
    expect(result.merchants[1].average).toBe(75);
    expect(result.monthlyBuckets.map((b) => [b.year, b.month, b.total])).toEqual([
      [2025, 11, 100],
      [2025, 12, 0],
      [2026, 1, 550],
      [2026, 2, 5],
    ]);
  });
});

describe('transaction text', () => {
  it('describes debits and credits for the explain endpoint', () => {
    expect(explainTransactionText(txn())).toBe('Paid ₹250 to Zomato on 28 JUN 2026 · 04:47 PM, categorized as Food.');
    expect(explainTransactionText(txn({ transactionType: 'CREDIT', merchant: null }))).toBe('Received ₹250 from an unknown payee on 28 JUN 2026 · 04:47 PM.');
  });
  it('never claims more certainty than the backend had', () => {
    expect(categoryExplanation(txn({ transactionType: 'CREDIT' })).label).toBe('INCOMING');
    expect(categoryExplanation(txn({ categorizationConfidence: 0 })).label).toBe('NOT MATCHED');
    expect(categoryExplanation(txn({ category: null })).label).toBe('NOT MATCHED');
    expect(categoryExplanation(txn({ categorizationConfidence: 0.6 })).label).toBe('BEST GUESS');
    expect(categoryExplanation(txn({ categorizationConfidence: 0.95 })).label).toBe('KNOWN MERCHANT');
    expect(categoryExplanation(txn({ categorizationConfidence: null })).label).toBe('MERCHANT-BASED');
  });
});

describe('upload + analysing', () => {
  it('summarises a recognised statement', () => {
    const s = stmt('s', 'PENDING', { periodStart: new Date(2026, 0, 1), periodEnd: new Date(2026, 5, 30), declaredSentAmount: 1234.4, declaredReceivedAmount: null });
    expect(summaryLine(s)).toBe('PERIOD JAN 1 - JUN 30 2026 · SENT ₹1234');
  });
  it('spots a password prompt in the error message', () => {
    expect(looksLikePasswordIssue('This PDF is Password protected')).toBe(true);
    expect(looksLikePasswordIssue('Not a statement')).toBe(false);
    expect(looksLikePasswordIssue(null)).toBe(false);
  });
  it('maps progress onto the five pipeline stages', () => {
    expect(activeStageIndex(0)).toBe(0);
    expect(activeStageIndex(39)).toBe(1);
    expect(activeStageIndex(100)).toBe(4);
  });
});

describe('forms', () => {
  it('validates sign-in', () => {
    expect(validateLogin('', '')).toEqual({ email: 'Enter your email', password: 'Enter your password' });
    expect(validateLogin('nope', 'x').email).toBe('Enter a valid email');
    expect(validateLogin('a@b.co', 'x')).toEqual({});
  });
  it('validates registration', () => {
    expect(validateRegister('a@b.co', 'short', 'short').password).toBe('Use at least 8 characters');
    expect(validateRegister('a@b.co', 'longenough', 'different').confirm).toBe("Passwords don't match");
    expect(validateRegister('a@b.co', 'x'.repeat(129), 'x'.repeat(129)).password).toBe('Password is too long');
    expect(validateRegister('a@b.co', 'longenough', 'longenough')).toEqual({});
  });
  it('normalizes developer backend URLs', () => {
    expect(normalizeBaseUrl('http://192.168.1.5:8000')).toBe('http://192.168.1.5:8000/');
    expect(normalizeBaseUrl(' https://api.example.com/ ')).toBe('https://api.example.com/');
    expect(normalizeBaseUrl('ftp://x.y')).toBeNull();
    expect(normalizeBaseUrl('192.168.1.5')).toBeNull();
    expect(normalizeBaseUrl('http://')).toBeNull();
    expect(normalizeBaseUrl('')).toBeNull();
  });
  it('derives initials from the name, else the email', () => {
    expect(userInitials({ fullName: 'Ada  Lovelace Byron', email: 'a@b.co' })).toBe('AL');
    expect(userInitials({ fullName: '  ', email: 'zed@b.co' })).toBe('Z');
    expect(userInitials({ fullName: null, email: 'zed@b.co' })).toBe('Z');
  });
});
