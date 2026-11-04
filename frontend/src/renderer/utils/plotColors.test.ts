import { expect } from 'chai';
import {
  defaultColorsRGB,
  nextDefaultColor,
  withDefaultColors,
} from './plotColors';
import { DataPlotly } from '../types';

const trace = (name: string, color?: string): DataPlotly =>
  ({ name, line: color ? { color } : {} }) as DataPlotly;

const [blue, orange, green] = defaultColorsRGB;

describe('nextDefaultColor', () => {
  it('takes palette colours in order on an empty grid', () => {
    const used: string[] = [];
    for (let i = 0; i < 3; i++) used.push(nextDefaultColor(used));
    expect(used).to.deep.equal([blue, orange, green]);
  });

  it('gives a re-added trace the freed colour, not one in use', () => {
    // A, B, C plotted, A removed, A added back.
    expect(nextDefaultColor([orange, green])).to.equal(blue);
    // Same with the middle one.
    expect(nextDefaultColor([blue, green])).to.equal(orange);
  });

  it('skips a palette colour the user picked, and ignores others', () => {
    expect(nextDefaultColor([blue, 'rgb(1, 2, 3)'])).to.equal(orange);
  });

  it('compares colours regardless of spacing and case', () => {
    expect(nextDefaultColor(['RGB(31,119,180)'])).to.equal(orange);
  });

  it('spreads repeats evenly once the palette is used up', () => {
    const used = [...defaultColorsRGB];
    expect(nextDefaultColor(used)).to.equal(blue);
    used.push(blue);
    expect(nextDefaultColor(used)).to.equal(orange);
    // Removing a colour used once makes it the least used again.
    expect(nextDefaultColor(used.filter((c) => c !== green))).to.equal(green);
  });
});

describe('withDefaultColors', () => {
  it('colours the traces that have none, against those that do', () => {
    const plots = [trace('a'), trace('b', blue), trace('c')];
    const colored = withDefaultColors(plots);
    expect(colored.map((p) => p.line?.color)).to.deep.equal([
      orange,
      blue,
      green,
    ]);
  });

  it('returns traces that already have a colour unchanged', () => {
    const plots = [trace('a', green), trace('b')];
    const colored = withDefaultColors(plots);
    expect(colored[0]).to.equal(plots[0]);
    expect(colored[1]).to.not.equal(plots[1]);
    expect(plots[1].line?.color).to.equal(undefined);
  });
});
