import axios from 'axios';
import { GeocodingClient } from './geocoding-client';
import { isGoogleMapsConfigurationError, summarizeGoogleMapsError } from './google-maps-error';

describe('GeocodingClient', () => {
  const client = new GeocodingClient();
  const params = { address: 'Praça da Sé, São Paulo & Brasil', key: 'test-key-private' };
  afterEach(() => jest.restoreAllMocks());

  it('returns coordinates with a bounded HTTPS request and without request credentials', async () => {
    const results = [{ geometry: { location: { lat: -23.55, lng: -46.63 } } }];
    const get = jest.spyOn(axios, 'get').mockResolvedValue({
      status: 200, data: { status: 'OK', results }, config: { params },
    });
    expect(await client.geocode({ params })).toEqual({ data: { status: 'OK', results } });
    expect(get).toHaveBeenCalledWith('https://maps.googleapis.com/maps/api/geocode/json', {
      params, timeout: 15000, maxRedirects: 0, maxContentLength: 2000000,
    });
  });

  it('accepts legitimate zero results', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: { status: 'ZERO_RESULTS', results: [] } });
    expect((await client.geocode({ params })).data.results).toEqual([]);
  });

  it.each([
    null,
    { status: 'OK', results: [] },
    { status: 'OK', results: [{}] },
    { status: 'OK', results: [{ geometry: { location: { lat: 91, lng: 0 } } }] },
    { status: 'OK', results: [{ geometry: { location: { lat: '1', lng: 0 } } }] },
    { status: 'ZERO_RESULTS', results: [{}] },
  ])('rejects malformed provider data %#', async (data) => {
    jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data });
    await expect(client.geocode({ params })).rejects.toMatchObject({ response: { data: { status: 'INVALID_RESPONSE' } } });
  });

  it('retains actionable configuration status but removes provider messages and secrets', async () => {
    jest.spyOn(axios, 'get').mockResolvedValue({ status: 200, data: {
      status: 'REQUEST_DENIED', error_message: params.key,
    } });
    const error = await client.geocode({ params }).catch((error: unknown) => error);
    expect(isGoogleMapsConfigurationError(error)).toBe(true);
    expect(summarizeGoogleMapsError(error)).toContain('REQUEST_DENIED');
    expect(JSON.stringify(error)).not.toContain(params.key);
  });

  it('removes credentials and causes from transport errors while preserving HTTP status', async () => {
    jest.spyOn(axios, 'get').mockRejectedValue({ isAxiosError: true, message: params.key,
      config: { params }, response: { status: 403, data: { error_message: params.key } },
    });
    const error = await client.geocode({ params }).catch((error: unknown) => error);
    expect(isGoogleMapsConfigurationError(error)).toBe(true);
    expect(summarizeGoogleMapsError(error)).toContain('HTTP 403');
    expect(JSON.stringify(error)).not.toContain(params.key);
    expect(error).not.toHaveProperty('cause');
  });

  it('rejects missing credentials before making a request', async () => {
    const get = jest.spyOn(axios, 'get');
    await expect(client.geocode({ params: { ...params, key: '' } })).rejects.toThrow('GOOGLE_MAPS_API_KEY');
    expect(get).not.toHaveBeenCalled();
  });
});
