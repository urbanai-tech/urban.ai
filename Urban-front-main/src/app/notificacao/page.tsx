'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Bell, Check, CheckCheck, RefreshCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  getNotificacoesPorUsuario,
  getUnreadNotificationsCount,
  marcarNotificacaoComoAberta,
  marcarTodasNotificacoesComoAbertas,
} from '../service/api';
import { Pagination } from '../componentes/Pagination';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmptyState,
  AppLoadingStatus,
  AppPageShell,
  AppSectionHeader,
  Icons,
  useToastCompat,
} from '../componentes/ui';
import { PushNotificationOptIn } from '../componentes/PushNotificationOptIn';
import { groupNotificationsByDay } from '../lib/host-today-domain';
import '../componentes/host-pages.css';

interface NotificationItem {
  id: string;
  title: string;
  description?: string | null;
  createdAt: string;
  opened: boolean;
  redirectTo?: string | null;
  titleButton?: string | null;
}

type NotificationKind = 'pricing' | 'analysis' | 'account' | 'general';

function notificationKind(notif: NotificationItem): NotificationKind {
  const text = `${notif.title} ${notif.description ?? ''}`.toLowerCase();
  if (text.includes('preço') || text.includes('preco') || text.includes('sugest')) return 'pricing';
  if (text.includes('análise') || text.includes('analise') || text.includes('evento')) return 'analysis';
  if (text.includes('plano') || text.includes('pagamento') || text.includes('conta')) return 'account';
  return 'general';
}

function kindLabel(kind: NotificationKind): string {
  if (kind === 'pricing') return 'Precificação';
  if (kind === 'analysis') return 'Monitoramento';
  if (kind === 'account') return 'Conta';
  return 'Atividade';
}

function kindBadge(kind: NotificationKind): 'accent' | 'success' | 'warn' | 'neutral' {
  if (kind === 'pricing') return 'accent';
  if (kind === 'analysis') return 'success';
  if (kind === 'account') return 'warn';
  return 'neutral';
}

function normalizeDescription(notif: NotificationItem): string {
  const description = notif.description?.trim() || 'Abra para ver os detalhes.';
  if (/^\s*(Atualizamos|Geramos)\s+\d+\s+sugest/i.test(description)) {
    return description
      .replace(/^Atualizamos/i, 'Neste lote de monitoramento, atualizamos')
      .replace(/^Geramos/i, 'Neste lote de monitoramento, geramos')
      .replace('para a propriedade', 'para');
  }
  return description;
}

function resolveTarget(notif: NotificationItem): string | null {
  const raw = notif.redirectTo?.trim();
  if (raw?.startsWith('/')) return raw;
  const kind = notificationKind(notif);
  if (kind === 'pricing' || kind === 'analysis') return '/dashboard';
  if (kind === 'account') return '/my-plan';
  return null;
}

