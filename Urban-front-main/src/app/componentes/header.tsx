'use client';

import {
  Avatar,
  Button,
  Link,
  Text
} from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import NextImage from 'next/image';
import { api } from '../service/api';

const NAV_ITEMS = [
  { path: '/dashboard', key: 'Iniciar',      href: '/dashboard'  },
  // { path: '/listings',  key: 'Propriedades', href: '/near-events' },
  { path: '/pricing',   key: 'Pagamentos',   href: '/plans'       },
];

export default function Header() {
  const { t } = useTranslation();
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header
      className="
        flex
        items-center
        justify-between
        border-b border-[#e8eef3]
        px-4 md:px-10
        bg-white
        z-40
        h-16 md:h-23   /* ✅ altura fixa: maior e consistente */
      "
    >

   {/* Logo */}
   <div className="relative md:static absolute left-1/2 -translate-x-1/2 md:translate-x-0 md:left-0 md:ml-6">
  <NextImage
    src="/urban-logo-transparent-soft.png"
    alt={t('header.logoAlt')}
    width={130}
    height={36}
    priority
  />
</div>
      {/* Desktop Nav */}
      <div className="hidden md:flex flex-1 justify-end items-center gap-6">
        <NavLinks t={t} />
      </div>

      {/* Mobile Menu Button (tamanho acompanha header) */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8eef3] md:hidden"
      >
        <BurgerIcon open={isMenuOpen} />
      </button>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 md:hidden"
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-3/4 bg-white p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="h-12 w-12 flex items-center justify-center rounded-xl bg-[#e8eef3]"
              >
                <CloseIcon />
              </button>
            </div>

            <NavLinks mobile t={t} onLinkClick={() => setIsMenuOpen(false)} />

            <div className="mt-4 flex gap-2">
              <ButtonIcon><LightningIcon /></ButtonIcon>
              <ButtonIcon><QuestionIcon /></ButtonIcon>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

const NavLinks = ({
  mobile = false,
  onLinkClick,
  t,
}: {
  mobile?: boolean;
  onLinkClick?: () => void;
  t: (key: string) => string;
}) => (
  <nav className={`flex ${mobile ? 'flex-col gap-4' : 'items-center gap-9'}`}>
    {NAV_ITEMS.map(item => (
      <Link
        key={item.key}
        href={item.href}
        className="text-sm font-medium text-[#0e161b] hover:text-[#0e161b]/80"
        onClick={onLinkClick}
      >
        <Text className="font-press" fontWeight="normal" fontSize="md">
          {item.key}
        </Text>
      </Link>
    ))}
  </nav>
);

const ButtonIcon = ({ children }: { children: React.ReactNode }) => (
  <button className="flex h-10 items-center justify-center rounded-xl bg-[#e8eef3] px-2.5 text-sm font-bold text-[#0e161b]">
    {children}
  </button>
);

const LightningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
    <path d="M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17Z" />
  </svg>
);

const QuestionIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
    <path d="M140,180a12,12,0,1,1-12-12A12,12,0,0,1,140,180ZM128,72c-22.06,0-40,16.15-40,36v4a8,8,0,0,0,16,0v-4c0-11,10.77-20,24-20s24,9,24,20-10.77,20-24,20a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-.72c18.24-3.35,32-17.9,32-35.28C168,88.15,150.06,72,128,72Zm104,56A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Z" />
  </svg>
);

const BurgerIcon = ({ open }: { open: boolean }) => (
  <svg className="h-6 w-6 text-[#0e161b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={open ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
  </svg>
);

const CloseIcon = () => (
  <svg className="h-6 w-6 text-[#0e161b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
  </svg>
);
