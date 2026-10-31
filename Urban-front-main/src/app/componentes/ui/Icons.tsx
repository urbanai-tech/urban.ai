/**
 * Conjunto único de ícones do produto (DS-15): lucide-react com traço 1,6.
 * Herdam currentColor e são decorativos (aria-hidden); o nome acessível fica no
 * botão/link que os contém. O mapa conceito → ícone está em `icon-map.ts`;
 * o admin reexporta este mesmo módulo (`admin/_components/Icons.tsx`).
 * Não crie SVG inline novo: adicione o ícone aqui e no mapa.
 */
import React from "react";
import {
  Activity as LucideActivity,
  AlertCircle as LucideAlertCircle,
  AlertTriangle as LucideAlertTriangle,
  ArrowLeft as LucideArrowLeft,
  ArrowRight as LucideArrowRight,
  Bell as LucideBell,
  Briefcase as LucideBriefcase,
  Calendar as LucideCalendar,
  Check as LucideCheck,
  ChevronDown as LucideChevronDown,
  ChevronLeft as LucideChevronLeft,
  ChevronRight as LucideChevronRight,
  CreditCard as LucideCreditCard,
  Database as LucideDatabase,
  DollarSign as LucideDollarSign,
  Download as LucideDownload,
  Ellipsis as LucideEllipsis,
  ExternalLink as LucideExternalLink,
  FileText as LucideFileText,
  House as LucideHouse,
  Inbox as LucideInbox,
  Info as LucideInfo,
  Layers as LucideLayers,
  LogOut as LucideLogOut,
  Mail as LucideMail,
  MapPin as LucideMapPin,
  Megaphone as LucideMegaphone,
  Menu as LucideMenu,
  Pencil as LucidePencil,
  Plug as LucidePlug,
  Plus as LucidePlus,
  Radar as LucideRadar,
  RefreshCw as LucideRefreshCw,
  Search as LucideSearch,
  Server as LucideServer,
  Settings as LucideSettings,
  Shield as LucideShield,
  SlidersHorizontal as LucideSlidersHorizontal,
  Sparkles as LucideSparkles,
  Ticket as LucideTicket,
  Trash2 as LucideTrash,
  TrendingDown as LucideTrendingDown,
  TrendingUp as LucideTrendingUp,
  Upload as LucideUpload,
  User as LucideUser,
  Users as LucideUsers,
  Wallet as LucideWallet,
  X as LucideX,
  Zap as LucideZap,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

export type IconProps = Omit<LucideProps, "size"> & { size?: number };
export type AppIcon = React.FC<IconProps>;

/** Traço de 1,6 e tamanho padrão por ícone, como no conjunto anterior. */
function icon(Glyph: LucideIcon, defaultSize: number, name: string): AppIcon {
  const Component: AppIcon = ({ size = defaultSize, ...rest }) => (
    <Glyph size={size} strokeWidth={1.6} aria-hidden {...rest} />
  );
  Component.displayName = name;
  return Component;
}

export const Activity = icon(LucideActivity, 16, "Activity");
export const AlertCircle = icon(LucideAlertCircle, 16, "AlertCircle");
export const AlertTriangle = icon(LucideAlertTriangle, 16, "AlertTriangle");
export const ArrowLeft = icon(LucideArrowLeft, 14, "ArrowLeft");
export const ArrowRight = icon(LucideArrowRight, 14, "ArrowRight");
export const Bell = icon(LucideBell, 16, "Bell");
export const Briefcase = icon(LucideBriefcase, 16, "Briefcase");
export const Calendar = icon(LucideCalendar, 16, "Calendar");
export const Check = icon(LucideCheck, 14, "Check");
export const ChevronDown = icon(LucideChevronDown, 14, "ChevronDown");
export const ChevronLeft = icon(LucideChevronLeft, 14, "ChevronLeft");
export const ChevronRight = icon(LucideChevronRight, 14, "ChevronRight");
export const Close = icon(LucideX, 16, "Close");
export const CreditCard = icon(LucideCreditCard, 16, "CreditCard");
export const Database = icon(LucideDatabase, 16, "Database");
export const DollarSign = icon(LucideDollarSign, 16, "DollarSign");
export const Download = icon(LucideDownload, 14, "Download");
export const Edit = icon(LucidePencil, 14, "Edit");
export const ExternalLink = icon(LucideExternalLink, 12, "ExternalLink");
export const FileText = icon(LucideFileText, 16, "FileText");
export const Home = icon(LucideHouse, 16, "Home");
export const Inbox = icon(LucideInbox, 16, "Inbox");
export const Info = icon(LucideInfo, 14, "Info");
export const Layers = icon(LucideLayers, 16, "Layers");
export const LogOut = icon(LucideLogOut, 16, "LogOut");
export const Mail = icon(LucideMail, 16, "Mail");
export const MapPin = icon(LucideMapPin, 16, "MapPin");
export const Megaphone = icon(LucideMegaphone, 16, "Megaphone");
export const Menu = icon(LucideMenu, 18, "Menu");
export const MoreHorizontal = icon(LucideEllipsis, 16, "MoreHorizontal");
export const Plug = icon(LucidePlug, 16, "Plug");
export const Plus = icon(LucidePlus, 16, "Plus");
export const Radar = icon(LucideRadar, 16, "Radar");
export const RefreshCw = icon(LucideRefreshCw, 14, "RefreshCw");
export const Search = icon(LucideSearch, 16, "Search");
export const Server = icon(LucideServer, 16, "Server");
export const Settings = icon(LucideSettings, 16, "Settings");
export const Shield = icon(LucideShield, 16, "Shield");
export const SlidersHorizontal = icon(LucideSlidersHorizontal, 16, "SlidersHorizontal");
export const Sparkles = icon(LucideSparkles, 16, "Sparkles");
export const Ticket = icon(LucideTicket, 16, "Ticket");
export const Trash = icon(LucideTrash, 14, "Trash");
export const TrendingDown = icon(LucideTrendingDown, 14, "TrendingDown");
export const TrendingUp = icon(LucideTrendingUp, 14, "TrendingUp");
export const Upload = icon(LucideUpload, 14, "Upload");
export const User = icon(LucideUser, 16, "User");
export const Users = icon(LucideUsers, 16, "Users");
export const Wallet = icon(LucideWallet, 16, "Wallet");
export const Zap = icon(LucideZap, 16, "Zap");
