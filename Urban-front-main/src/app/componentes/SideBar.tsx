'use client';

import {
  Avatar,
  Button,
  Text,
  Box,
  Drawer,
  DrawerBody,
  DrawerCloseButton,
  DrawerContent,
  DrawerHeader,
  DrawerOverlay,
  Flex,
  IconButton,
  Image,
  useDisclosure,
  VStack,
  Divider,
} from '@chakra-ui/react';
import { ChevronLeftIcon } from '@chakra-ui/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FiBarChart,
  FiBell,
  FiCalendar,
  FiDollarSign,
  FiHome,
  FiMapPin,
  FiMoreHorizontal,
  FiSettings,
  FiTrendingUp,
} from 'react-icons/fi';
import { api } from '../service/api';
import '../../../i18n';

/**
 * Shell de navegação do app autenticado.
 *
 * Refatoração 2026-05-16 (auditoria UI/UX):
 *  - Mobile NÃO renderiza mais a sidebar desktop (bug capturado em
 *    host-calendario-mobile.png: sidebar+hamburger duplicados, conteúdo vazio).
 *  - Em telas <768px: top bar fixa com hamburger + bottom-nav 4 itens
 *    (Painel/Calendário/Mapa/Propriedades) + drawer "Mais" pro resto.
 *  - Em telas ≥768px: sidebar expansível com toggle, ícone + label visíveis
 *    quando expandida, tooltip nos ícones quando colapsada.
 *  - Item "Configuração" foi renomeado para "Ajustes" (apontando ainda
 *    para /event-log — rota a ser movida no Sprint 2 do plano).
 *  - O wrapper `<Flex minH=100vh bg=#f8fafb>` foi REMOVIDO daqui.
 *    O layout do `app/<rota>/layout.tsx` é quem cria o flex/bg.
 */
