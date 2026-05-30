"use client";

import { Home, Search } from "lucide-react";
import React, { useMemo } from "react";
import ReactSelect, { type SingleValue, type StylesConfig } from "react-select";
import {
  formatPropertySearchLabel,
  PropertyDropdown,
} from "../service/api";

type Option = {
  value: string;
  searchLabel: string;
  primary: string;
  secondary: string | null;
  imageUrl?: string | null;
  processing: boolean;
  statusLabel?: string | null;
  isAll?: boolean;
};

interface Props {
  propsInfo: PropertyDropdown[];
  setPropertyId: (id: string) => void;
  value?: string;
  disabled?: boolean;
  includeAllOption?: boolean;
  allOptionValue?: string;
  allOptionLabel?: string;
  placeholder?: string;
  maxWidth?: number | string;
  menuPlacement?: "auto" | "bottom" | "top";
  ariaLabel?: string;
}

const DEFAULT_MAX_WIDTH = 320;

const uiVar = {
  surface: "var(--app-surface, var(--admin-surface-elevated, #FFFFFF))",
  surfaceElevated: "var(--app-surface-elevated, var(--admin-surface-elevated, #FFFFFF))",
  surfaceMuted: "var(--app-surface-muted, var(--admin-surface-muted, rgba(255,255,255,0.04)))",
  text: "var(--app-text, var(--admin-text, #0E1116))",
  textMuted: "var(--app-text-muted, var(--admin-text-muted, rgba(14,17,22,0.62)))",
  divider: "var(--app-divider, var(--admin-divider, rgba(14,17,22,0.08)))",
  dividerStrong: "var(--app-divider-strong, var(--admin-divider-strong, rgba(14,17,22,0.14)))",
  accent: "var(--app-accent, var(--admin-accent, #E8500A))",
  accentSoft: "var(--app-accent-soft, var(--admin-accent-soft, rgba(232,80,10,0.14)))",
  success: "var(--app-success, var(--admin-success, #16A06B))",
  successSoft: "var(--app-success-soft, rgba(22,160,107,0.12))",
  warning: "var(--app-warning, var(--admin-warning, #C8810E))",
  warningSoft: "var(--app-warning-soft, rgba(200,129,14,0.12))",
  shadowOverlay: "var(--app-shadow-overlay, var(--admin-shadow-overlay, 0 18px 48px rgba(0,0,0,0.18)))",
} as const;

const PropertySelect: React.FC<Props> = ({
  propsInfo,
  setPropertyId,
  value,
  disabled = false,
  includeAllOption = false,
  allOptionValue = "",
  allOptionLabel = "Todos os imoveis",
  placeholder = "Buscar imoveis",
  maxWidth = DEFAULT_MAX_WIDTH,
  menuPlacement = "auto",
  ariaLabel = "Selecionar imovel",
}) => {
  const options = useMemo(() => {
    const mapped = propsInfo.map(mapPropertyToOption);

    if (!includeAllOption) return mapped;

    const hasAllOption = mapped.some((option) => option.value === allOptionValue);
    if (hasAllOption) {
      return mapped.map((option) =>
        option.value === allOptionValue
          ? {
              ...option,
              primary: option.primary || allOptionLabel,
              searchLabel: `${allOptionLabel} ${option.searchLabel}`,
              isAll: true,
            }
          : option,
      );
    }

    return [
      {
        value: allOptionValue,
        searchLabel: allOptionLabel,
        primary: allOptionLabel,
        secondary: null,
        imageUrl: null,
        processing: false,
        statusLabel: null,
        isAll: true,
      },
      ...mapped,
    ];
  }, [allOptionLabel, allOptionValue, includeAllOption, propsInfo]);

  const selectedOption = options.find((option) => option.value === (value ?? "")) || null;
  const selectStyles = useMemo(() => createSelectStyles(maxWidth), [maxWidth]);

  const handleChange = (selected: SingleValue<Option>) => {
    if (selected) setPropertyId(selected.value);
  };

  return (
    <ReactSelect<Option, false>
      aria-label={ariaLabel}
      classNamePrefix="urban-property-select"
      components={{ DropdownIndicator, IndicatorSeparator: null }}
      filterOption={(candidate, input) =>
        normalize(candidate.data.searchLabel).includes(normalize(input))
      }
      formatOptionLabel={(option, meta) =>
        meta.context === "menu" ? (
          <PropertyMenuOption option={option} />
        ) : (
          <PropertyValue option={option} />
        )
      }
      getOptionLabel={(option) => option.searchLabel}
      getOptionValue={(option) => option.value}
      isDisabled={disabled}
      maxMenuHeight={360}
      menuPlacement={menuPlacement}
      menuPortalTarget={typeof document === "undefined" ? undefined : document.body}
      noOptionsMessage={() => "Nenhum imovel encontrado"}
      onChange={handleChange}
      options={options}
      placeholder={placeholder}
      styles={selectStyles}
      value={selectedOption}
    />
  );
};

