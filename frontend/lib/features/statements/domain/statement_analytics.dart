import 'package:freezed_annotation/freezed_annotation.dart';

part 'statement_analytics.freezed.dart';
part 'statement_analytics.g.dart';

@freezed
abstract class CategoryBreakdownEntry with _$CategoryBreakdownEntry {
  const factory CategoryBreakdownEntry({
    required String category,
    required double totalAmount,
    required int count,
  }) = _CategoryBreakdownEntry;

  factory CategoryBreakdownEntry.fromJson(Map<String, dynamic> json) => _$CategoryBreakdownEntryFromJson(json);
}

@freezed
abstract class TopMerchantEntry with _$TopMerchantEntry {
  const factory TopMerchantEntry({
    required String merchant,
    required double totalAmount,
    required int count,
  }) = _TopMerchantEntry;

  factory TopMerchantEntry.fromJson(Map<String, dynamic> json) => _$TopMerchantEntryFromJson(json);
}

@freezed
abstract class DailyTrendEntry with _$DailyTrendEntry {
  const factory DailyTrendEntry({
    required DateTime date,
    required double totalAmount,
    required int count,
  }) = _DailyTrendEntry;

  factory DailyTrendEntry.fromJson(Map<String, dynamic> json) => _$DailyTrendEntryFromJson(json);
}

@freezed
abstract class RecurringPaymentEntry with _$RecurringPaymentEntry {
  const factory RecurringPaymentEntry({
    required String merchant,
    required double estimatedMonthlyCost,
    required double periodicityScore,
    required int occurrences,
  }) = _RecurringPaymentEntry;

  factory RecurringPaymentEntry.fromJson(Map<String, dynamic> json) => _$RecurringPaymentEntryFromJson(json);
}

@freezed
abstract class StatementAnalytics with _$StatementAnalytics {
  const factory StatementAnalytics({
    required String statementId,
    required double totalSpend,
    required double totalIncome,
    required double net,
    required double averageTransactionValue,
    required int transactionCount,
    required int failedTransactionCount,
    required List<CategoryBreakdownEntry> categoryBreakdown,
    required List<TopMerchantEntry> topMerchants,
    required List<DailyTrendEntry> dailyTrend,
    required List<RecurringPaymentEntry> recurringPayments,
    required DateTime generatedAt,
  }) = _StatementAnalytics;

  factory StatementAnalytics.fromJson(Map<String, dynamic> json) => _$StatementAnalyticsFromJson(json);
}

extension StatementAnalyticsSpending on StatementAnalytics {
  /// [categoryBreakdown] minus `Income`: the backend's breakdown covers every
  /// transaction, credits included (docs/23-statements-pipeline.md), while
  /// [totalSpend] is debits only - so any "where it went" / "% of spending"
  /// view must leave the incoming money out or its shares pass 100%.
  List<CategoryBreakdownEntry> get spendingBreakdown =>
      categoryBreakdown.where((e) => e.category != 'Income').toList();
}
