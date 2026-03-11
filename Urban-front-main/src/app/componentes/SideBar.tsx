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
  Hide,
  IconButton,
  Image,
  Show,
  useDisclosure,
  VStack,
  Divider, // ⬅️ adicionado
} from '@chakra-ui/react';
import { ChevronLeftIcon } from '@chakra-ui/icons';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiBarChart, FiBell, FiCalendar, FiDollarSign, FiHome, FiLink, FiMapPin, FiSettings } from 'react-icons/fi';
import { api } from '../service/api';
import '../../../i18n';

export default function InternoLayout() {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const router = useRouter();
  const pathname = usePathname();
  const [userName, setUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      router.push('/');
      return;
    }

    api.get('/auth/me')
      .then(res => {
        setUserName(res.data.username);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        router.push('/');
      });
  }, [router]);

  function handleLogout() {
    localStorage.removeItem('accessToken');
    router.push('/');
  }

  const isActive = (route: string) => pathname === route;

  const navItems = [
    { path: '/painel', icon: FiBarChart, labelKey: "Painel de Controle" }, 
    { path: '/notificacao', icon: FiBell, labelKey: "Notificação" }, 
    { path: '/dashboard', icon: FiCalendar, labelKey: "Calendário" },   
    { path: '/maps', icon: FiMapPin, labelKey: 'Mapa' },
        { path: '/properties', icon: FiHome, labelKey: "Propriedades" }, 
    { path: '/app', icon: FiLink, labelKey: 'Adicionar' },
    { path: '/event-log', icon: FiSettings, labelKey: 'Configuração' },
     { path: '/my-plan', icon: FiDollarSign, labelKey: 'Meu plano' },
  ];

  const displayName = userName || t('header.userName');

  const MenuButtons = ({ isCollapsed }: { isCollapsed?: boolean }) => (
    <VStack align="stretch" spacing="3" mt="4">
      {navItems.map(({ path, icon: IconComponent, labelKey }) => {
        const active = isActive(path);
        const iconProps = IconComponent === FiMapPin ? { size: 25 } : { boxSize: 5 };
        return (
          <Button
            key={path}
            variant={active ? 'solid' : 'ghost'}
            bg={active ? 'gray.700' : undefined}
            color={active ? 'white' : 'gray.700'}
            _hover={{ bg: active ? 'gray.600' : 'gray.100' }}
            justifyContent={isCollapsed ? 'center' : 'flex-start'}
            fontSize="md"
            p={isCollapsed ? '0' : '4'}
            onClick={() => {
              router.push(path);
              onClose();
            }}
            _focus={{ boxShadow: 'none' }}
            minH="40px"
            borderRadius="md"
            width={isCollapsed ? 'auto' : '100%'}
          >
            {isCollapsed ? (
              <Box as={IconComponent} {...iconProps} />
            ) : (
              <>
                <Box as={IconComponent} {...iconProps} mr="3" />
                {t(labelKey)}
              </>
            )}
          </Button>
        );
      })}
    </VStack>
  );

  // Ícone de hambúrguer personalizado
  const HamburgerIcon = ({ boxSize }: { boxSize?: number }) => (
    <svg className="h-6 w-6 text-[#0e161b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );

  return (
    <Flex minH="100vh" bg="#f8fafb">
      {/* Sidebar desktop */}
      <Hide below="md">
        <Box
          as="aside"
          bg="white"
          w={isCollapsed ? '80px' : '240px'}
          transition="width 0.3s"
          p="4"
          borderRight="1px solid"
          borderColor="gray.200"
          display="flex"
          flexDirection="column"
          justifyContent="space-between"
          alignItems={isCollapsed ? 'center' : 'stretch'}
          height="100vh"
        >
          <Box>
            {/* Header: logo + toggle button */}
            {isCollapsed ? (
              <IconButton
                aria-label={t('layout.toggle_sidebar')}
                icon={<HamburgerIcon boxSize={6} />}
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
                  <Image src="/urlaranja.png" alt="Logo" maxH="110px" />
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
                {/* Linha fina abaixo do header */}
                <Divider borderColor="gray.200" opacity={0.5} mb="4" />
              </>
            )}

            <MenuButtons isCollapsed={isCollapsed} />
          </Box>

          {/* Área do usuário e logout (desktop) */}
          {!isCollapsed && (
            <Flex 
              align="center" 
              p="3" 
              bg="gray.50" 
              borderRadius="md"
              mb="4"
            >
              <Avatar size="sm" name={displayName} mr="3" />
              <Box flex="1">
                <Text fontSize="sm" fontWeight="medium">{displayName}</Text>
              </Box>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleLogout}
                colorScheme="red"
              >
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
      </Hide>

      {/* Drawer mobile */}
      <Show below="md">
        <IconButton
          aria-label={t('layout.open_menu')}
          icon={<HamburgerIcon boxSize={6} />}
          onClick={onOpen}
          position="absolute"
          top="4"
          left="4"
          zIndex="1000"
          color="gray.700"
          _hover={{ bg: 'gray.100' }}
          _focus={{ boxShadow: 'none' }}
        />
        <Drawer isOpen={isOpen} placement="left" onClose={onClose}>
          <DrawerOverlay />
          <DrawerContent>
            <DrawerCloseButton aria-label={t('layout.close_menu')} />
            <DrawerHeader>{t('layout.menu')}</DrawerHeader>
            <DrawerBody display="flex" flexDirection="column" justifyContent="space-between">
              <Box>
                <MenuButtons />
              </Box>
              
              {/* Área do usuário e logout (mobile) */}
              <Flex 
                align="center" 
                p="3" 
                bg="gray.50" 
                borderRadius="md"
                mt="auto"
                mb="4"
              >
                <Avatar size="sm" name={displayName} mr="3" />
                <Box flex="1">
                  <Text fontSize="sm" fontWeight="medium">{displayName}</Text>
                </Box>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleLogout}
                  colorScheme="red"
                >
                  {t('header.logout')}
                </Button>
              </Flex>
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      </Show>
    </Flex>
  );
}

// Ícone de logout personalizado
const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
    <path d="M10 12.5a.5.5 0 0 1-.5.5h-8a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1-.5-.5h8a.5.5 0 0 1 .5.5v2a.5.5 0 0 0 1 0v-2A1.5 1.5 0 0 0 9.5 2h-8A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h8a1.5 1.5 0 0 0 1.5-1.5v-2a.5.5 0 0 0-1 0v2z"/>
    <path d="M15.854 8.354a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L14.293 7.5H5.5a.5.5 0 0 0 0 1h8.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3z"/>
  </svg>
);
