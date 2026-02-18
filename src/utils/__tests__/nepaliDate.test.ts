import { describe, expect, it } from 'vitest';
import { parseInputDateToAd } from '@/utils/nepaliDate';

describe('nepaliDate BS to AD conversion', () => {
  it('converts Poush 19 (2082-09-19) to the expected AD date', () => {
    expect(parseInputDateToAd('2082-09-19', 'BS')).toBe('2026-01-03');
  });

  it('preserves strict date ordering around Poush 19', () => {
    const day18 = parseInputDateToAd('2082-09-18', 'BS');
    const day19 = parseInputDateToAd('2082-09-19', 'BS');
    const day20 = parseInputDateToAd('2082-09-20', 'BS');

    expect(day18).not.toBeNull();
    expect(day19).not.toBeNull();
    expect(day20).not.toBeNull();

    expect(day18! < day19!).toBe(true);
    expect(day19! < day20!).toBe(true);
  });
});

