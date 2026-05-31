'use client';

import React from 'react';
import { Building2, Mail, MapPin, Phone, Save, ShieldCheck, UserRound } from 'lucide-react';
import {
  AppBadge,
  AppButton,
  AppCard,
  AppInput,
  AppLoadingStatus,
  AppPageShell,
  AppSectionHeader,
  useToastCompat,
} from '@/app/componentes/ui';
import { getProfileById, updateProfileById } from '@/app/service/api';
import type { ProfileResponse } from '@/app/service/api';

type ProfileForm = {
  username: string;
  email: string;
  phone: string;
  company: string;
  airbnbHostId: string;
  distanceKm: string;
};

function roleLabel(role?: string) {
  const normalized = (role || '').toLowerCase();
  if (normalized === 'admin') return 'Admin';
  if (normalized === 'host') return 'Anfitrião';
  return 'Usuário';
}

function formatDate(value?: string) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function normalizeDistance(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return undefined;
  const numberValue = Number(normalized);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : undefined;
}

export default function ProfilePage() {
  const toast = useToastCompat();
  const [profile, setProfile] = React.useState<ProfileResponse | null>(null);
  const [form, setForm] = React.useState<ProfileForm>({
    username: '',
    email: '',
    phone: '',
    company: '',
    airbnbHostId: '',
    distanceKm: '',
  });
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    getProfileById()
      .then((data) => {
        setProfile(data);
        setForm({
          username: data.username ?? '',
          email: data.email ?? '',
          phone: data.profile?.phone ?? '',
          company: data.profile?.company ?? '',
          airbnbHostId: data.airbnbHostId ?? '',
          distanceKm: data.distanceKm ? String(data.distanceKm).replace('.', ',') : '',
        });
      })
      .catch((error) => {
        console.error(error);
        toast('Não foi possível carregar seu perfil.', { type: 'error' });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  function setField(field: keyof ProfileForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSave() {
    if (!profile?.id) return;

    const distanceKm = normalizeDistance(form.distanceKm);
    if (form.distanceKm.trim() && distanceKm === undefined) {
      toast('Informe um raio de monitoramento válido.', { type: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const updated = await updateProfileById(profile.id, {
        username: form.username.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        airbnbHostId: form.airbnbHostId.trim(),
        distanceKm,
      });
      setProfile((current) => ({
        ...(current ?? updated),
        ...updated,
        role: updated.role ?? current?.role,
        createdAt: updated.createdAt ?? current?.createdAt,
      }));
      toast('Perfil atualizado.', { type: 'success' });
    } catch (error) {
      console.error(error);
      toast('Não foi possível salvar seu perfil.', { type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AppPageShell>
        <AppLoadingStatus
          eyebrow="PERFIL"
          title="Carregando seus dados"
          body="Estamos buscando as informações da sua conta e operação."
          steps={[
            { id: 'user', label: 'Dados do usuário', status: 'active' },
            { id: 'operation', label: 'Operação', status: 'pending' },
          ]}
        />
      </AppPageShell>
    );
  }

  return (
    <AppPageShell maxWidth={1120}>
      <AppSectionHeader
        eyebrow="CONTA - PERFIL"
        title="Perfil"
        subtitle="Mantenha os dados do usuário e da operação atualizados. A precificação usa estes dados só como contexto operacional, não como limite de preço."
        actions={
          <AppButton
            type="button"
            variant="primary"
            leftIcon={<Save size={15} />}
            loading={saving}
            onClick={handleSave}
          >
            Salvar perfil
          </AppButton>
        }
      />

      <div className="profile-layout">
        <AppCard variant="default">
          <div className="profile-card-title">
            <UserRound size={20} />
            <div>
              <h2>Dados do usuário</h2>
              <p>Informações usadas para identificação, suporte e comunicação.</p>
            </div>
          </div>

          <div className="profile-field-grid">
            <AppInput
              label="Nome"
              value={form.username}
              onChange={(event) => setField('username', event.target.value)}
              leftAddon={<UserRound size={15} />}
            />
            <AppInput
              label="E-mail"
              type="email"
              value={form.email}
              onChange={(event) => setField('email', event.target.value)}
              leftAddon={<Mail size={15} />}
            />
            <AppInput
              label="Telefone"
              value={form.phone}
              onChange={(event) => setField('phone', event.target.value)}
              leftAddon={<Phone size={15} />}
              placeholder="(11) 99999-9999"
            />
            <AppInput
              label="Empresa ou operação"
              value={form.company}
              onChange={(event) => setField('company', event.target.value)}
              leftAddon={<Building2 size={15} />}
              placeholder="Nome da operação"
            />
          </div>
        </AppCard>

        <AppCard variant="default">
          <div className="profile-card-title">
            <ShieldCheck size={20} />
            <div>
              <h2>Resumo da conta</h2>
              <p>Visão rápida para você conferir se está operando no perfil certo.</p>
            </div>
          </div>

          <div className="profile-summary">
            <div className="profile-avatar" aria-hidden>
              {(form.username || form.email || 'U').charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{form.username || 'Usuário Urban AI'}</strong>
              <span>{form.email || 'E-mail não informado'}</span>
            </div>
            <AppBadge kind="accent">{roleLabel(profile?.role)}</AppBadge>
          </div>

          <div className="profile-facts">
            <div>
              <span>Conta criada</span>
              <strong>{formatDate(profile?.createdAt)}</strong>
            </div>
            <div>
              <span>Raio padrão do radar</span>
              <strong>{form.distanceKm ? `${form.distanceKm} km` : 'Não informado'}</strong>
            </div>
            <div>
              <span>ID de anfitrião Airbnb</span>
              <strong>{form.airbnbHostId || 'Não informado'}</strong>
            </div>
          </div>
        </AppCard>
      </div>

      <AppCard variant="default">
        <div className="profile-card-title">
          <MapPin size={20} />
          <div>
            <h2>Contexto da operação</h2>
            <p>Esses campos ajudam filtros, importação de imóveis e leitura de eventos próximos.</p>
          </div>
        </div>

        <div className="profile-field-grid compact">
          <AppInput
            label="ID de anfitrião Airbnb"
            value={form.airbnbHostId}
            onChange={(event) => setField('airbnbHostId', event.target.value)}
            helper="Usado para facilitar importação e conferência dos imóveis."
          />
          <AppInput
            label="Raio padrão do radar"
            value={form.distanceKm}
            onChange={(event) => setField('distanceKm', event.target.value.replace(/[^0-9,.]/g, ''))}
            helper="Distância em quilômetros para procurar eventos próximos quando a tela permitir filtro automático."
          />
        </div>
      </AppCard>

      <style jsx>{styles}</style>
    </AppPageShell>
  );
}

const styles = `
  .profile-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.7fr);
    gap: 18px;
    margin-bottom: 18px;
  }

  .profile-card-title {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 18px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--app-divider);
  }

  .profile-card-title h2 {
    margin: 0;
    color: var(--app-text);
    font-size: 18px;
    line-height: 1.2;
  }

  .profile-card-title p {
    margin: 6px 0 0;
    color: var(--app-text-muted);
    font-size: 13px;
    line-height: 1.5;
  }

  .profile-field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .profile-field-grid.compact {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .profile-summary {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 14px;
    background: var(--app-surface-muted);
    border: 1px solid var(--app-divider);
    border-radius: 12px;
  }

  .profile-avatar {
    display: grid;
    place-items: center;
    width: 42px;
    height: 42px;
    color: var(--app-text);
    font-weight: 800;
    background: var(--app-accent-soft);
    border: 1px solid var(--app-accent-border);
    border-radius: 50%;
  }

  .profile-summary strong,
  .profile-summary span {
    display: block;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-summary strong {
    color: var(--app-text);
    font-size: 15px;
  }

  .profile-summary span {
    margin-top: 4px;
    color: var(--app-text-muted);
    font-size: 12px;
  }

  .profile-facts {
    display: grid;
    gap: 10px;
    margin-top: 14px;
  }

  .profile-facts div {
    padding: 12px 0;
    border-bottom: 1px solid var(--app-divider);
  }

  .profile-facts div:last-child {
    border-bottom: 0;
  }

  .profile-facts span {
    display: block;
    color: var(--app-text-subtle);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 1.2px;
    text-transform: uppercase;
  }

  .profile-facts strong {
    display: block;
    margin-top: 5px;
    color: var(--app-text);
    font-size: 14px;
    overflow-wrap: anywhere;
  }

  @média (max-width: 920px) {
    .profile-layout,
    .profile-field-grid,
    .profile-field-grid.compact {
      grid-template-columns: 1fr;
    }
  }
`;
