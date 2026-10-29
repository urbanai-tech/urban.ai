"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import {
  AppButton,
  AppCard,
  AppConfirmDialog,
  AppInput,
  AppPageShell,
  AppSectionHeader,
  useToastCompat,
} from "../../componentes/ui";
import { deleteMyAccount, exportMyData } from "../../service/api";
import { invalidateAuthCache, invalidateSubscriptionCache } from "../../context/subscription-status";
import { deleteAccountErrorMessage, exportFileName, safeErrorSummary, serializeExport } from "../../lib/account-privacy";
import { marketingUrl } from "../../lib/marketing-url";

/**
 * /settings/privacy — autoatendimento LGPD: exportar meus dados e excluir a conta.
 */
export default function PrivacySettingsPage() {
  const router = useRouter();
  const toast = useToastCompat();
  const [exporting, setExporting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    try {
      const bundle = await exportMyData();
      const blob = new Blob([serializeExport(bundle)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = exportFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast("Arquivo com seus dados gerado.", { type: "success" });
    } catch (error) {
      console.error(error);
      toast("Não conseguimos gerar o arquivo agora. Tente novamente em instantes.", { type: "error" });
    } finally {
      setExporting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount(password);
      invalidateAuthCache();
      invalidateSubscriptionCache();
      setConfirmOpen(false);
      toast("Sua conta foi excluída.", { type: "success" });
      router.replace("/");
    } catch (error) {
      console.error(safeErrorSummary(error));
      setDeleteError(deleteAccountErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AppPageShell maxWidth={820}>
      <AppSectionHeader
        eyebrow="CONTA - PRIVACIDADE"
        title="Privacidade e dados"
        subtitle="Você controla seus dados. Baixe uma cópia ou exclua sua conta quando quiser."
      />

      <AppCard variant="default">
        <div className="funnel-stack">
          <h2>Exportar meus dados</h2>
          <p>
            Gera um arquivo JSON com seu perfil, imóveis e endereços, análises e recomendações, metadados de
            cobrança, da integração Stays e de comunicações, e seus registros de consentimento. Senhas, tokens
            e dados de cartão nunca entram no arquivo.
          </p>
          <div>
            <AppButton
              type="button"
              variant="secondary"
              leftIcon={<Download size={15} />}
              loading={exporting}
              onClick={handleExport}
            >
              Exportar meus dados
            </AppButton>
          </div>
        </div>
      </AppCard>

      <AppCard variant="default">
        <div className="funnel-stack">
          <h2>Excluir minha conta</h2>
          <p>
            A exclusão cancela sua assinatura, desconecta a Stays e remove sua conta e os dados associados.
            Isso não pode ser desfeito. Alguns registros podem ser mantidos quando a lei exigir; veja a{" "}
            <a href={marketingUrl("/privacidade")} target="_blank" rel="noopener noreferrer" className="funnel-link">
              Política de Privacidade
            </a>
            .
          </p>
          <div>
            <AppButton
              type="button"
              variant="danger"
              leftIcon={<Trash2 size={15} />}
              onClick={() => {
                setPassword("");
                setDeleteError(null);
                setConfirmOpen(true);
              }}
            >
              Excluir minha conta
            </AppButton>
          </div>
        </div>
      </AppCard>

      <AppConfirmDialog
        open={confirmOpen}
        onClose={() => (deleting ? undefined : setConfirmOpen(false))}
        onConfirm={handleDelete}
        title="Excluir sua conta?"
        destructive
        loading={deleting}
        confirmLabel="Excluir definitivamente"
        body={
          <div className="funnel-stack">
            <span>Para confirmar, digite sua senha atual. Sua assinatura será cancelada.</span>
            <AppInput
              label="Senha atual"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={deleteError ?? undefined}
            />
          </div>
        }
      />
    </AppPageShell>
  );
}
