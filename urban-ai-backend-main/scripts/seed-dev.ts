/**
 * Seed de DESENVOLVIMENTO LOCAL — `npm run seed:dev`.
 *
 * Cria (ou atualiza) o minimo para um time novo logar e ver o app populado:
 *   - 1 anfitriao e 1 admin, com credenciais LOCAIS conhecidas (ver CONTRIBUTING.md);
 *   - assinatura ativa do anfitriao (sem ela o guard de assinatura devolve 402);
 *   - 1 imovel em Sao Paulo (diaria base, minima e de fim de semana, endereco com coordenadas);
 *   - 5 eventos futuros ao redor, a partir de hoje (as datas sao renovadas a cada execucao);
 *   - 3 sugestoes de preco (2 pendentes, 1 aceita) e avisos (notificacoes) do anfitriao.
 *
 * Seguranca: recusa rodar fora de ambiente local (ver src/common/dev-seed-guard.ts):
 * APP_ENV/NODE_ENV development|dev|local E banco em localhost/mysql. Nunca roda
 * em producao ou staging, nem com DATABASE_URL remoto.
 *
 * Idempotente: pode rodar quantas vezes quiser; cada registro tem chave natural
 * (e-mail, id_do_anuncio `seed-dev-*`, dedupHash de `seed-dev-event-*`).
 *
 * Senha: igual ao fluxo real. O front envia SHA-256 hex da senha; o servidor
 * guarda bcrypt(12) desse hex (AuthService.register -> bcryptHash). O seed ja
 * parte desse SHA-256 (constante abaixo), entao nao calcula hash de senha. O
 * login por curl usa o SHA-256 da senha (ver CONTRIBUTING.md).
 *
 * Uso:
 *   docker compose exec backend npm run seed:dev     # com o Compose no ar
 *   npm run seed:dev                                  # no host, com APP_ENV=development e DB local
 */

import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AppDataSource } from '../src/data-source';
import { evaluateDevSeedGuard } from '../src/common/dev-seed-guard';
import { TERMS_VERSION } from '../src/auth/terms.constants';
import { User } from '../src/entities/user.entity';
import { List } from '../src/entities/list.entity';
import { Address } from '../src/entities/addresses.entity';
import { Event } from '../src/entities/events.entity';
import { AnalisePreco } from '../src/entities/AnalisePreco';
import { AnaliseEnderecoEvento } from '../src/entities/AnaliseEnderecoEvento.entity';
import { Notification } from '../src/entities/notification.entity';
import { Payment } from '../src/entities/payment.entity';

const BCRYPT_ROUNDS = 12; // mesmo custo do AuthService
const DAY_MS = 24 * 60 * 60 * 1000;

// Valores ficticios, so para uso local (senha documentada: UrbanLocal#2026).
const HOST_EMAIL = 'host@urban.local';
const ADMIN_EMAIL = 'admin@urban.local';
// SHA-256 hex de 'UrbanLocal#2026', que e o que o front envia no login.
const DEV_LOGIN_PREHASH = 'df646be6e34c6a07edeae42a9f48a82ac01fa24f52a9e0b8e219c6f0cbbfaa38';

const LISTING_KEY = 'seed-dev-0001';
const BASE_NIGHTLY = 320;
const PROPERTY = { lat: -23.5667, lng: -46.6917 }; // Pinheiros, Sao Paulo

interface SeedEvent {
  key: string;
  nome: string;
  daysFromNow: number;
  hour: number;
  durationH: number;
  lat: number;
  lng: number;
  endereco: string;
  categoria: string;
  relevancia: number;
  raioKm: number;
  capacidade: number;
  venueType: string;
}

