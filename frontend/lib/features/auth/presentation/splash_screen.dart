import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_typography.dart';
import 'auth_controller.dart';

class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Routing off of auth state happens in the router's redirect (see
    // app_router.dart) - this screen is purely the loading visual while
    // authControllerProvider resolves.
    ref.watch(authControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.ink900,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Wordmark only - the app's logo mark is deliberately not shown
            // inside the app (it lives on the launcher icon alone).
            Text('Miravelt', style: AppTypography.wordmark14.copyWith(color: AppColors.onDark)),
            const SizedBox(height: 28),
            SizedBox(
              width: 22,
              height: 22,
              child: CircularProgressIndicator(strokeWidth: 2.2, color: AppColors.accent),
            ),
          ],
        ),
      ),
    );
  }
}
