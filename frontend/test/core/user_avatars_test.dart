import 'package:flutter_test/flutter_test.dart';

import 'package:miravelt/core/avatars/user_avatars.dart';

void main() {
  group('userAvatarForSeed', () {
    test('always returns one of the bundled assets', () {
      for (var i = 0; i < 200; i++) {
        expect(userAvatarAssets, contains(userAvatarForSeed('user-$i')));
      }
    });

    test('is stable for the same seed', () {
      expect(userAvatarForSeed('65f0c1a2b3d4e5f607182930'), userAvatarForSeed('65f0c1a2b3d4e5f607182930'));
    });

    test('spreads across the whole catalogue', () {
      final seen = {for (var i = 0; i < 200; i++) userAvatarForSeed('65f0c1a2b3d4e5f6071829$i')};
      expect(seen.length, userAvatarAssets.length);
    });

    test('falls back to null without a usable seed', () {
      expect(userAvatarForSeed(null), isNull);
      expect(userAvatarForSeed(''), isNull);
      expect(userAvatarForSeed('   '), isNull);
    });
  });
}
