'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Box } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import Image from 'next/image';
import { api } from '../service/api';

// animações
const shine = keyframes`
  0% { transform: translateX(-150%); }
  100% { transform: translateX(150%); }
`;
const pulse = keyframes`
  0%, 100% { transform: scale(1); filter: drop-shadow(0 8px 20px rgba(0,0,0,0.24)); }
  50% { transform: scale(1.02); filter: drop-shadow(0 10px 28px rgba(0,0,0,0.28)); }
`;
const spin = keyframes`to { transform: rotate(360deg); }`;

// normaliza boolean vindo da API (true | "true" | 1)
function toBool(v: unknown): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
  if (typeof v === 'number') return v === 1;
  return false;
}

type HasAddressResult = { hasAddress: boolean | string | number; count: number };

export default function PostLoginPage() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    let finished = false;

    const timeout = setTimeout(() => {
      if (!finished && !cancelled) {
        console.warn('[post-login] timeout de 7s — fallback -> /app');
        router.replace('/app');
      }
    }, 7000);

    (async () => {
      try {
        const token = localStorage.getItem('accessToken');
        if (!token) {
          console.warn('[post-login] Sem token — /login');
          finished = true;
          router.replace('/login');
          return;
        }

        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        console.log('[post-login] baseURL =>', (api.defaults as any).baseURL);

        const { data } = await api.get<HasAddressResult>('/users/me/has-address', {
          params: { onlyActive: true },
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        console.log('[post-login] payload =>', data);

        // Lógica corrigida para verificar se tem endereço
        const hasAddress = toBool(data.hasAddress) || data.count > 0;

        finished = true;
        
        // Redirecionamento correto
        if (hasAddress) {
          router.replace('/dashboard'); // Se TEM endereço, vai para dashboard
        } else {
          router.replace('/app'); // Se NÃO TEM endereço, vai para app
        }
      } catch (err: any) {
        if (cancelled) return;
        finished = true;

        const status = err?.response?.status;
        console.error('[post-login] erro:', status, err?.response?.data || err);

        if (status === 401) {
          router.replace('/login');
        } else {
          router.replace('/app');
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

  // Loader fullscreen
  return (
    <Box
      position="fixed"
      top={0}
      right={0}
      bottom={0}
      left={0}
      display="grid"
      placeItems="center"
      bg="rgba(10,12,24,0.76)"
      backdropFilter="saturate(140%) blur(6px)"
      zIndex={9999}
      role="status"
      aria-busy="true"
    >
      <Box position="relative" animation={`${pulse} 2.4s ease-in-out infinite`}>
        <Image
          src="/urban-logo.png"
          alt="UrbanAI"
          width={360}
          height={120}
          priority
          style={{ display: 'block', height: 'auto' }}
        />

        {/* brilho que varre */}
        <Box
          pointerEvents="none"
          position="absolute"
          top={0}
          right={0}
          bottom={0}
          left={0}
          overflow="hidden"
          _before={{
            content: '""',
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '30%',
            transform: 'translateX(-150%)',
            background:
              'linear-gradient(110deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.35) 45%, rgba(255,255,255,0) 100%)',
            animation: `${shine} 1.35s ease-in-out infinite`,
          }}
        />

        {/* ponto laranja orbitando */}
        <Box
          position="absolute"
          top="50%"
          left="50%"
          w={`${Math.max(360, 120) * 0.9}px`}
          h={`${Math.max(360, 120) * 0.9}px`}
          transform="translate(-50%, -50%)"
          borderRadius="full"
          animation={`${spin} 1.75s linear infinite`}
          _before={{
            content: '""',
            position: 'absolute',
            top: '-8px',
            left: '50%',
            transform: 'translateX(-50%)',
            w: '12px',
            h: '12px',
            borderRadius: 'full',
            bg: '#E46E2E',
            boxShadow: '0 0 0 0 rgba(228,110,46,0.75)',
          }}
        />
      </Box>
    </Box>
  );
}