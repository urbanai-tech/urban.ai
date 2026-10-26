/**
 * Gera os ativos do PWA a partir do logo que já existe no repositório
 * (public/pwa-icon-512.png + public/urbanai_only.png). Nenhuma arte nova:
 * só redimensiona, recorta a margem de segurança e deriva a silhueta do pin.
 *
 * Uso: node scripts/generate-pwa-assets.mjs
 * Requer `sharp` (já vem como dependência opcional do Next). Os PNGs gerados são versionados.
 * Quando o manual de marca novo chegar, troque os dois arquivos-fonte e rode de novo.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pub = (name) => resolve(root, "public", name);
const SOURCE_ICON = pub("pwa-icon-512.png");
const SOURCE_PIN = pub("urbanai_only.png");

// Cor de fundo do ícone (canto do PNG fonte) = fundo das telas de abertura do iOS.
const corner = await sharp(SOURCE_ICON)
  .extract({ left: 2, top: 2, width: 1, height: 1 })
  .removeAlpha()
  .raw()
  .toBuffer();
const BG = { r: corner[0], g: corner[1], b: corner[2] };

const png = { compressionLevel: 9 };

// 1. Ícones "any" (cantos retos; o SO aplica a máscara no Android/iOS).
//    192 e 512 são regenerados do próprio 512, então ficam idênticos aos atuais.
for (const size of [48, 72, 96, 144, 192, 256, 384]) {
  await sharp(SOURCE_ICON).resize(size, size).png(png).toFile(pub(`pwa-icon-${size}.png`));
}

// 2. Maskable: o logo ocupa 78% central (dentro da zona segura de 80% do spec) sobre o fundo sólido.
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.78);
  const logo = await sharp(SOURCE_ICON).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: BG } })
    .composite([{ input: logo, gravity: "center" }])
    .png(png)
    .toFile(pub(`maskable-icon-${size}.png`));
}

// 3. apple-touch-icon: iOS não aceita transparência e arredonda sozinho.
for (const [size, name] of [
  [180, "apple-touch-icon.png"],
  [167, "apple-touch-icon-167.png"],
  [152, "apple-touch-icon-152.png"],
  [120, "apple-touch-icon-120.png"],
]) {
  await sharp(SOURCE_ICON).resize(size, size).flatten({ background: BG }).png(png).toFile(pub(name));
}

// 4. Silhueta do pin (monochrome do Android 13+ e badge de notificação): máscara por
//    distância de cor ao fundo do logo-fonte, preenchida de branco sobre transparente.
async function pinSilhouette(size, padding) {
  const { data, info } = await sharp(SOURCE_PIN).extract({ left: 12, top: 12, width: 1056, height: 1056 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const bg = [data[0], data[1], data[2]];
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i += 1) {
    const d = Math.abs(data[i * 3] - bg[0]) + Math.abs(data[i * 3 + 1] - bg[1]) + Math.abs(data[i * 3 + 2] - bg[2]);
    rgba[i * 4] = 255;
    rgba[i * 4 + 1] = 255;
    rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = d > 12 ? 255 : 0;
  }
  const full = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim()
    .png()
    .toBuffer();
  const inner = Math.round(size * (1 - padding * 2));
  const fitted = await sharp(full)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: fitted, gravity: "center" }])
    .png(png);
}
await (await pinSilhouette(512, 0.12)).toFile(pub("pwa-monochrome-512.png"));
await (await pinSilhouette(96, 0.08)).toFile(pub("pwa-badge-96.png"));

// 5. Telas de abertura do iOS (apple-touch-startup-image). [largura css, altura css, dpr]
const DEVICES = [
  [440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [390, 844, 3], [375, 812, 3],
  [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2],
  [744, 1133, 2], [768, 1024, 2], [810, 1080, 2], [820, 1180, 2], [834, 1112, 2], [834, 1194, 2], [1024, 1366, 2],
];
await mkdir(pub("splash"), { recursive: true });
const startupImages = [];
for (const [w, h, dpr] of DEVICES) {
  const pw = w * dpr;
  const ph = h * dpr;
  const logoSize = Math.round(Math.min(pw, ph) * 0.42);
  const logo = await sharp(SOURCE_ICON).resize(logoSize, logoSize).png().toBuffer();
  const file = `splash/apple-splash-${pw}x${ph}.png`;
  await sharp({ create: { width: pw, height: ph, channels: 3, background: BG } })
    .composite([{ input: logo, gravity: "center" }])
    .png({ compressionLevel: 9, palette: true, colors: 64 })
    .toFile(pub(file));
  startupImages.push({
    url: `/${file}`,
    media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
  });
}
await mkdir(resolve(root, "src/app/lib"), { recursive: true });
await writeFile(
  resolve(root, "src/app/lib/pwaSplashScreens.generated.ts"),
  `// Gerado por scripts/generate-pwa-assets.mjs. Não edite à mão.\nexport const APPLE_STARTUP_IMAGES = ${JSON.stringify(startupImages, null, 2)} as const;\n`,
);
console.log(`ok: fundo rgb(${BG.r},${BG.g},${BG.b}), ${startupImages.length} splash screens`);
