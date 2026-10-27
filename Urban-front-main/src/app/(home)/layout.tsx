import { Providers } from "../providers";

// "/" é leve no RootShell (porque no domínio público é a landing reescrita).
// Quando "/" é o login do app, os providers de sessão/i18n/toast entram aqui.
export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
