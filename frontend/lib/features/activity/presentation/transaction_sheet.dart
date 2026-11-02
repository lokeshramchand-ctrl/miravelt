import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/feature_providers.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_radius.dart';
import '../../../core/theme/app_typography.dart';
import '../../../core/utils/formatters.dart';
import '../../../shared/widgets/avatar_chip.dart';
import '../../../shared/widgets/bottom_sheet_scaffold.dart';
import '../../statements/domain/transaction.dart';
import '../../statements/presentation/period_providers.dart';
import '../domain/explain_outcome.dart';

const _kTransactionCategories = [
  'Food', 'Travel', 'Entertainment', 'Bills', 'Friends', 'Education', 'Healthcare', 'Subscription', 'Shopping', 'Utility', 'Income', 'Unknown',
];

Future<void> showTransactionSheet(BuildContext context, Transaction transaction) {
  return showMiraveltSheet<void>(context, dark: false, child: _TransactionSheetBody(transaction: transaction));
}

class _TransactionSheetBody extends ConsumerStatefulWidget {
  const _TransactionSheetBody({required this.transaction});
  final Transaction transaction;

  @override
  ConsumerState<_TransactionSheetBody> createState() => _TransactionSheetBodyState();
}

class _TransactionSheetBodyState extends ConsumerState<_TransactionSheetBody> {
  bool _submitting = false;
  String? _feedbackResult;
  bool _explainLoading = false;
  ExplainOutcome? _explainOutcome;

  Future<void> _requestExplanation() async {
    setState(() => _explainLoading = true);
    try {
      final outcome = await ref.read(explainRepositoryProvider).explain(
            transactionText: _explainTransactionText(widget.transaction),
          );
      setState(() => _explainOutcome = outcome);
    } catch (_) {
      setState(() => _explainOutcome = const ExplainOutcome.unavailable("Couldn't reach the explanation service."));
    } finally {
      if (mounted) setState(() => _explainLoading = false);
    }
  }

