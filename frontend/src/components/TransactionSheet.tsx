import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { explainRepository, feedbackRepository } from '../api/instance';
import type { ExplainOutcome, Transaction } from '../domain/types';
import { invalidatePeriodData, useCurrentPeriod } from '../hooks/periods';
import { errorMessage } from '../state/auth';
import { formatCurrency, formatFullTimestamp, formatPeriodRange } from '../lib/format';
import { TRANSACTION_CATEGORIES, canRecategorize, categoryExplanation } from '../lib/transactionText';
import { categoryColor, colors } from '../theme/colors';
import { radius } from '../theme/tokens';
import { typography } from '../theme/typography';
import { AvatarChip } from './Avatars';
import { SecondaryPillButton } from './Buttons';
import { withAlpha } from './Display';
import { StreamedText, ThinkingIndicator } from './Live';
import { FadeInUp } from './motion';
import { MiraveltSheet } from './Sheet';

/** The light transaction detail sheet. Keeps showing its last transaction while it animates closed. */
export function TransactionSheet({ transaction, onClose }: { transaction: Transaction | null; onClose: () => void }) {
  const [shown, setShown] = useState<Transaction | null>(transaction);
  if (transaction && transaction !== shown) setShown(transaction);
  return (
    <MiraveltSheet visible={transaction != null} onClose={onClose} dark={false}>
      {shown ? <TransactionSheetBody key={shown.id} transaction={shown} onClose={onClose} /> : null}
    </MiraveltSheet>
  );
}

