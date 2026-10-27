'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowRight, Bell, CheckCheck, RefreshCcw } from 'lucide-react';
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
  if (text.includes('preço') || text.includes('preço') || text.includes('sugest')) return 'pricing';
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
  const description = notif.description?.trim() || 'Abra para ver os detalhes no painel.';
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

function NotificationRow({
  notif,
  onOpen,
}: {
  notif: NotificationItem;
  onOpen: (notif: NotificationItem) => void;
}) {
  const kind = notificationKind(notif);
  const target = resolveTarget(notif);
  const clickable = Boolean(target);

  return (
    <article
      className={`urban-notif-card ${notif.opened ? 'is-opened' : 'is-unread'}`}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={() => onOpen(notif)}
      onKeyDown={(event) => {
        if (clickable && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onOpen(notif);
        }
      }}
    >
      <div className="urban-notif-icon">
        <Bell size={17} />
      </div>
      <div className="urban-notif-body">
        <div className="urban-notif-topline">
          <AppBadge kind={kindBadge(kind)}>{kindLabel(kind)}</AppBadge>
          {!notif.opened && <AppBadge kind="accent">Novo</AppBadge>}
          <span>
            {formatDistanceToNow(new Date(notif.createdAt), {
              addSuffix: true,
              locale: ptBR,
            })}
          </span>
        </div>
        <h3>{notif.title}</h3>
        <p>{normalizeDescription(notif)}</p>
      </div>
      <div className="urban-notif-action">
        {target ? (
          <>
            <span>{notif.titleButton || 'Abrir'}</span>
            <ArrowRight size={15} />
          </>
        ) : (
          <span>Sem destino</span>
        )}
      </div>
    </article>
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
      const [res, unread] = await Promise.all([
        getNotificacoesPorUsuario(page, limit),
        getUnreadNotificationsCount(),
      ]);
      setNotifications(res.data ?? []);
      setPaginaAtual(res.page ?? page);
      setTotalPaginas(Math.max(1, res.lastPage ?? 1));
      setTotal(res.total ?? 0);
      setUnreadTotal(unread.unread ?? 0);
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
      toast('Não foi possível carregar suas notificações.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData(paginaAtual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paginaAtual]);

  const stats = useMemo(() => {
    const pricing = notifications.filter((notif) => notificationKind(notif) === 'pricing').length;
    return { pricing };
  }, [notifications]);
  const unreadLabel = unreadTotal === 1
    ? '1 notificação não lida'
    : `${unreadTotal} notificações não lidas`;

  async function openNotification(notif: NotificationItem) {
    const target = resolveTarget(notif);
    if (!notif.opened) {
      setNotifications((prev) => prev.map((item) => item.id === notif.id ? { ...item, opened: true } : item));
      setUnreadTotal((prev) => Math.max(0, prev - 1));
      try {
        await marcarNotificacaoComoAberta(notif.id);
      } catch (error) {
        console.error('Erro ao marcar notificação como lida:', error);
      }
    }
    if (target) router.push(target);
  }

  async function markAllAsRead() {
    if (unreadTotal === 0) return;
    setMarkingAll(true);
    try {
      await marcarTodasNotificacoesComoAbertas();
      setNotifications((prev) => prev.map((item) => ({ ...item, opened: true })));
      setUnreadTotal(0);
      toast('Todas as notificações foram marcadas como lidas.', { type: 'success' });
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
      toast('Não foi possível marcar todas como lidas.', { type: 'error' });
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <AppPageShell maxWidth={1040}>
      <AppSectionHeader
        eyebrow="NOTIFICAÇÕES - ATIVIDADE RECENTE"
        title="Central de notificações"
        subtitle={
          unreadTotal > 0
            ? `Você tem ${unreadLabel} em toda a conta.`
            : 'Tudo em dia. Avisos importantes da Urban AI aparecem aqui.'
        }
        actions={
          <div className="urban-notif-actions">
            <AppButton
              variant="secondary"
              size="sm"
              leftIcon={<RefreshCcw size={14} />}
              onClick={() => fetchData(paginaAtual)}
              loading={loading}
            >
              Atualizar
            </AppButton>
            <AppButton
              variant="primary"
              size="sm"
              leftIcon={<CheckCheck size={14} />}
              onClick={markAllAsRead}
              loading={markingAll}
              disabled={unreadTotal === 0}
            >
              Marcar todas como lidas
            </AppButton>
          </div>
        }
      />

      <div className="urban-notif-metrics">
        <div>
          <strong>{unreadTotal}</strong>
          <span>não lidas</span>
        </div>
        <div>
          <strong>{total}</strong>
          <span>notificações no histórico</span>
        </div>
        <div>
          <strong>{stats.pricing}</strong>
          <span>avisos de preço nesta página</span>
        </div>
      </div>

      <PushNotificationOptIn />

      {loading ? (
        <AppLoadingStatus
          compact
          eyebrow="NOTIFICAÇÕES"
          title="Carregando atividade recente"
          body="Estamos buscando avisos, recomendações e atualizações de conta."
          steps={[
            { id: 'list', label: 'Buscar histórico', status: 'active' },
            { id: 'unread', label: 'Contar não lidas', status: 'pending' },
          ]}
        />
      ) : notifications.length === 0 ? (
        <AppCard variant="default">
          <AppEmptyState
            icon={<Icons.Info size={32} />}
            title="Sem notificações"
            body="Quando a Urban AI gerar avisos ou recomendações importantes, eles aparecem aqui."
          />
        </AppCard>
      ) : (
        <>
          <div className="urban-notif-list">
            {notifications.map((notif) => (
              <NotificationRow key={notif.id} notif={notif} onOpen={openNotification} />
            ))}
          </div>

          <Pagination
            paginaAtual={paginaAtual}
            totalPaginas={totalPaginas}
            onPageChange={(novaPagina: number) => setPaginaAtual(novaPagina)}
          />
        </>
      )}

    </AppPageShell>
  );
}