  Future<void> _submitFeedback(String correctedCategory) async {
    setState(() => _submitting = true);
    try {
      final recorded = await ref.read(feedbackRepositoryProvider).submit(
            transactionId: widget.transaction.id,
            originalPrediction: widget.transaction.category ?? 'Unknown',
            correctedCategory: correctedCategory,
            confidence: 1.0,
          );
      setState(() => _feedbackResult = recorded ? 'Thanks - your correction trains Miravelt\'s merchant memory.' : 'Thanks for confirming.');
    } catch (_) {
      setState(() => _feedbackResult = "Couldn't record your feedback. Please try again.");
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _pickWrongCategory() async {
    final selected = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.sheet))),
      builder: (context) => SafeArea(
        child: ListView(
          shrinkWrap: true,
          children: [
            for (final category in _kTransactionCategories)
              ListTile(
                title: Text(category, style: AppTypography.rowLabel14.copyWith(color: AppColors.onLight)),
                onTap: () => Navigator.of(context).pop(category),
              ),
          ],
        ),
      ),
    );
    if (selected != null) await _submitFeedback(selected);
  }

  @override
  Widget build(BuildContext context) {
    final txn = widget.transaction;
    final period = ref.watch(currentPeriodProvider);
    final isUnusual = txn.status != TransactionStatus.success;
    final avatarLetter = (txn.merchant?.isNotEmpty ?? false) ? txn.merchant![0].toUpperCase() : '?';
    final color = AppColors.forCategory(txn.category ?? '');
    final explanation = _categoryExplanation(txn);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            AvatarChip(initials: avatarLetter, size: 46, radius: 14, backgroundColor: color.withValues(alpha: 0.16), foregroundColor: color),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(txn.merchant ?? 'Unknown merchant', style: AppTypography.rowLabel14.copyWith(fontSize: 16, color: AppColors.onLight)),
                  const SizedBox(height: 3),
                  Text(formatFullTimestamp(txn.timestamp), style: AppTypography.meta115.copyWith(color: AppColors.onLightFaint)),
                ],
              ),
            ),
            Flexible(
              child: Text(
                '${txn.transactionType == TransactionType.debit ? '−' : '+'}${formatCurrency(txn.amount.abs())}',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.amountSmall22.copyWith(color: AppColors.onLight),
              ),
            ),
          ],
        ),
        if (isUnusual) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 13),
            decoration: BoxDecoration(color: AppColors.amberTint, borderRadius: BorderRadius.circular(14)),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('!', style: AppTypography.buttonLabel12.copyWith(color: AppColors.amberInk, fontWeight: FontWeight.w700)),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'This transaction is marked ${txn.status.name} by the statement - not a normal completed payment.',
                    style: AppTypography.footnote12.copyWith(color: AppColors.amberTextOnTint),
                  ),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        Container(
          decoration: BoxDecoration(border: Border.all(color: AppColors.hairlineLight), borderRadius: BorderRadius.circular(AppRadius.field + 4)),
          child: Column(
            children: [
              _detailRow(
                'Category',
                txn.category ?? 'Uncategorized',
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(txn.category ?? 'Uncategorized', style: AppTypography.rowLabel14.copyWith(color: AppColors.onLight)),
                    const SizedBox(width: 8),
                    GestureDetector(
                      onTap: _submitting ? null : _pickWrongCategory,
                      child: Text('EDIT', style: AppTypography.buttonLabel12.copyWith(color: AppColors.accentDim)),
                    ),
                  ],
                ),
              ),
              if (txn.referenceNumber != null) _detailRow('UPI transaction ID', txn.referenceNumber!, mono: true),
              if (txn.bank != null || txn.accountLast4 != null) _detailRow('Paid by', '${txn.bank ?? ''}${txn.accountLast4 != null ? ' ···${txn.accountLast4}' : ''}'.trim(), mono: true),
              if (period != null) _detailRow('Period', formatPeriodRange(period.periodStart, period.periodEnd), isLast: true),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: AppColors.ink900, borderRadius: BorderRadius.circular(16)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Text('✦', style: TextStyle(color: AppColors.accent, fontSize: 12)),
                  const SizedBox(width: 6),
                  Text('WHY THIS CATEGORY', style: AppTypography.microLabelTracked105.copyWith(color: AppColors.accent)),
                  const Spacer(),
                  Text(explanation.label, style: AppTypography.microLabel11.copyWith(color: AppColors.onDarkFaint)),
                ],
              ),
              const SizedBox(height: 10),
              Text(
                explanation.body,
                style: AppTypography.footnote12.copyWith(color: AppColors.onDarkMuted, height: 1.55),
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        _ExplainPanel(
          loading: _explainLoading,
          outcome: _explainOutcome,
          onRequest: txn.transactionType == TransactionType.credit ? null : _requestExplanation,
        ),
        const SizedBox(height: 18),
        if (_feedbackResult != null)
          Center(child: Text(_feedbackResult!, textAlign: TextAlign.center, style: AppTypography.footnote12.copyWith(color: AppColors.accentDim)))
        else ...[
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _submitting ? null : () => _submitFeedback(txn.category ?? 'Unknown'),
                  style: OutlinedButton.styleFrom(side: BorderSide(color: AppColors.hairlineLight), padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100))),
                  child: Text('Looks right', style: AppTypography.buttonLabel12.copyWith(color: AppColors.onLight)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton(
                  onPressed: _submitting ? null : _pickWrongCategory,
                  style: OutlinedButton.styleFrom(side: BorderSide(color: AppColors.hairlineLight), padding: const EdgeInsets.symmetric(vertical: 12), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(100))),
                  child: Text('Wrong category', style: AppTypography.buttonLabel12.copyWith(color: AppColors.onLight)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Center(child: Text("Your correction trains Miravelt's merchant memory.", style: AppTypography.microLabel11.copyWith(color: AppColors.onLightFaint))),
        ],
      ],
    );
  }

  Widget _detailRow(String label, String value, {Widget? trailing, bool mono = false, bool isLast = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(border: isLast ? null : Border(bottom: BorderSide(color: AppColors.hairlineLight))),
      child: Row(
        children: [
          Text(label, style: AppTypography.body14.copyWith(fontSize: 13, color: AppColors.onLightMuted)),
          const Spacer(),
          ?trailing,
          if (trailing == null)
            Text(value, style: (mono ? AppTypography.meta12 : AppTypography.rowLabel14).copyWith(color: AppColors.onLight)),
        ],
      ),
    );
  }
}

