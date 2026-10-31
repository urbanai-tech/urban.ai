/**
 * Mapa único conceito → ícone (DS-15). Um conceito tem um ícone; um ícone não
 * serve a dois conceitos (antes, calendário valia para "Calendário" e
 * "Eventos", tendência para "Radar" e "Ganhos", sino para "Avisos" e
 * "Comunicações"). Ao criar uma tela, procure o conceito aqui antes de
 * escolher um ícone; se faltar, inclua o ícone em `Icons.tsx` e o conceito aqui.
 */
import * as Icons from "./Icons";

/** Navegação do app (sidebar, tab bar e sheet "Mais"). */
export const NAV_ICONS = {
  today: Icons.Home,
  calendar: Icons.Calendar,
  properties: Icons.Layers,
  alerts: Icons.Bell,
  radar: Icons.Radar,
  events: Icons.Ticket,
  portfolio: Icons.Briefcase,
  map: Icons.MapPin,
  earnings: Icons.Wallet,
  owners: Icons.Users,
  plan: Icons.CreditCard,
  profile: Icons.User,
  integrations: Icons.Plug,
  communications: Icons.Megaphone,
  pricing: Icons.SlidersHorizontal,
  more: Icons.MoreHorizontal,
} as const;

export type NavIconKey = keyof typeof NAV_ICONS;

/** Conceitos de interface fora da navegação. */
export const CONCEPT_ICONS = {
  success: Icons.Check,
  warning: Icons.AlertTriangle,
  error: Icons.AlertCircle,
  info: Icons.Info,
  trendUp: Icons.TrendingUp,
  trendDown: Icons.TrendingDown,
  money: Icons.DollarSign,
  assistant: Icons.Sparkles,
  speed: Icons.Zap,
  location: Icons.MapPin,
  user: Icons.User,
  search: Icons.Search,
  add: Icons.Plus,
  edit: Icons.Edit,
  remove: Icons.Trash,
  close: Icons.Close,
  menu: Icons.Menu,
  back: Icons.ArrowLeft,
  next: Icons.ArrowRight,
  expand: Icons.ChevronDown,
  externalLink: Icons.ExternalLink,
  logout: Icons.LogOut,
  security: Icons.Shield,
  refresh: Icons.RefreshCw,
  download: Icons.Download,
  upload: Icons.Upload,
} as const;
