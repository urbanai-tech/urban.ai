"use client";

import { Analytics } from "./componentes/Analytics";
import { PwaInstaller } from "./componentes/PwaInstaller";

export default function DeferredChrome() {
  return (
    <>
      <Analytics />
      <PwaInstaller />
    </>
  );
}
