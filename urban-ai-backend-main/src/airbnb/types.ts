export interface AirbnbPriceDetails {
  type: string;
  localizedTitle: string;
  amount: number;
  amountFormatted: string;
}

export interface AirbnbPriceData {
  accommodationCost: number;
  accommodationCostFormatted: string;
  accommodationCostTitle: string;
  details: AirbnbPriceDetails[];
}

export interface AirbnbPriceResponse {
  status: boolean;
  message: string;
  timestamp: number;
  data: AirbnbPriceData;
}

export interface PropertyDetails {
  bedrooms: number;
  beds: number;
  guestMaximum: number;
}

export interface FirstAvailablePriceResult {
  price: AirbnbPriceResponse;
  propertyDetails: PropertyDetails;
}
