/**
 * The bundled avatar illustrations (`assets/avatars/`), and the rule that
 * assigns one to a user.
 *
 * The assignment is random-looking but *stable*: the same user always gets the
 * same face on every device and every reinstall, because it is derived from
 * their immutable user id rather than a random number generator. Nothing about
 * the choice is stored server-side.
 */
import type { ImageSourcePropType } from 'react-native';

export const userAvatarAssets: ImageSourcePropType[] = [
  require('../../assets/avatars/alpaca.png'),
  require('../../assets/avatars/baby-octopus.png'),
  require('../../assets/avatars/classic-panda.png'),
  require('../../assets/avatars/gecko-6.png'),
  require('../../assets/avatars/jellyfish-4.png'),
  require('../../assets/avatars/raccoon-apricot.png'),
  require('../../assets/avatars/raccoon-close-set-eyes-left.png'),
  require('../../assets/avatars/tiny-yeti.png'),
  require('../../assets/avatars/white-lop-rabbit.png'),
];

/**
 * FNV-1a (32-bit), written out rather than relying on any built-in hash so the
 * mapping never reshuffles - and identical to the Flutter client's, so existing
 * users keep the face they already have.
 */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** The avatar for `seed` (user id, or email as a fallback), or null when there is nothing to derive one from. */
export function userAvatarForSeed(seed: string | null | undefined): ImageSourcePropType | null {
  const trimmed = seed?.trim();
  if (!trimmed) return null;
  return userAvatarAssets[fnv1a(trimmed) % userAvatarAssets.length];
}
