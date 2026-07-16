'use client';

import React from 'react';

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
      <span>{isLoading ? (loadingText ?? 'Carregando…') : children}</span>
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

export {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  AddIcon,
  Badge,
  Box,
  Button,
  CloseIcon,
  Container,
  ExternalLinkIcon,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  HStack,
  IconButton,
  Image,
  InfoIcon,
  Input,
  Link,
  SimpleGrid,
  Spinner,
  Stack,
  Switch,
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Text,
  Tooltip,
  VStack,
};
