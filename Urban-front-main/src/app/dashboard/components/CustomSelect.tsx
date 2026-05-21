"use client";

import { PropertyDropdown } from "@/app/service/api";
import React from "react";
import ReactSelect, { SingleValue } from "react-select";

type Option = { value: string; label: React.ReactNode };

interface Props {
  propsInfo: PropertyDropdown[];
  setPropertyId: (id: string) => void;
  value?: string;
}

const PropertySelect: React.FC<Props> = ({ propsInfo, setPropertyId, value }) => {
  const options: Option[] = propsInfo.map((p) => ({
    value: p.id,
    label: <PropertyOption property={p} />,
  }));

  const handleChange = (selected: SingleValue<Option>) => {
    if (selected) setPropertyId(selected.value);
  };

  const selectedOption = options.find((o) => o.value === value) || null;

  return (
    <>
      <ReactSelect
        styles={{
          container: (provided) => ({ ...provided, width: "100%", maxWidth: 300, minWidth: 0 }),
          menu: (provided) => ({ ...provided, width: "100%" }),
        }}
        options={options}
        onChange={handleChange}
        value={selectedOption}
        placeholder="Selecione"
      />
      <style>{`@keyframes property-select-spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
};

function PropertyOption({ property }: { property: PropertyDropdown }) {
  const processing = property?.analisado !== "completed";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={property.image_url}
        alt={property.propertyName}
        style={{
          width: 40,
          height: 40,
          objectFit: "cover",
          borderRadius: 4,
          opacity: processing ? 0.5 : 1,
        }}
      />
      {processing ? (
        <>
          <span style={processingBadgeStyle}>Processando...</span>
          <Spinner />
        </>
      ) : (
        <span>{property.propertyName}</span>
      )}
    </div>
  );
}

function Spinner() {
  return <span aria-hidden style={spinnerStyle} />;
}

const processingBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 20,
  padding: "0 8px",
  borderRadius: 999,
  background: "rgba(202,138,4,0.12)",
  color: "#92400E",
  fontSize: 12,
  fontWeight: 650,
};

const spinnerStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  borderRadius: "50%",
  border: "2px solid rgba(202,138,4,0.20)",
  borderTopColor: "#CA8A04",
  animation: "property-select-spin 0.8s linear infinite",
};

export default PropertySelect;