export default function SideBar() {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    api
      .get('/auth/me')
      .then((res) => {
        setUserName(res.data.username);
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        router.push('/');
      });
  }, [router]);

  async function handleLogout() {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Erro ao encerrar sessão no backend:', error);
    }
    localStorage.removeItem('accessToken');
    router.push('/');
  }

  const isActive = (route: string) => pathname === route;

  // Items primários (vão para bottom-nav no mobile)
  const primaryNav = [
    { path: '/painel', icon: FiBarChart, labelKey: 'Painel' },
    { path: '/dashboard', icon: FiCalendar, labelKey: 'Calendário' },
    { path: '/maps', icon: FiMapPin, labelKey: 'Mapa' },
    { path: '/properties', icon: FiHome, labelKey: 'Imóveis' },
  ];

  // Items secundários (só na sidebar desktop + drawer "Mais" mobile)
  const secondaryNav = [
    { path: '/notificacao', icon: FiBell, labelKey: 'Notificações' },
    { path: '/my-roi', icon: FiTrendingUp, labelKey: 'Meu ROI' },
    { path: '/my-plan', icon: FiDollarSign, labelKey: 'Meu plano' },
    { path: '/event-log', icon: FiSettings, labelKey: 'Ajustes' },
  ];

  const allNav = [...primaryNav, ...secondaryNav];
  const displayName = userName || t('header.userName');

  const NavButton = ({
    path,
    icon: IconComponent,
    label,
    collapsed,
    onSelect,
  }: {
    path: string;
    icon: typeof FiBarChart;
    label: string;
    collapsed?: boolean;
    onSelect?: () => void;
  }) => {
    const active = isActive(path);
    const iconProps = IconComponent === FiMapPin ? { size: 22 } : { boxSize: 5 };
    return (
      <Button
        variant={active ? 'solid' : 'ghost'}
        bg={active ? 'gray.700' : undefined}
        color={active ? 'white' : 'gray.700'}
        _hover={{ bg: active ? 'gray.600' : 'gray.100' }}
        justifyContent={collapsed ? 'center' : 'flex-start'}
        fontSize="sm"
        p={collapsed ? '0' : '4'}
        onClick={() => {
          router.push(path);
          onSelect?.();
          onClose();
        }}
        _focus={{ boxShadow: 'none' }}
        minH="40px"
        borderRadius="md"
        width={collapsed ? '40px' : '100%'}
        title={collapsed ? label : undefined}
      >
        {collapsed ? (
          <Box as={IconComponent} {...iconProps} />
        ) : (
          <>
            <Box as={IconComponent} {...iconProps} mr="3" />
            {label}
          </>
        )}
      </Button>
    );
  };

  return (
    <>
      {/* ====================== Desktop: sidebar lateral ====================== */}
      <Box
        as="aside"
        bg="white"
        w={isCollapsed ? '80px' : '240px'}
        transition="width 0.3s"
        p="4"
        borderRight="1px solid"
        borderColor="gray.200"
        display={{ base: 'none', md: 'flex' }}
        flexDirection="column"
        justifyContent="space-between"
        alignItems={isCollapsed ? 'center' : 'stretch'}
        height="100vh"
        position="sticky"
        top="0"
      >
        <Box w="full">
          {isCollapsed ? (
            <IconButton
              aria-label={t('layout.toggle_sidebar')}
              icon={<HamburgerIcon />}
              onClick={() => setIsCollapsed(false)}
              size="lg"
              color="gray.700"
              _hover={{ bg: 'gray.100' }}
              _focus={{ boxShadow: 'none' }}
              mb="6"
            />
          ) : (
            <>
              <Flex mr={5} justify="space-between" align="center" mb="6" px="2">
                <Image src="/urlaranja.png" alt="Urban AI" maxH="110px" />
                <IconButton
                  aria-label={t('layout.toggle_sidebar')}
                  icon={<ChevronLeftIcon boxSize={6} />}
                  onClick={() => setIsCollapsed(true)}
                  size="lg"
                  color="gray.700"
                  _hover={{ bg: 'gray.100' }}
                  _focus={{ boxShadow: 'none' }}
                />
              </Flex>
              <Divider borderColor="gray.200" opacity={0.5} mb="4" />
            </>
          )}

          <VStack align="stretch" spacing="2" mt="2">
            {allNav.map((item) => (
              <NavButton
                key={item.path}
                path={item.path}
                icon={item.icon}
                label={item.labelKey}
                collapsed={isCollapsed}
              />
            ))}
          </VStack>
        </Box>

        {/* Área do usuário + logout (desktop) */}
        {!isCollapsed && (
          <Flex align="center" p="3" bg="gray.50" borderRadius="md" mb="4">
            <Avatar size="sm" name={displayName} mr="3" />
            <Box flex="1" minW={0}>
              <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                {displayName}
              </Text>
            </Box>
            <Button size="sm" variant="outline" onClick={handleLogout} colorScheme="red">
              {t('header.logout')}
            </Button>
          </Flex>
        )}

        {isCollapsed && (
          <IconButton
            aria-label="Logout"
            icon={<LogoutIcon />}
            onClick={handleLogout}
            size="sm"
            variant="outline"
            colorScheme="red"
            mb="4"
          />
        )}
      </Box>

      {/* ====================== Mobile: top bar + bottom-nav + drawer Mais ====================== */}
      <Box display={{ base: 'block', md: 'none' }}>
        {/* Top bar */}
        <Flex
          as="header"
          position="sticky"
          top="0"
          zIndex="40"
          bg="white"
          borderBottom="1px solid"
          borderColor="gray.200"
          align="center"
          justify="space-between"
          h="56px"
          px="4"
        >
          <Image src="/urlaranja.png" alt="Urban AI" maxH="32px" />
          <IconButton
            aria-label={t('layout.open_menu')}
            icon={<HamburgerIcon />}
            onClick={onOpen}
            size="sm"
            variant="ghost"
            _hover={{ bg: 'gray.100' }}
            _focus={{ boxShadow: 'none' }}
          />
        </Flex>

        {/* Bottom-nav fixa — 4 itens primários */}
        <Flex
          as="nav"
          position="fixed"
          bottom="0"
          left="0"
          right="0"
          zIndex="40"
          bg="white"
          borderTop="1px solid"
          borderColor="gray.200"
          h="64px"
          align="stretch"
          justify="space-around"
          px="2"
        >
          {primaryNav.map((item) => {
            const active = isActive(item.path);
            const Icon = item.icon;
            return (
              <Button
                key={item.path}
                variant="ghost"
                onClick={() => router.push(item.path)}
                _focus={{ boxShadow: 'none' }}
                _hover={{ bg: 'transparent' }}
                flex="1"
                h="full"
                py="2"
                px="0"
                flexDirection="column"
                gap="2px"
                color={active ? 'blue.600' : 'gray.500'}
                fontWeight={active ? '600' : '400'}
                fontSize="11px"
              >
                <Icon size={20} />
                {item.labelKey}
              </Button>
            );
          })}
          <Button
            variant="ghost"
            onClick={onOpen}
            _focus={{ boxShadow: 'none' }}
            _hover={{ bg: 'transparent' }}
            flex="1"
            h="full"
            py="2"
            px="0"
            flexDirection="column"
            gap="2px"
            color="gray.500"
            fontWeight="400"
            fontSize="11px"
          >
            <FiMoreHorizontal size={20} />
            Mais
          </Button>
        </Flex>

        {/* Drawer "Mais" — items secundários + logout */}
        <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="xs">
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton aria-label={t('layout.close_menu')} />
            <DrawerHeader fontSize="md" fontWeight="semibold">
              Mais opções
            </DrawerHeader>
            <DrawerBody display="flex" flexDirection="column" justifyContent="space-between" pb={6}>
              <VStack align="stretch" spacing="2">
                {secondaryNav.map((item) => (
                  <NavButton
                    key={item.path}
                    path={item.path}
                    icon={item.icon}
                    label={item.labelKey}
                  />
                ))}
              </VStack>

              <Flex align="center" p="3" bg="gray.50" borderRadius="md" mt={6}>
                <Avatar size="sm" name={displayName} mr="3" />
                <Box flex="1" minW={0}>
                  <Text fontSize="sm" fontWeight="medium" noOfLines={1}>
                    {displayName}
                  </Text>
                </Box>
                <Button size="sm" variant="outline" onClick={handleLogout} colorScheme="red">
                  {t('header.logout')}
                </Button>
              </Flex>
            </DrawerBody>
          </DrawerContent>
        </Drawer>

        {/* Spacer pra conteúdo da página não ficar atrás da bottom-nav */}
        <Box h="64px" />
      </Box>
    </>
  );
}

const HamburgerIcon = () => (
  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const LogoutIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    fill="currentColor"
    viewBox="0 0 16 16"
    aria-hidden
  >
    <path d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1-.5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z" />
    <path d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z" />
  </svg>
);