const EVENTS: SeedEvent[] = [
  { key: 'seed-dev-event-1', nome: 'Show de exemplo - Allianz Parque', daysFromNow: 6, hour: 21, durationH: 4,
    lat: -23.5275, lng: -46.6784, endereco: 'Av. Francisco Matarazzo, 1705 - Agua Branca, Sao Paulo - SP',
    categoria: 'Show', relevancia: 92, raioKm: 4.5, capacidade: 43000, venueType: 'stadium' },
  { key: 'seed-dev-event-2', nome: 'Jogo de exemplo - Estadio do Morumbi', daysFromNow: 12, hour: 16, durationH: 3,
    lat: -23.6001, lng: -46.7200, endereco: 'Praca Roberto Gomes Pedrosa, 1 - Morumbi, Sao Paulo - SP',
    categoria: 'Esporte', relevancia: 85, raioKm: 4, capacidade: 66000, venueType: 'stadium' },
  { key: 'seed-dev-event-3', nome: 'Festival de exemplo - Parque Ibirapuera', daysFromNow: 20, hour: 12, durationH: 9,
    lat: -23.5874, lng: -46.6576, endereco: 'Av. Pedro Alvares Cabral - Vila Mariana, Sao Paulo - SP',
    categoria: 'Festival', relevancia: 78, raioKm: 3, capacidade: 25000, venueType: 'outdoor' },
  { key: 'seed-dev-event-4', nome: 'Feira de exemplo - Sao Paulo Expo', daysFromNow: 33, hour: 9, durationH: 9,
    lat: -23.6256, lng: -46.6406, endereco: 'Rod. dos Imigrantes, km 1,5 - Vila Agua Funda, Sao Paulo - SP',
    categoria: 'Feira', relevancia: 70, raioKm: 5, capacidade: 30000, venueType: 'convention_center' },
  { key: 'seed-dev-event-5', nome: 'Peca de exemplo - Teatro na Paulista', daysFromNow: 3, hour: 20, durationH: 2,
    lat: -23.5629, lng: -46.6544, endereco: 'Av. Paulista, 900 - Bela Vista, Sao Paulo - SP',
    categoria: 'Teatro', relevancia: 45, raioKm: 1.5, capacidade: 800, venueType: 'theater' },
];

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Distancia em linha reta (haversine), em metros. */
function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}

