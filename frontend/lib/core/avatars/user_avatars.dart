/// The bundled avatar illustrations (`assets/avatars/`), and the rule that
/// assigns one to a user.
///
/// The assignment is random-looking but *stable*: the same user always gets
/// the same face on every device and every reinstall, because it is derived
/// from their immutable user id rather than from a random number generator.
/// Nothing about the choice is stored server-side.
library;

const List<String> userAvatarAssets = [
  'assets/avatars/alpaca.png',
  'assets/avatars/baby-octopus.png',
  'assets/avatars/classic-panda.png',
  'assets/avatars/gecko-6.png',
  'assets/avatars/jellyfish-4.png',
  'assets/avatars/raccoon-apricot.png',
  'assets/avatars/raccoon-close-set-eyes-left.png',
  'assets/avatars/tiny-yeti.png',
  'assets/avatars/white-lop-rabbit.png',
];

/// FNV-1a (32-bit). Written out rather than using [String.hashCode] because
/// that one carries no cross-version stability guarantee - a Dart upgrade
/// could silently reshuffle everybody's avatar.
int _fnv1a(String input) {
  var hash = 0x811c9dc5;
  for (final unit in input.codeUnits) {
    hash ^= unit;
    hash = (hash * 0x01000193) & 0xffffffff;
  }
  return hash;
}

/// The avatar asset for [seed] (the user's id, or their email as a fallback),
/// or `null` when there is no seed to derive one from - callers then fall back
/// to initials.
String? userAvatarForSeed(String? seed) {
  final trimmed = seed?.trim();
  if (trimmed == null || trimmed.isEmpty) return null;
  return userAvatarAssets[_fnv1a(trimmed) % userAvatarAssets.length];
}
