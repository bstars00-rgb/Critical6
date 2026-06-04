import { describe, it, expect } from 'vitest';
import { weekStart } from '@/lib/date';

describe('weekStart', () => {
  it('returns the Monday of the given week', () => {
    // 2026-06-04 is a Thursday → Monday is 2026-06-01
    expect(weekStart(new Date('2026-06-04T10:00:00Z'))).toBe('2026-06-01');
  });

  it('returns the same day when it is already Monday', () => {
    expect(weekStart(new Date('2026-06-01T00:00:00Z'))).toBe('2026-06-01');
  });

  it('handles Sunday as the end of the ISO week', () => {
    // 2026-06-07 is a Sunday → Monday is still 2026-06-01
    expect(weekStart(new Date('2026-06-07T23:00:00Z'))).toBe('2026-06-01');
  });
});
