jest.mock('p-limit', () => () => (fn: () => unknown) => fn());
jest.mock('@sentry/nestjs', () => ({ captureMessage: jest.fn() }));
jest.mock('../knn-engine/pricing-engine', () => ({ UrbanAIPricingEngine: class UrbanAIPricingEngine {} }));

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { AirbnbService } from '../airbnb/airbnb.service';
import { PropriedadeService } from './propriedade.service';
import { PropertyEventAnalysesService } from './property-event-analyses.service';
import { PropertyListingQuoteService } from './property-listing-quote.service';
import { PropertyPortfolioService } from './property-portfolio.service';
import { PropertyPricingAnalysisService } from './property-pricing-analysis.service';
import { PropertyScrapingService } from './property-scraping.service';

/**
 * Garante que a divisão do antigo PropriedadeService não criou ciclo de DI
 * novo: o único ciclo continua sendo AirbnbService <-> propriedades, resolvido
 * pelos forwardRef que já existiam.
 */
describe('PropriedadeModule DI graph', () => {
  it('resolve a fachada e os serviços extraídos junto com o AirbnbService', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AirbnbService,
        PropriedadeService,
        PropertyPortfolioService,
        PropertyScrapingService,
        PropertyListingQuoteService,
        PropertyPricingAnalysisService,
        PropertyEventAnalysesService,
      ],
    })
      .useMocker((token) => (token === ConfigService ? { get: () => 'test-key' } : {}))
      .compile();

    const facade = moduleRef.get(PropriedadeService);
    const airbnb = moduleRef.get(AirbnbService);
    expect(facade).toBeInstanceOf(PropriedadeService);
    expect((airbnb as any).propriedadeService).toBe(facade);
    expect((moduleRef.get(PropertyScrapingService) as any).airbnbService).toBe(airbnb);
    expect((moduleRef.get(PropertyListingQuoteService) as any).airbnbService).toBe(airbnb);
    expect((moduleRef.get(PropertyPricingAnalysisService) as any).airbnbService).toBe(airbnb);
  });
});
