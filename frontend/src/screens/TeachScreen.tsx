import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { timelineRepository } from '../api/instance';
import { AvatarChip } from '../components/Avatars';
import { PrimaryPillButton, SecondaryPillButton } from '../components/Buttons';
import { ScreenBackHeader } from '../components/Controls';
import { EmptyState, ErrorRetry, withAlpha } from '../components/Display';
import { Screen } from '../components/Screen';
import type { TeachAnswer, TeachCard, TeachDeck } from '../domain/types';
import { invalidatePeriodData, useCurrentPeriod } from '../hooks/periods';
import { formatCurrency } from '../lib/format';
import { haptics } from '../lib/haptics';
import { track } from '../lib/telemetry';
import { TRANSACTION_CATEGORIES } from '../lib/transactionText';
import { errorMessage } from '../state/auth';
import { showToast } from '../state/toast';
import { categoryColor, colors } from '../theme/colors';
import { radius, spacing } from '../theme/tokens';
import { typography } from '../theme/typography';

/** Categories offered on a card: every spending category except the "no category" one. */
export const TEACH_CATEGORIES = TRANSACTION_CATEGORIES.filter((c) => c !== 'Uncategorized');

/** "These 8 names are 61% of what we could not label." */
export function deckHeadline(deck: Pick<TeachDeck, 'cards' | 'coveredShare' | 'unknownPayees'>): string {
  const n = deck.cards.length;
  if (n === 0) return 'Nothing left to label';
  const share = Math.round(deck.coveredShare * 100);
  const names = n === 1 ? 'This 1 name is' : `These ${n} names are`;
  return deck.unknownPayees <= n ? `${names} everything Miravelt could not label` : `${names} ${share}% of what Miravelt could not label`;
}

/** The answer a card produces, or null when the person skipped it. */
export function answerFor(card: Pick<TeachCard, 'merchant'>, choice: { category?: string; kind?: 'person' | 'business' } | null): TeachAnswer | null {
  if (!choice || (!choice.category && !choice.kind)) return null;
  return { merchant: card.merchant, ...(choice.category ? { category: choice.category } : {}), ...(choice.kind ? { kind: choice.kind } : {}) };
}

/**
 * "Teach Miravelt in 30 seconds" (PROJECT_AUDIT.md B2): the few payees that
 * explain most of the uncategorised spend, one card each. Every answer is
 * remembered for future statements and updates every period's totals.
 */