function TransactionSheetBody({ transaction: txn, onClose }: { transaction: Transaction; onClose: () => void }) {
  const period = useCurrentPeriod();
  const [submitting, setSubmitting] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainSince, setExplainSince] = useState<number | null>(null);
  const [explainOutcome, setExplainOutcome] = useState<ExplainOutcome | null>(null);
  // Picking a category swaps the sheet body rather than stacking a second modal on top.
  const [picking, setPicking] = useState(false);

  const requestExplanation = async () => {
    setExplainLoading(true);
    setExplainSince(Date.now());
    try {
      // By id: the backend explains this row from the user's own history with the payee (F12).
      setExplainOutcome(await explainRepository.explain(txn.id));
    } catch {
      setExplainOutcome({ available: false, unavailableReason: "Couldn't reach the explanation service." });
    } finally {
      setExplainLoading(false);
    }
  };

  const submitFeedback = async (correctedCategory: string) => {
    setSubmitting(true);
    try {
      const recorded = await feedbackRepository.submit({
        transactionId: txn.id,
        originalPrediction: txn.category ?? 'Uncategorized',
        correctedCategory,
        confidence: 1.0,
      });
      if (recorded) {
        // The backend has already recomputed every affected period; refetch so
        // Overview, Activity and the drill-downs all show it (F3).
        await invalidatePeriodData();
        setFeedbackResult(`Done - every ${txn.merchant ?? 'payment like this'} payment is now ${correctedCategory}, and future statements will remember it.`);
      } else {
        setFeedbackResult('Thanks for confirming.');
      }
    } catch (e) {
      setFeedbackResult(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (picking) {
    return (
      <View>
        <Text style={[typography.rowLabel14, { fontSize: 16, color: colors.text, marginBottom: 6 }]}>Which category is it?</Text>
        {TRANSACTION_CATEGORIES.map((category) => (
          <Pressable
            key={category}
            accessibilityRole="button"
            onPress={() => {
              setPicking(false);
              void submitFeedback(category);
            }}
            style={({ pressed }) => [{ paddingVertical: 14 }, pressed && { opacity: 0.5 }]}
          >
            <Text style={[typography.rowLabel14, { color: colors.text }]}>{category}</Text>
          </Pressable>
        ))}
        <Pressable accessibilityRole="button" onPress={() => setPicking(false)} style={{ paddingVertical: 14 }}>
          <Text style={[typography.rowLabel14, { color: colors.muted }]}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const isUnusual = txn.status !== 'SUCCESS';
  const color = categoryColor(txn.category ?? '');
  const explanation = categoryExplanation(txn);
  const sign = txn.transactionType === 'DEBIT' ? '−' : '+';

  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <AvatarChip initials={txn.merchant ? txn.merchant[0].toUpperCase() : '?'} size={46} radius={14} backgroundColor={withAlpha(color, 0.16)} foregroundColor={color} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[typography.rowLabel14, { fontSize: 16, color: colors.text }]}>{txn.merchant ?? 'Unknown merchant'}</Text>
          <Text style={[typography.meta115, { color: colors.faint, marginTop: 3 }]}>{formatFullTimestamp(txn.timestamp)}</Text>
        </View>
        <Text numberOfLines={1} style={[typography.amountSmall22, { color: colors.text, flexShrink: 1 }]}>
          {sign}
          {formatCurrency(Math.abs(txn.amount))}
        </Text>
      </View>

      {isUnusual ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 16, paddingHorizontal: 15, paddingVertical: 13, backgroundColor: colors.warnSoft, borderRadius: 14 }}>
          <Text style={[typography.buttonLabel12, { color: colors.warn, fontFamily: 'Inter_700Bold' }]}>!</Text>
          <Text style={[typography.footnote12, { color: colors.warn, flex: 1, marginLeft: 8 }]}>
            This transaction is marked {txn.status.toLowerCase()} by the statement - not a normal completed payment.
          </Text>
        </View>
      ) : null}

      <View style={{ marginTop: 16, borderWidth: 1, borderColor: colors.border, borderRadius: radius.field + 4 }}>
        <DetailRow
          label="Category"
          trailing={
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={[typography.rowLabel14, { color: colors.text }]}>{txn.category ?? 'Uncategorized'}</Text>
              {canRecategorize(txn) ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Edit category" disabled={submitting} onPress={() => setPicking(true)} hitSlop={8} style={{ marginLeft: 8 }}>
                  <Text style={[typography.buttonLabel12, { color: colors.signalText }]}>EDIT</Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
        {txn.referenceNumber ? <DetailRow label="UPI transaction ID" value={txn.referenceNumber} mono /> : null}
        {txn.bank || txn.accountLast4 ? <DetailRow label="Paid by" value={`${txn.bank ?? ''}${txn.accountLast4 ? ` ···${txn.accountLast4}` : ''}`.trim()} mono /> : null}
        {period ? <DetailRow label="Period" value={formatPeriodRange(period.periodStart, period.periodEnd)} last /> : null}
      </View>

      <View style={{ marginTop: 16, padding: 16, backgroundColor: colors.bg, borderRadius: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: colors.signal, fontSize: 12 }}>✦</Text>
          <Text style={[typography.microLabelTracked105, { color: colors.signal, marginLeft: 6 }]}>WHY THIS CATEGORY</Text>
          <View style={{ flex: 1 }} />
          <Text style={[typography.microLabel11, { color: colors.faint }]}>{explanation.label}</Text>
        </View>
        <Text style={[typography.footnote12, { color: colors.muted, lineHeight: 12 * 1.55, marginTop: 10 }]}>{explanation.body}</Text>
      </View>

      <View style={{ marginTop: 12 }}>
        <ExplainPanel loading={explainLoading} loadingSince={explainSince} outcome={explainOutcome} onRequest={requestExplanation} />
      </View>

      {txn.merchant && txn.transactionType === 'DEBIT' ? (
        <Pressable
          accessibilityRole="link"
          hitSlop={8}
          onPress={() => {
            onClose();
            router.push({ pathname: '/merchant/[name]', params: { name: txn.merchant! } });
          }}
          style={{ alignSelf: 'flex-start', marginTop: 12 }}
        >
          <Text style={[typography.buttonLabel12, { color: colors.signalText }]}>See every payment to {txn.merchant}</Text>
        </Pressable>
      ) : null}

      <View style={{ marginTop: 18 }}>
        {!canRecategorize(txn) ? null : feedbackResult ? (
          <Text style={[typography.footnote12, { color: colors.signalText, textAlign: 'center' }]}>{feedbackResult}</Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row' }}>
              <View style={{ flex: 1 }}>
                <SecondaryPillButton label="Looks right" foreground={colors.text} borderColor={colors.border} onPress={submitting ? undefined : () => void submitFeedback(txn.category ?? 'Uncategorized')} style={{ paddingVertical: 12 }} />
              </View>
              <View style={{ width: 10 }} />
              <View style={{ flex: 1 }}>
                <SecondaryPillButton label="Wrong category" foreground={colors.text} borderColor={colors.border} onPress={submitting ? undefined : () => setPicking(true)} style={{ paddingVertical: 12 }} />
              </View>
            </View>
            <Text style={[typography.microLabel11, { color: colors.faint, textAlign: 'center', marginTop: 12 }]}>A correction applies to every payment to this payee and is remembered for future statements.</Text>
          </>
        )}
      </View>
    </View>
  );
}

function DetailRow({ label, value, trailing, mono = false, last = false }: { label: string; value?: string; trailing?: React.ReactNode; mono?: boolean; last?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.border }}>
      <Text style={[typography.body14, { fontSize: 13, color: colors.muted }]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {trailing ?? <Text style={[mono ? typography.meta12 : typography.rowLabel14, { color: colors.text, flexShrink: 1, textAlign: 'right' }]}>{value}</Text>}
    </View>
  );
}

