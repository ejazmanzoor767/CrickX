import { MatchesService, applicationState } from './matches.service';

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

  it('keeps a started NS fixture UPCOMING when the provider has not marked it live', () => {
    expect(applicationState({
      id: 8,
      status: 'NS',
      live: 0,
      starting_at: new Date(now - 60_000).toISOString(),
    } as any)).toBe('UPCOMING');
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


describe('MatchesService live projection', () => {
  function makeRealtime(staleRef: any) {
    const batch = {
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    const liveCollection = {
      where: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue({ docs: [staleRef] }),
      }),
      doc: jest.fn().mockReturnValue({
        set: jest.fn().mockResolvedValue(undefined),
      }),
    };
    const completedCollection = {
      doc: jest.fn().mockReturnValue({
        set: jest.fn().mockResolvedValue(undefined),
      }),
    };

    return {
      batch,
      completedCollection,
      realtime: {
        isEnabled: jest.fn().mockReturnValue(true),
        db: {
          batch: jest.fn().mockReturnValue(batch),
          collection: jest.fn((name: string) =>
            name === 'liveMatches' ? liveCollection : completedCollection,
          ),
        },
      },
    };
  }

  it('keeps a dropped live fixture active when Sportmonks has not confirmed terminal status', async () => {
    const ref = {};
    const { realtime, batch } = makeRealtime({ id: '123', ref });
    const sportmonks = {
      getFixture: jest.fn().mockResolvedValue({
        id: 123,
        status: 'Live',
        live: 1,
        starting_at: new Date(Date.now() - 60_000).toISOString(),
      }),
    };
    const firestore = {};

    const service = new MatchesService(sportmonks as any, firestore as any, realtime as any);
    await (service as any).projectLiveMatches([]);

    expect(batch.set).toHaveBeenCalledWith(
      ref,
      expect.objectContaining({ active: true, applicationState: 'LIVE' }),
      { merge: true },
    );
  });

  it('projects a dropped fixture to Completed as soon as Sportmonks confirms terminal status', async () => {
    const ref = {};
    const { realtime, batch, completedCollection } = makeRealtime({ id: '123', ref });
    const sportmonks = {
      getFixture: jest.fn().mockResolvedValue({
        id: 123,
        status: 'Finished',
        live: 0,
        starting_at: new Date(Date.now() - 60_000).toISOString(),
      }),
    };
    const firestore = {};

    const service = new (require('./matches.service').MatchesService)(sportmonks, firestore, realtime);
    await (service as any).projectLiveMatches([]);

    expect(completedCollection.doc).toHaveBeenCalledWith('123');
    expect(batch.set).toHaveBeenCalledWith(
      ref,
      expect.objectContaining({ active: false, applicationState: 'COMPLETED' }),
      { merge: true },
    );
  });
});
