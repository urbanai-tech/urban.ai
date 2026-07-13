import { api } from "./client";


export const getNotificacoesPorUsuario = async (
  page = 1,
  limit = 10
) => {
  try {
    const { data } = await api.get(`/notifications/user/`, {
      params: { page, limit },
    });

    return data;
  } catch (error) {
    console.error('Erro ao buscar notificações por usuário:', error);
    throw error;
  }
};
export const marcarNotificacaoComoAberta = async (notificationId: string) => {
  try {
    const { data } = await api.patch(`/notifications/${notificationId}/opened`);
    return data;
  } catch (error) {
    console.error(`Erro ao marcar notificação ${notificationId} como aberta:`, error);
    throw error;
  }
};

export const marcarTodasNotificacoesComoAbertas = async (): Promise<{ updated: boolean }> => {
  try {
    const { data } = await api.patch('/notifications/user/opened');
    return data;
  } catch (error) {
    console.error('Erro ao marcar todas as notificações como abertas:', error);
    throw error;
  }
};

export const getUnreadNotificationsCount = async (): Promise<{ unread: number }> => {
  try {
    const { data } = await api.get('/notifications/user/unread-count');
    return data; // { unread: number }
  } catch (error) {
    console.error('Erro ao buscar contagem de notificações não lidas:', error);
    throw error;
  }
};
