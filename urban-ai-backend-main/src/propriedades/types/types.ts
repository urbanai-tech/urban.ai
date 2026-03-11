// Tipo principal para o retorno
export interface AirbnbQuoteResponse {
  status: boolean;
  message: string;
  timestamp: number;
  data: Data;
}

export interface Data {
  priceBreakdown: PriceBreakdown;
  metadata: Metadata;
  sections: Sections;
  temporaryQuickPayData: TemporaryQuickPayData;
}

export interface PriceBreakdown {
  priceItems: PriceItem[];
  subtotalItems: any[]; // Pode detalhar se necessário
  total: TotalPriceItem;
  warningMessage: string | null;
  pricingDiscountDataForTotal: PricingDiscountData;
}

export interface PriceItem {
  localizedExplanation: string | null;
  localizedSubtitle: string | null;
  localizedTitle: string;
  nestedPriceItems: PriceItem[];
  total: Amount;
  type: string;
  explanationData: any | null;
}

export interface TotalPriceItem {
  localizedExplanation: string;
  localizedSubtitle: string | null;
  localizedTitle: string;
  nestedPriceItems: any[] | null;
  total: Amount;
  type: string;
  explanationData: any | null;
}

export interface Amount {
  amountFormatted: string;
  amountMicros: string;
  currency: string;
}

export interface PricingDiscountData {
  barDisplayPriceAmountWithoutDiscount: any | null;
  barDisplayPriceWithoutDiscountDisclaimer: any | null;
}

export interface Metadata {
  bookingAttemptId: string | null;
  confirmationCode: string | null;
  membershipLevel: string | null;
  navTitle: string;
  tierId: string;
  splitStayIndex: any | null;
  clientLoggingContext: ClientLoggingContext;
  errorData: any | null;
  orderId: string | null;
  bookingQuoteId: string | null;
}

export interface ClientLoggingContext {
  checkoutFlowType: number;
  clientActionId: any | null;
  errorCode: any | null;
  errorMessage: any | null;
  guestId: any | null;
  hostId: any | null;
  productId: string;
  experiment: any | null;
  treatment: any | null;
  staysData: StaysData;
  guestCheckoutSteps: string[];
}

export interface StaysData {
  inventoryType: number;
  numAdults: number;
  numChildren: number;
  numInfants: number;
  numPets: number;
  checkinDate: string;
  checkoutDate: string;
  isEligibleForWorkTrip: any | null;
  isWorkTrip: boolean;
  checkoutRequestType: number;
  airbnbOrgData: any | null;
  checkoutProductVersion: string;
}

export interface Sections {
  titleRate: object;
  guestPicker: object;
  bannerUncMessage: object;
  titleTripSummary: object;
  loginPhoneAuth: object;
  tieredPricing: object;
  datePicker: object;
  listingCard: object;
}

export interface TemporaryQuickPayData {
  billInfo: BillInfo;
  bootstrapPayments: BootstrapPayments;
}

export interface BillInfo {
  reservationId: string | null;
  billItemProductId: string | null;
  billItemProductType: string;
  isBusinessTravel: boolean;
  productInfos: ProductInfo[];
}

export interface ProductInfo {
  billItemProductId: string | null;
  billItemProductType: string;
}

export interface BootstrapPayments {
  airbnbCredit: any | null;
  billData: BillData;
  brazilianInstallments: any | null;
  checkoutTokens: CheckoutTokens;
  chinaPoints: any | null;
  couponList: any | null;
  fxMessage: FxMessage;
  paymentOptions: PaymentOptions;
  paymentPlanSchedule: PaymentPlanSchedule;
  paymentPlans: PaymentPlans;
  pricingDisclaimer: any | null;
  productPriceBreakdown: ProductPriceBreakdown;
  quickPayConfiguration: QuickPayConfiguration;
  regionalCheckoutData: RegionalCheckoutData;
  tendersPriceBreakdown: any | null;
  travelCouponCredit: any | null;
  visiblePaymentModuleTypes: string[];
}

export interface BillData {
  billingDataRolloutStage: string;
  billQuoteToken: string;
  billToken: any | null;
  productPriceQuoteToken: string;
  tenderPriceQuoteTokens: string[];
  paymentQuoteId: any | null;
}

export interface CheckoutTokens {
  paymentCheckoutId: string;
  stepstonesToken: any | null;
}

export interface FxMessage {
  message: any | null;
}

export interface PaymentOptions {
  isInlineDisplay: boolean;
  isPayByBank: boolean;
  paymentOptions: PaymentOption[];
  selectedPaymentOption: any | null;
  visiblePaymentOptions: PaymentOption[];
}

export interface PaymentOption {
  displayName: string;
  gibraltarInstrumentType: string;
  isValidForCurrency: boolean;
  isCvvRequiredForPayment: boolean;
  isDefault: boolean;
  isExistingInstrument: boolean;
  isNewlyVaulted: boolean | null;
  localizedSubtitle: string | null;
  name: string | null;
  adyenNetBankingDetails: any | null;
  bankAccountDetail: any | null;
  fpxDetails: any | null;
  businessEntityGroupId: any | null;
  creditCardDetails: any | null;
  idealDetails: any | null;
  netBankingDetails: any | null;
  paymentOptionInputInfo: any | null;
  savingsDetail: any | null;
  klarnaDetail: any | null;
  errorDetail: any | null;
}

export interface PaymentPlanSchedule {
  billQuoteToken: string;
  priceSchedule: PriceSchedule;
}

export interface PriceSchedule {
  priceItems: PriceItem[];
  totalPriceItem: any | null;
  footerText: any | null;
}

export interface PaymentPlans {
  paymentPlanOptions: PaymentPlanOption[];
  selectedPaymentPlanOption: any | null;
}

export interface PaymentPlanOption {
  localizedAmount: string;
  displayString: string;
  paymentPlanType: string;
  paymentPlanSubtype: string;
  title: string;
  subtitle: string | null;
  amountSubtitle: string | null;
  depositInfo: any | null;
  learnMoreLink: any | null;
  paymentsDepositUpsellData: any | null;
  klarnaOption: any | null;
  savingsDetail: any | null;
}

export interface ProductPriceBreakdown {
  priceBreakdown: PriceBreakdown;
  productPriceQuoteToken: string;
}

export interface QuickPayConfiguration {
  creditCardFieldCredentials: any | null;
}

export interface RegionalCheckoutData {
  shouldShowBrazilianLongForm: boolean;
}
