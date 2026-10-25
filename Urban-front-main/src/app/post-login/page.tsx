'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import UrbanAiLoader from '../componentes/loading';
import { api } from '../service/api';
import { useToastCompat } from '../componentes/ui';
import { stashPendingEmail } from "@/app/lib/auth-links";

function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
  if (typeof v === 'number') return v === 1;
  return false;
}

type HasAddressResult = { hasAddress: boolean | string | number; count: number };

export default function PostLoginPage() {
  const router = useRouter();
  const toast = useToastCompat();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    let cancelled = false;
    let finished = false;

    const timeout = setTimeout(() => {
      if (!finished && !cancelled) {
        console.warn('[post-login] timeout de 7s - fallback -> /onboarding');
        router.replace('/onboarding');
      }
    }, 7000);

    (async () => {
      try {
        console.log('[post-login] baseURL =>', (api.defaults as any).baseURL);

        // E-mail ainda não verificado: confirma antes de qualquer onboarding.
        // Falha ao ler o perfil não bloqueia o fluxo (o backend também barra).
        try {
          const { data: profile } = await api.get<{ email?: string; emailVerifiedAt?: string | null }>('/auth/profile');
          if (cancelled) return;
          if (profile?.emailVerifiedAt === null && profile.email) {
            finished = true;
            stashPendingEmail(profile.email);
            router.replace("/confirm-email");
            return;
          }
        } catch (profileError: any) {
          if (profileError?.response?.status === 401) throw profileError;
        }

        const { data } = await api.get<HasAddressResult>('/users/me/has-address', {
          params: { onlyActive: true },
        });

        if (cancelled) return;

        console.log('[post-login] payload =>', data);
        const hasAddress = toBool(data.hasAddress) || data.count > 0;

        finished = true;
        router.replace(hasAddress ? '/dashboard' : '/onboarding');
      } catch (err: any) {
        if (cancelled) return;
        finished = true;

        const status = err?.response?.status;
        console.error('[post-login] erro:', status, err?.response?.data || err);
        if (status === 401) {
          router.replace('/login');
        } else {
          // Falha de rede/5xx: o /app não existe (404). Segue para o painel, que tem
          // seus próprios estados de erro/retry, e avisa o usuário.
          toastRef.current('Não conseguimos carregar seus dados agora. Mostrando seu painel; atualize a página se algo parecer faltando.', { type: 'warning' });
          router.replace('/dashboard');
        }
      } finally {
        clearTimeout(timeout);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [router]);

  return (
    <UrbanAiLoader
      fullscreen
      src="/urban-logo-transparent-soft.png"
      alt="UrbanAI"
      width={360}
      height={120}
      overlayBg="rgba(8,10,15,0.94)"
      orbitColor="rgba(232,80,10,0.62)"
    />
  );
}