export default function TeachScreen() {
  const insets = useSafeAreaInsets();
  const period = useCurrentPeriod();
  const deck = useQuery({
    queryKey: ['teach', period?.id ?? null],
    queryFn: () => timelineRepository.teachDeck(period?.id),
    staleTime: 0,
  });
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<TeachAnswer[]>([]);
  const [saving, setSaving] = useState(false);

  if (deck.isPending) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={colors.signal} />
        </View>
      </Screen>
    );
  }
  if (deck.isError) {
    return (
      <Screen>
        <ErrorRetry message="Could not load the payees to label." onRetry={() => void deck.refetch()} />
      </Screen>
    );
  }

  const cards = deck.data.cards;
  const card = cards[index] as TeachCard | undefined;

  const save = async (final: TeachAnswer[]) => {
    if (final.length === 0) {
      router.back();
      return;
    }
    setSaving(true);
    try {
      const applied = await timelineRepository.answerTeachDeck(final);
      await invalidatePeriodData();
      track('teach_deck_completed', { answered: final.length, offered: cards.length });
      haptics.success();
      showToast(applied === 1 ? '1 payee labelled. Your totals are updated.' : `${applied} payees labelled. Your totals are updated.`, 'success');
      router.back();
    } catch (e) {
      showToast(errorMessage(e), 'error');
      setSaving(false);
    }
  };

  const next = (choice: { category?: string; kind?: 'person' | 'business' } | null) => {
    if (!card) return;
    const answer = answerFor(card, choice);
    const collected = answer ? [...answers, answer] : answers;
    setAnswers(collected);
    if (index + 1 >= cards.length) void save(collected);
    else setIndex(index + 1);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.gutter, paddingTop: 6, paddingBottom: 28 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <ScreenBackHeader title="Teach Miravelt" />
        {cards.length === 0 ? (
          <View style={{ marginTop: 60 }}>
            <EmptyState icon="check-circle" title="Nothing left to label" subtitle="Every payment in this period has a category. New payees will show up here after your next statement." />
          </View>
        ) : saving || !card ? (
          <View style={{ marginTop: 80, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.signal} />
            <Text style={[typography.footnote15, { color: colors.muted, marginTop: 16 }]}>Updating your totals</Text>
          </View>
        ) : (
          <>
            <Text style={[typography.bigHeadline22, { color: colors.text, marginTop: 18 }]}>{deckHeadline(deck.data)}</Text>
            <Text style={[typography.footnote15, { color: colors.muted, marginTop: 8 }]}>
              Label each one once. Miravelt applies it to every payment to that payee and remembers it for future statements.
            </Text>
            <View accessible accessibilityLabel={`Card ${index + 1} of ${cards.length}`} style={{ flexDirection: 'row', marginTop: 18 }}>
              {cards.map((c, i) => (
                <View key={c.merchant} style={{ flex: 1, height: 4, borderRadius: 2, marginRight: i === cards.length - 1 ? 0 : 4, backgroundColor: i <= index ? colors.signal : colors.border }} />
              ))}
            </View>
            <PayeeCard key={card.merchant} card={card} onAnswer={next} />
            <View style={{ marginTop: 14 }}>
              <SecondaryPillButton label={index + 1 >= cards.length ? 'Skip and finish' : 'Skip this one'} foreground={colors.text} borderColor={colors.border} onPress={() => next(null)} testID="teach-skip" />
            </View>
            {answers.length > 0 ? (
              <View style={{ marginTop: 10 }}>
                <PrimaryPillButton label={`Save ${answers.length} and finish`} onPress={() => void save(answers)} testID="teach-save" />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function PayeeCard({ card, onAnswer }: { card: TeachCard; onAnswer: (choice: { category?: string; kind?: 'person' | 'business' }) => void }) {
  const isPerson = card.counterpartyKind === 'person';
  // A suggestion leads the list when there is one; a person leads with Friends.
  const lead = card.suggestedCategory ?? (isPerson ? 'Friends' : null);
  const categories = lead ? [lead, ...TEACH_CATEGORIES.filter((c) => c !== lead)] : [...TEACH_CATEGORIES];
  return (
    <View style={{ marginTop: 18, padding: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <AvatarChip initials={card.merchant ? card.merchant[0].toUpperCase() : '?'} size={46} radius={14} backgroundColor={withAlpha(colors.signal, 0.14)} foregroundColor={colors.signalText} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={[typography.rowLabel14, { fontSize: 16, color: colors.text }]}>{card.merchant}</Text>
          <Text style={[typography.meta115, { color: colors.faint, marginTop: 3 }]}>
            {card.count === 1 ? '1 payment' : `${card.count} payments`} · {Math.round(card.shareOfUnknown * 100)}% of the unlabelled spend
          </Text>
        </View>
        <Text style={[typography.amountMedium16, { color: colors.text }]}>{formatCurrency(card.totalAmount)}</Text>
      </View>

      {card.suggestedCategory ? (
        <Text style={[typography.footnote12, { color: colors.muted, marginTop: 14 }]}>
          Looks like {card.suggestedCategory}
          {card.similarNames.length > 0 ? ` - similar to ${card.similarNames.slice(0, 2).join(' and ')}` : ''}. Only a suggestion.
        </Text>
      ) : isPerson ? (
        <Text style={[typography.footnote12, { color: colors.muted, marginTop: 14 }]}>This looks like a person, not a shop.</Text>
      ) : null}

      <Text style={[typography.microLabel11, { color: colors.faint, marginTop: 16 }]}>WHAT IS IT?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
        {categories.map((category) => {
          const suggested = category === card.suggestedCategory;
          const color = categoryColor(category);
          return (
            <Pressable
              key={category}
              accessibilityRole="button"
              accessibilityLabel={`${category}${suggested ? ', suggested' : ''}`}
              onPress={() => onAnswer({ category })}
              style={({ pressed }) => [
                { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 100, borderWidth: 1, marginRight: 8, marginBottom: 8 },
                { borderColor: suggested ? color : colors.border, backgroundColor: suggested ? withAlpha(color, 0.12) : 'transparent' },
                pressed && { opacity: 0.5 },
              ]}
            >
              <Text style={[typography.buttonLabel12, { color: colors.text }]}>{category}</Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable accessibilityRole="button" hitSlop={8} onPress={() => onAnswer({ kind: isPerson ? 'business' : 'person' })} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
        <Text style={[typography.buttonLabel12, { color: colors.signalText }]}>{isPerson ? 'This is a business, not a person' : 'This is a person, not a business'}</Text>
      </Pressable>
    </View>
  );
}
