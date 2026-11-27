import { vi } from 'vitest';
import { deviceTimeZone, pickTimeZone } from '@/lib/format';

const zones = ['Asia/Riyadh', 'Asia/Dubai', 'Africa/Cairo', 'Europe/Berlin', 'America/New_York'];

describe('time zone default (review finding 3)', () => {
  it('prefers the device zone over the chosen country', () => {
    expect(pickTimeZone({ device: 'Europe/Berlin', zones, country: 'AE' })).toBe('Europe/Berlin');
  });

  it('never overwrites a valid device zone when the country changes', () => {
    for (const country of ['SA', 'AE', 'EG', 'ZZ', null]) {
      expect(
        pickTimeZone({ device: 'America/New_York', zones, country, current: 'America/New_York' }),
      ).toBe('America/New_York');
    }
  });

  it('falls back to the country only when the device zone is unavailable', () => {
    expect(pickTimeZone({ device: null, zones, country: 'AE' })).toBe('Asia/Dubai');
    expect(pickTimeZone({ device: null, zones, country: 'EG' })).toBe('Africa/Cairo');
  });

  it('treats a device zone the picker cannot offer as unavailable', () => {
    expect(pickTimeZone({ device: 'Etc/Unknown', zones, country: 'AE' })).toBe('Asia/Dubai');
  });

  it('keeps the current value for a country without a known zone, else the Gulf default', () => {
    expect(pickTimeZone({ device: null, zones, country: 'FR', current: 'Europe/Berlin' })).toBe(
      'Europe/Berlin',
    );
    expect(pickTimeZone({ device: null, zones, country: 'FR' })).toBe('Asia/Riyadh');
  });

  it('reads the device zone from Intl, and reports null when it is missing or throws', () => {
    const spy = vi.spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions');
    spy.mockReturnValue({ timeZone: 'Asia/Dubai' } as Intl.ResolvedDateTimeFormatOptions);
    expect(deviceTimeZone()).toBe('Asia/Dubai');
    spy.mockReturnValue({ timeZone: '' } as Intl.ResolvedDateTimeFormatOptions);
    expect(deviceTimeZone()).toBeNull();
    spy.mockImplementation(() => {
      throw new RangeError('no zone');
    });
    expect(deviceTimeZone()).toBeNull();
    spy.mockRestore();
  });
});
