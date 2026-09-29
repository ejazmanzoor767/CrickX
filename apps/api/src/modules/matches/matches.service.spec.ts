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

  it('keeps a future fixture UPCOMING even when the provider live flag is premature', () => {
    expect(applicationState({
      id: 3,
      status: 'NS',
      live: 1,
      starting_at: new Date(now + 60_000).toISOString(),
    } as any)).toBe('UPCOMING');
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

  it('expires an old NS fixture even when the provider live flag is stale', () => {
    expect(applicationState({
      id: 5,
      status: 'NS',
      live: 1,
      starting_at: new Date(now - 7 * 60 * 60 * 1000).toISOString(),
    } as any)).toBe('COMPLETED');
  });

});
