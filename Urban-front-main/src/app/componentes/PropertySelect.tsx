"use client";

import { Home } from "lucide-react";
import React from "react";
import ReactSelect, { type SingleValue, type StylesConfig } from "react-select";
import {
  formatPropertyPrimaryLabel,
  formatPropertySearchLabel,
  formatPropertySecondaryLabel,
  PropertyDropdown,
} from "../service/api";

type Option = {
  value: string;
  searchLabel: string;
  label: React.ReactNode;
};

interface Props {
  propsInfo: PropertyDropdown[];
  setPropertyId: (id: string) => void;
  value?: string;
}

const selectStyles: StylesConfig<Option, false> = {
  container: (provided) => ({
    ...provided,
    width: "100%",
    minWidth: 0,
  }),
  control: (provided, state) => ({
    ...provided,
    minHeight: 56,
    borderRadius: 10,
    borderColor: state.isFocused
      ? "var(--theme-app-accent)"
      : "var(--theme-app-divider-strong)",
    backgroundColor: "var(--theme-app-surface)",
    boxShadow: state.isFocused
      ? "0 0 0 3px var(--theme-app-accent-soft)"
      : "none",
    cursor: "pointer",
    transition: "border-color 120ms, box-shadow 120ms, background 120ms",
    "&:hover": {
      borderColor: state.isFocused
        ? "var(--theme-app-accent)"
        : "var(--theme-app-divider-strong)",
    },
  }),
  valueContainer: (provided) => ({
    ...provided,
    minWidth: 0,
    padding: "6px 10px",
  }),
  singleValue: (provided) => ({
    ...provided,
    maxWidth: "100%",
    color: "var(--theme-app-text)",
  }),
  input: (provided) => ({
    ...provided,
    color: "var(--theme-app-text)",
  }),
  placeholder: (provided) => ({
    ...provided,
    color: "var(--theme-app-text-muted)",
  }),
  indicatorsContainer: (provided) => ({
    ...provided,
    color: "var(--theme-app-text-muted)",
  }),
  dropdownIndicator: (provided, state) => ({
    ...provided,
    color: state.isFocused
      ? "var(--theme-app-accent)"
      : "var(--theme-app-text-muted)",
    "&:hover": {
      color: "var(--theme-app-accent)",
    },
  }),
  indicatorSeparator: (provided) => ({
    ...provided,
    backgroundColor: "var(--theme-app-divider)",
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 30,
    overflow: "hidden",
    border: "1px solid var(--theme-app-divider-strong)",
    borderRadius: 10,
    backgroundColor: "var(--theme-app-surface-elevated)",
    boxShadow: "var(--theme-app-shadow-overlay)",
  }),
  menuList: (provided) => ({
    ...provided,
    padding: 6,
  }),
  option: (provided, state) => ({
    ...provided,
    borderRadius: 8,
    color: state.isDisabled
      ? "var(--theme-app-text-dim)"
      : "var(--theme-app-text)",
    backgroundColor: state.isSelected
      ? "var(--theme-app-accent-soft)"
      : state.isFocused
        ? "var(--theme-app-surface-muted)"
        : "transparent",
    cursor: state.isDisabled ? "not-allowed" : "pointer",
    "&:active": {
      backgroundColor: "var(--theme-app-accent-soft)",
    },
  }),
  noOptionsMessage: (provided) => ({
    ...provided,
    color: "var(--theme-app-text-muted)",
  }),
};

const PropertySelect: React.FC<Props> = ({ propsInfo, setPropertyId, value }) => {
  const options: Option[] = propsInfo.map((property) => ({
    value: property.id,
    searchLabel: formatPropertySearchLabel(property),
    label: <PropertyOption property={property} />,
  }));

  const selectedOption = options.find((option) => option.value === value) || null;

  const handleChange = (selected: SingleValue<Option>) => {
    if (selected) setPropertyId(selected.value);
  };

  return (
    <>
      <ReactSelect<Option, false>
        classNamePrefix="urban-property-select"
        getOptionLabel={(option) => option.searchLabel}
        getOptionValue={(option) => option.value}
        maxMenuHeight={320}
        noOptionsMessage={() => "Nenhum imóvel encontrado"}
        onChange={handleChange}
        options={options}
        placeholder="Selecione"
        styles={selectStyles}
        value={selectedOption}
      />
      <style>{`@keyframes property-select-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
};

function PropertyOption({ property }: { property: PropertyDropdown }) {
  const processing = property.setupStatus?.state
    ? property.setupStatus.state !== "ready"
    : property?.analisado !== "completed";
  const title = formatPropertyPrimaryLabel(property);
  const subtitle = formatPropertySecondaryLabel(property);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
      {property.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={property.image_url}
          alt={title}
          style={{
            width: 44,
            height: 44,
            objectFit: "cover",
            borderRadius: 6,
            border: "1px solid var(--theme-app-divider)",
            opacity: processing ? 0.58 : 1,
            flexShrink: 0,
          }}
        />
      ) : (
        <span
          style={{
            width: 44,
            height: 44,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            border: "1px solid var(--theme-app-divider)",
            background: "var(--theme-app-surface-muted)",
            color: "var(--theme-app-text-muted)",
            flexShrink: 0,
          }}
        >
          <Home size={18} strokeWidth={1.8} />
        </span>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {processing ? (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <span style={processingBadgeStyle}>
              {property.setupStatus?.publicLabel ?? "Preparando..."}
            </span>
            <Spinner />
          </span>
        ) : (
          <span
            title={title}
            style={{
              display: "block",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--theme-app-text)",
              fontSize: 15,
              fontWeight: 600,
              lineHeight: 1.25,
            }}
          >
            {title}
          </span>
        )}
        {!processing && subtitle && (
          <span
            title={subtitle}
            style={{
              display: "block",
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--theme-app-text-muted)",
              fontSize: 12,
              lineHeight: 1.2,
            }}
          >
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return <span aria-hidden style={spinnerStyle} />;
}

const processingBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 22,
  padding: "0 8px",
  borderRadius: 999,
  background: "var(--theme-app-warning-soft)",
  color: "var(--theme-app-warning)",
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.2,
  maxWidth: 170,
  whiteSpace: "normal",
};

const spinnerStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "2px solid var(--theme-app-warning-border)",
  borderTopColor: "var(--theme-app-warning)",
  animation: "property-select-spin 0.8s linear infinite",
  flexShrink: 0,
};

export default PropertySelect;
