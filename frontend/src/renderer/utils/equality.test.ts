import { expect } from 'chai';
import {
  clearComparisons,
  isSameAxisData,
  isSameAxisPayload,
} from './equality';

describe('isSameAxisData', () => {
  it('matches equal vectors and separates different ones', () => {
    expect(isSameAxisData([1, 2, 3], [1, 2, 3])).to.equal(true);
    expect(isSameAxisData([1, 2, 3], [1, 2, 4])).to.equal(false);
    expect(isSameAxisData([1, 2, 3], [1, 2])).to.equal(false);
  });

  it('walks nested matrices', () => {
    expect(
      isSameAxisData(
        [
          [1, 2],
          [3, 4],
        ],
        [
          [1, 2],
          [3, 4],
        ],
      ),
    ).to.equal(true);
    expect(
      isSameAxisData(
        [
          [1, 2],
          [3, 4],
        ],
        [
          [1, 2],
          [3, 5],
        ],
      ),
    ).to.equal(false);
  });

  it('keeps the JSON.stringify semantics it replaced', () => {
    // Both were written as `null` inside an array, so both compared equal.
    expect(isSameAxisData([NaN], [NaN])).to.equal(true);
    expect(isSameAxisData(null, undefined)).to.equal(true);
    expect(isSameAxisData([1, NaN], [1, 2])).to.equal(false);
  });

  it('compares complex values by their parts', () => {
    expect(isSameAxisData([{ r: 1, i: 2 }], [{ r: 1, i: 2 }])).to.equal(true);
    expect(isSameAxisData([{ r: 1, i: 2 }], [{ r: 1, i: 3 }])).to.equal(false);
  });
});

describe('isSameAxisPayload', () => {
  beforeEach(() => clearComparisons());

  it('links two grids holding equal values under different keys', () => {
    // The regression this guards: two grids plotting different nodes of one IDS
    // share a time coordinate, but each fetched it inside its own response.
    const time = [0, 0.1, 0.2];
    expect(
      isSameAxisPayload(
        time,
        '/d?uri=a#coord:time',
        [...time],
        '/d?uri=b#coord:time',
      ),
    ).to.equal(true);
  });

  it('keeps apart two coordinates that merely share a name', () => {
    expect(
      isSameAxisPayload(
        [0, 1],
        '/d?uri=a#coord:time',
        [0, 2],
        '/d?uri=b#coord:time',
      ),
    ).to.equal(false);
  });

  it('answers from one key when both sides name the same payload', () => {
    expect(isSameAxisPayload([1], 'k', [2], 'k')).to.equal(true);
  });

  it('falls back to the walk when a key is missing', () => {
    expect(isSameAxisPayload([1, 2], undefined, [1, 2], 'k')).to.equal(true);
    expect(isSameAxisPayload([1, 2], 'k', [1, 3], undefined)).to.equal(false);
  });

  it('remembers the answer for a pair rather than walking again', () => {
    // A slider tick asks the same question about the same two payloads over and
    // over; only the first one is allowed to cost a walk.
    let reads = 0;
    const counted = (values: number[]) =>
      new Proxy(values, {
        get(target, property) {
          reads++;
          return Reflect.get(target, property);
        },
      }) as unknown as number[];

    const a = counted([1, 2, 3]);
    const b = counted([1, 2, 3]);

    expect(isSameAxisPayload(a, 'ka', b, 'kb')).to.equal(true);
    const afterFirst = reads;
    expect(afterFirst).to.be.greaterThan(0);

    expect(isSameAxisPayload(a, 'ka', b, 'kb')).to.equal(true);
    expect(reads).to.equal(afterFirst);
  });

  it('gives one answer however the pair is ordered', () => {
    expect(isSameAxisPayload([1], 'ka', [1], 'kb')).to.equal(true);
    expect(isSameAxisPayload([9], 'kb', [9], 'ka')).to.equal(true);
  });
});