async function main(): Promise<void> {
  const guard = evaluateDevSeedGuard(process.env);
  if (!guard.allowed) {
    console.error('[seed:dev] RECUSADO: este seed so roda em ambiente local de desenvolvimento.');
    guard.reasons.forEach((reason) => console.error(`  - ${reason}`));
    process.exitCode = 1;
    return;
  }

  await AppDataSource.initialize();
  const now = new Date();
  try {
    await AppDataSource.transaction(async (em) => {
      const users = em.getRepository(User);

      // ---------------------------------------------------------- usuarios
      async function upsertUser(email: string, username: string, role: 'host' | 'admin', extra: Partial<User>) {
        const existing = await users.findOne({ where: { email }, select: ['id', 'email', 'password'] });
        const passwordHash = await bcrypt.hash(DEV_LOGIN_PREHASH, BCRYPT_ROUNDS);
        if (existing) {
          await users.update(existing.id, {
            username, role, ativo: true, password: passwordHash,
            emailVerifiedAt: now, termsAcceptedAt: now, termsVersion: TERMS_VERSION, ...extra,
          });
          return (await users.findOneByOrFail({ id: existing.id }));
        }
        return users.save(users.create({
          username, email, password: passwordHash, role, ativo: true, distanceKm: 30,
          emailVerifiedAt: now, termsAcceptedAt: now, termsVersion: TERMS_VERSION, ...extra,
        }));
      }

      const host = await upsertUser(HOST_EMAIL, 'Anfitriao Local', 'host', {
        pricingStrategy: 'balanced', operationMode: 'notifications', phone: '+5511999990000', company: 'Urban AI (dev)',
      });
      const admin = await upsertUser(ADMIN_EMAIL, 'Admin Local', 'admin', {});

      // -------------------------------------------------------- assinatura
      const payments = em.getRepository(Payment);
      const paymentFields: Partial<Payment> = {
        status: 'active', mode: 'month', billingCycle: 'monthly', planName: 'profissional',
        listingsContratados: 3, startDate: now, expireDate: new Date(now.getTime() + 365 * DAY_MS),
        customerId: 'cus_local_dummy', subscriptionId: 'sub_local_dummy',
      };
      const payment = await payments.findOne({ where: { user: { id: host.id } } });
      if (payment) await payments.update(payment.id, paymentFields);
      else await payments.save(payments.create({ ...paymentFields, user: host }));

      // ------------------------------------------------------------ imovel
      const lists = em.getRepository(List);
      const listFields: Partial<List> = {
        titulo: 'Apartamento de exemplo em Pinheiros', internalNickname: 'Pinheiros 1Q', internalCode: 'PIN-01',
        ativo: true, user: host, priceText: `R$${BASE_NIGHTLY}`, raw: BASE_NIGHTLY, currency: 'R$',
        dailyPrice: BASE_NIGHTLY, manualDailyPrice: BASE_NIGHTLY, minDailyPrice: 250, weekendDailyPrice: 420,
        averageMonthlyRevenue: 7800, pricingInputSource: 'manual', pricingInputsUpdatedAt: now,
        hostInputUpdatedAt: now, essentialsSource: 'host_input', essentialsUpdatedAt: now, status: 'disponivel',
        hospedes: 4, quartos: 1, camas: 2, banheiros: 1, propertyType: 'Apartment', amenitiesCount: 24,
        category: 'Standard', neighborhood: 'Pinheiros', rating: 4.8, reviewCount: 42,
      };
      let list = await lists.findOne({ where: { id_do_anuncio: LISTING_KEY } });
      if (list) {
        await lists.update(list.id, listFields as never);
        list = await lists.findOneByOrFail({ id: list.id });
      } else {
        list = await lists.save(lists.create({ ...listFields, id_do_anuncio: LISTING_KEY }));
      }

      const addresses = em.getRepository(Address);
      const addrFields: Partial<Address> = {
        cep: '05422-001', numero: '100', logradouro: 'Rua dos Pinheiros', bairro: 'Pinheiros',
        cidade: 'Sao Paulo', estado: 'SP', latitude: PROPERTY.lat, longitude: PROPERTY.lng,
        metroDistance: 0.6, ativo: true, user: host, list, analisado: 'done',
      };
      let address = await addresses.findOne({ where: { list: { id: list.id } } });
      if (address) {
        await addresses.update(address.id, addrFields as never);
        address = await addresses.findOneByOrFail({ id: address.id });
      } else {
        address = await addresses.save(addresses.create(addrFields));
      }

      // ----------------------------------------------------------- eventos
      const events = em.getRepository(Event);
      const saved: Event[] = [];
      for (const spec of EVENTS) {
        const dedupHash = sha256(spec.key);
        const start = new Date(now.getTime() + spec.daysFromNow * DAY_MS);
        start.setHours(spec.hour, 0, 0, 0);
        const end = new Date(start.getTime() + spec.durationH * 3600 * 1000);
        const fields: Partial<Event> = {
          nome: spec.nome, descricao: 'Evento ficticio criado pelo seed de desenvolvimento local.',
          dataInicio: start, dataFim: end, enderecoCompleto: spec.endereco, cidade: 'Sao Paulo', estado: 'SP',
          latitude: spec.lat, longitude: spec.lng, categoria: spec.categoria, relevancia: spec.relevancia,
          raioImpactoKm: spec.raioKm, capacidadeEstimada: spec.capacidade, venueCapacity: spec.capacidade,
          expectedAttendance: Math.round(spec.capacidade * 0.8), venueType: spec.venueType,
          source: 'admin-manual', sourceId: spec.key, dedupHash, dedupStatus: 'canonical', sourceCount: 1,
          lastSeenAt: now, dataCrawl: now, ativo: true, outOfScope: false, pendingGeocode: false,
        };
        const existing = await events.findOne({ where: { dedupHash } });
        if (existing) {
          await events.update(existing.id, fields as never);
          saved.push(await events.findOneByOrFail({ id: existing.id }));
        } else {
          saved.push(await events.save(events.create(fields)));
        }
      }

      // ------------------------- distancias e sugestoes de preco (analise)
      const analyses = em.getRepository(AnaliseEnderecoEvento);
      for (const ev of saved) {
        const meters = distanceMeters(PROPERTY.lat, PROPERTY.lng, Number(ev.latitude), Number(ev.longitude));
        const existing = await analyses.findOne({
          where: { evento: { id: ev.id }, endereco: { id: address.id }, usuarioProprietario: { id: host.id } },
        });
        const f = { distanciaMetros: meters, duraçãoSegundos: Math.round(meters / 400), transportMode: 'driving', enviado: false };
        if (existing) await analyses.update(existing.id, f as never);
        else await analyses.save(analyses.create({ ...f, evento: ev, endereco: address, usuarioProprietario: host }));
      }

      const prices = em.getRepository(AnalisePreco);
      const suggestions: Array<{ event: Event; pct: number; status: AnalisePreco['status']; why: string }> = [
        { event: saved[0], pct: 40, status: 'suggested',
          why: 'Show de grande porte a cerca de 5 km; demanda tende a subir na vespera e na data.' },
        { event: saved[1], pct: 20, status: 'suggested',
          why: 'Jogo no Morumbi com procura moderada por hospedagem na regiao.' },
        { event: saved[2], pct: 12, status: 'accepted',
          why: 'Festival no Ibirapuera; aumento conservador por ser em area aberta e de dia.' },
      ];
      for (const s of suggestions) {
        const meters = distanceMeters(PROPERTY.lat, PROPERTY.lng, Number(s.event.latitude), Number(s.event.longitude));
        const suggested = Math.round(BASE_NIGHTLY * (1 + s.pct / 100));
        const accepted = s.status === 'accepted';
        const f = {
          distanciaSuaPropriedade: meters / 1000, distanciaPropriedadeReferencia: meters / 1000,
          precoSugerido: suggested, seuPrecoAtual: BASE_NIGHTLY, diferencaPercentual: s.pct,
          recomendacao: `Aumentar a diaria em ${s.pct}% para ${s.event.nome}`, motivo_ia: s.why,
          aceito: accepted, status: s.status, aceitoEm: accepted ? now : null,
        };
        const existing = await prices.findOne({
          where: { evento: { id: s.event.id }, endereco: { id: address.id }, usuarioProprietario: { id: host.id } },
        });
        if (existing) await prices.update(existing.id, f as never);
        else await prices.save(prices.create({ ...f, evento: s.event, endereco: address, usuarioProprietario: host }));
      }

      // -------------------------------------------------- avisos (Avisos)
      const notifications = em.getRepository(Notification);
      const notes = [
        { title: 'Show de exemplo perto do seu imovel', description: 'Allianz Parque, em 6 dias. Veja a sugestao de preco.', titleButton: 'Ver evento', redirectTo: '/events' },
        { title: 'Nova sugestao de preco', description: 'Sugerimos R$ 448 para a noite do show (hoje R$ 320).', titleButton: 'Ver sugestao', redirectTo: '/price' },
        { title: 'Bem-vindo ao ambiente local', description: 'Estes dados sao ficticios, criados por npm run seed:dev.', titleButton: 'Ver imoveis', redirectTo: '/properties' },
      ];
      for (const n of notes) {
        const existing = await notifications.findOne({ where: { title: n.title, user: { id: host.id } } });
        const f = { ...n, sent: true, opened: false, sendEmail: false };
        if (existing) await notifications.update(existing.id, f as never);
        else await notifications.save(notifications.create({ ...f, user: host }));
      }

      console.log(`[seed:dev] ok: host=${host.email} admin=${admin.email} imovel=${list.id_do_anuncio} eventos=${saved.length} sugestoes=${suggestions.length} avisos=${notes.length}`);
    });
    console.log('[seed:dev] credenciais LOCAIS (ficticias): ver CONTRIBUTING.md, secao "Logar localmente".');
  } finally {
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error('[seed:dev] falhou:', error?.message || error);
  process.exitCode = 1;
});
