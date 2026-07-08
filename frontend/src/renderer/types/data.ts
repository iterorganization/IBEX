import { AxisData } from './plot';

export type PlotCoordinatesResponse = {
  name: string;
  target: string;
  unit: string;
  value: AxisData;
  downsampled_shape: number[];
  shape: number[] | 'irregular';
  coordinates: string[];
  ndim: number;
  path: string;
  description: string;
};

export type PlotDataResponse = {
  data: {
    name: string;
    unit: string;
    value: AxisData;
    downsampled_shape: number[];
    downsampled_method: string;
    interpolated_method: string;
    shape: number[] | 'irregular';
    ndim: number;
    path: string;
    description: string;
    coordinates: PlotCoordinatesResponse[];
  };
};

export type FieldValueResponse = {
  value: AxisData;
};

export type SmoothingParams = {
  smoothing_method: string;
  gaussian_smoothing_sigma?: number;
  savgol_smoothing_window_length?: number;
  savgol_smoothing_polyorder?: number;
  savgol_smoothing_deriv?: number;
  savgol_smoothing_delta?: number;
  savgol_smoothing_mode?: string;
  savgol_smoothing_cval?: number;
};

export type DownsamplingMethodsResponse = {
  downsampling_methods: [
    {
      name: string;
      description: string;
    },
  ];
};

export type DataManipulationListResponse = {
  data_manipulation_methods: Array<{
    name: string;
    description: string;
    method_parameters: DataManipulationParameterResponse[];
  }>;
};

type DataManipulationParameterResponse = {
  human_readable_name: string;
  name: string;
  description: string;
  possible_values: DataManipulationMethodResponse[];
};

type DataManipulationMethodResponse = {
  value: string;
  description: string;
};

export type ArraySummaryResponse = {
  shape: number[];
  min: number;
  max: number;
  mean: number;
  standard_deviation: number;
  message?: string;
};

export type InfoVersionResponse = {
  version: string;
};
