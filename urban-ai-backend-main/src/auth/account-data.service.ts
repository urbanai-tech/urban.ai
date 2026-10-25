import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { List } from '../entities/list.entity';
import { Address } from '../entities/addresses.entity';
import { AnalisePreco } from '../entities/AnalisePreco';
import { Payment } from '../entities/payment.entity';
import { StaysAccount } from '../entities/stays-account.entity';
import { UserCommunicationPreferences } from '../entities/user-communication-preferences.entity';

export const ACCOUNT_EXPORT_FORMAT = 'urban-ai-data-export/v1';
/** Teto de análises exportadas (as mais recentes); acima disso `truncated` = true. */
export const ACCOUNT_EXPORT_ANALYSES_LIMIT = 5000;

function pick(source: any, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!source) return out;
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

const idOf = (value: any): string | null =>
  value == null ? null : typeof value === 'object' ? (value.id ?? null) : String(value);

/**
 * Exportação de dados pessoais do titular (LGPD art. 18, II e V — acesso e
 * portabilidade). Monta SOMENTE dados do próprio usuário e nunca inclui hash de
 * senha, tokens (refresh/Stays/Stripe), dados de cartão ou IDs internos do Stripe.
 */
@Injectable()
export class AccountDataService {
  constructor(
    @InjectRepository(User) private readonly userRepository: Repository<User>,
    @InjectRepository(List) private readonly listRepository: Repository<List>,
    @InjectRepository(Address) private readonly addressRepository: Repository<Address>,
    @InjectRepository(AnalisePreco) private readonly analiseRepository: Repository<AnalisePreco>,
    @InjectRepository(Payment) private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(StaysAccount) private readonly staysAccountRepository: Repository<StaysAccount>,
    @InjectRepository(UserCommunicationPreferences)
    private readonly preferencesRepository: Repository<UserCommunicationPreferences>,
  ) {}

  async exportUserData(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User with ID ${userId} not found`);

    const [lists, addresses, analyses, payments, staysAccount, preferences] = await Promise.all([
      this.listRepository.find({ where: { user: { id: userId } } }),
      this.addressRepository.find({ where: { user: { id: userId } } }),
      this.analiseRepository.find({
        where: { usuarioProprietario: { id: userId } },
        order: { criadoEm: 'DESC' },
        take: ACCOUNT_EXPORT_ANALYSES_LIMIT + 1,
        loadRelationIds: true,
      }),
      this.paymentRepository.find({ where: { user: { id: userId } } }),
      this.staysAccountRepository.findOne({ where: { user: { id: userId } } }),
      this.preferencesRepository.findOne({ where: { userId } }),
    ]);

    const truncated = analyses.length > ACCOUNT_EXPORT_ANALYSES_LIMIT;
    const analysesOut = analyses.slice(0, ACCOUNT_EXPORT_ANALYSES_LIMIT);

    return {
      format: ACCOUNT_EXPORT_FORMAT,
      generatedAt: new Date().toISOString(),
      user: pick(user, [
        'id', 'username', 'email', 'role', 'ativo', 'createdAt', 'distanceKm', 'airbnbHostId',
        'pricingStrategy', 'operationMode', 'percentualInicial', 'percentualFinal',
        'emailVerifiedAt',
      ]),
      consents: {
        terms: {
          acceptedAt: user.termsAcceptedAt ?? null,
          version: user.termsVersion ?? null,
        },
        stays: staysAccount
          ? {
              acceptedAt: staysAccount.consentAcceptedAt ?? null,
              version: staysAccount.consentVersion ?? null,
            }
          : null,
        marketingCommunications: preferences ? Boolean(preferences.marketing) : null,
      },
      communicationPreferences: preferences
        ? pick(preferences, [
            'emailPricing', 'pushPricing', 'weeklyReport', 'onboardingEmails', 'marketing', 'staysAlerts',
            'billingAlerts', 'createdAt', 'updatedAt',
          ])
        : null,
      properties: lists.map((item) =>
        pick(item, [
          'id', 'titulo', 'id_do_anuncio', 'internalNickname', 'internalCode', 'ativo',
          'priceText', 'raw', 'currency', 'checkIn', 'checkOut', 'status', 'dailyPrice',
        ]),
      ),
      addresses: addresses.map((item) => ({
        ...pick(item, [
          'id', 'cep', 'numero', 'logradouro', 'bairro', 'cidade', 'estado', 'latitude',
          'longitude', 'ativo', 'created_at', 'updated_at',
        ]),
        propertyId: idOf((item as any).list),
      })),
      analyses: {
        truncated,
        limit: ACCOUNT_EXPORT_ANALYSES_LIMIT,
        items: analysesOut.map((item) => ({
          ...pick(item, [
            'id', 'distanciaSuaPropriedade', 'precoSugerido', 'seuPrecoAtual',
            'diferencaPercentual', 'recomendacao', 'aceito', 'status', 'aceitoEm',
            'rejeitadoEm', 'expiradoEm', 'precoAplicado', 'aplicadoEm', 'origemAplicacao',
            'motivo_ia', 'criadoEm',
          ]),
          addressId: idOf((item as any).endereco),
          eventId: idOf((item as any).evento),
        })),
      },
      // Metadados de cobrança: sem dados de cartão e sem IDs internos do Stripe.
      payments: payments.map((item) =>
        pick(item, [
          'status', 'planName', 'billingCycle', 'listingsContratados', 'mode', 'startDate',
          'expireDate', 'trialUsedAt', 'createdAt', 'updatedAt',
        ]),
      ),
      // Metadados da integração Stays: nunca o token de acesso.
      staysAccount: staysAccount
        ? pick(staysAccount, [
            'clientId', 'status', 'tokenExpiresAt', 'lastSyncAt', 'maxIncreasePercent',
            'maxDecreasePercent', 'createdAt', 'updatedAt',
          ])
        : null,
    };
  }
}
