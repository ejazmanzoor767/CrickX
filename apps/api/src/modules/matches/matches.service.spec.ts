import { applicationState } from './matches.service';

describe('applicationState', () => {
  const now = Date.now();

  it('marks abandoned fixtures completed even when Sportmonks leaves live=1', () => {
    expect(applicationState({
      id: 1,
      status: 'Abandoned',
      live: 1,
      starting_at: new Date(now - 60_000).toISOString(),
    } as any)).toBe('COMPLETED');
  });

  it('promotes a started fixture to LIVE when live=1 but status is still NS', () => {
    expect(applicationState({
      id: 2,
      status: 'NS',
      live: 1,
      starting_at: new Date(now - 60_000).toISOString(),
    } as any)).toBe('LIVE');
  });

  it('trusts live=1 even when the provider start time is still in the future', () => {
    expect(applicationState({
      id: 3,
      status: 'NS',
      live: 1,
      starting_at: new Date(now + 60_000).toISOString(),
    } as any)).toBe('LIVE');
  });

  it('marks no-result fixtures completed', () => {
    expect(applicationState({
      id: 4,
      status: 'No Result',
      live: 0,
      starting_at: new Date(now - 60_000).toISOString(),
      draw_noresult: true,
    } as any)).toBe('COMPLETED');
  });
});
