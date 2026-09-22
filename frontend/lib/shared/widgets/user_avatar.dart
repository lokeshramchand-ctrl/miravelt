import 'package:flutter/material.dart';

import '../../core/avatars/user_avatars.dart';
import 'avatar_chip.dart';

/// The signed-in user's avatar: one of the bundled illustrations, picked from
/// [seed] (their user id) by [userAvatarForSeed].
///
/// Falls back to the gradient [AvatarChip] of [initials] when there is no seed
/// - signed out, or a user record that arrived without an id.
class UserAvatar extends StatelessWidget {
  const UserAvatar({
    super.key,
    required this.seed,
    required this.initials,
    this.size = 40,
    this.gradient,
    this.foregroundColor,
    this.backgroundColor,
  });

  final String? seed;
  final String initials;
  final double size;

  /// Only used by the initials fallback.
  final Gradient? gradient;
  final Color? foregroundColor;
  final Color? backgroundColor;

  @override
  Widget build(BuildContext context) {
    final asset = userAvatarForSeed(seed);
    if (asset == null) {
      return AvatarChip(
        initials: initials,
        size: size,
        gradient: gradient,
        foregroundColor: foregroundColor,
        backgroundColor: backgroundColor,
      );
    }
    return ClipOval(
      child: Image.asset(
        asset,
        width: size,
        height: size,
        fit: BoxFit.cover,
        // A missing/corrupt asset should degrade to initials, not to Flutter's
        // grey error box sitting in the middle of the header.
        errorBuilder: (context, error, stackTrace) => AvatarChip(
          initials: initials,
          size: size,
          gradient: gradient,
          foregroundColor: foregroundColor,
          backgroundColor: backgroundColor,
        ),
      ),
    );
  }
}
