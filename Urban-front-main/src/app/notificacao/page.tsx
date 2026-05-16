'use client';

import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import { getNotificacoesPorUsuario, marcarNotificacaoComoAberta } from '../service/api';
import { Pagination } from '../componentes/Pagination';
import {
  AppPageShell,
  AppSectionHeader,
  AppBadge,
  AppEmptyState,
  Icons,
} from '../componentes/ui';

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  createdAt: string; // vem como string da API
  opened: boolean;
  redirectTo: string;
}

interface NotificationRowProps {
  notif: NotificationItem;
}

/**
 * Linha de notificacao light premium.
 *
 * Migrada do Chakra (bg="#E8F0FF" azul-pastel + Badge "#1931CF" azul royal)
 * para o design system .urban-app:
 *  - Lista vertical sem card rounded — separacao por divider sutil.
 *  - Nao-lidas: border-left 2px var(--app-accent) + dot 6x6 accent.
 *  - Badge "NOVO" em AppBadge kind="accent".
 *  - Timestamp mono cinza pequeno.
 */
const NotificationRow: React.FC<NotificationRowProps> = ({ notif }) => {
  const router = useRouter();

  const handleClick = async () => {
    if (!notif.opened) {
      try {
        await marcarNotificacaoComoAberta(notif.id);
      } catch {
        /* segue mesmo se falhar */
      }
    }
    if (notif.redirectTo) {
      router.push(notif.redirectTo);
    }
  };

  const clickable = Boolean(notif.redirectTo);

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : -1}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick();
        }
      }}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '18px 20px 18px 28px',
        borderLeft: notif.opened
          ? '2px solid transparent'
          : '2px solid var(--app-accent)',
        background: notif.opened ? 'transparent' : 'var(--app-accent-soft)',
        cursor: clickable ? 'pointer' : 'default',
        transition: 'background 120ms',
      }}
    >
      {!notif.opened && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 24,
            left: 12,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--app-accent)',
          }}
        />
      )}

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: notif.opened ? 500 : 700,
            color: 'var(--app-text)',
            letterSpacing: -0.1,
            lineHeight: 1.35,
          }}
        >
          {notif.title}
        </p>
        {!notif.opened && <AppBadge kind="accent">NOVO</AppBadge>}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: 'var(--app-text-muted)',
          lineHeight: 1.55,
        }}
      >
        {notif.description}
      </p>

      <p
        style={{
          margin: '4px 0 0',
          fontSize: 11,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          color: 'var(--app-text-dim)',
          letterSpacing: 0.3,
        }}
      >
        {formatDistanceToNow(new Date(notif.createdAt), {
          addSuffix: true,
          locale: ptBR,
        })}
      </p>
    </div>
  );
};

export default function NotificationCenter() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);

  const limit = 10;

  const fetchData = async (page: number) => {
    try {
      setLoading(true);
      const res = await getNotificacoesPorUsuario(page, limit);
      setNotifications(res.data);
      setPaginaAtual(res.page);
      setTotalPaginas(res.lastPage);
    } catch (error) {
      console.error('Erro ao carregar notificacoes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(paginaAtual);
  }, [paginaAtual]);

  const unreadCount = notifications.filter((n) => !n.opened).length;

  return (
    <AppPageShell maxWidth={900}>
      <AppSectionHeader
        eyebrow="NOTIFICAÇÕES · ATIVIDADE RECENTE"
        title="Notificações"
        subtitle={
          unreadCount > 0
            ? `Você tem ${unreadCount} notificação${unreadCount === 1 ? '' : 's'} não lida${unreadCount === 1 ? '' : 's'}.`
            : 'Tudo em dia. Avisos importantes da Urban AI aparecem aqui.'
        }
      />

      {loading ? (
        <p style={{ color: 'var(--app-text-muted)', fontSize: 14, padding: '24px 0' }}>
          Carregando…
        </p>
      ) : notifications.length === 0 ? (
        <AppEmptyState
          icon={<Icons.Info size={32} />}
          title="Sem notificações"
          body="Quando a Urban AI gerar avisos ou recomendações importantes, eles aparecem aqui."
        />
      ) : (
        <>
          <div
            style={{
              background: 'var(--app-surface)',
              border: '1px solid var(--app-divider)',
              borderRadius: 'var(--app-radius-card)',
              boxShadow: '0 1px 2px rgba(14, 17, 22, 0.04)',
              overflow: 'hidden',
            }}
          >
            {notifications.map((notif, idx) => (
              <React.Fragment key={notif.id}>
                {idx > 0 && (
                  <div
                    style={{
                      height: 1,
                      background: 'var(--app-divider)',
                      margin: '0 20px',
                    }}
                  />
                )}
                <NotificationRow notif={notif} />
              </React.Fragment>
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
