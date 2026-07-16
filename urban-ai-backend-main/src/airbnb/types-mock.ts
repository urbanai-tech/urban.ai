type AirbnbPriceData = {
  data: {
    accommodationCost: number;
  };
};

type AirbnbPropertyDetails = {
  bedrooms: number;
  bathrooms: number;
};

export type AirbnbResponse = {
  price: AirbnbPriceData;
  propertyDetails: AirbnbPropertyDetails;
};

export type MaxObj = {
  bedrooms: number;
  bathrooms: number;
};
