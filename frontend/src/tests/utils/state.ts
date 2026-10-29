import { TestState } from 'src/renderer/types';

export const mockConfigurationState: Partial<TestState> = {
  configurations: [
    {
      name: 'Test Configuration 1',
      dataURI: [],
      checkedNodeURI: [],
      customDataTree: [],
      dataPlot: [],
    },

    {
      name: 'Test Configuration 2',
      dataURI: [],
      checkedNodeURI: [],
      customDataTree: [],
      dataPlot: [],
    },
  ],
  active: {
    name: 'Test Configuration 1',
    dataURI: [],
    checkedNodeURI: [],
    customDataTree: [],
    dataPlot: [],
  },
};

export const mockemptyConfigurationsState: Partial<TestState> = {
  configurations: [],
  active: null,
};
