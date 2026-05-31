'use client';

import { CheckCircle, Info, Loader2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppButton, AppInput, useToastCompat } from "./ui";
import { getAddressByCep } from "../service/api";

interface AddressCardProps {
  title: string;
  imageUrl: string;
  cep: string;
  number: string;
  onCepChange: (value: string) => void;
  onNumberChange: (value: string) => void;
  isValid: boolean;
  validationMessage: string | null;
  onAddressUpdate?: (addressData: {
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  }) => void;
}

export default function AddressCard({
  title,
  imageUrl,
  cep,
  number,
  onCepChange,
  onNumberChange,
  isValid,
  validationMessage,
  onAddressUpdate,
}: AddressCardProps) {
  const { t } = useTranslation();
  const toast = useToastCompat();
  const [isLoadingCep, setIsLoadingCep] = useState(false);
  const [cepError, setCepError] = useState<string | null>(null);
  const [imageSrc, setImageSrc] = useState(imageUrl);
  const [addressData, setAddressData] = useState({
    street: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  useEffect(() => {
    setImageSrc(imageUrl);
  }, [imageUrl]);

  const formatCep = (value: string) => {
    const numericValue = value.replace(/\D/g, "");
    if (numericValue.length <= 5) {
      return numericValue;
    }
    return `${numericValue.slice(0, 5)}-${numericValue.slice(5, 8)}`;
  };

  const isValidCep = (value: string): boolean => {
    const cleanCep = value.replace(/\D/g, "");
    return cleanCep.length === 8;
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    onCepChange(formatted);
    setCepError(null);
    if (!isValidCep(formatted)) {
      setAddressData({ street: "", neighborhood: "", city: "", state: "" });
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numericValue = e.target.value.replace(/\D/g, "");
    onNumberChange(numericValue);
  };

  const consultarCep = async () => {
    if (!isValidCep(cep)) {
      setCepError(t("address.cep_invalid_digits"));
      toast("O CEP informado não é válido. Verifique e tente novamente.", { type: "error" });
      return;
    }

    try {
      setIsLoadingCep(true);
      setCepError(null);
      const response = await getAddressByCep(cep);
      const newAddressData = {
        street: response.street || "",
        neighborhood: response.neighborhood || "",
        city: response.city || "",
        state: response.state || "",
      };
      setAddressData(newAddressData);
      onAddressUpdate?.(newAddressData);
      toast("Dados do CEP encontrados", { type: "success" });
    } catch (error) {
      console.error("Erro ao consultar CEP:", error);
      setCepError(t("address.cep_not_found_description"));
      setAddressData({ street: "", neighborhood: "", city: "", state: "" });
      toast("O CEP informado não é válido. Verifique e tente novamente.", { type: "error" });
    } finally {
      setIsLoadingCep(false);
    }
  };

  const isAddressComplete =
    !!addressData.street &&
    !!addressData.neighborhood &&
    !!addressData.city &&
    !!addressData.state &&
    isValidCep(cep) &&
    !!number;

  const statusColor = isAddressComplete
    ? "#16A06B"
    : isLoadingCep
      ? "#2563EB"
      : cepError
        ? "#C2342E"
        : "rgba(14,17,22,0.12)";

  return (
    <article
      style={{
        position: "relative",
        overflow: "hidden",
        border: `1px solid ${statusColor}`,
        borderRadius: 12,
        background: "#fff",
        boxShadow: isAddressComplete ? "0 8px 24px rgba(14,17,22,0.10)" : "0 1px 2px rgba(14,17,22,0.04)",
      }}
    >
      <div style={{ height: 200, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={title}
          onError={() => setImageSrc("https://via.placeholder.com/400x200?text=Foto+indispon%C3%ADvel")}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      </div>

      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 4,
          background: statusColor,
        }}
      />

      <div style={{ padding: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <div>
              <h3 style={{ margin: 0, color: "#0E1116", fontSize: 24, lineHeight: 1.2 }}>
                {title}
              </h3>
              {isLoadingCep && (
                <p style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 0", color: "#2563EB", fontSize: 13, fontWeight: 650 }}>
                  <Loader2 size={14} style={{ animation: "address-spin 0.9s linear infinite" }} />
                  {t("address.consulting_cep")}
                </p>
              )}
            </div>

            {isAddressComplete && (
              <span
                style={{
                  alignSelf: "flex-start",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: "rgba(22,160,107,0.10)",
                  color: "#16A06B",
                  fontSize: 12,
                  fontWeight: 750,
                }}
              >
                <CheckCircle size={13} />
                {t("address.address_complete")}
              </span>
            )}
          </div>

          {(addressData.neighborhood || addressData.city || addressData.state) && (
            <div
              style={{
                padding: 16,
                border: "1px solid rgba(14,17,22,0.06)",
                borderRadius: 10,
                background: "#F4F5F7",
              }}
            >
              <p className="urban-app-eyebrow-muted" style={{ marginBottom: 6 }}>
                {t("address.found_address")}
              </p>
              <p style={{ margin: "0 0 4px", color: "#0E1116", fontSize: 17, fontWeight: 650 }}>
                {addressData.street}
              </p>
              <p style={{ margin: 0, color: "rgba(14,17,22,0.62)", fontSize: 14 }}>
                {[addressData.neighborhood, addressData.city, addressData.state].filter(Boolean).join(" - ")}
              </p>
            </div>
          )}

          <div
            data-address-fields
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) auto",
              gap: 16,
              alignItems: "end",
            }}
          >
            <AppInput
              label={t("address.cep_label")}
              placeholder="00000-000"
              value={cep}
              onChange={handleCepChange}
              maxLength={9}
              disabled={isLoadingCep}
            />

            <AppInput
              label={t("address.number_label")}
              placeholder="123"
              value={number}
              onChange={handleNumberChange}
            />

            <AppButton
              type="button"
              onClick={consultarCep}
              disabled={!isValidCep(cep) || isLoadingCep}
              loading={isLoadingCep}
              style={{ height: 40, minWidth: 140 }}
            >
              {isLoadingCep ? t("address.searching_cep") : t("address.search_cep")}
            </AppButton>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {cepError && (
              <Notice kind="error">{cepError}</Notice>
            )}

            {validationMessage === "cep" && (
              <Notice kind="error">{t("address.cep_invalid_digits")}</Notice>
            )}

            {validationMessage === "number" && (
              <Notice kind="error">{t("address.number_required")}</Notice>
            )}

            {isAddressComplete && (
              <Notice kind="success">{t("address.address_complete")}</Notice>
            )}

            {isValid && !isAddressComplete && (
              <Notice kind="info">{t("address.address_valid")}</Notice>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes address-spin { to { transform: rotate(360deg); } }
        @média (max-width: 760px) {
          [data-address-fields] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </article>
  );
}

function Notice({ kind, children }: { kind: "error" | "success" | "info"; children: React.ReactNode }) {
  const palette = {
    error: {
      bg: "rgba(194,52,46,0.08)",
      border: "rgba(194,52,46,0.22)",
      color: "#C2342E",
      icon: <TriangleAlert size={15} />,
    },
    success: {
      bg: "rgba(22,160,107,0.08)",
      border: "rgba(22,160,107,0.22)",
      color: "#16A06B",
      icon: <CheckCircle size={15} />,
    },
    info: {
      bg: "rgba(37,99,235,0.08)",
      border: "rgba(37,99,235,0.22)",
      color: "#2563EB",
      icon: <Info size={15} />,
    },
  }[kind];

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        color: palette.color,
        fontSize: 13,
        fontWeight: 650,
      }}
    >
      {palette.icon}
      <span>{children}</span>
    </div>
  );
}
