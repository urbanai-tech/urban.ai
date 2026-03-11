'use client';

import React, { memo } from 'react';
import Image from 'next/image';
import { Box, Portal } from '@chakra-ui/react';
import { keyframes } from '@emotion/react';

const shine = keyframes`
  0% { transform: translateX(-150%); }
  100% { transform: translateX(150%); }
`;
const pulse = keyframes`
  0%, 100% { transform: scale(1); filter: drop-shadow(0 8px 20px rgba(0,0,0,0.24)); }
  50% { transform: scale(1.02); filter: drop-shadow(0 10px 28px rgba(0,0,0,0.28)); }
`;
const spin = keyframes`to { transform: rotate(360deg); }`;

type Props = {
  /** overlay de tela toda */
  fullscreen?: boolean;
  /** caminho do logo (coloque o PNG em /public) */
  src?: string;
  alt?: string;
  /** tamanho do logo */
  width?: number;
  height?: number;
  /** cor do backdrop quando fullscreen */
  overlayBg?: string;
  /** cor do ponto orbitando */
  orbitColor?: string;
};

function Inner({
  fullscreen,
  src,
  alt,
  width,
  height,
  overlayBg,
  orbitColor,
}: Required<Omit<Props, 'overlayBg' | 'orbitColor'>> & {
  overlayBg: string;
  orbitColor: string;
}) {
  const content = (
    <Box
      position={fullscreen ? 'fixed' : 'relative'}
      top={fullscreen ? 0 : undefined}
      left={fullscreen ? 0 : undefined}
      right={fullscreen ? 0 : undefined}
      bottom={fullscreen ? 0 : undefined}
      display="grid"
      placeItems="center"
      bg={fullscreen ? overlayBg : 'transparent'}
      backdropFilter={fullscreen ? 'saturate(140%) blur(6px)' : undefined}
      zIndex={fullscreen ? 9999 : 'auto'}
      role="status"
      aria-busy="true"
    >
      <Box position="relative" animation={`${pulse} 2.4s ease-in-out infinite`}>
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority
          style={{ display: 'block', height: 'auto' }}
        />

        {/* brilho que “varre” o logo */}
        <Box
          pointerEvents="none"
          position="absolute"
          inset={0}
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
          w={`${Math.max(width, height) * 0.9}px`}
          h={`${Math.max(width, height) * 0.9}px`}
          transform={'translate(-50%, -50%)'}
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
            bg: orbitColor,
            boxShadow: '0 0 0 0 rgba(228,110,46,0.75)',
          }}
        />
      </Box>
    </Box>
  );

  // quando fullscreen, usa Portal pra ficar acima de tudo
  return fullscreen ? <Portal>{content}</Portal> : content;
}

const UrbanAiLoader = memo(function UrbanAiLoader({
  fullscreen = true,
  src = '/urban-logo.png',
  alt = 'UrbanAI',
  width = 360,
  height = 120,
  overlayBg = 'rgba(10,12,24,0.76)',
  orbitColor = '#E46E2E',
}: Props) {
  return (
    <Inner
      fullscreen={fullscreen}
      src={src}
      alt={alt}
      width={width}
      height={height}
      overlayBg={overlayBg}
      orbitColor={orbitColor}
    />
  );
});

export default UrbanAiLoader;