/// Free-text description POST /v1/explain grounds its retrieval on
/// (routers/rag.py's `transaction_text` field) - not a transaction id, since
/// the endpoint has no per-user scoping and works purely from the text.
String _explainTransactionText(Transaction txn) {
  final amount = formatCurrency(txn.amount.abs());
  final when = formatFullTimestamp(txn.timestamp);
  final merchant = txn.merchant ?? 'an unknown payee';
  if (txn.transactionType == TransactionType.credit) {
    return 'Received $amount from $merchant on $when.';
  }
  final category = txn.category ?? 'Uncategorized';
  return 'Paid $amount to $merchant on $when, categorized as $category.';
}

/// A deeper, grounded explanation on top of "Why this category" - fetched
/// on demand (never auto, see explain_repository.dart) since it costs a
/// rate-limited LLM call. Deliberately a separate, additive panel rather
/// than replacing "Why this category": that card is already shipped and
/// instant; this one is richer but slower and can come back empty.
class _ExplainPanel extends StatelessWidget {
  const _ExplainPanel({required this.loading, required this.outcome, required this.onRequest});

  final bool loading;
  final ExplainOutcome? outcome;
  final VoidCallback? onRequest;

  @override
  Widget build(BuildContext context) {
    if (outcome == null) {
      return Align(
        alignment: Alignment.centerLeft,
        child: TextButton(
          onPressed: loading ? null : onRequest,
          style: TextButton.styleFrom(padding: EdgeInsets.zero, minimumSize: Size.zero, tapTargetSize: MaterialTapTargetSize.shrinkWrap),
          child: loading
              ? SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.accentDim))
              : Text('Ask for a deeper explanation', style: AppTypography.buttonLabel12.copyWith(color: AppColors.accentDim)),
        ),
      );
    }

    if (!outcome!.isAvailable) {
      return Text(outcome!.unavailableReason!, style: AppTypography.footnote12.copyWith(color: AppColors.onLightMuted));
    }

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(color: AppColors.hairlineLight.withValues(alpha: 0.35), borderRadius: BorderRadius.circular(14)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text('GROUNDED EXPLANATION', style: AppTypography.microLabelTracked105.copyWith(color: AppColors.onLightFaint)),
              const Spacer(),
              if (outcome!.confidence != null)
                Text(outcome!.confidence!, style: AppTypography.microLabel11.copyWith(color: AppColors.onLightFaint)),
            ],
          ),
          const SizedBox(height: 8),
          Text(outcome!.explanation!, style: AppTypography.footnote12.copyWith(color: AppColors.onLight, height: 1.5)),
        ],
      ),
    );
  }
}

/// The "Why this category" card's label and sentence, chosen from how the
/// backend actually decided the category (Transaction.categorizationConfidence)
/// so the card never claims more certainty than there was.
({String label, String body}) _categoryExplanation(Transaction txn) {
  final category = txn.category ?? 'Uncategorized';
  final payee = txn.merchant ?? 'this payee';
  final confidence = txn.categorizationConfidence;

  if (txn.transactionType == TransactionType.credit) {
    return (label: 'INCOMING', body: 'Money you received from $payee. Incoming payments are always filed under Income.');
  }
  if (category == 'Uncategorized' || confidence == 0) {
    return (
      label: 'NOT MATCHED',
      body: "Miravelt doesn't recognise $payee as a merchant or a type of business, so this is left uncategorized "
          "rather than guessed. Use Wrong category to teach it - every $payee payment updates with it.",
    );
  }
  if (confidence != null && confidence < 0.9) {
    return (
      label: 'BEST GUESS',
      body: '$payee isn\'t a known merchant, but its name suggests a $category business. '
          'This is a best guess - if it\'s off, use Wrong category.',
    );
  }
  if (confidence != null) {
    return (label: 'KNOWN MERCHANT', body: 'Filed under $category because $payee is a known merchant, or because you corrected it.');
  }
  return (label: 'MERCHANT-BASED', body: 'Filed under $category for $payee.');
}
