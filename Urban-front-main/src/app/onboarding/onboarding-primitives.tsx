'use client';

import React from 'react';
import styles from "./onboarding-primitives.module.css";

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
      return prop.toLowerCase().includes('color') ? 'var(--theme-app-legacy-white)' : 'var(--app-surface)';
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

function cx(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(' ');
}

const primitive = (defaultAs: React.ElementType, baseStyle?: React.CSSProperties, baseClassName?: string) =>
  React.forwardRef<any, PrimitiveProps>(function Primitive({ as, children, ...props }, ref) {
    const Component = as ?? defaultAs;
    const { domProps, style } = splitPrimitiveProps(props);
    // Estilo em runtime: props de estilo estilo-Chakra (w, mt, bg...) + base computada.
    const merged: React.CSSProperties = { ...baseStyle, ...style };
    const { className: extraClassName, ...restDomProps } = domProps;
    return (
      <Component
        ref={ref}
        style={merged}
        {...restDomProps}
        className={cx(baseClassName, extraClassName) || undefined}
      >
        {children}
      </Component>
    );
  });

const Box = primitive('div');
const Flex = primitive('div', undefined, styles.flexBase);
const FormControl = primitive('div');
const FormLabel = primitive('label');
const AlertTitle = primitive('strong', undefined, styles.alertTitleBase);
const AlertDescription = primitive('span');
const Container = primitive('div', undefined, styles.containerBase);

function Text({ as = 'p', children, ...props }: PrimitiveProps) {
  const Component = primitive(as, undefined, styles.textBase);
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
  const Component = primitive(as, { fontSize }, styles.headingBase);
  return <Component {...props}>{children}</Component>;
}

function stackStyle(props: PrimitiveProps) {
  return {
    gap: spacing(Number(resolveResponsive(props.spacing ?? props.gap ?? 2))),
    alignItems: props.align,
  } as React.CSSProperties;
}

function VStack({ children, ...props }: PrimitiveProps) {
  const Component = primitive('div', stackStyle(props), cx(styles.stackBase, styles.stackColumn));
  return <Component {...props}>{children}</Component>;
}

function HStack({ children, ...props }: PrimitiveProps) {
  const Component = primitive('div', stackStyle(props), cx(styles.stackBase, styles.stackRow));
  return <Component {...props}>{children}</Component>;
}

function Stack({ children, ...props }: PrimitiveProps) {
  return <VStack {...props}>{children}</VStack>;
}

