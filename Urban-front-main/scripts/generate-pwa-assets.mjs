/**
 * Gera os ativos do PWA a partir do manual de marca My Urban AI (MARCA-SPEC.md).
 *
 * Fontes (fora do repositório, 5000px): Logotipo_25.png (ícone mint) e Logotipo_27.png (ícone branco).
 * Uso: BRAND_DIR="C:/caminho/urban-ai-marca" node scripts/generate-pwa-assets.mjs
 * Requer `sharp` (dependência opcional do Next). Só os PNG/ICO gerados (pequenos) são versionados.
 *
 * Regras do manual respeitadas: logo só redimensionado (sem distorcer, recolorir, sombra ou contorno);
 * ícone mint sobre o verde-noite #103134 com área segura (>= 20% de margem) em todos os formatos.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pub = (name) => resolve(root, "public", name);
const BRAND_DIR = process.env.BRAND_DIR || "C:/Users/Acer/Documents/urban-ai-marca";
const brand = (file) => resolve(BRAND_DIR, "logotipo-png", file);

const DEEP = { r: 0x10, g: 0x31, b: 0x34 };
const png = { compressionLevel: 9 };

// Ícones recortados no limite do desenho (o PNG fonte tem margem transparente).
const iconMint = await sharp(brand("Logotipo_25.png")).trim().png().toBuffer();
const iconWhite = await sharp(brand("Logotipo_27.png")).trim().png().toBuffer();

/** Ícone mint centralizado sobre o fundo deep; `ratio` = fração do lado ocupada pelo ícone. */
async function tile(size, ratio) {
  const inner = Math.round(size * ratio);
  const glyph = await sharp(iconMint).resize(inner, inner, { fit: "contain" }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 3, background: DEEP } })
    .composite([{ input: glyph, gravity: "center" }])
    .png(png);
}

// 1. Ícones "any": ícone a 62% do lado (a máscara do SO corta pouco).
for (const size of [48, 72, 96, 144, 192, 256, 384, 512]) {
  await (await tile(size, 0.62)).toFile(pub(`pwa-icon-${size}.png`));
}

// 2. Maskable: ícone a 56% (margem de segurança de 22% de cada lado, acima dos 20% do manual).
for (const size of [192, 512]) {
  await (await tile(size, 0.56)).toFile(pub(`maskable-icon-${size}.png`));
}

// 3. apple-touch-icon (iOS não aceita transparência e aplica o arredondado sozinho).
for (const [size, name] of [
  [180, "apple-touch-icon.png"],
  [167, "apple-touch-icon-167.png"],
  [152, "apple-touch-icon-152.png"],
  [120, "apple-touch-icon-120.png"],
]) {
  await (await tile(size, 0.62)).toFile(pub(name));
}

// 4. Monochrome (Android 13+) e badge de notificação: ícone 27 (branco) sobre transparente.
async function whiteOnTransparent(size, ratio) {
  const inner = Math.round(size * ratio);
  const glyph = await sharp(iconWhite).resize(inner, inner, { fit: "contain" }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: glyph, gravity: "center" }])
    .png(png);
}
await (await whiteOnTransparent(512, 0.66)).toFile(pub("pwa-monochrome-512.png"));
await (await whiteOnTransparent(96, 0.9)).toFile(pub("pwa-badge-96.png"));

// 5. Favicons: PNG 16/32 + favicon.ico (contêiner ICO com os dois PNG).
const fav16 = await (await tile(16, 0.78)).toBuffer();
const fav32 = await (await tile(32, 0.78)).toBuffer();
await writeFile(pub("favicon-16.png"), fav16);
await writeFile(pub("favicon-32.png"), fav32);
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size, 0);
    entry.writeUInt8(size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((image) => image.data)]);
}
await writeFile(pub("favicon.ico"), ico([{ size: 16, data: fav16 }, { size: 32, data: fav32 }]));

// 6. Telas de abertura do iOS: fundo #103134 + ícone mint (25) centralizado.
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
  const glyphSize = Math.round(Math.min(pw, ph) * 0.26);
  const glyph = await sharp(iconMint).resize(glyphSize, glyphSize, { fit: "contain" }).png().toBuffer();
  const file = `splash/apple-splash-${pw}x${ph}.png`;
  await sharp({ create: { width: pw, height: ph, channels: 3, background: DEEP } })
    .composite([{ input: glyph, gravity: "center" }])
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
console.log(`ok: ${startupImages.length} splash screens, ícones, favicons e badge`);
