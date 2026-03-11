type AirbnbPriceData = {
  data: {
    accommodationCost: number;
  };
};

type AirbnbPropertyDetails = {
  bedrooms: number;
  bathrooms: number;
};

type AirbnbResponse = {
  price: AirbnbPriceData;
  propertyDetails: AirbnbPropertyDetails;
};

type MaxObj = {
  bedrooms: number;
  bathrooms: number;
};
