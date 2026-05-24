'use client';

import React, { useState, Suspense, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import '../../../i18n';
import {
  getHostId, getUserManagedListings, registerProperties,
  createMultipleAddresses, resolveAirbnbUrl,
  createCheckoutSession, updateProfileById, getProfileById,
  fetchSubscription,
  getPropertyQuickInfo, updatePropertyPricingInputs,
  getPropriedadesDropdownList, getPlans, Plan, registerProcess
} from '../service/api';
import { Bell, Home, Users, Zap } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { AppLoadingStatus, useToastCompat, type AppLoadingStep } from '../componentes/ui';
import { describeBasePriceReadiness } from '../lib/pricingInputs';

type PrimitiveProps = Record<string, any> & {
  as?: React.ElementType;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

const colorMap: Record<string, string> = {
  'gray.50': 'var(--app-bg)',
  'gray.100': 'var(--app-surface-muted)',
  'gray.200': 'var(--app-divider)',
  'gray.300': 'var(--app-divider-strong)',
  'gray.400': 'var(--app-text-dim)',
  'gray.500': 'var(--app-text-muted)',
  'gray.600': 'var(--app-text-dim)',
  'gray.700': 'var(--app-text)',
  'gray.800': 'var(--app-text)',
  'blue.50': 'var(--app-accent-soft)',
  'blue.200': 'var(--app-divider-strong)',
  'blue.300': 'var(--app-accent-soft)',
  'blue.400': 'var(--app-accent-hover)',
  'blue.500': 'var(--app-accent)',
  'blue.600': 'var(--app-accent)',
  'green.50': 'var(--app-accent-soft)',
  'green.200': 'var(--app-divider-strong)',
  'green.400': 'var(--app-success)',
  'green.500': 'var(--app-success)',
  'red.200': 'var(--app-divider-strong)',
  'red.600': 'var(--app-danger)',
  'red.900': 'var(--app-danger)',
  'orange.500': 'var(--app-accent)',
  white: 'var(--app-surface)',
};

const radiusMap: Record<string, string> = {
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  full: '999px',
};

const shadowMap: Record<string, string> = {
  sm: '0 1px 2px rgba(15, 23, 42, 0.08)',
  md: '0 8px 22px rgba(15, 23, 42, 0.10)',
  lg: '0 18px 42px rgba(15, 23, 42, 0.14)',
};

const stylePropMap: Record<string, keyof React.CSSProperties> = {
  w: 'width',
  h: 'height',
  minW: 'minWidth',
  maxW: 'maxWidth',
  minH: 'minHeight',
  maxH: 'maxHeight',
  bg: 'background',
  rounded: 'borderRadius',
  shadow: 'boxShadow',
  direction: 'flexDirection',
  align: 'alignItems',
  justify: 'justifyContent',
  wrap: 'flexWrap',
  templateColumns: 'gridTemplateColumns',
  decoration: 'textDecoration',
  textDecor: 'textDecoration',
};

const styleProps = new Set([
  'width', 'height', 'minWidth', 'maxWidth', 'minHeight', 'maxHeight',
  'boxSize', 'p', 'px', 'py', 'pt', 'pb', 'pl', 'pr', 'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr',
  'display', 'position', 'top', 'right', 'bottom', 'left', 'inset', 'zIndex',
  'flex', 'flexShrink', 'flexGrow', 'flexBasis', 'flexDirection', 'alignItems', 'alignSelf',
  'justifyContent', 'gap', 'overflow', 'overflowX', 'overflowY', 'objectFit', 'aspectRatio',
  'background', 'color', 'border', 'borderWidth', 'borderColor', 'borderRadius', 'borderBottom',
  'borderTop', 'borderLeft', 'borderRight', 'boxShadow', 'opacity', 'cursor', 'pointerEvents',
  'textAlign', 'textTransform', 'letterSpacing', 'lineHeight', 'fontSize', 'fontWeight',
  'whiteSpace', 'transition', 'transform',
  ...Object.keys(stylePropMap),
]);

function resolveResponsive(value: any) {
  if (value && typeof value === 'object' && !React.isValidElement(value) && !Array.isArray(value)) {
    return value.md ?? value.lg ?? value.base ?? Object.values(value)[0];
  }
  return value;
}

function spacing(value: number) {
  return `${value * 4}px`;
}

function cssValue(prop: string, value: any): any {
  const resolved = resolveResponsive(value);
  if (resolved === undefined || resolved === null || resolved === false) return undefined;
  if (prop === 'boxSize') return resolved;

  if (typeof resolved === 'number') {
    if (['opacity', 'zIndex', 'flex', 'flexGrow', 'fontWeight', 'lineHeight'].includes(prop)) return resolved;
    return spacing(resolved);
  }

  if (typeof resolved !== 'string') return resolved;
  if (prop.toLowerCase().includes('color') || prop === 'background' || prop === 'bg') {
    if (resolved === 'white') {
      return prop.toLowerCase().includes('color') ? '#FFFFFF' : 'var(--app-surface)';
    }
    return colorMap[resolved] ?? resolved;
  }
  if (prop.toLowerCase().includes('radius')) return radiusMap[resolved] ?? resolved;
  if (prop.toLowerCase().includes('shadow')) return shadowMap[resolved] ?? resolved;
  if (prop === 'fontSize') {
    return {
      '2xs': '10px',
      xs: '12px',
      sm: '14px',
      md: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '28px',
    }[resolved] ?? resolved;
  }
  if (prop === 'fontWeight') {
    return {
      medium: 500,
      semibold: 600,
      bold: 700,
      extrabold: 800,
    }[resolved] ?? resolved;
  }
  if (prop === 'letterSpacing') {
    return { wider: '0.08em', widest: '0.14em' }[resolved] ?? resolved;
  }
  if (prop === 'lineHeight') {
    return { tight: 1.25, short: 1.35, shorter: 1.15, tall: 1.7 }[resolved] ?? resolved;
  }
  if (prop === 'maxWidth' && resolved === 'container.md') return '768px';
  return resolved;
}

function splitPrimitiveProps(props: PrimitiveProps) {
  const domProps: Record<string, any> = {};
  const style: React.CSSProperties = { ...(props.style ?? {}) };
  const ignored = new Set([
    'as', 'children', 'style', 'variant', 'colorScheme', 'size', 'spacing', 'columns',
    'leftIcon', 'rightIcon', 'icon', 'isLoading', 'loadingText', 'isDisabled',
    'focusBorderColor', 'isExternal', 'hasArrow', 'placement', 'label', 'index',
    'isFitted', 'sx',
  ]);

  for (const [rawKey, rawValue] of Object.entries(props)) {
    if (ignored.has(rawKey) || rawKey.startsWith('_')) continue;
    const mappedKey = stylePropMap[rawKey] ?? rawKey;

    if (styleProps.has(rawKey) || styleProps.has(String(mappedKey))) {
      if (rawKey === 'boxSize') {
        const value = cssValue(rawKey, rawValue);
        style.width = cssValue('width', value);
        style.height = cssValue('height', value);
      } else if (rawKey === 'px') {
        style.paddingLeft = cssValue(rawKey, rawValue);
        style.paddingRight = cssValue(rawKey, rawValue);
      } else if (rawKey === 'py') {
        style.paddingTop = cssValue(rawKey, rawValue);
        style.paddingBottom = cssValue(rawKey, rawValue);
      } else if (rawKey === 'pt') style.paddingTop = cssValue(rawKey, rawValue);
      else if (rawKey === 'pb') style.paddingBottom = cssValue(rawKey, rawValue);
      else if (rawKey === 'pl') style.paddingLeft = cssValue(rawKey, rawValue);
      else if (rawKey === 'pr') style.paddingRight = cssValue(rawKey, rawValue);
      else if (rawKey === 'mx') {
        style.marginLeft = rawValue === 'auto' ? 'auto' : cssValue(rawKey, rawValue);
        style.marginRight = rawValue === 'auto' ? 'auto' : cssValue(rawKey, rawValue);
      } else if (rawKey === 'my') {
        style.marginTop = cssValue(rawKey, rawValue);
        style.marginBottom = cssValue(rawKey, rawValue);
      } else if (rawKey === 'mt') style.marginTop = cssValue(rawKey, rawValue);
      else if (rawKey === 'mb') style.marginBottom = cssValue(rawKey, rawValue);
      else if (rawKey === 'ml') style.marginLeft = cssValue(rawKey, rawValue);
      else if (rawKey === 'mr') style.marginRight = cssValue(rawKey, rawValue);
      else if (rawKey === 'p') style.padding = cssValue(rawKey, rawValue);
      else if (rawKey === 'm') style.margin = cssValue(rawKey, rawValue);
      else (style as any)[mappedKey] = cssValue(String(mappedKey), rawValue);
    } else {
      domProps[rawKey] = rawValue;
    }
  }

  return { domProps, style };
}

const primitive = (defaultAs: React.ElementType, baseStyle?: React.CSSProperties) =>
  React.forwardRef<any, PrimitiveProps>(function Primitive({ as, children, ...props }, ref) {
    const Component = as ?? defaultAs;
    const { domProps, style } = splitPrimitiveProps(props);
    return (
      <Component ref={ref} style={{ ...baseStyle, ...style }} {...domProps}>
        {children}
      </Component>
    );
  });

const Box = primitive('div');
const Flex = primitive('div', { display: 'flex' });
const FormControl = primitive('div');
const FormLabel = primitive('label');
const List = primitive('ul', { listStyle: 'none', padding: 0, margin: 0 });
const ListItem = primitive('li');
const AlertTitle = primitive('strong', { display: 'block' });
const AlertDescription = primitive('span');
const Container = primitive('div', { width: '100%', marginLeft: 'auto', marginRight: 'auto' });

function Text({ as = 'p', children, ...props }: PrimitiveProps) {
  const Component = primitive(as, { margin: 0 });
  return <Component {...props}>{children}</Component>;
}

function Heading({ as = 'h2', size, children, ...props }: PrimitiveProps) {
  const fontSize = typeof size === 'object'
    ? (resolveResponsive(size) === '2xl' ? '34px' : '28px')
    : size === 'xl'
      ? '32px'
      : size === 'lg'
        ? '26px'
        : '22px';
  const Component = primitive(as, { margin: 0, fontWeight: 700, lineHeight: 1.15, fontSize });
  return <Component {...props}>{children}</Component>;
}

function stackStyle(direction: 'row' | 'column', props: PrimitiveProps) {
  return {
    display: 'flex',
    flexDirection: direction,
    gap: spacing(Number(resolveResponsive(props.spacing ?? props.gap ?? 2))),
    alignItems: props.align ?? (direction === 'row' ? 'center' : undefined),
  } as React.CSSProperties;
}

function VStack({ children, ...props }: PrimitiveProps) {
  const Component = primitive('div', stackStyle('column', props));
  return <Component {...props}>{children}</Component>;
}

function HStack({ children, ...props }: PrimitiveProps) {
  const Component = primitive('div', stackStyle('row', props));
  return <Component {...props}>{children}</Component>;
}

function Stack({ children, ...props }: PrimitiveProps) {
  return <VStack {...props}>{children}</VStack>;
}

function Input(props: PrimitiveProps) {
  const { domProps, style } = splitPrimitiveProps(props);
  return (
    <input
      style={{
        width: '100%',
        height: cssValue('height', props.h ?? (props.size === 'lg' ? 13 : 10)),
        padding: '0 14px',
        color: 'var(--app-text)',
        background: 'var(--app-surface)',
        border: '1px solid var(--app-divider-strong)',
        borderRadius: 10,
        outline: 'none',
        font: 'inherit',
        ...style,
      }}
      {...domProps}
    />
  );
}

function Button({
  children,
  leftIcon,
  rightIcon,
  isLoading,
  loadingText,
  isDisabled,
  disabled,
  variant,
  ...props
}: PrimitiveProps) {
  const { domProps, style } = splitPrimitiveProps(props);
  const isGhost = variant === 'ghost';
  const isOutline = variant === 'outline';
  return (
    <button
      type={domProps.type ?? 'button'}
      {...domProps}
      disabled={Boolean(disabled || isDisabled || isLoading)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: props.size === 'lg' ? 48 : props.size === 'sm' ? 32 : 40,
        padding: props.size === 'sm' ? '0 14px' : '0 20px',
        color: isGhost ? 'var(--app-text-muted)' : isOutline ? 'var(--app-accent)' : '#FFFFFF',
        background: isGhost || isOutline ? 'transparent' : 'var(--app-accent)',
        border: isGhost ? '1px solid transparent' : isOutline ? '1px solid var(--app-accent)' : '1px solid var(--app-accent)',
        borderRadius: 10,
        fontWeight: 650,
        cursor: disabled || isDisabled || isLoading ? 'not-allowed' : 'pointer',
        opacity: disabled || isDisabled || isLoading ? 0.55 : props.opacity ?? 1,
        ...style,
      }}
    >
      {leftIcon}
      <span>{isLoading ? (loadingText ?? 'Carregando...') : children}</span>
      {rightIcon}
    </button>
  );
}

function IconButton({ icon, isDisabled, disabled, ...props }: PrimitiveProps) {
  const { domProps, style } = splitPrimitiveProps(props);
  return (
    <button
      type="button"
      {...domProps}
      disabled={Boolean(disabled || isDisabled)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        color: props.colorScheme === 'red' ? 'var(--app-danger)' : 'var(--app-text-muted)',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: 8,
        cursor: disabled || isDisabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {icon}
    </button>
  );
}

function Image(props: PrimitiveProps) {
  const { domProps, style } = splitPrimitiveProps(props);
  const { alt = '', ...imageProps } = domProps as React.ImgHTMLAttributes<HTMLImageElement>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img alt={alt} style={style} {...imageProps} />;
}

function Badge({ children, ...props }: PrimitiveProps) {
  const { domProps, style } = splitPrimitiveProps(props);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        width: 'fit-content',
        padding: '2px 8px',
        color: props.colorScheme === 'blue' ? 'var(--app-accent)' : props.colorScheme === 'orange' ? 'var(--app-accent)' : 'var(--app-text-dim)',
        background: props.colorScheme === 'blue' ? 'var(--app-accent-soft)' : props.colorScheme === 'orange' ? 'var(--app-accent-soft)' : 'var(--app-surface-muted)',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        ...style,
      }}
      {...domProps}
    >
      {children}
    </span>
  );
}