function Input(props: PrimitiveProps) {
  const { domProps, style } = splitPrimitiveProps(props);
  const { className: inputExtraClassName, ...restInputDomProps } = domProps;
  return (
    <input
      style={style}
      {...restInputDomProps}
      className={cx(styles.formInput, props.size === 'lg' && styles.formInputLarge, inputExtraClassName)}
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
  const { className: extraClassName, ...restDomProps } = domProps;
  return (
    <button
      type={restDomProps.type ?? 'button'}
      {...restDomProps}
      disabled={Boolean(disabled || isDisabled || isLoading)}
      className={cx(
        styles.button,
        props.size === 'lg' && styles.buttonLarge,
        props.size === 'sm' && styles.buttonSmall,
        isGhost && styles.buttonGhost,
        isOutline && styles.buttonOutline,
        extraClassName,
      )}
      style={style}
    >
      {leftIcon}
      <span>{isLoading ? (loadingText ?? 'Carregando…') : children}</span>
      {rightIcon}
    </button>
  );
}

function IconButton({ icon, isDisabled, disabled, ...props }: PrimitiveProps) {
  const { domProps, style } = splitPrimitiveProps(props);
  const { className: iconExtraClassName, ...restIconDomProps } = domProps;
  return (
    <button
      type="button"
      {...restIconDomProps}
      disabled={Boolean(disabled || isDisabled)}
      className={cx(
        styles.iconButton,
        props.colorScheme === 'red' && styles.iconButtonDanger,
        iconExtraClassName,
      )}
      style={style}
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
  const { className: badgeExtraClassName, ...restBadgeDomProps } = domProps;
  return (
    <span
      className={cx(
        styles.badge,
        (props.colorScheme === 'blue' || props.colorScheme === 'orange') && styles.badgeAccent,
        badgeExtraClassName,
      )}
      style={style}
      {...restBadgeDomProps}
    >
      {children}
    </span>
  );
}

const GRID_MAX_COLUMNS = 6;

function gridColumnCount(value: any, fallback: number) {
  const count = Math.floor(Number(value));
  return Number.isFinite(count) && count >= 1 ? Math.min(count, GRID_MAX_COLUMNS) : fallback;
}

// E2E-04: colunas responsivas ({ base, md }) viram classes do CSS Module (≤767px usa `base`),
// em vez de resolver só o valor de desktop e espremer a grade no celular.
function SimpleGrid({ columns = 1, spacing: gap = 4, children, ...props }: PrimitiveProps) {
  const responsive = columns && typeof columns === 'object' ? columns : null;
  const desktop = gridColumnCount(responsive ? (responsive.md ?? responsive.lg ?? responsive.base) : columns, 1);
  const mobile = gridColumnCount(responsive?.base, desktop);
  const Component = primitive(
    'div',
    { gap: cssValue('gap', gap) },
    cx(styles.gridBase, styles[`gridDesktop${desktop}`], styles[`gridMobile${mobile}`]),
  );
  return <Component {...props}>{children}</Component>;
}

function Spinner({ color = 'var(--app-accent)', thickness = '3px', ...props }: PrimitiveProps) {
  const { style } = splitPrimitiveProps(props);
  // Espessura, cor e animação vêm de props/runtime.
  const spinnerStyle: React.CSSProperties = {
    border: `${thickness} solid var(--app-divider)`,
    borderTopColor: colorMap[color] ?? color,
    animation: 'onboarding-spin 800ms linear infinite',
    ...style,
  };
  return (
    <span
      className={cx(styles.spinner, props.size === 'xl' && styles.spinnerXl)}
      style={spinnerStyle}
    />
  );
}

function Tooltip({ label, children }: PrimitiveProps) {
  return <span title={label} className={styles.inlineLabel}>{children}</span>;
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
  const Component = primitive('div', undefined, styles.tabListBase);
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
  const { className: tabExtraClassName, ...restTabDomProps } = domProps;
  // A sombra do tab selecionado usa um valor bruto do mapa de sombras (sem token equivalente).
  const tabStyle: React.CSSProperties = { boxShadow: selected ? shadowMap.sm : 'none', ...style };
  return (
    <button
      type="button"
      {...restTabDomProps}
      onClick={() => context?.onChange?.(tabIndexValue)}
      className={cx(styles.tab, selected && styles.tabSelected, tabExtraClassName)}
      style={tabStyle}
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

// Sombra do knob: valor bruto do mapa de sombras (sem token equivalente).
const SWITCH_KNOB_STYLE: React.CSSProperties = { boxShadow: shadowMap.sm };

function Switch({ isChecked, onChange, id, 'aria-label': ariaLabel, ...props }: PrimitiveProps) {
  return (
    <label className={`${styles.switchLabel} ${props.size === 'lg' ? styles.switchLarge : styles.switchSmall}`}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-label={ariaLabel}
        checked={Boolean(isChecked)}
        onChange={onChange}
        className={styles.switchInput}
      />
      <span
        className={`${styles.switchTrack} ${isChecked ? styles.switchTrackOn : styles.switchTrackOff}`}
      />
      <span
        className={cx(
          styles.switchKnob,
          props.size === 'lg' && styles.switchKnobLarge,
          isChecked && styles.switchKnobOn,
        )}
        style={SWITCH_KNOB_STYLE}
      />
    </label>
  );
}

function Link({ isExternal, children, ...props }: PrimitiveProps) {
  const { domProps, style } = splitPrimitiveProps(props);
  const { className: linkExtraClassName, ...restLinkDomProps } = domProps;
  return (
    <a
      {...restLinkDomProps}
      target={isExternal ? '_blank' : restLinkDomProps.target}
      rel={isExternal ? 'noopener noreferrer' : restLinkDomProps.rel}
      className={cx(styles.link, linkExtraClassName)}
      style={style}
    >
      {children}
    </a>
  );
}

function Alert({ children, ...props }: PrimitiveProps) {
  const Component = primitive('div', undefined, styles.alertBase);
  return <Component {...props}>{children}</Component>;
}

/** Tamanho do ícone a partir de `boxSize` (escala x4 como o resto: 3.5 → 14px; "10px" → 10). */
function resolveIconSize(boxSize: unknown, fallback: number): number {
  const resolved = resolveResponsive(boxSize);
  if (typeof resolved === 'number' && Number.isFinite(resolved) && resolved > 0) return resolved * 4;
  if (typeof resolved === 'string') {
    const parsed = parseFloat(resolved);
    if (Number.isFinite(parsed) && parsed > 0) return /rem$/.test(resolved) ? parsed * 16 : parsed;
  }
  return fallback;
}

function SvgIcon({ children, size = 16, color, ...props }: PrimitiveProps & { size?: number }) {
  const { style } = splitPrimitiveProps(props);
  // E2E-14: boxSize em string ("10px") virava NaN no atributo width/height do <svg>.
  const iconSize = resolveIconSize(props.boxSize, size);
  return (
    <svg
      width={iconSize}
      height={iconSize}
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
