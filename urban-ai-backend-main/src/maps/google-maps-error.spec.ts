import { summarizeGoogleMapsError } from './google-maps-error';

describe('summarizeGoogleMapsError', () => {
  it('turns Google 403 responses into an actionable configuration message', () => {
    const message = summarizeGoogleMapsError({
      message: 'Request failed with status code 403',
      response: {
        status: 403,
        data: {
          status: 'REQUEST_DENIED',
          error_message: 'This API project is not authorized to use this API.',
        },
      },
    });

    expect(message).toContain('HTTP 403');
    expect(message).toContain('REQUEST_DENIED');
    expect(message).toContain('not authorized');
    expect(message).toContain('GOOGLE_MAPS_API_KEY');
    expect(message).toContain('Geocoding API');
    expect(message).not.toContain('undefined');
  });

  it('keeps generic request failures readable', () => {
    expect(summarizeGoogleMapsError({ message: 'network timeout' })).toBe(
      'Google Geocoding API request failed - network timeout',
    );
  });
});