function SimpleGrid({ columns = 1, spacing: gap = 4, children, ...props }: PrimitiveProps) {
  const count = Number(resolveResponsive(columns)) || 1;
  const Component = primitive('div', {
    display: 'grid',
    gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
    gap: cssValue('gap', gap),
  });
  return <Component {...props}>{children}</Component>;
}

function Spinner({ color = 'var(--app-accent)', thickness = '3px', ...props }: PrimitiveProps) {
  const { style } = splitPrimitiveProps(props);
  return (
    <span
      style={{
        display: 'inline-block',
        width: props.size === 'xl' ? 42 : 28,
        height: props.size === 'xl' ? 42 : 28,
        border: `${thickness} solid var(--app-divider)`,
        borderTopColor: colorMap[color] ?? color,
        borderRadius: '50%',
        animation: 'onboarding-spin 800ms linear infinite',
        ...style,
      }}
    />
  );
}

function Tooltip({ label, children }: PrimitiveProps) {
  return <span title={label} style={{ display: 'inline-flex', alignItems: 'center' }}>{children}</span>;
}

const TabsContext = React.createContext<{ index: number; onChange?: (index: number) => void } | null>(null);

function Tabs({ index = 0, onChange, children, ...props }: PrimitiveProps) {
  const Component = primitive('div');
  return (
    <TabsContext.Provider value={{ index, onChange }}>
      <Component {...props}>{children}</Component>
    </TabsContext.Provider>
  );
}

function TabList({ children, ...props }: PrimitiveProps) {
  const Component = primitive('div', { display: 'flex', gap: 4 });
  return (
    <Component {...props}>
      {React.Children.map(children, (child, index) =>
        React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<any>, { tabIndexValue: index }) : child,
      )}
    </Component>
  );
}

function Tab({ children, tabIndexValue, ...props }: PrimitiveProps) {
  const context = React.useContext(TabsContext);
  const selected = context?.index === tabIndexValue;
  const { domProps, style } = splitPrimitiveProps(props);
  return (
    <button
      type="button"
      {...domProps}
      onClick={() => context?.onChange?.(tabIndexValue)}
      style={{
        flex: 1,
        display: 'inline-flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: 40,
        padding: '0 12px',
        color: selected ? 'var(--app-accent)' : 'var(--app-text-muted)',
        background: selected ? 'var(--app-surface)' : 'transparent',
        border: '1px solid transparent',
        borderRadius: 10,
        boxShadow: selected ? shadowMap.sm : 'none',
        fontWeight: 650,
        cursor: 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function TabPanels({ children, ...props }: PrimitiveProps) {
  const Component = primitive('div');
  return (
    <Component {...props}>
      {React.Children.map(children, (child, index) =>
        React.isValidElement(child) ? React.cloneElement(child as React.ReactElement<any>, { panelIndexValue: index }) : child,
      )}
    </Component>
  );
}

function TabPanel({ children, panelIndexValue, ...props }: PrimitiveProps) {
  const context = React.useContext(TabsContext);
  if (context?.index !== panelIndexValue) return null;
  const Component = primitive('div');
  return <Component {...props}>{children}</Component>;
}

function Switch({ isChecked, onChange, id, ...props }: PrimitiveProps) {
  return (
    <label style={{ position: 'relative', display: 'inline-flex', width: props.size === 'lg' ? 48 : 42, height: props.size === 'lg' ? 26 : 24, cursor: 'pointer' }}>
      <input
        id={id}
        type="checkbox"
        checked={Boolean(isChecked)}
        onChange={onChange}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          background: isChecked ? 'var(--app-accent)' : 'var(--app-divider-strong)',
          borderRadius: 999,
          transition: 'background 140ms ease',
        }}
      />
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: isChecked ? 24 : 3,
          width: props.size === 'lg' ? 20 : 18,
          height: props.size === 'lg' ? 20 : 18,
          background: 'var(--app-surface)',
          borderRadius: '50%',
          boxShadow: shadowMap.sm,
          transition: 'left 140ms ease',
        }}
      />
    </label>
  );
}

function Link({ isExternal, children, ...props }: PrimitiveProps) {
  const { domProps, style } = splitPrimitiveProps(props);
  return (
    <a
      {...domProps}
      target={isExternal ? '_blank' : domProps.target}
      rel={isExternal ? 'noopener noreferrer' : domProps.rel}
      style={{ color: 'var(--app-accent)', textDecoration: 'none', ...style }}
    >
      {children}
    </a>
  );
}

function Alert({ children, ...props }: PrimitiveProps) {
  const Component = primitive('div', {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    color: 'var(--app-accent)',
    background: 'var(--app-accent-soft)',
    border: '1px solid var(--app-divider-strong)',
  });
  return <Component {...props}>{children}</Component>;
}

