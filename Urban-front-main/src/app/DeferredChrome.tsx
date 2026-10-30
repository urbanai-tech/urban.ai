"use client";

import { Analytics } from "./componentes/Analytics";
import { PwaInstaller } from "./componentes/PwaInstaller";

export default function DeferredChrome({ nonce }: { nonce?: string }) {
  return (
    <>
      <Analytics nonce={nonce} />
      <PwaInstaller />
    </>
  );
}