function relativeTime(createdAt: string): string {
  const date = new Date(createdAt);
  if (!Number.isFinite(date.getTime())) return '';
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

function NotificationRow({
  notif,
  onOpen,
  onMarkRead,
}: {
  notif: NotificationItem;
  onOpen: (notif: NotificationItem) => void;
  onMarkRead: (notif: NotificationItem) => void;
}) {
  const kind = notificationKind(notif);
  const target = resolveTarget(notif);
  const unread = !notif.opened;
  const titleId = `notif-${notif.id}-title`;

  return (
    <li className="urban-notif-item" data-unread={unread || undefined} data-notification-id={notif.id}>
      <article className="urban-notif-row" aria-labelledby={titleId}>
        <span className="urban-notif-icon" aria-hidden="true">
          <Bell size={17} />
        </span>
        <div className="urban-notif-body">
          <div className="urban-notif-topline">
            <AppBadge kind={kindBadge(kind)}>{kindLabel(kind)}</AppBadge>
            <span>{relativeTime(notif.createdAt)}</span>
          </div>
          <h3 id={titleId}>
            {unread && <span className="urban-notif-unread-dot" aria-hidden="true" />}
            {unread && <span className="urban-visually-hidden">Não lido: </span>}
            {notif.title}
          </h3>
          <p>{normalizeDescription(notif)}</p>
          {/* Ações explícitas de 44px, sem gesto de deslizar. */}
          {(target || unread) && (
            <div className="urban-notif-row-actions">
              {target && (
                <button type="button" className="urban-notif-btn urban-notif-btn--primary urban-focus-ring" onClick={() => onOpen(notif)}>
                  {notif.titleButton || 'Abrir'} <ArrowRight size={15} aria-hidden="true" />
                </button>
              )}
              {unread && (
                <button
                  type="button"
                  className="urban-notif-btn urban-focus-ring"
                  onClick={() => onMarkRead(notif)}
                  aria-label={`Marcar como lido: ${notif.title}`}
                >
                  <Check size={16} aria-hidden="true" /> Marcar como lido
                </button>
              )}
            </div>
          )}
        </div>
      </article>
    </li>
  );
}

export default function NotificationCenter() {
  const router = useRouter();
  const toast = useToastCompat();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);

  const limit = 12;

  async function fetchData(page: number) {
    try {
      setLoading(true);
      const [res, unread] = await Promise.all([getNotificacoesPorUsuario(page, limit), getUnreadNotificationsCount()]);
      setNotifications(res.data ?? []);
      setPaginaAtual(res.page ?? page);
      setTotalPaginas(Math.max(1, res.lastPage ?? 1));
      setTotal(res.total ?? 0);
      setUnreadTotal(unread.unread ?? 0);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      toast('Não foi possível carregar seus avisos.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(paginaAtual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaAtual]);

  const groups = useMemo(() => groupNotificationsByDay(notifications), [notifications]);

  async function markRead(notif: NotificationItem) {
    if (notif.opened) return;
    setNotifications((prev) => prev.map((item) => (item.id === notif.id ? { ...item, opened: true } : item)));
    setUnreadTotal((prev) => Math.max(0, prev - 1));
    try {
      await marcarNotificacaoComoAberta(notif.id);
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  }

  async function openNotification(notif: NotificationItem) {
    await markRead(notif);
    const target = resolveTarget(notif);
    if (target) router.push(target);
  }

  async function markAllAsRead() {
    if (unreadTotal === 0) return;
    setMarkingAll(true);
    try {
      await marcarTodasNotificacoesComoAbertas();
      setNotifications((prev) => prev.map((item) => ({ ...item, opened: true })));
      setUnreadTotal(0);
      toast('Todos os avisos foram marcados como lidos.', { type: 'success' });
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      toast('Não foi possível marcar todos como lidos.', { type: 'error' });
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <AppPageShell maxWidth={1040}>
      <div className="urban-host-page">
        <AppSectionHeader
          title="Avisos"
          subtitle={
            unreadTotal > 0
              ? unreadTotal === 1
                ? '1 aviso não lido.'
                : `${unreadTotal} avisos não lidos.`
              : 'Tudo em dia por aqui.'
          }
          actions={
            <div className="urban-notif-actions urban-notif-header-actions">
              <button
                type="button"
                className="urban-cal-nav-btn urban-focus-ring"
                onClick={() => fetchData(paginaAtual)}
                disabled={loading}
                aria-label="Atualizar avisos"
                title="Atualizar"
              >
                <RefreshCcw size={16} aria-hidden="true" />
              </button>
              <AppButton
                variant="primary"
                size="md"
                leftIcon={<CheckCheck size={14} />}
                onClick={markAllAsRead}
                loading={markingAll}
                disabled={unreadTotal === 0}
              >
                Marcar todos como lidos
              </AppButton>
            </div>
          }
        />

        <PushNotificationOptIn variant="compact" />

        {loading ? (
          <AppLoadingStatus
            compact
            eyebrow="AVISOS"
            title="Carregando avisos"
            steps={[
              { id: 'list', label: 'Buscar histórico', status: 'active' },
              { id: 'unread', label: 'Contar não lidos', status: 'pending' },
            ]}
          />
        ) : notifications.length === 0 ? (
          <AppCard variant="default">
            <AppEmptyState
              icon={<Icons.Info size={32} />}
              title="Nenhum aviso ainda"
              body="Quando surgir uma sugestão de preço, um evento perto dos seus imóveis ou algo da sua conta, avisamos aqui."
            />
          </AppCard>
        ) : (
          <>
            <div className="urban-notif-groups" data-notification-groups>
              {groups.map((group) => (
                <section
                  key={group.bucket}
                  className="urban-notif-group"
                  aria-labelledby={`avisos-${group.bucket}`}
                  data-notification-group={group.bucket}
                >
                  <h2 id={`avisos-${group.bucket}`} className="urban-notif-group__label">
                    {group.label}
                    <span>{group.items.length === 1 ? '1 aviso' : `${group.items.length} avisos`}</span>
                  </h2>
                  <ul className="urban-notif-list">
                    {group.items.map((notif) => (
                      <NotificationRow key={notif.id} notif={notif} onOpen={openNotification} onMarkRead={markRead} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            {total > limit && (
              <Pagination
                paginaAtual={paginaAtual}
                totalPaginas={totalPaginas}
                onPageChange={(novaPagina: number) => setPaginaAtual(novaPagina)}
              />
            )}
          </>
        )}
      </div>
    </AppPageShell>
  );
}
