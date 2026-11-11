import { createStuckAwareWait, settlesWithin } from '../functions';

describe('settlesWithin', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('is true for a promise that resolves in time', async () => {
    await expect(settlesWithin(Promise.resolve(), 1000)).resolves.toBe(true);
  });

  it('is true for a promise that rejects in time', async () => {
    await expect(settlesWithin(Promise.reject(new Error('subscribe failed')), 1000)).resolves.toBe(true);
  });

  it('is false for a promise that hangs, like a stuck browser subscription', async () => {
    const result = settlesWithin(new Promise(() => undefined), 1000);

    jest.advanceTimersByTime(1000);

    await expect(result).resolves.toBe(false);
  });
});

describe('createStuckAwareWait', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('waits for a hanging promise once and answers at once afterwards', async () => {
    const wait = createStuckAwareWait(1000);
    const stuck = new Promise(() => undefined);

    const first = wait(stuck);
    jest.advanceTimersByTime(1000);
    await expect(first).resolves.toBe(false);

    await expect(wait(stuck)).resolves.toBe(false);
  });

  it('keeps waiting for other promises', async () => {
    const wait = createStuckAwareWait(1000);

    await expect(wait(Promise.resolve())).resolves.toBe(true);
  });
});