function mapPropertyToOption(property: PropertyDropdown): Option {
  const processing = property.setupStatus?.state
    ? property.setupStatus.state !== "ready"
    : property?.analisado !== "completed";

  return {
    value: property.id,
    searchLabel: formatPropertySearchLabel(property),
    primary: compactPropertyPrimary(property),
    secondary: compactPropertySecondary(property),
    imageUrl: property.image_url,
    processing,
    statusLabel: processing ? property.setupStatus?.publicLabel ?? "Preparando" : null,
    isAll: property.id === "",
  };
}

function compactPropertyPrimary(property?: Partial<PropertyDropdown> | null): string {
  const firstReadable =
    cleanText(property?.internalNickname) ||
    cleanText(property?.propertyName) ||
    cleanText(property?.nome) ||
    cleanText(property?.internalCode);

  if (!firstReadable || firstReadable === property?.id) return "Imovel";
  return firstReadable;
}

function compactPropertySecondary(property?: Partial<PropertyDropdown> | null): string | null {
  if (!property) return null;

  const parts: string[] = [];
  pushPart(parts, property.internalCode);
  pushPart(parts, property.bairro || property.locationLabel);
  pushPart(parts, [property.cidade, property.estado].filter(Boolean).join(", "));

  if (parts.length === 0 && property.id_do_anuncio) {
    pushPart(parts, `Airbnb ${property.id_do_anuncio}`);
  }

  return parts.length > 0 ? parts.join(" - ") : null;
}

function cleanText(value?: string | null): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized || isUuidLike(normalized)) return null;
  return normalized;
}

