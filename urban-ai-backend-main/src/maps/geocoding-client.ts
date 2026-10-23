import axios from 'axios';

type GeocodingResult = { geometry: { location: { lat: number; lng: number } } };

class GeocodingError extends Error {
  constructor(readonly response: { status?: number; data: { status: string } }) {
    super('Google Geocoding API request failed');
    this.name = 'GeocodingError';
  }
}

/** Only the address lookup used by Urban; no response retains the API key. */
export class GeocodingClient {
  async geocode({ params }: { params: { address: string; key: string | undefined } }) {
    if (!params.key?.trim() || !params.address.trim()) {
      throw new Error('Google geocoding requires an address and GOOGLE_MAPS_API_KEY');
    }
    let response;
    try {
      response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
        params, timeout: 15_000, maxRedirects: 0, maxContentLength: 2_000_000,
      });
    } catch (error: unknown) {
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      // Do not attach the Axios cause: it contains the API key.
      throw new GeocodingError({ status, data: { status: 'TRANSPORT_ERROR' } });
    }
    const data = response.data;
    if (!data || !['OK', 'ZERO_RESULTS'].includes(data.status)) {
      const known = ['REQUEST_DENIED', 'OVER_DAILY_LIMIT', 'OVER_QUERY_LIMIT', 'INVALID_REQUEST', 'UNKNOWN_ERROR'];
      throw new GeocodingError({
        status: response.status,
        data: { status: known.includes(data?.status) ? data.status : 'INVALID_RESPONSE' },
      });
    }
    if (!Array.isArray(data.results) ||
      (data.status === 'OK' && data.results.length === 0) ||
      (data.status === 'ZERO_RESULTS' && data.results.length !== 0) ||
      data.results.some((result: GeocodingResult) => {
        const point = result?.geometry?.location;
        return !point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
          Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180;
      })) {
      throw new GeocodingError({ status: response.status, data: { status: 'INVALID_RESPONSE' } });
    }
    return { data: { status: data.status as string, results: data.results as GeocodingResult[] } };
  }
}
