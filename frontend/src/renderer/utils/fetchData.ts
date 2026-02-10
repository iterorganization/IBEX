import { showNotification } from '@mantine/notifications';
import {
  ArraySummaryResponse,
  AxisData,
  DataIdsResponse,
  DownsamplingMethodsResponse,
  FieldValueResponse,
  FormDbEntries,
  InfoVersionResponse,
  NodeInfoResponse,
  PlotDataResponse,
  SearchNodeResponse,
  URDataEntriesResponse,
  URIExistsResponse,
  URIFromPathResponse,
} from '../types';
import { getTensorizedMatrix } from './plot';

/**
 * Retrieves the API configuration.
 */
const getConfig = async () => {
  try {
    const config = await window.api.getConfig();
    if (!config) throw new Error('Failed to load configuration');
    return config;
  } catch (error) {
    console.error('Error fetching config:', error);
    throw error;
  }
};

/**
 * Handles API errors.
 * You can also report the error to a monitoring service here (e.g., Sentry).
 */
const handleError = (error: unknown, context: string, code?: number) => {
  if (error instanceof Error) {
    if (
      // Occurs when having at least one plot with error bands and adding a plot without upper / lower in tree
      (code === 404 &&
        error.toString().includes('has no attribute') &&
        (error.toString().includes('_error_upper') ||
          error.toString().includes('_error_lower'))) || // Occurs when calling automatically error bands without data
      (code === 464 &&
        error.toString().includes('No data for') &&
        (error.toString().includes('_error_upper') ||
          error.toString().includes('_error_lower')))
    ) {
      // Prevent from showing notification when no error band founded
      throw error;
    }

    // Notify the user in case of an error including an error message if it is not a 500 error.
    showNotification({
      title: !code ? 'Unable to contact the server' : `Error ${code}`,
      message:
        !code || (code >= 400 && code < 500) ? error.message : 'Internal error',
      color: 'red',
    });
  }
  console.error(`Error in ${context}:`, error);
  throw error;
};

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeout = 2000,
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Generic GET request to the API.
 */
const fetchFromApi = async <T>(
  endpoint: string,
  timeout?: number,
): Promise<T> => {
  let responseStatus: number;
  try {
    const config = await getConfig();
    const url = `${config.API_URL}${endpoint}`;

    const fetchFn = async () => {
      if (timeout) {
        return await fetchWithTimeout(
          url,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          },
          timeout,
        );
      } else {
        return await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
      }
    };
    const response = await fetchFn();

    if (!response.ok) {
      if (response?.status) {
        responseStatus = response.status;
      }
      const errorData = await response.json();
      throw new Error(
        errorData.message || errorData.detail || 'Failed to fetch data',
      );
    }

    return response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`Timeout after ${timeout}ms: fetchFromApi(${endpoint}).`);
      throw error;
    } else {
      handleError(error, `fetchFromApi(${endpoint})`, responseStatus);
    }
  }
};

// ---- Specific API calls ----

/**
 * Fetches information about a given node.
 */
export const fetchNodeInfos = async (
  nodeUri: string,
  showErrorBars: boolean,
) => {
  return fetchFromApi<NodeInfoResponse>(
    `/ids_info/node_info?uri=${encodeURIComponent(nodeUri)}&show_error_bars=${showErrorBars}`,
  );
};

/**
 * Finds matching node paths based on a search value.
 */
export const fetchFindPaths = async (
  uri: string,
  value: string,
  showErrorBars: boolean,
) => {
  return fetchFromApi<SearchNodeResponse>(
    `/ids_info/find_paths?uri=${encodeURIComponent(uri)}&searched_node=${encodeURIComponent(value)}&show_error_bars=${showErrorBars}`,
  );
};

/**
 * Retrieves plot data for a given URI.
 */
