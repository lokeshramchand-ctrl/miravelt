import { fnv1a, userAvatarAssets, userAvatarForSeed } from '../src/lib/avatars';

describe('userAvatarForSeed', () => {
  it('always returns one of the bundled assets', () => {
    for (let i = 0; i < 200; i++) expect(userAvatarAssets).toContain(userAvatarForSeed(`user-${i}`));
  });

  it('is stable for the same seed', () => {
    expect(userAvatarForSeed('65f0c1a2b3d4e5f607182930')).toBe(userAvatarForSeed('65f0c1a2b3d4e5f607182930'));
  });

  it('spreads across the whole catalogue', () => {
    const seen = new Set(Array.from({ length: 200 }, (_, i) => userAvatarForSeed(`65f0c1a2b3d4e5f6071829${i}`)));
    expect(seen.size).toBe(userAvatarAssets.length);
  });

  it('falls back to null without a usable seed', () => {
    expect(userAvatarForSeed(null)).toBeNull();
    expect(userAvatarForSeed('')).toBeNull();
    expect(userAvatarForSeed('   ')).toBeNull();
  });

  it('hashes with standard 32-bit FNV-1a, so existing users keep their avatar', () => {
    // Reference vectors for FNV-1a 32-bit.
    expect(fnv1a('')).toBe(0x811c9dc5);
    expect(fnv1a('a')).toBe(0xe40c292c);
    expect(fnv1a('foobar')).toBe(0xbf9cf968);
  });
});