function SvgIcon({ children, size = 16, color, ...props }: PrimitiveProps & { size?: number }) {
  const { style } = splitPrimitiveProps(props);
  return (
    <svg
      width={props.boxSize ? Number(resolveResponsive(props.boxSize)) * 4 : size}
      height={props.boxSize ? Number(resolveResponsive(props.boxSize)) * 4 : size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colorMap[color] ?? color ?? 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden
    >
      {children}
    </svg>
  );
}

const CheckIcon = (props: PrimitiveProps) => (
  <SvgIcon {...props}><path d="M20 6 9 17l-5-5" /></SvgIcon>
);
const InfoIcon = (props: PrimitiveProps) => (
  <SvgIcon {...props}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></SvgIcon>
);
const AddIcon = (props: PrimitiveProps) => (
  <SvgIcon {...props}><path d="M12 5v14" /><path d="M5 12h14" /></SvgIcon>
);
const CloseIcon = (props: PrimitiveProps) => (
  <SvgIcon {...props}><path d="M18 6 6 18" /><path d="m6 6 12 12" /></SvgIcon>
);
const ExternalLinkIcon = (props: PrimitiveProps) => (
  <SvgIcon {...props}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="m10 14 11-11" /></SvgIcon>
);
const AlertIcon = InfoIcon;

function ListIcon({ as: Icon = CheckIcon, ...props }: PrimitiveProps) {
  return <Icon {...props} />;
}

const MotionBox = motion(Box);
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const TOTAL_STEPS = 5;

const quotaErrorMessage = (error: unknown, fallback: string) => {
  const data = (error as any)?.response?.data;
  if (data?.code === 'LISTINGS_QUOTA_EXCEEDED') {
    return data.message || 'Você atingiu o limite de imóveis do seu plano. Escolha um plano maior para adicionar mais imóveis.';
  }
  return fallback;
};

// ═══════════════════════════════════════
//  TIPOS
// ═══════════════════════════════════════
interface Property {
  id: number;
  titulo: string;
  id_do_anuncio: string;
  ativo: boolean;
  pictureUrl: string;
  bedrooms?: number;
  beds?: number;
  bathrooms?: number;
  guests?: number;
  rating?: number;
  isNewListing?: boolean;
  reviewCount?: number;
  propertyType?: string;
  neighborhood?: string;
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  fullAddress?: string;
  amenitiesCount?: number;
  amenities?: string[];
}

interface RegisteredProperty {
  id: string;
  titulo: string;
  id_do_anuncio: string;
  pictureUrl: string;
  ativo: boolean;
  user?: { id: string };
}

interface SelectedPropertiesState {
  [key: string]: boolean;
}

type PendingPricingProperty = {
  addressId: string;
  listId: string;
  propertyName: string;
  pictureUrl?: string | null;
  airbnbId?: string | null;
  sourceLabel?: string;
  fallbackMessage?: string;
  provisionalDailyPrice?: number | null;
};

type PricingStrategy = 'conservative' | 'balanced' | 'aggressive' | 'autonomous';
type OperationMode = 'notifications' | 'automatic';

// Sprint 4 redesign: removido `color` ciclico (green/blue/orange/purple)
// e icones emoji (🛡️⚖️🚀🤖). Identificador agora e `iconKey` para
// renderizar com SVG inline (StrategyIcon). Selecao destacada via accent var(--app-accent).
type StrategyIconKey = 'shield' | 'scale' | 'rocket' | 'sparkles';

function StrategyIcon({ iconKey }: { iconKey: StrategyIconKey }) {
  const base = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  if (iconKey === 'shield') {
    return (
      <svg {...base}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  if (iconKey === 'scale') {
    return (
      <svg {...base}>
        <path d="M16 16h6l-3-9-3 9z" />
        <path d="M2 16h6l-3-9-3 9z" />
        <path d="M7 7h10" />
        <path d="M12 7v15" />
        <path d="M8 22h8" />
      </svg>
    );
  }
  if (iconKey === 'rocket') {
    return (
      <svg {...base}>
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
        <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
      </svg>
    );
  }
  // sparkles (autonomous)
  return (
    <svg {...base}>
      <path d="M12 3l2.39 5.05L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.61-.95L12 3z" />
    </svg>
  );
}

const PRICING_PRESETS: Record<PricingStrategy, { inicial: number; final: number | null; label: string; desc: string; iconKey: StrategyIconKey }> = {
  conservative: {
    inicial: -5, final: 10,
    label: 'Mais cautelosa', desc: 'Busca manter o imóvel competitivo sem mexer demais nos preços. Boa para começar com tranquilidade.',
    iconKey: 'shield',
  },
  balanced: {
    inicial: -10, final: 20,
    label: 'Equilibrada', desc: 'Tenta equilibrar ocupação e diária média. Recomendado para a maioria dos anfitriões.',
    iconKey: 'scale',
  },
  aggressive: {
    inicial: -15, final: 35,
    label: 'Mais ousada', desc: 'Permite variações maiores em datas de alta procura. Indicada para quem já acompanha preços de perto.',
    iconKey: 'rocket',
  },
  autonomous: {
    inicial: -5, final: null,
    label: 'Automático com IA', desc: 'Modo beta. A IA ajusta com mais liberdade, mantendo limite para evitar quedas bruscas.',
    iconKey: 'sparkles',
  },
};

// ═══════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════
type OnboardingLoadStage =
  | 'idle'
  | 'checking-existing'
  | 'resolving-link'
  | 'finding-host'
  | 'fetching-listing'
  | 'fetching-profile'
  | 'filtering-listings'
  | 'registering'
  | 'creating-addresses'
  | 'pricing'
  | 'checking-airbnb-availability'
  | 'finding-available-dates'
  | 'calculating-daily-rate'
  | 'manual-price-required'
  | 'saving-prices'
  | 'starting-analysis';

const onboardingStageOrder: OnboardingLoadStage[] = [
  'checking-existing',
  'resolving-link',
  'finding-host',
  'fetching-listing',
  'fetching-profile',
  'filtering-listings',
  'registering',
  'creating-addresses',
  'pricing',
  'checking-airbnb-availability',
  'finding-available-dates',
  'calculating-daily-rate',
  'manual-price-required',
  'saving-prices',
  'starting-analysis',
];

function getOnboardingLoadingStatus(stage: OnboardingLoadStage, foundCount: number): {
  eyebrow: string;
  title: string;
  body: string;
  tone: "accent" | "warn" | "neutral" | "error";
  steps: AppLoadingStep[];
} {
  const currentIndex = onboardingStageOrder.indexOf(stage);
  const status = (step: OnboardingLoadStage) => {
    const index = onboardingStageOrder.indexOf(step);
    if (stage === 'idle' || index < 0) return 'pending' as const;
    if (index < currentIndex) return 'complete' as const;
    if (index === currentIndex) return 'active' as const;
    return 'pending' as const;
  };

  if ([
    'registering',
    'creating-addresses',
    'pricing',
    'checking-airbnb-availability',
    'finding-available-dates',
    'calculating-daily-rate',
    'manual-price-required',
    'saving-prices',
    'starting-analysis',
  ].includes(stage)) {
    const needsManualPrice = stage === 'manual-price-required';

    return {
      eyebrow: needsManualPrice ? 'Fallback manual' : 'Configurando imoveis',
      title: needsManualPrice
        ? 'Precisamos da diaria base para continuar'
        : 'Estamos preparando a diaria base e as recomendacoes',
      body: needsManualPrice
        ? 'O Airbnb nao retornou uma diaria confirmada, ou a origem encontrada era provisoria. Informe o valor atual para iniciar a analise.'
        : 'Buscamos disponibilidade no Airbnb, tentamos encontrar datas futuras e calculamos a diaria antes de iniciar a analise.',
      tone: needsManualPrice ? 'warn' : 'accent',
      steps: [
        { id: 'registering', label: 'Salvar imoveis', status: status('registering') },
        { id: 'creating-addresses', label: 'Validar dados', status: status('creating-addresses') },
        { id: 'pricing', label: 'Preparar cotacao', status: status('pricing') },
        { id: 'availability', label: 'Ver disponibilidade', status: status('checking-airbnb-availability') },
        { id: 'dates', label: 'Encontrar datas', status: status('finding-available-dates') },
        { id: 'daily', label: 'Calcular diaria', status: status('calculating-daily-rate') },
        { id: 'manual', label: 'Fallback manual', status: status('manual-price-required') },
        { id: 'saving-prices', label: 'Salvar diaria', status: status('saving-prices') },
        { id: 'starting-analysis', label: 'Iniciar analise', status: status('starting-analysis') },
      ],
    };
  }

  return {
    eyebrow: 'Buscando no Airbnb',
    title: foundCount > 0 ? `Encontramos ${foundCount} imoveis ate agora` : 'Estamos buscando informacoes do Airbnb',
    body: 'Abrimos o link, identificamos o anfitriao e validamos os anuncios publicos antes de mostrar a lista.',
    tone: 'accent',
    steps: [
      { id: 'checking-existing', label: 'Checar conta', status: status('checking-existing') },
      { id: 'resolving-link', label: 'Abrir link', status: status('resolving-link') },
      { id: 'finding-host', label: 'Identificar host', status: status('finding-host') },
      { id: 'fetching-profile', label: 'Buscar imoveis', status: status('fetching-profile') },
      { id: 'filtering-listings', label: 'Validar lista', status: status('filtering-listings') },
    ],
  };
}

function OnboardingWizardContent() {
  const toast = useToastCompat();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAddOnly = searchParams.get('addOnly') === 'true';

  const [step, setStep] = useState(1);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [isAnnual, setIsAnnual] = useState(true);
  const [hasGrantedAccess, setHasGrantedAccess] = useState(false);

  useEffect(() => {
    setLoadingPlans(true);
    getPlans()
      .then((data) => {
        setPlans(data);
        setLoadingPlans(false);
      })
      .catch((err) => {
        console.error("Erro ao carregar planos:", err);
        setLoadingPlans(false);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchSubscription()
      .then((subscription) => {
        if (cancelled) return;
        setHasGrantedAccess(
          subscription?.status === 'active' || subscription?.status === 'trialing',
        );
      })
      .catch(() => {
        if (!cancelled) setHasGrantedAccess(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Step 2 — Link Airbnb
  const [airbnbLink, setAirbnbLink] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingLoadStage, setOnboardingLoadStage] = useState<OnboardingLoadStage>('idle');
  const [selectedProperties, setSelectedProperties] = useState<SelectedPropertiesState>({});
  const [selectAll, setSelectAll] = useState(false);
  const [importMode, setImportMode] = useState(0); // 0 = individual, 1 = host
  const [individualLinks, setIndividualLinks] = useState<string[]>(['']);
  const [, setIndividualProperties] = useState<Property[]>([]);
  const [loadingIndividual, setLoadingIndividual] = useState(false);
  const [hostUserId, setHostUserId] = useState<string | null>(null);

  // Step 4 — Configurações do motor de IA
  const [pricingStrategy, setPricingStrategy] = useState<PricingStrategy>('balanced');
  const [operationMode, setOperationMode] = useState<OperationMode>('notifications');
  const [allRegistered, setAllRegistered] = useState(false);
  const [pendingPricingProperties, setPendingPricingProperties] = useState<PendingPricingProperty[]>([]);
  const [manualPriceDrafts, setManualPriceDrafts] = useState<Record<string, string>>({});
  const [pendingProcessListIds, setPendingProcessListIds] = useState<Array<{ id: string }>>([]);

  // =====================================================
  //  FUNÇÕES AUXILIARES
  // =====================================================

  const extractAirbnbPropertyId = (link: string): string | null => {
    if (!link || !link.includes('airbnb')) return null;
    const patterns = [
      /\/rooms\/(\d+)/,
      /airbnb\.com\.?\w*\/rooms\/(\d+)/i,
      /airbnb\.com\.?\w*\/p\/(\d+)/i
    ];
    for (const regex of patterns) {
      const match = link.match(regex);
      if (match && match[1]) return match[1];
    }
    return null;
  };

  const extractAirbnbUserId = (link: string): string | null => {
    if (!link || !link.includes('airbnb')) return null;
    const regex = /\/users\/(?:show|profile)\/(\d+)/;
    const match = link.match(regex);
    return match && match[1] ? match[1] : null;
  };

  const extractAirbnbListingId = (url: string): string | null => {
    try {
      const regex = /editor\/(\d+)\/details/;
      const match = url.match(regex);
      return match ? match[1] : null;
    } catch {
      return null;
    }
  };

  const initializeSelectedProperties = (list: Property[]) => {
    const initialSelectedState: SelectedPropertiesState = {};
    list.forEach(prop => {
      initialSelectedState[prop.id_do_anuncio] = true;
      prop.ativo = true;
    });
    setSelectedProperties(initialSelectedState);
    setSelectAll(list.length > 0);
  };

  const parseMoneyInput = (value: string): number | null => {
    const normalized = value
      .replace(/[^\d,.-]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
  };

  const runOnboardingWithTimedStages = async <T,>(
    schedule: Array<{ stage: OnboardingLoadStage; delayMs: number }>,
    action: () => Promise<T>,
  ): Promise<T> => {
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    for (const item of schedule) {
      if (item.delayMs <= 0) {
        setOnboardingLoadStage(item.stage);
      } else {
        timers.push(setTimeout(() => setOnboardingLoadStage(item.stage), item.delayMs));
      }
    }

    try {
      return await action();
    } finally {
      timers.forEach(clearTimeout);
    }
  };

  const collectPendingPricingProperties = (createdAddresses: any[]): PendingPricingProperty[] =>
    (createdAddresses ?? [])
      .reduce<PendingPricingProperty[]>((pending, address) => {
        const list = address?.list ?? {};
        const readiness = describeBasePriceReadiness(list);
        if (readiness.ready) return pending;

        const item: PendingPricingProperty = {
          addressId: address.id,
          listId: address.list?.id,
          propertyName: address.list?.titulo || `Imovel ${String(address.id).slice(0, 4)}`,
          pictureUrl: address.list?.pictureUrl ?? null,
          airbnbId: address.list?.id_do_anuncio ?? null,
          sourceLabel: readiness.sourceLabel,
          fallbackMessage: readiness.message,
          provisionalDailyPrice: readiness.dailyPrice,
        };

        if (item.addressId && item.listId) pending.push(item);
        return pending;
      }, []);

  const startRegisteredProcess = async (processListIds: Array<{ id: string }>) => {
    if (processListIds.length > 0) {
      await registerProcess(processListIds);
    }
  };

  // =====================================================
  //  PASSO 2A: Buscar imóvel INDIVIDUAL por link
  // =====================================================
  const handleAddIndividualLink = () => {
    setIndividualLinks(prev => [...prev, '']);
  };

  const handleRemoveIndividualLink = (index: number) => {
    setIndividualLinks(prev => prev.filter((_, i) => i !== index));
    // Remove a propriedade correspondente se ela já foi buscada
    setIndividualProperties(prev => prev.filter((_, i) => i !== index));
  };

  const handleIndividualLinkChange = (index: number, value: string) => {
    setIndividualLinks(prev => {
      const copy = [...prev];
      copy[index] = value;
      return copy;
    });
  };

  const fetchIndividualProperties = async () => {
    const validLinks = individualLinks.filter(l => l.trim().length > 0);
    if (validLinks.length === 0) {
      toast("Insira pelo menos um link de imóvel.", { type: "info" });
      return;
    }

    setLoadingIndividual(true);
    setOnboardingLoadStage('checking-existing');
    const fetched: Property[] = [];

    try {
      const existingProps = await getPropriedadesDropdownList();
      const existingIds = existingProps.map(p => p.id_do_anuncio).filter(Boolean);

      for (const link of validLinks) {
        try {
        // Tenta resolver URLs redirecionadas (ex: links curtos do Airbnb)
        let finalUrl = link;
        try {
          setOnboardingLoadStage('resolving-link');
          const resolved = await resolveAirbnbUrl(link);
          finalUrl = resolved.finalUrl;
        } catch {
          // Se falhar resolução, segue com o link original
        }

        // Extrai listing ID do editor ou rooms
        const editorId = extractAirbnbListingId(link);
        if (editorId) {
          finalUrl = `https://www.airbnb.com/rooms/${editorId}`;
        }

        const propertyId = extractAirbnbPropertyId(finalUrl);
        if (!propertyId) {
          toast(`Link inválido: ${link.substring(0, 50)}...`, { type: "warning" });
          continue;
        }

        // Verifica se já está na lista local ou no DB
        if (fetched.some(p => p.id_do_anuncio === propertyId)) continue;
        if (existingIds.includes(propertyId)) {
          toast(`O imóvel ${propertyId} já está cadastrado em sua conta.`, { type: "info" });
          setAllRegistered(true);
          continue;
        }

        setOnboardingLoadStage('fetching-listing');
        const info = await getPropertyQuickInfo(propertyId);
        fetched.push({
          id: 0,
          titulo: info.title,
          id_do_anuncio: propertyId,
          ativo: true,
          pictureUrl: info.pictureUrl,
          bedrooms: info.bedrooms || 0,
          beds: info.beds || 0,
          bathrooms: info.bathrooms || 0,
          guests: info.guests || 0,
          rating: info.rating || 0,
          isNewListing: info.isNewListing || false,
          reviewCount: info.reviewCount || 0,
          propertyType: info.propertyType || '',
          neighborhood: info.neighborhood || '',
          street: info.street || '',
          city: info.city || '',
          state: info.state || '',
          zipCode: info.zipCode || '',
          fullAddress: info.fullAddress || '',
          amenitiesCount: info.amenitiesCount || 0,
          amenities: info.amenities || [],
        });
      } catch (error) {
        console.error(`Erro ao buscar imóvel do link: ${link}`, error);
        toast(`Não foi possível buscar dados para: ${link.substring(0, 40)}...`, { type: "error" });
      }
      } // Fim for

      if (fetched.length > 0) {
        setIndividualProperties(fetched);
        // Combina com as que já existem
        const allProps = [...properties, ...fetched].filter(
          (v, i, a) => a.findIndex(t => t.id_do_anuncio === v.id_do_anuncio) === i
        );
        setProperties(allProps);
        initializeSelectedProperties(allProps);
        setStep(3);
      } else {
        toast("Nenhum imóvel novo encontrado. Verifique os links.", { type: "error" });
      }

    } catch (e) {
      console.error(e);
      toast("Erro ao buscar propriedades já cadastradas.", { type: "error" });
    } finally {
      setLoadingIndividual(false);
      setOnboardingLoadStage('idle');
    }
  };

  // =====================================================
  //  PASSO 2B: Buscar TODOS os imóveis do Host
  // =====================================================
  const fetchUserProperties = async () => {
    if (!airbnbLink) {
      toast("Para continuar, insira um link do Airbnb.", { type: "info" });
      return;
    }

    setIsLoading(true);
    setOnboardingLoadStage('resolving-link');
    try {
      const result = await resolveAirbnbUrl(airbnbLink);
      setAirbnbLink(result.finalUrl);

      const id = extractAirbnbListingId(airbnbLink);
      let urlEditor = null;
      if (id) {
        urlEditor = `https://www.airbnb.com/rooms/${id}`;
      }

      const propertyIdExtracted = extractAirbnbPropertyId(urlEditor ? urlEditor : result.finalUrl);

      let userIdFromGetHostId = null;
      if (propertyIdExtracted) {
        try {
          setOnboardingLoadStage('finding-host');
          const data = await getHostId(propertyIdExtracted);
          userIdFromGetHostId = data?.result.hostId;
        } catch (err) {
          console.warn('Não foi possível obter hostId via API, tentando extração do link...', err);
        }
      }

      if (propertyIdExtracted && !userIdFromGetHostId) {
        try {
          setOnboardingLoadStage('fetching-listing');
          const info = await getPropertyQuickInfo(propertyIdExtracted);
          userIdFromGetHostId = info.hostId;
        } catch (err) {
          console.warn('Nao foi possivel obter hostId via quick-info.', err);
        }
      }

      const userId = userIdFromGetHostId || extractAirbnbUserId(urlEditor ? urlEditor : result.finalUrl);
      setHostUserId(userId);

      if (!userId) {
        toast("Por favor, insira um link válido do perfil ou imóvel do Airbnb.", { type: "error" });
        setIsLoading(false);
        return;
      }

      setOnboardingLoadStage('fetching-profile');
      const listings = await getUserManagedListings(userId);

      if (!listings || listings.length === 0) {
        toast("Não encontramos imóveis neste perfil. Verifique o link.", { type: "warning" });
        setIsLoading(false);
        return;
      }

      const existingProps = await getPropriedadesDropdownList();
      const existingIds = existingProps.map(p => p.id_do_anuncio).filter(Boolean);

      setOnboardingLoadStage('filtering-listings');
      const filteredListings = listings.filter((item: any) => !existingIds.includes(item.id_do_anuncio));

      if (filteredListings.length === 0 && listings.length > 0) {
        toast("Todos os imóveis encontrados já estão cadastrados em sua conta.", { type: "info" });
        setAllRegistered(true);
        setIsLoading(false);
        return;
      }

      const mappedProperties: Property[] = filteredListings.map((item: any) => ({
        id: item.id || 0,
        titulo: item.titulo ?? item.name ?? 'Sem título',
        id_do_anuncio: item.id_do_anuncio ?? '',
        ativo: true,
        pictureUrl: item.pictureUrl ?? '',
        // Dados enriquecidos do scraping
        bedrooms: item.bedrooms,
        beds: item.beds,
        bathrooms: item.bathrooms,
        guests: item.guests ?? item.guestCapacity,
        rating: item.rating,
        isNewListing: item.isNewListing,
        reviewCount: item.reviewCount,
        propertyType: item.propertyType,
        neighborhood: item.neighborhood,
        street: item.street,
        city: item.city,
        state: item.state,
        zipCode: item.zipCode,
        fullAddress: item.fullAddress,
        amenitiesCount: item.amenitiesCount,
        amenities: item.amenities,
      }));

      setProperties(mappedProperties);
      initializeSelectedProperties(mappedProperties);
      setStep(3);
    } catch (error) {
      console.error('Erro ao buscar imóveis:', error);
      toast("Não foi possível buscar seus imóveis. Verifique o link e tente novamente.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  //  PASSO 3: Seleção & Registro
  // =====================================================
  const handlePropertyToggle = (id_do_anuncio: string) => {
    setSelectedProperties(prev => {
      const newSelected = { ...prev, [id_do_anuncio]: !prev[id_do_anuncio] };
      setSelectAll(Object.values(newSelected).every(Boolean));
      return newSelected;
    });
  };

  const handleSelectAllToggle = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    const updatedSelectedState: SelectedPropertiesState = {};
    properties.forEach(prop => {
      updatedSelectedState[prop.id_do_anuncio] = newSelectAll;
    });
    setSelectedProperties(updatedSelectedState);
  };

  const handleRegisterProperties = async () => {
    const selectedPropertiesList = properties.filter(
      prop => selectedProperties[prop.id_do_anuncio] === true
    );

    if (selectedPropertiesList.length === 0) {
      toast("Selecione pelo menos uma propriedade.", { type: "warning" });
      return;
    }

    let keepManualPriceStage = false;

    try {
      setIsLoading(true);
      setOnboardingLoadStage('registering');
      const toRegister = selectedPropertiesList.map(prop => ({
        id: prop.id,
        titulo: prop.titulo,
        id_do_anuncio: prop.id_do_anuncio,
        ativo: true,
        pictureUrl: prop.pictureUrl,
      }));

      const response = await registerProperties(toRegister);
      const registered: RegisteredProperty[] = Array.isArray((response as any)?.data)
        ? (response as any).data
        : (response as any);

      const addressesToRegister = registered.map((prop: any) => {
        return {
          cep: null,
          numero: null,
          logradouro: null,
          bairro: null,
          cidade: null,
          estado: null,
          list: { id: prop.id_do_anuncio },
        };
      });

      const createdAddresses = await runOnboardingWithTimedStages(
        [
          { stage: 'creating-addresses', delayMs: 0 },
          { stage: 'pricing', delayMs: 700 },
          { stage: 'checking-airbnb-availability', delayMs: 1200 },
          { stage: 'finding-available-dates', delayMs: 2600 },
          { stage: 'calculating-daily-rate', delayMs: 4200 },
        ],
        () => createMultipleAddresses(addressesToRegister),
      );

      const processListIds = registered
        .map((prop: any) => prop?.id)
        .filter(Boolean)
        .map((id: string) => ({ id }));

      if (hostUserId) {
        try {
          await updateProfileById(undefined as any, { airbnbHostId: hostUserId });
        } catch (e) {
          console.error("Erro ao salvar airbnbHostId do usuário", e);
        }
      }

      setOnboardingLoadStage('calculating-daily-rate');
      const pendingPricing = collectPendingPricingProperties(createdAddresses as any[]);
      if (pendingPricing.length > 0) {
        setPendingPricingProperties(pendingPricing);
        setPendingProcessListIds(processListIds);
        setManualPriceDrafts(
          pendingPricing.reduce((acc, property) => ({ ...acc, [property.addressId]: '' }), {}),
        );
        keepManualPriceStage = true;
        setOnboardingLoadStage('manual-price-required');
        toast("Nao encontramos uma diaria confiavel no Airbnb. Informe a diaria base para concluir.", { type: "info" });
        return;
      }

      setOnboardingLoadStage('starting-analysis');
      await startRegisteredProcess(processListIds);
      toast(`${selectedPropertiesList.length} propriedade(s) registrada(s) com sucesso!`, { type: "success" });
      if (isAddOnly) {
        setTimeout(() => router.push('/properties'), 500);
      } else {
        setStep(4);
      }

    } catch (error) {
      console.error('Erro ao registrar propriedades:', error);
      toast(quotaErrorMessage(error, "Falha ao configurar propriedades. Tente novamente."), { type: "error" });
    } finally {
      setIsLoading(false);
      if (!keepManualPriceStage) {
        setOnboardingLoadStage('idle');
      }
    }
  };

  const handleSaveManualPricesAndContinue = async () => {
    if (pendingPricingProperties.length === 0) return;

    const parsedByAddress = pendingPricingProperties.map((property) => ({
      property,
      manualDailyPrice: parseMoneyInput(manualPriceDrafts[property.addressId] ?? ''),
    }));

    const invalid = parsedByAddress.find((item) => !item.manualDailyPrice);
    if (invalid) {
      toast("Informe uma diaria base valida para todos os imoveis. Sem esse valor, a Urban AI nao inicia a analise.", { type: "warning" });
      return;
    }

    setIsLoading(true);
    let manualSaveSucceeded = false;
    try {
      setOnboardingLoadStage('saving-prices');
      for (const item of parsedByAddress) {
        await updatePropertyPricingInputs(item.property.addressId, {
          manualDailyPrice: item.manualDailyPrice,
          averageMonthlyRevenue: null,
        });
      }

      setOnboardingLoadStage('starting-analysis');
      await startRegisteredProcess(pendingProcessListIds);
      setPendingPricingProperties([]);
      setManualPriceDrafts({});
      setPendingProcessListIds([]);
      manualSaveSucceeded = true;
      toast("Precos base salvos. Imoveis configurados com sucesso!", { type: "success" });

      if (isAddOnly) {
        setTimeout(() => router.push('/properties'), 500);
      } else {
        setStep(4);
      }
    } catch (error) {
      console.error('Erro ao salvar precos manuais:', error);
      setOnboardingLoadStage('manual-price-required');
      toast("Nao conseguimos salvar os precos base. Tente novamente.", { type: "error" });
    } finally {
      setIsLoading(false);
      if (manualSaveSucceeded) {
        setOnboardingLoadStage('idle');
      }
    }
  };

  // =====================================================
  //  STEP 4: Salvar configurações do motor de IA
  // =====================================================
  const shouldSkipBillingStep = async () => {
    if (hasGrantedAccess) return true;

    try {
      const subscription = await fetchSubscription();
      const active =
        subscription?.status === 'active' || subscription?.status === 'trialing';
      if (active) setHasGrantedAccess(true);
      return active;
    } catch {
      return false;
    }
  };

  const handleSaveConfig = async () => {
    if (pendingPricingProperties.length > 0) {
      setStep(3);
      toast("Antes de ajustar as recomendacoes, informe a diaria base dos imoveis pendentes.", { type: "warning" });
      return;
    }

    setIsLoading(true);
    try {
      const profile = await getProfileById();
      // Salvar percentuais baseado na estratégia selecionada
      const preset = PRICING_PRESETS[pricingStrategy];

      await updateProfileById(profile.id, {
        pricingStrategy,
        operationMode,
        percentualInicial: preset.inicial,
        percentualFinal: preset.final,
      });

      if (await shouldSkipBillingStep()) {
        toast("Configurações salvas! Seu acesso já está liberado.", { type: "success" });
        router.replace('/dashboard');
        return;
      }

      toast("Configurações salvas! Vamos ativar o seu sistema.", { type: "success" });
      setStep(5);
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast("Erro ao salvar. Tente novamente.", { type: "error" });
    } finally {
      setIsLoading(false);
      setOnboardingLoadStage('idle');
    }
  };

  // =====================================================
  //  STEP 5: Paywall — Checkout Stripe (F6.5 — cobrança por imóvel)
  // =====================================================
  const handleCheckout = async (planId: string) => {
    setIsLoading(true);
    try {
      const billingCycle = isAnnual ? 'annual' : 'monthly';
      // F6.5: número de imóveis vai como quantity → Stripe cobra price × quantity
      // selectedCount vem do step anterior (imóveis Airbnb selecionados pelo anfitrião).
      // Default 1 caso o user pule etapas e chegue aqui sem ter selecionado.
      const quantity = Math.max(1, Number(selectedCount) || 1);
      const { sessionId } = await createCheckoutSession(planId, billingCycle, quantity);
      const stripe = await stripePromise;
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      } else {
        toast("Erro ao carregar o Stripe.", { type: "error" });
      }
    } catch (err) {
      console.error(err);
      toast("Erro ao iniciar o pagamento. Tente novamente.", { type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  // =====================================================
  //  ANIMAÇÕES
  // =====================================================
  const pageVariants = {
    initial: { opacity: 0, x: 40 },
    in: { opacity: 1, x: 0 },
    out: { opacity: 0, x: -40 }
  };

  const selectedCount = Object.values(selectedProperties).filter(Boolean).length;
  const onboardingLoadingStatus = getOnboardingLoadingStatus(onboardingLoadStage, properties.length);
  const showOnboardingLoadingStatus =
    onboardingLoadStage !== 'idle' && (isLoading || loadingIndividual || pendingPricingProperties.length > 0);

  return (
    <Flex w="100%" direction="column" align="center" bg="transparent">
      {/* Barra de progresso */}
      <Container maxW="container.md" mb={2}>
        <HStack spacing={0} w="100%">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <Box key={i} flex={1} h="4px" bg={i < step ? "var(--app-accent)" : "gray.200"} borderRadius="full"
              mx={0.5} transition="background 0.4s ease" />
          ))}
        </HStack>
        <Text fontSize="xs" color="gray.400" textAlign="right" mt={1}>
          Etapa {step} de {TOTAL_STEPS}
        </Text>
      </Container>

      <Container maxW="container.md" pb={12}>
        <MotionBox
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          bg="white"
          borderRadius="2xl"
          boxShadow="0 4px 24px rgba(0,0,0,0.06)"
          p={{ base: 6, md: 12 }}
          overflow="hidden"
        >
          <AnimatePresence mode="wait">

            {/* ════════════════════════════════════════════════
                PASSO 1: Boas Vindas
            ════════════════════════════════════════════════ */}
            {step === 1 && (
              <MotionBox key="step1" initial="initial" animate="in" exit="out"
                variants={pageVariants} transition={{ duration: 0.4 }}>
                <VStack spacing={6} align="center" textAlign="center">
                  <Heading size="xl" color="gray.800" lineHeight="shorter" mt={4}>
                    Bem-vindo ao Urban AI
                  </Heading>
                  <Text fontSize="lg" color="gray.500" maxW="440px" lineHeight="tall">
                    A Urban AI analisa seu mercado local, eventos próximos e anúncios parecidos
                    para sugerir preços melhores para seus imóveis do Airbnb. No começo, você
                    acompanha as recomendações antes de qualquer automação.
                  </Text>
                  <Text fontSize="sm" color="gray.400" maxW="380px">
                    O setup inicial leva menos de 2 minutos.
                  </Text>

                  <Button
                    mt={4}
                    bg="var(--app-accent)"
                    color="white"
                    _hover={{ bg: 'var(--app-accent-hover)', transform: 'translateY(-2px)', boxShadow: 'lg' }}
                    _active={{ bg: 'var(--app-accent-hover)' }}
                    size="lg"
                    px={10}
                    h="56px"
                    fontSize="lg"
                    transition="all 0.2s"
                    onClick={() => setStep(2)}
                  >
                    Começar configuração
                  </Button>
                </VStack>
              </MotionBox>
            )}

            {/* ════════════════════════════════════════════════
                PASSO 2: Inserção do Link do Airbnb (TABS)
            ════════════════════════════════════════════════ */}
            {step === 2 && (
              <MotionBox key="step2" initial="initial" animate="in" exit="out"
                variants={pageVariants} transition={{ duration: 0.4 }}>
                <VStack spacing={6} align="stretch">
                  <Box textAlign="center">
                    <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase"
                      letterSpacing="widest" mb={2}>Passo 1 de 3</Text>
                    <Heading size="lg" mb={3} color="gray.800">Conecte seus Imóveis</Heading>
                    <Text color="gray.500" maxW="440px" mx="auto">
                      Importe seus imóveis colando o link de um <strong>anúncio individual</strong> ou
                      do seu <strong>perfil de anfitrião</strong> para buscar todos de uma vez.
                    </Text>
                  </Box>

                  <Tabs
                    index={importMode}
                    onChange={(idx: number) => setImportMode(idx)}
                    variant="soft-rounded"
                    colorScheme="blue"
                    isFitted
                  >
                    <TabList bg="gray.50" p={1} borderRadius="xl">
                      <Tab
                        borderRadius="lg"
                        fontWeight="semibold"
                        fontSize="sm"
                        _selected={{ bg: 'white', color: 'blue.600', boxShadow: 'sm' }}
                      >
                        <HStack spacing={2}>
                          <Home size={16} strokeWidth={1.8} />
                          <Text>Imóvel Individual</Text>
                        </HStack>
                      </Tab>
                      <Tab
                        borderRadius="lg"
                        fontWeight="semibold"
                        fontSize="sm"
                        _selected={{ bg: 'white', color: 'blue.600', boxShadow: 'sm' }}
                      >
                        <HStack spacing={2}>
                          <Users size={16} strokeWidth={1.8} />
                          <Text>Importar Tudo (Host)</Text>
                        </HStack>
                      </Tab>
                    </TabList>

                    <TabPanels mt={4}>
                      {/* ── TAB 0: IMÓVEL INDIVIDUAL ── */}
                      <TabPanel px={0}>
                        <VStack spacing={4} align="stretch">
                          <Text fontSize="sm" color="gray.500">
                            Cole o link de cada imóvel do Airbnb que deseja monitorar.
                            Você pode adicionar vários de uma vez.
                          </Text>

                          {individualLinks.map((link, index) => (
                            <HStack key={index}>
                              <Input
                                size="lg" type="url"
                                placeholder="https://www.airbnb.com.br/rooms/12345678"
                                value={link}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleIndividualLinkChange(index, e.target.value)}
                                focusBorderColor="blue.500"
                                bg="gray.50" border="2px solid" borderColor="gray.200"
                                _hover={{ borderColor: "gray.300" }} h="52px"
                              />
                              {individualLinks.length > 1 && (
                                <IconButton
                                  aria-label="Remover link"
                                  icon={<CloseIcon />}
                                  size="sm"
                                  variant="ghost"
                                  colorScheme="red"
                                  onClick={() => handleRemoveIndividualLink(index)}
                                />
                              )}
                            </HStack>
                          ))}

                          <Button
                            leftIcon={<AddIcon />}
                            variant="outline"
                            size="sm"
                            colorScheme="blue"
                            onClick={handleAddIndividualLink}
                            alignSelf="flex-start"
                          >
                            Adicionar outro imóvel
                          </Button>

                          <Flex gap={4} mt={2}>
                            <Button variant="ghost" size="lg" onClick={() => setStep(1)} color="gray.500">
                              Voltar
                            </Button>
                            <Button
                              bg="var(--app-accent)" color="white" _hover={{ bg: 'var(--app-accent-hover)' }}
                              _active={{ bg: 'var(--app-surface-elevated)' }} size="lg" flex={1}
                              isLoading={loadingIndividual}
                              loadingText="Buscando imóveis..."
                              onClick={fetchIndividualProperties}
                            >
                              Buscar {individualLinks.filter(l => l.trim()).length === 1 ? 'imóvel' : 'imóveis'}
                            </Button>
                          </Flex>
                          {allRegistered && (
                            <Button
                              variant="outline" colorScheme="green" size="lg" w="100%" mt={2}
                              onClick={() => isAddOnly ? router.push('/properties') : setStep(4)}
                            >
                              Meus imóveis já estão cadastrados — Avançar
                            </Button>
                          )}
                        </VStack>
                      </TabPanel>

                      {/* ── TAB 1: HOST / PERFIL ── */}
                      <TabPanel px={0}>
                        <VStack spacing={4} align="stretch">
                          <Text fontSize="sm" color="gray.500">
                            Cole a URL do seu perfil de anfitrião ou de qualquer anúncio seu.
                            Vamos procurar seus imóveis e mostrar o que encontramos antes de continuar.
                          </Text>

                          <FormControl>
                            <Input
                              size="lg" type="url"
                              placeholder="https://www.airbnb.com.br/users/show/123456789"
                              value={airbnbLink}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAirbnbLink(e.target.value)}
                              focusBorderColor="blue.500"
                              bg="gray.50" border="2px solid" borderColor="gray.200"
                              _hover={{ borderColor: "gray.300" }} h="52px"
                            />
                            <Text fontSize="xs" mt={1} color="gray.400">
                              Aceita links de /users/show/ID, /rooms/ID ou link da área de editor
                            </Text>
                          </FormControl>

                          <Flex gap={4} mt={2}>
                            <Button variant="ghost" size="lg" onClick={() => setStep(1)} color="gray.500">
                              Voltar
                            </Button>
                            <Button
                              bg="var(--app-accent)" color="white" _hover={{ bg: 'var(--app-accent-hover)' }}
                              _active={{ bg: 'var(--app-surface-elevated)' }} size="lg" flex={1}
                              isLoading={isLoading}
                              loadingText="Rastreando imóveis..."
                              onClick={fetchUserProperties}
                            >
                              Buscar todas as propriedades
                            </Button>
                          </Flex>
                          {allRegistered && (
                            <Button
                              variant="outline" colorScheme="green" size="lg" w="100%" mt={2}
                              onClick={() => isAddOnly ? router.push('/properties') : setStep(4)}
                            >
                              Meus imóveis já estão cadastrados — Avançar
                            </Button>
                          )}
                        </VStack>
                      </TabPanel>
                    </TabPanels>
                  </Tabs>
                  {showOnboardingLoadingStatus && step === 2 && (
                    <AppLoadingStatus
                      compact
                      eyebrow={onboardingLoadingStatus.eyebrow}
                      title={onboardingLoadingStatus.title}
                      body={onboardingLoadingStatus.body}
                      steps={onboardingLoadingStatus.steps}
                      tone={onboardingLoadingStatus.tone}
                    />
                  )}
                </VStack>
              </MotionBox>
            )}

            {/* ════════════════════════════════════════════════
                PASSO 3: Seleção das Propriedades
            ════════════════════════════════════════════════ */}
            {step === 3 && (
              <MotionBox key="step3" initial="initial" animate="in" exit="out"
                variants={pageVariants} transition={{ duration: 0.4 }}>
                <VStack spacing={6} align="stretch">
                  <Box textAlign="center">
                    <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase"
                      letterSpacing="widest" mb={2}>Passo 2 de 3</Text>
                    <Heading size="lg" mb={2} color="gray.800">Selecionar Imóveis</Heading>
                    <Text color="gray.500">
                      Encontramos <strong>{properties.length}</strong> {properties.length === 1 ? 'imóvel' : 'imóveis'}.
                      Ative os que deseja monitorar com a inteligência do Urban AI.
                    </Text>
                    {hostUserId && (
                      <Link
                        href={`https://www.airbnb.com/users/profile/${hostUserId}`}
                        isExternal
                        color="blue.500"
                        fontSize="sm"
                        fontWeight="medium"
                        mt={1}
                        _hover={{ color: 'blue.600', textDecoration: 'underline' }}
                      >
                        Ver perfil do anfitrião no Airbnb <ExternalLinkIcon mx="2px" />
                      </Link>
                    )}
                  </Box>

                  {showOnboardingLoadingStatus && step === 3 && (
                    <AppLoadingStatus
                      eyebrow={onboardingLoadingStatus.eyebrow}
                      title={onboardingLoadingStatus.title}
                      body={onboardingLoadingStatus.body}
                      steps={onboardingLoadingStatus.steps}
                      tone={onboardingLoadingStatus.tone}
                    />
                  )}

                  {pendingPricingProperties.length > 0 && (
                    <Box p={4} bg="var(--app-accent-soft)" borderRadius="lg" border="1px solid" borderColor="var(--app-divider-strong)">
                      <VStack spacing={4} align="stretch">
                        <Box>
                          <Text fontWeight="bold" color="gray.800">Informar diaria base</Text>
                          <Text fontSize="sm" color="gray.600" mt={1}>
                            O Airbnb nao retornou uma diaria confirmada para estes imoveis, ou retornou apenas uma fonte provisoria. Informe a diaria atual para concluir a configuracao e iniciar a analise.
                          </Text>
                        </Box>
                        {pendingPricingProperties.map((property) => (
                          <Flex key={property.addressId} gap={3} align="center" bg="white" p={3} borderRadius="md" border="1px solid" borderColor="gray.200">
                            {property.pictureUrl ? (
                              <Image src={property.pictureUrl} alt={property.propertyName} w="58px" h="44px" objectFit="cover" borderRadius="md" flexShrink={0} />
                            ) : (
                              <Box w="58px" h="44px" bg="gray.200" borderRadius="md" flexShrink={0} />
                            )}
                            <Box flex={1} minW={0}>
                              <Text fontSize="sm" fontWeight="bold" color="gray.800" whiteSpace="nowrap" overflow="hidden" textOverflow="ellipsis">
                                {property.propertyName}
                              </Text>
                              {property.airbnbId && (
                                <Text fontSize="2xs" color="gray.500" fontFamily="mono">{property.airbnbId}</Text>
                              )}
                              <Text fontSize="2xs" color="var(--app-warning)" lineHeight="short" mt={1}>
                                {property.fallbackMessage}
                                {property.provisionalDailyPrice
                                  ? ` Valor encontrado: R$ ${property.provisionalDailyPrice.toFixed(2)} (${property.sourceLabel ?? 'fonte nao informada'}).`
                                  : ` Fonte: ${property.sourceLabel ?? 'fonte nao informada'}.`}
                              </Text>
                            </Box>
                            <Box w="160px">
                              <Input
                                placeholder="R$ 350"
                                value={manualPriceDrafts[property.addressId] ?? ''}
                                onChange={(event: any) =>
                                  setManualPriceDrafts((prev) => ({ ...prev, [property.addressId]: event.target.value }))
                                }
                                inputMode="decimal"
                                disabled={isLoading}
                              />
                            </Box>
                          </Flex>
                        ))}
                      </VStack>
                    </Box>
                  )}

                  {pendingPricingProperties.length === 0 && (
                  <Box p={4} bg="gray.50" borderRadius="lg" border="1px solid" borderColor="gray.200">
                    <FormControl display="flex" alignItems="center" justifyContent="space-between"
                      mb={4} pb={4} borderBottom="1px solid" borderColor="gray.200">
                      <FormLabel mb="0" fontWeight="bold" color="gray.800">
                        Ativar todos ({properties.length})
                      </FormLabel>
                      <Switch
                        size="lg"
                        isChecked={selectAll}
                        onChange={handleSelectAllToggle}
                      />
                    </FormControl>

                    <Stack spacing={3} maxH="450px" overflowY="auto" pr={2}>
                      {properties.map((property) => (
                        <Box
                          key={property.id_do_anuncio}
                          bg="white" p={4} borderRadius="lg"
                          border="1px solid"
                          borderColor={selectedProperties[property.id_do_anuncio] ? 'blue.300' : 'gray.200'}
                          boxShadow={selectedProperties[property.id_do_anuncio] ? 'md' : 'sm'}
                          transition="all 0.2s"
                          _hover={{ borderColor: 'blue.200', boxShadow: 'md' }}
                        >
                          {/* Cabeçalho: Imagem + Info + Toggle */}
                          <Flex justify="space-between" align="start" mb={3}>
                            <Flex gap={3} flex={1}>
                              {property.pictureUrl ? (
                                <Image src={property.pictureUrl} alt={property.titulo}
                                  w="90px" h="68px" objectFit="cover" borderRadius="md" flexShrink={0} />
                              ) : (
                                <Box w="90px" h="68px" bg="gray.200" borderRadius="md" flexShrink={0} />
                              )}
                              <Box flex={1} minW={0}>
                                {/* Tipo do imóvel como título limpo */}
                                <Text fontWeight="bold" color="gray.800" fontSize="sm"
                                  lineHeight="tight" mb={1}>
                                  {property.propertyType && property.propertyType !== 'Unknown'
                                    ? property.propertyType
                                    : property.titulo}
                                </Text>

                                {/* Badges: Rating */}
                                <HStack spacing={2} flexWrap="wrap" mb={1}>
                                  {(property.rating !== undefined && property.rating > 0) ? (
                                    <Badge
                                      bg="var(--app-accent-soft)"
                                      color="var(--app-accent)"
                                      fontSize="2xs"
                                      borderRadius="full"
                                      px={2}
                                    >
                                      {property.rating.toFixed(2)}
                                      {(property.reviewCount !== undefined && property.reviewCount > 0) &&
                                        ` (${property.reviewCount})`}
                                    </Badge>
                                  ) : property.isNewListing ? (
                                    <Badge bg="var(--app-accent)" color="white" fontSize="2xs" borderRadius="full" px={2}>
                                      Novidade
                                    </Badge>
                                  ) : null}
                                </HStack>

                                {/* Endereço completo */}
                                {(property.street || property.neighborhood || property.city) && (
                                  <Text fontSize="2xs" color="gray.500" lineHeight="short" mb={0.5}>
                                    {[property.street, property.neighborhood].filter(Boolean).join(', ')}
                                    {property.city && (
                                      <> — {property.city}{property.state ? `-${property.state}` : ''}</>
                                    )}
                                    {property.zipCode && ` (${property.zipCode})`}
                                  </Text>
                                )}

                                {/* Link do anúncio no Airbnb */}
                                <Link
                                  href={`https://www.airbnb.com/rooms/${property.id_do_anuncio}`}
                                  isExternal
                                  fontSize="2xs"
                                  color="blue.400"
                                  fontFamily="mono"
                                  _hover={{ color: 'blue.600', textDecoration: 'underline' }}
                                >
                                  {property.id_do_anuncio} <ExternalLinkIcon mx="1px" boxSize="10px" />
                                </Link>
                              </Box>
                            </Flex>
                            <Switch
                              size="md"
                              isChecked={selectedProperties[property.id_do_anuncio] || false}
                              onChange={() => handlePropertyToggle(property.id_do_anuncio)} />
                          </Flex>

                          {/* Detalhes do imóvel — sempre visíveis */}
                          <Flex gap={4} flexWrap="wrap" px={1} py={2}
                            bg="gray.50" borderRadius="md" justify="center"
                            fontSize="xs" color="gray.700" fontWeight="medium">
                            {(property.bedrooms !== undefined && property.bedrooms > 0) && (
                              <Text>
                                {property.bedrooms} {property.bedrooms === 1 ? 'quarto' : 'quartos'}
                              </Text>
                            )}
                            {(property.beds !== undefined && property.beds > 0) && (
                              <Text>
                                {property.beds} {property.beds === 1 ? 'cama' : 'camas'}
                              </Text>
                            )}
                            {(property.bathrooms !== undefined && property.bathrooms > 0) && (
                              <Text>
                                {property.bathrooms} {property.bathrooms === 1 ? 'banheiro' : 'banheiros'}
                              </Text>
                            )}
                            {(property.guests !== undefined && property.guests > 0) && (
                              <Text>
                                {property.guests} {property.guests === 1 ? 'hóspede' : 'hóspedes'}
                              </Text>
                            )}
                            {(property.amenitiesCount !== undefined && property.amenitiesCount > 0) && (
                              <Text>
                                {property.amenitiesCount} itens disponíveis
                              </Text>
                            )}
                          </Flex>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                  )}

                  <Flex gap={4} mt={2}>
                    <Button variant="ghost" size="lg" onClick={() => setStep(2)} color="gray.500"
                      isDisabled={isLoading || pendingPricingProperties.length > 0}>
                      Voltar
                    </Button>
                    <Button bg="var(--app-accent)" color="white" _hover={{ bg: 'var(--app-accent-hover)' }} size="lg" flex={1}
                      onClick={pendingPricingProperties.length > 0 ? handleSaveManualPricesAndContinue : handleRegisterProperties}
                      isDisabled={
                        pendingPricingProperties.length > 0
                          ? pendingPricingProperties.some((property) => !parseMoneyInput(manualPriceDrafts[property.addressId] ?? ''))
                          : selectedCount === 0
                      }
                      isLoading={isLoading}
                      loadingText={
                        pendingPricingProperties.length > 0
                          ? "Salvando diaria..."
                          : onboardingLoadStage === 'calculating-daily-rate'
                            ? "Calculando diaria..."
                            : "Registrando..."
                      }>
                      {pendingPricingProperties.length > 0
                        ? "Salvar diaria e continuar"
                        : `Registrar ${selectedCount} ${selectedCount === 1 ? 'imóvel' : 'imóveis'}`}
                    </Button>
                  </Flex>
                </VStack>
              </MotionBox>
            )}

            {/* ════════════════════════════════════════════════
                PASSO 4: Configurações do Motor de IA (Expandido)
            ════════════════════════════════════════════════ */}
            {step === 4 && (
              <MotionBox key="step4" initial="initial" animate="in" exit="out"
                variants={pageVariants} transition={{ duration: 0.4 }}>
                <VStack spacing={8} align="stretch">
                  <Box textAlign="center">
                    <Text fontSize="xs" color="gray.400" fontWeight="bold" textTransform="uppercase"
                      letterSpacing="widest" mb={2}>Passo 3 de 3</Text>
                    <Heading size="lg" mb={3} color="gray.800">Ajustar as recomendações</Heading>
                    <Text color="gray.500" maxW="440px" mx="auto">
                      Escolha o quanto você quer que as sugestões sejam cautelosas ou ousadas.
                      Você poderá mudar isso depois.
                    </Text>
                  </Box>

                  {/* ── Estratégia de Precificação ── */}
                  <Box>
                    <Flex align="center" gap={2} mb={4}>
                      <Text fontWeight="bold" color="gray.800" fontSize="md">
                        Estilo das sugestões de preço
                      </Text>
                      <Tooltip label="Define o quanto a Urban AI pode sugerir subir ou baixar preços em relação ao mercado."
                        hasArrow placement="top">
                        <InfoIcon color="gray.400" boxSize={3.5} />
                      </Tooltip>
                    </Flex>

                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={3}>
                      {(Object.entries(PRICING_PRESETS) as [PricingStrategy, typeof PRICING_PRESETS[PricingStrategy]][]).map(
                        ([key, preset]) => {
                          const isSelected = pricingStrategy === key;
                          return (
                            <Box
                              key={key}
                              p={4}
                              borderRadius="xl"
                              border="2px solid"
                              borderColor={isSelected ? 'var(--app-accent)' : 'gray.200'}
                              bg={isSelected ? 'var(--app-accent-soft)' : 'gray.50'}
                              cursor="pointer"
                              transition="all 0.2s"
                              _hover={{
                                borderColor: isSelected ? 'var(--app-accent)' : 'gray.300',
                                transform: 'translateY(-2px)',
                                boxShadow: 'md'
                              }}
                              onClick={() => setPricingStrategy(key)}
                            >
                              <VStack spacing={2} align="start">
                                <Flex wrap="wrap" gap={2} alignItems="center">
                                  <Box
                                    color={isSelected ? 'var(--app-accent)' : 'gray.500'}
                                    display="inline-flex"
                                  >
                                    <StrategyIcon iconKey={preset.iconKey} />
                                  </Box>
                                  <Text fontWeight="bold" color="gray.800" fontSize="sm" lineHeight="1">
                                    {preset.label}
                                  </Text>
                                  {key === 'balanced' && (
                                    <Badge bg="var(--app-accent)" color="white" fontSize="0.6rem" px={2} py={0.5} borderRadius="md">
                                      Recomendado
                                    </Badge>
                                  )}
                                </Flex>
                                <Text fontSize="xs" color="gray.500" lineHeight="short">
                                  {preset.desc}
                                </Text>
                                <HStack spacing={1} mt={1}>
                                  <Badge
                                    bg={isSelected ? 'var(--app-accent)' : 'gray.200'}
                                    color={isSelected ? 'white' : 'gray.700'}
                                    variant="solid"
                                    fontSize="0.65rem"
                                  >
                                    {preset.inicial > 0 ? '+' : ''}{preset.inicial}% a {preset.final !== null ? (preset.final > 0 ? '+' : '') + preset.final + '%' : 'IA Livre'}
                                  </Badge>
                                </HStack>
                              </VStack>
                            </Box>
                          );
                        }
                      )}
                    </SimpleGrid>
                  </Box>

                  {/* ── Modo de Operação ── */}
                  <Box>
                    <Flex align="center" gap={2} mb={4}>
                      <Text fontWeight="bold" color="gray.800" fontSize="md">
                        Como você quer receber as mudanças
                      </Text>
                      <Tooltip label="No beta, recomendamos começar com aprovação manual. O automático pela Stays é liberado aos poucos."
                        hasArrow placement="top">
                        <InfoIcon color="gray.400" boxSize={3.5} />
                      </Tooltip>
                    </Flex>

                    <SimpleGrid columns={{ base: 1, md: 2 }} spacing={3}>
                      <Box
                        p={5}
                        borderRadius="xl"
                        border="2px solid"
                        borderColor={operationMode === 'notifications' ? 'blue.400' : 'gray.200'}
                        bg={operationMode === 'notifications' ? 'blue.50' : 'gray.50'}
                        cursor="pointer"
                        transition="all 0.2s"
                        _hover={{ borderColor: 'blue.300', transform: 'translateY(-1px)', boxShadow: 'sm' }}
                        onClick={() => setOperationMode('notifications')}
                      >
                        <VStack spacing={2} align="start">
                          <Flex wrap="wrap" gap={2} alignItems="center">
                            <Box as={Bell} color="blue.500" boxSize={5} />
                            <Text fontWeight="bold" color="gray.800" fontSize="sm" lineHeight="1">Apenas Notificações</Text>
                            <Badge colorScheme="blue" fontSize="0.6rem">Recomendado</Badge>
                          </Flex>
                          <Text fontSize="xs" color="gray.500" lineHeight="short">
                            Receba alertas e sugestões de preço. Você decide quando aplicar cada mudança manualmente.
                          </Text>
                        </VStack>
                      </Box>

                      <Box
                        p={5}
                        borderRadius="xl"
                        border="2px solid"
                        borderColor="gray.200"
                        bg="gray.100"
                        opacity={0.6}
                        cursor="not-allowed"
                        pointerEvents="none"
                        transition="all 0.2s"
                      >
                        <VStack spacing={2} align="start">
                          <Flex wrap="wrap" gap={2} alignItems="center">
                            <Box as={Zap} color="orange.500" boxSize={5} />
                            <Text fontWeight="bold" color="gray.800" fontSize="sm" lineHeight="1">Automático</Text>
                            <Badge colorScheme="orange" fontSize="0.6rem">Em breve</Badge>
                          </Flex>
                          <Text fontSize="xs" color="gray.500" lineHeight="short">
                            Beta privado via Stays. Só é liberado depois de conectar a conta, aceitar a autorização e testar mudanças antes de aplicar.
                          </Text>
                        </VStack>
                      </Box>
                    </SimpleGrid>
                  </Box>



                  <Flex gap={4} mt={2}>
                    {!hasGrantedAccess && (
                      <Button variant="ghost" size="lg" color="gray.500"
                        onClick={() => setStep(5)} isDisabled={isLoading}>
                        Pular
                      </Button>
                    )}
                    <Button bg="var(--app-accent)" color="white" _hover={{ bg: 'var(--app-accent-hover)' }} size="lg" flex={1}
                      onClick={handleSaveConfig}
                      isLoading={isLoading}
                      loadingText="Salvando...">
                      Salvar e continuar
                    </Button>
                  </Flex>
                </VStack>
              </MotionBox>
            )}

            {/* ════════════════════════════════════════════════
                PASSO 5: Paywall — Ativação do Plano
            ════════════════════════════════════════════════ */}
            {step === 5 && (
              <MotionBox key="step5" initial="initial" animate="in" exit="out"
                variants={pageVariants} transition={{ duration: 0.4 }}>
                <VStack spacing={8} align="stretch">
                  <Box textAlign="center">
                    <Box p={4} bg="green.50" borderRadius="full" display="inline-flex" mb={4}>
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--app-success)"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    </Box>
                    <Heading size="lg" mb={3} color="gray.800">
                      Tudo configurado!
                    </Heading>
                    <Text color="gray.500" maxW="440px" mx="auto">
                      Seus imóveis estão conectados e as recomendações estão prontas para começar.
                      Escolha um plano para receber sugestões diárias de preço.
                    </Text>
                  </Box>

                  {selectedCount > 0 && (
                    <Alert status="info" variant="subtle" borderRadius="md" mx="auto" maxW="3xl">
                      <AlertIcon />
                      <Box>
                        <AlertTitle>Você conectou {selectedCount} imóveis.</AlertTitle>
                        <AlertDescription>
                          Pelo número de imóveis, o plano que deve atender melhor agora é o <strong>{selectedCount <= 3 ? 'Starter' : selectedCount <= 10 ? 'Profissional' : 'Escala'}</strong>.
                        </AlertDescription>
                      </Box>
                    </Alert>
                  )}

                  <Flex justify="center" mb={2}>
                    <FormControl display="flex" alignItems="center" w="auto" bg="gray.50" p={2} borderRadius="full" borderWidth="1px" borderColor="gray.200">
                      <FormLabel htmlFor="onboarding-billing-toggle" mb="0" ml={4} fontWeight="bold" color={!isAnnual ? "var(--app-accent)" : "gray.500"}>
                        Mensal
                      </FormLabel>
                      <Switch
                        id="onboarding-billing-toggle"
                        size="lg"
                        isChecked={isAnnual}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsAnnual(e.target.checked)}
                      />
                      <FormLabel htmlFor="onboarding-billing-toggle" mb="0" ml={3} mr={4} fontWeight="bold" color={isAnnual ? "var(--app-accent)" : "gray.500"}>
                        Anual
                        <Badge ml={2} bg="var(--app-accent)" color="white" borderRadius="full" fontSize="0.7em" px={2}>Economize 20%</Badge>
                      </FormLabel>
                    </FormControl>
                  </Flex>

                  {loadingPlans ? (
                    <Flex justify="center" p={10}>
                      <Spinner size="xl" />
                    </Flex>
                  ) : (
                    <SimpleGrid columns={{ base: 1, md: plans.length > 2 ? 3 : 2 }} spacing={{ base: 6, lg: 8 }} w="full">
                      {plans.map((plan) => (
                        <Box
                          key={plan.id}
                          position="relative"
                          borderRadius="xl"
                          p={{ base: 5, md: 6 }}
                          bg="white"
                          boxShadow="0 4px 12px rgba(0,0,0,0.06)"
                          _hover={{ boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
                          transition="box-shadow 0.2s ease"
                          borderWidth={plan.highlightBadge ? "2px" : "1px"}
                          borderColor={plan.highlightBadge ? "var(--app-accent)" : "gray.200"}
                          textAlign="center"
                          display="flex"
                          flexDirection="column"
                        >
                          {plan.highlightBadge && (
                            <Badge
                              position="absolute"
                              top={-3}
                              right={{ base: 4, md: "auto" }}
                              left={{ md: "50%" }}
                              transform={{ md: "translateX(-50%)" }}
                              bg="var(--app-accent)"
                              color="white"
                              fontSize="0.75rem"
                              px={3}
                              py={1}
                              borderRadius="full"
                              fontWeight="bold"
                              border="2px solid white"
                            >
                              {plan.highlightBadge}
                            </Badge>
                          )}

                          <Stack mt={plan.highlightBadge ? 4 : 0} spacing={4} flex="1">
                            <Text fontSize="xl" fontWeight="extrabold" color="gray.700">
                              {plan.title}
                            </Text>

                            <Box minH="70px" display="flex" flexDirection="column" justifyContent="center">
                              {((isAnnual && plan.originalPriceAnnual) || (!isAnnual && plan.originalPrice)) && (
                                <Flex justify="center" align="center" gap={2}>
                                  <Text decoration="line-through" color="gray.400" fontSize="sm">
                                    R$ {isAnnual && plan.originalPriceAnnual ? plan.originalPriceAnnual : plan.originalPrice} {plan.period}
                                  </Text>
                                </Flex>
                              )}

                              {!plan.isCustomPrice ? (
                                <Flex justify="center" align="baseline">
                                  <Heading as="h3" size={{ base: "xl", lg: "2xl" }} color="gray.800">
                                    R$ {isAnnual && plan.priceAnnual ? plan.priceAnnual : plan.price}
                                  </Heading>
                                  {plan.period && (
                                    <Text as="span" fontSize="sm" color="gray.500" ml={1}>
                                      {plan.period}
                                    </Text>
                                  )}
                                  {plan.discountBadge && (
                                    <Badge ml={2} colorScheme="red" bg="red.900" color="red.200" px={2} py={0.5} borderRadius="md" fontSize="xs">
                                      {plan.discountBadge}
                                    </Badge>
                                  )}
                                </Flex>
                              ) : (
                                <Heading as="h3" size="lg" color="gray.800" whiteSpace="nowrap">
                                  Sob consulta
                                </Heading>
                              )}
                            </Box>

                            <Button
                              bg={plan.highlightBadge ? "var(--app-accent)" : "white"}
                              color={plan.highlightBadge ? "white" : "var(--app-accent)"}
                              borderWidth={plan.highlightBadge ? 0 : "1px"}
                              borderColor="var(--app-accent)"
                              _hover={{
                                bg: plan.highlightBadge ? "var(--app-accent-hover)" : "var(--app-accent-soft)",
                              }}
                              size="md"
                              whiteSpace="normal"
                              height="auto"
                              py={2}
                              onClick={() => {
                                if (plan.isCustomPrice) {
                                  window.open("https://wa.me/seunumerodevendas", "_blank");
                                } else {
                                  handleCheckout(plan.name);
                                }
                              }}
                              isLoading={isLoading}
                              loadingText="Processando..."
                              transition="all 0.2s"
                              w="full"
                              mt={2}
                            >
                              {plan.isCustomPrice ? "Fale com consultor" : "Selecionar plano"}
                            </Button>

                            <List spacing={2} pt={4} textAlign="left" mx="auto" w="full">
                              {plan.features.map((feat) => (
                                <ListItem
                                  key={feat}
                                  fontSize="sm"
                                  color="gray.600"
                                  display="flex"
                                  alignItems="flex-start"
                                >
                                  <ListIcon as={CheckIcon} color="var(--app-accent)" mt={1} boxSize="3" />
                                  <Text lineHeight="short">{feat}</Text>
                                </ListItem>
                              ))}
                            </List>
                          </Stack>
                        </Box>
                      ))}
                    </SimpleGrid>
                  )}

                </VStack>
              </MotionBox>
            )}

          </AnimatePresence>
        </MotionBox>
      </Container>
    </Flex>
  );
}

export default function OnboardingWizard() {
  return (
    <Suspense fallback={
      <Flex w="100vw" h="100vh" align="center" justify="center">
        <Spinner size="xl" color="var(--app-accent)" thickness="3px" />
      </Flex>
    }>
      <OnboardingWizardContent />
    </Suspense>
  );
}
