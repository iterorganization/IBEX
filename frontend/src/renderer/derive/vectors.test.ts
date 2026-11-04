import { expect } from 'chai';
import {
  axisVector,
  bandVectors,
  cursorOf,
  customdataOf,
  lineVector,
  slabMatrix,
} from './vectors';
import { Coordinates, DataPlotly } from '../types';

/** A coordinate with no dependencies: its own vector is its data. */
const coordinate = (
  name: string,
  axeIndex: number,
  valueIndex: number,
  data: number[] | number[][],
  dependencies: string[] = [],
): Coordinates =>
  ({
    name,
    axeIndex,
    valueIndex,
    data,
    shape: [Array.isArray(data) ? data.length : 0],
    coord_dependencies: dependencies,
    path: `p/${name}`,
    target: `t/${name}`,
  }) as Coordinates;

describe('derive/vectors', () => {
  // A 2 x 3 matrix: two time slices of a three-point profile.
  const matrix = [
    [10, 11, 12],
    [20, 21, 22],
  ];
  const at = (timeIndex: number) => [
    coordinate('rho', 0, 0, [0.1, 0.2, 0.3]),
    coordinate('time', 1, timeIndex, [5, 6]),
  ];

  describe('lineVector', () => {
    it('takes the row the cursor points at', () => {
      expect(lineVector(matrix, at(0))).to.deep.equal([10, 11, 12]);
      expect(lineVector(matrix, at(1))).to.deep.equal([20, 21, 22]);
    });

    it('returns the same array twice for the same payload and cursor', () => {
      // Reference equality is the contract: two synchronized grids showing the
      // same payload at the same cursor must derive once between them, and
      // Plotly compares what it is handed by reference.
      const first = lineVector(matrix, at(1));
      const second = lineVector(matrix, at(1));
      expect(second).to.equal(first);
    });

    it('does not confuse two cursors on one payload', () => {
      const first = lineVector(matrix, at(0));
      lineVector(matrix, at(1));
      expect(lineVector(matrix, at(0))).to.equal(first);
    });

    it('keeps payloads apart', () => {
      const other = [
        [1, 2, 3],
        [4, 5, 6],
      ];
      expect(lineVector(other, at(0))).to.deep.equal([1, 2, 3]);
      expect(lineVector(matrix, at(0))).to.deep.equal([10, 11, 12]);
    });

    it('has nothing to derive without a payload', () => {
      expect(lineVector(undefined, at(0))).to.equal(undefined);
    });
  });

  describe('axisVector', () => {
    it('returns the vector of the coordinate on that axis', () => {
      expect(axisVector(at(0), 0)).to.deep.equal([0.1, 0.2, 0.3]);
    });

    it('follows the axis rather than the coordinate', () => {
      // After a transposition the coordinates keep their data and swap axes.
      const swapped = [
        coordinate('rho', 1, 0, [0.1, 0.2, 0.3]),
        coordinate('time', 0, 0, [5, 6]),
      ];
      expect(axisVector(swapped, 0)).to.deep.equal([5, 6]);
    });

    it('is undefined for an axis no coordinate is on', () => {
      expect(axisVector(at(0), 7)).to.equal(undefined);
    });
  });

  describe('cursorOf', () => {
    it('separates a moved cursor from a moved axis', () => {
      expect(cursorOf(at(0))).to.not.equal(cursorOf(at(1)));
      const swapped = [
        coordinate('rho', 1, 0, [0.1]),
        coordinate('time', 0, 0, [5]),
      ];
      const straight = [
        coordinate('rho', 0, 0, [0.1]),
        coordinate('time', 1, 0, [5]),
      ];
      expect(cursorOf(swapped)).to.not.equal(cursorOf(straight));
    });
  });

  describe('error bands', () => {
    const plot = {
      yData: matrix,
      error_bands: [
        {
          path: 'u_error_upper',
          yData: [
            [1, 1, 1],
            [2, 2, 2],
          ],
        },
        {
          path: 'l_error_lower',
          yData: [
            [3, 3, 3],
            [4, 4, 4],
          ],
        },
      ],
    } as DataPlotly;

    it('derives one row per band, at the grid cursor', () => {
      expect(bandVectors(plot, at(1))).to.deep.equal([
        [2, 2, 2],
        [4, 4, 4],
      ]);
    });

    it('pairs two bands into the columns the hover template reads', () => {
      expect(customdataOf(bandVectors(plot, at(0)))).to.deep.equal([
        [1, 3],
        [1, 3],
        [1, 3],
      ]);
    });

    it('gives a symmetric band a single column', () => {
      const symmetric = {
        yData: matrix,
        error_bands: [plot.error_bands[0]],
      } as DataPlotly;
      expect(customdataOf(bandVectors(symmetric, at(0)))).to.deep.equal([
        [1],
        [1],
        [1],
      ]);
    });

    it('has no customdata when there are no bands', () => {
      expect(customdataOf([])).to.equal(undefined);
    });
  });

  describe('slabMatrix', () => {
    // 2 x 2 x 3: two outer slices of the matrix above.
    const cube = [
      matrix,
      [
        [30, 31, 32],
        [40, 41, 42],
      ],
    ];
    const cubeAt = (outer: number) => [
      coordinate('rho', 0, 0, [0.1, 0.2, 0.3]),
      coordinate('time', 1, 0, [5, 6]),
      coordinate('run', 2, outer, [0, 1]),
    ];

    it('walks down to two dimensions with the cursor of the axes above', () => {
      expect(slabMatrix(cube, cubeAt(1))).to.deep.equal([
        [30, 31, 32],
        [40, 41, 42],
      ]);
    });

    it('leaves a matrix that is already two-dimensional alone', () => {
      expect(slabMatrix(matrix, at(0))).to.equal(matrix);
    });

    it('is memoised apart from the row of the same payload', () => {
      const slab = slabMatrix(matrix, at(0));
      expect(lineVector(matrix, at(0))).to.not.equal(slab);
      expect(slabMatrix(matrix, at(0))).to.equal(slab);
    });
  });
});