/**
 * A deeper, grounded explanation on top of "Why this category" - fetched on
 * demand (never auto) since it costs a rate-limited LLM call. Deliberately a
 * separate, additive panel: that card is instant; this one is richer but
 * slower and can come back empty. While it works it shows a thinking indicator
 * with elapsed time; the answer then reveals word by word (presentation only -
 * the backend returns it whole, and screen readers get the full text at once).
 */
function ExplainPanel({ loading, loadingSince, outcome, onRequest }: { loading: boolean; loadingSince: number | null; outcome: ExplainOutcome | null; onRequest?: () => void }) {
  if (!outcome) {
    if (loading) return <ThinkingIndicator label="Reading your history with this payee" since={loadingSince} />;
    return (
      <Pressable accessibilityRole="button" disabled={!onRequest} onPress={onRequest} hitSlop={8} style={{ alignSelf: 'flex-start', opacity: onRequest ? 1 : 0.4 }}>
        <Text style={[typography.buttonLabel12, { color: colors.signalText }]}>How does this compare with my history?</Text>
      </Pressable>
    );
  }
  if (!outcome.available) {
    return (
      <FadeInUp distance={6}>
        <Text style={[typography.footnote12, { color: colors.muted }]}>{outcome.unavailableReason}</Text>
      </FadeInUp>
    );
  }
  return (
    <FadeInUp distance={8} style={{ padding: 14, backgroundColor: withAlpha(colors.border, 0.35), borderRadius: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Either way it comes only from this user's own rows; "generated" means the
            model phrased it and the backend checked every figure in it. */}
        <Text style={[typography.microLabelTracked105, { color: colors.faint }]}>{outcome.generated ? 'EXPLAINED FROM YOUR HISTORY' : 'FROM YOUR HISTORY'}</Text>
        <View style={{ flex: 1 }} />
        {outcome.confidence ? <Text style={[typography.microLabel11, { color: colors.faint }]}>{outcome.confidence}</Text> : null}
      </View>
      <View style={{ marginTop: 8 }}>
        <StreamedText text={outcome.explanation} style={[typography.footnote12, { color: colors.text, lineHeight: 18 }]} />
      </View>
    </FadeInUp>
  );
}
