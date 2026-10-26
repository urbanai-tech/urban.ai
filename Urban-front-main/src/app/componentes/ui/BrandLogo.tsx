import Image from "next/image";

/**
 * Logo oficial My Urban (Brandbook 2026), sempre o arquivo do manual:
 *  - wordmark: Logotipo_06 (deep, fundo claro) / Logotipo_17 (branco, fundo escuro)
 *  - icon:     Logotipo_22 (deep) / Logotipo_25 (mint)
 *  - lockup:   Logotipo_07 (preto, fundo claro com informação) / Logotipo_12 (lime + branco, fundo escuro)
 *
 * As duas versões são renderizadas e o CSS mostra a do tema ativo
 * (`.urban-brand-logo--on-light|--on-dark`). Proibido aplicar blur, sombra,
 * contorno, recolorir ou distorcer — só a altura muda (largura automática).
 * A área de proteção (altura do "O") é responsabilidade de quem posiciona.
 */

type Variant = "wordmark" | "icon" | "lockup";

const FILES: Record<Variant, { light: string; dark: string; width: number; height: number }> = {
  wordmark: { light: "/brand/logo-wordmark-deep.svg", dark: "/brand/logo-wordmark-white.svg", width: 930, height: 164 },
  icon: { light: "/brand/logo-icon-deep.svg", dark: "/brand/logo-icon-mint.svg", width: 647, height: 646 },
  lockup: { light: "/brand/logo-lockup-black.svg", dark: "/brand/logo-lockup-light.svg", width: 736, height: 410 },
};

export function BrandLogo({
  variant = "wordmark",
  className,
  alt = "My Urban",
  priority = false,
}: {
  variant?: Variant;
  className?: string;
  alt?: string;
  priority?: boolean;
}) {
  const file = FILES[variant];
  const base = ["urban-brand-logo", `urban-brand-logo--${variant}`, className].filter(Boolean).join(" ");
  return (
    <>
      <Image
        src={file.light}
        alt={alt}
        width={file.width}
        height={file.height}
        unoptimized
        priority={priority}
        className={`${base} urban-brand-logo--on-light`}
      />
      <Image
        src={file.dark}
        alt={alt}
        width={file.width}
        height={file.height}
        unoptimized
        priority={priority}
        className={`${base} urban-brand-logo--on-dark`}
      />
    </>
  );
}