export const fetchDataPlot = async (
  uri: string,
  downsamplingMethod?: string,
  downsamplingSize?: number,
) => {
  const downsampled_size = downsamplingSize || 1000;
  let response: PlotDataResponse;
  let firstMethod: string;

  if (downsamplingMethod) {
    // Get downsampled data plot
    response = await fetchFromApi<PlotDataResponse>(
      `/data/plot_data?uri=${encodeURIComponent(uri)}&downsampling_method=${encodeURIComponent(downsamplingMethod)}&downsampled_size=${encodeURIComponent(downsampled_size)}`,
    );
  } else {
    try {
      // Try to fetch data without downsampling in according timeout
      response = await fetchFromApi<PlotDataResponse>(
        `/data/plot_data?uri=${encodeURIComponent(uri)}`,
        5000,
      );
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'SyntaxError') {
        // "SyntaxError" can be triggered when too heavy (eof error)
        // Use first downsampling method by default to fetch data
        const methods = await fetchDownsamplingMethods();
        firstMethod =
          methods?.downsampling_methods.find((meth) => meth.name === 'M4')
            ?.name || methods?.downsampling_methods.slice(0)[1].name;
        response = await fetchFromApi<PlotDataResponse>(
          `/data/plot_data?uri=${encodeURIComponent(uri)}&downsampling_method=${encodeURIComponent(firstMethod)}&downsampled_size=${encodeURIComponent(downsampled_size)}`,
        );
      }
    }
  }

  // Rule to rename data when "value" or "data":
  if (response.data.name == 'data' || response.data.name == 'value') {
    const targetStringList = response.data.path.split('/');
    response.data.name =
      targetStringList.length >= 2
        ? `${targetStringList.at(-2)}`
        : response.data.name;
  }

  // Force all targets to ends with '[:]'
  for (const coord of response.data.coordinates) {
    if (!coord.target.endsWith(']')) {
      coord.target = coord.target += '[:]';
    }
  }
  if (firstMethod || downsamplingMethod) {
    response.data.downsampled_method = firstMethod || downsamplingMethod;
  }

  if (response.data.shape === 'irregular' && response.data.ndim === 1) {
    // Alert when getting irregular shape in 1D cases
    showNotification({
      title: 'Warning',
      message: 'Data are incomplete.',
      color: 'yellow',
    });

    for (const coord of response.data.coordinates) {
      // Fill incomplete coordinates with NaN to be a matrix format
      const tensorizedCoordinate = await getTensorizedMatrix(coord.value);
      coord.value = (await tensorizedCoordinate.array()) as AxisData;
      coord.shape = tensorizedCoordinate.shape;
      coord.downsampled_shape = tensorizedCoordinate.shape;
    }
    // Fill incomplete data with NaN to be a matrix format
    const dataTensorized = await getTensorizedMatrix(response.data.value);
    response.data.value = (await dataTensorized.array()) as AxisData;
    response.data.shape = dataTensorized.shape;
    response.data.downsampled_shape = dataTensorized.shape;
  }
  return response;
};

/**
 * Retrieves downsampling methods.
 */
export const fetchDownsamplingMethods = async () => {
  return fetchFromApi<DownsamplingMethodsResponse>(
    `/info/downsampling_methods`,
  );
};

/**
 * Retrieves field values for a given URI.
 */
export const fetchFieldValue = async (
  uri: string,
  downsamplingMethod?: string,
  downsamplingSize?: number,
) => {
  const downsampled_size = downsamplingSize || 1000;
  let response: FieldValueResponse;
  if (downsamplingMethod) {
    // TODO : this is a temporary solution to get downsampled value without using field_value route. We should use this route as soon as downsampling will be fixed
    const dataPlotResponse = await fetchFromApi<PlotDataResponse>(
      `/data/plot_data?uri=${encodeURIComponent(uri)}&downsampling_method=${encodeURIComponent(downsamplingMethod)}&downsampled_size=${encodeURIComponent(downsampled_size)}`,
    );

    response = { value: dataPlotResponse.data.value } as FieldValueResponse;
  } else {
    response = await fetchFromApi<FieldValueResponse>(
      `/data/field_value?uri=${encodeURIComponent(uri)}`,
    );
  }
  return response;
};

/**
 * Lists all available IDS IDs for a given URI.
 */
export const fetchDataIds = async (uri: string) => {
  return fetchFromApi<DataIdsResponse>(
    `/data_entry/list_idses?uri=${encodeURIComponent(uri)}`,
  );
};

/**
 * Checks whether a specific URI exists.
 */
export const fetchURIFromPath = async (path: string) => {
  return fetchFromApi<URIFromPathResponse>(
    `/data_entry/uri_from_path?path=${encodeURIComponent(path)}`,
  );
};

/**
 * Checks whether a specific URI exists.
 */
export const fetchURIExists = async (uri: string) => {
  return fetchFromApi<URIExistsResponse>(
    `/data_entry/exists?uri=${encodeURIComponent(uri)}`,
  );
};

/**
 * Retrieves available entries for a user/database configuration.
 */
export const fetchDataEntries = async (
  dataEntriesParameters: FormDbEntries,
) => {
  return fetchFromApi<URDataEntriesResponse>(
    `/data_entry/available_entries?user=${dataEntriesParameters.user}&backend=${dataEntriesParameters.backend}&database=${dataEntriesParameters.database}&version=${dataEntriesParameters.version}`,
  );
};

/**
 * Retrieves plot data for a given URI.
 */
export const fetchArraySummary = async (uri: string) => {
  return fetchFromApi<ArraySummaryResponse>(
    `/ids_info/array_summary?uri=${encodeURIComponent(uri)}`,
  );
};

/**
 * Return backend version.
 */
export const fetchInfoVersion = async () => {
  return fetchFromApi<InfoVersionResponse>(`/info/version`);
};
