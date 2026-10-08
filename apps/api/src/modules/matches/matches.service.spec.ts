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

  it('promotes a started NS fixture to LIVE from the provider live flag before scoring data arrives', () => {
    expect(applicationState({
      id: 2,
      status: 'NS',
      live: 1,
      starting_at: new Date(now - 60_000).toISOString(),
    } as any)).toBe('LIVE');
  });

  it('promotes a started NS fixture to LIVE even before Sportmonks flips its status/live flag', () => {
    expect(applicationState({
      id: 8,
      status: 'NS',
      live: 0,
      starting_at: new Date(now - 60_000).toISOString(),
    } as any)).toBe('LIVE');
  });

  it('treats a started fixture from the dedicated live feed as LIVE during kickoff', () => {
    expect(applicationState({
      id: 9,
      status: 'NS',
      live: 0,
      starting_at: new Date(now - 60_000).toISOString(),
    } as any, { providerLiveFeed: true })).toBe('LIVE');
  });

  it('never promotes a future fixture to LIVE just because it came from the live feed', () => {
    expect(applicationState({
      id: 10,
      status: 'NS',
      live: 0,
      starting_at: new Date(now + 60_000).toISOString(),
    } as any, { providerLiveFeed: true })).toBe('UPCOMING');
  });

  it('allows a started NS fixture LIVE when live=1 has scoring evidence', () => {
    expect(applicationState({
      id: 6,
      status: 'NS',
      live: 1,
      starting_at: new Date(now - 60_000).toISOString(),
      scoreboards: [{ score: 12 }],
    } as any)).toBe('LIVE');
  });

  it('promotes an NS fixture with an initialized scoreboard when the provider marks it live', () => {
    expect(applicationState({
      id: 7,
      status: 'NS',
      live: 1,
      starting_at: new Date(now - 60_000).toISOString(),
      scoreboards: [{ score: 0, total: 0 }],
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
