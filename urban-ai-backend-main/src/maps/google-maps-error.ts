export function summarizeGoogleMapsError(err: any): string {
  const response = err?.response;
  const statusCode = response?.status;
  const data = response?.data;
  const googleStatus = typeof data?.status === 'string' ? data.status : undefined;
  const googleMessage =
    typeof data?.error_message === 'string'
      ? data.error_message
      : typeof data?.error?.message === 'string'
        ? data.error.message
        : undefined;
  const axiosMessage = typeof err?.message === 'string' ? err.message : undefined;

  const statusSuffix = [
    typeof statusCode === 'number' ? `HTTP ${statusCode}` : undefined,
    googleStatus,
  ]
    .filter(Boolean)
    .join(', ');

  const base = statusSuffix
    ? `Google Geocoding API request failed (${statusSuffix})`
    : 'Google Geocoding API request failed';

  const guidance = buildGoogleMapsGuidance(statusCode, googleStatus);
  return [base, googleMessage ?? axiosMessage, guidance].filter(Boolean).join(' - ');
}

export function isGoogleMapsConfigurationError(messageOrError: any): boolean {
  if (typeof messageOrError === 'string') {
    return (
      messageOrError.includes('HTTP 403') ||
      messageOrError.includes('REQUEST_DENIED') ||
      messageOrError.includes('GOOGLE_MAPS_API_KEY') ||
      messageOrError.includes('Geocoding API enablement')
    );
  }

  const response = messageOrError?.response;
  return response?.status === 403 || response?.data?.status === 'REQUEST_DENIED';
}

function buildGoogleMapsGuidance(statusCode?: number, googleStatus?: string): string | undefined {
  if (statusCode === 403 || googleStatus === 'REQUEST_DENIED') {
    return 'check GOOGLE_MAPS_API_KEY server restrictions, Geocoding API enablement and Google Cloud billing';
  }

  if (statusCode === 429 || googleStatus === 'OVER_QUERY_LIMIT') {
    return 'check Google Maps quota and rate limits';
  }

  if (statusCode && statusCode >= 500) {
    return 'retry later or check Google Maps service status';
  }

  return undefined;
}
