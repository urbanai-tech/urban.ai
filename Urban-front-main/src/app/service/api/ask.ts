import { api } from "./client";


// === Gap 7 — AskUrban ===
//
// Assistente conversacional do anfitrião — drawer global acionado via
// Cmd+J / Ctrl+J.
// Quando o backend estiver de pé:
//   - GET    /ask/usage           → AskUsageResponse
//   - POST   /ask/question        body = AskRequestInput → AskResponse
//   - POST   /ask/feedback        body = { messageId, vote } → { ok: true }

export type AskCitation = { id: string; label: string; url?: string };

export type AskMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: AskCitation[];
  feedback?: 'up' | 'down';
  createdAt: string;
};

export type AskUsageResponse = {
  used: number;
  quota: number;
  hardCap: number;
  canUse: boolean;
  plan: string;
  reason:
    | null
    | 'no_active_subscription'
    | 'subscription_expired'
    | 'plan_not_allowed'
    | 'quota_exceeded'
    | 'hard_cap_exceeded';
};

export type AskRequestInput = {
  question: string;
  conversationId?: string;
};

export type AskResponse = {
  messageId: string;
  conversationId: string;
  content: string;
  citations: AskCitation[];
  usage: AskUsageResponse;
};

export async function fetchAskUsage(): Promise<AskUsageResponse> {
  const { data } = await api.get<AskUsageResponse>('/ask/usage');
  return data;
}

export async function postAskQuestion(
  input: AskRequestInput,
): Promise<AskResponse> {

  const { data } = await api.post<AskResponse>('/ask/question', input);
  return data;
}

export async function submitAskFeedback(
  messageId: string,
  vote: 'up' | 'down',
): Promise<{ ok: true }> {
  await api.post('/ask/feedback', { messageId, vote });
  return { ok: true };
}