function pushPart(parts: string[], value?: string | null) {
  const normalized = cleanText(value);
  if (!normalized) return;
  const repeated = parts.some(
    (part) => part.localeCompare(normalized, "pt-BR", { sensitivity: "accent" }) === 0,
  );
  if (!repeated) parts.push(normalized);
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function PropertyValue({ option }: { option: Option }) {
  return (
    <span style={valueShellStyle}>
      <PropertyThumb option={option} size={30} />
      <span style={{ minWidth: 0, display: "grid", gap: 1 }}>
        <span title={option.primary} style={valuePrimaryStyle}>
          {option.primary}
        </span>
        {option.secondary && (
          <span title={option.secondary} style={valueSecondaryStyle}>
            {option.secondary}
          </span>
        )}
      </span>
    </span>
  );
}

function PropertyMenuOption({ option }: { option: Option }) {
  return (
    <div style={menuOptionStyle}>
      <PropertyThumb option={option} size={44} />
      <span style={{ minWidth: 0, flex: 1 }}>
        <span title={option.primary} style={menuPrimaryStyle}>
          {option.primary}
        </span>
        <span title={option.secondary ?? undefined} style={menuSecondaryStyle}>
          {option.statusLabel ?? option.secondary ?? (option.isAll ? "Carteira completa" : "Localizacao nao informada")}
        </span>
      </span>
      {!option.isAll && (
        <span
          aria-hidden
          style={{
            width: 9,
            height: 9,
            borderRadius: "50%",
            background: option.processing ? uiVar.warning : uiVar.success,
            boxShadow: option.processing
              ? `0 0 0 3px ${uiVar.warningSoft}`
              : `0 0 0 3px ${uiVar.successSoft}`,
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
}

function PropertyThumb({ option, size }: { option: Option; size: number }) {
  if (option.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={option.imageUrl}
        alt=""
        aria-hidden
        style={{
          width: size,
          height: size,
          objectFit: "cover",
          borderRadius: 6,
          border: `1px solid ${uiVar.divider}`,
          opacity: option.processing ? 0.62 : 1,
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        border: `1px solid ${uiVar.divider}`,
        background: option.isAll ? uiVar.accentSoft : uiVar.surfaceMuted,
        color: option.isAll ? uiVar.accent : uiVar.textMuted,
        flexShrink: 0,
      }}
    >
      <Home size={Math.max(15, Math.round(size * 0.42))} strokeWidth={1.8} />
    </span>
  );
}

function DropdownIndicator() {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        color: uiVar.textMuted,
      }}
    >
      <Search size={15} strokeWidth={1.9} />
    </span>
  );
}

function createSelectStyles(maxWidth: number | string): StylesConfig<Option, false> {
  return {
    container: (provided) => ({
      ...provided,
      width: "100%",
      maxWidth,
      minWidth: 0,
    }),
    control: (provided, state) => ({
      ...provided,
      minHeight: 44,
      borderRadius: 8,
      borderColor: state.isFocused ? uiVar.accent : uiVar.dividerStrong,
      backgroundColor: uiVar.surface,
      boxShadow: state.isFocused ? `0 0 0 3px ${uiVar.accentSoft}` : "none",
      cursor: state.isDisabled ? "not-allowed" : "pointer",
      transition: "border-color 120ms, box-shadow 120ms, background 120ms",
      "&:hover": {
        borderColor: state.isFocused ? uiVar.accent : uiVar.dividerStrong,
      },
    }),
    valueContainer: (provided) => ({
      ...provided,
      minWidth: 0,
      padding: "5px 8px 5px 10px",
      overflow: "hidden",
    }),
    singleValue: (provided) => ({
      ...provided,
      maxWidth: "100%",
      minWidth: 0,
      color: uiVar.text,
      overflow: "hidden",
    }),
    input: (provided) => ({
      ...provided,
      color: uiVar.text,
      minWidth: 0,
    }),
    placeholder: (provided) => ({
      ...provided,
      color: uiVar.textMuted,
      fontSize: 13,
      fontWeight: 600,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis",
    }),
    indicatorsContainer: (provided) => ({
      ...provided,
      flexShrink: 0,
    }),
    menuPortal: (provided) => ({
      ...provided,
      zIndex: 10000,
    }),
    menu: (provided) => ({
      ...provided,
      zIndex: 10000,
      overflow: "hidden",
      width: "min(360px, calc(100vw - 32px))",
      border: `1px solid ${uiVar.dividerStrong}`,
      borderRadius: 8,
      backgroundColor: uiVar.surfaceElevated,
      boxShadow: uiVar.shadowOverlay,
    }),
    menuList: (provided) => ({
      ...provided,
      padding: 6,
    }),
    option: (provided, state) => ({
      ...provided,
      borderRadius: 6,
      padding: 8,
      color: uiVar.text,
      backgroundColor: state.isSelected
        ? uiVar.accentSoft
        : state.isFocused
          ? uiVar.surfaceMuted
          : "transparent",
      cursor: "pointer",
      "&:active": {
        backgroundColor: uiVar.accentSoft,
      },
    }),
    noOptionsMessage: (provided) => ({
      ...provided,
      color: uiVar.textMuted,
      fontSize: 13,
    }),
  };
}

const valueShellStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  minWidth: 0,
  maxWidth: "100%",
};

const valuePrimaryStyle: React.CSSProperties = {
  display: "block",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: uiVar.text,
  fontSize: 13,
  fontWeight: 750,
  lineHeight: 1.2,
};

const valueSecondaryStyle: React.CSSProperties = {
  display: "block",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: uiVar.textMuted,
  fontSize: 11,
  lineHeight: 1.15,
};

const menuOptionStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
};

const menuPrimaryStyle: React.CSSProperties = {
  display: "block",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: uiVar.text,
  fontSize: 14,
  fontWeight: 750,
  lineHeight: 1.25,
};

const menuSecondaryStyle: React.CSSProperties = {
  display: "block",
  marginTop: 2,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: uiVar.textMuted,
  fontSize: 12,
  lineHeight: 1.2,
};

export default PropertySelect;
