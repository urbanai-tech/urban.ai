// components/Footer.tsx
"use client";

import React from 'react';
import "../../../i18n"; // inicializa o i18n
import { useTranslation } from 'react-i18next';

const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "https://myurbanai.com";

const footerLinkStyle: React.CSSProperties = {
  color: "inherit",
  textDecoration: "none",
  fontSize: 14,
};

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer
      style={{
        height: 200,
        padding: "24px 16px",
        background: "var(--app-surface)",
        color: "var(--app-text)",
        borderTop: "1px solid var(--app-divider)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <p style={{ margin: 0, textAlign: "center", fontSize: 14 }}>
          {t('footer.copy', { year: new Date().getFullYear() })}
        </p>
        <nav style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <a href={`${PUBLIC_SITE_URL}/sobre`} style={footerLinkStyle}>
            {t('footer.links.about')}
          </a>
          <a href={`${PUBLIC_SITE_URL}/contato`} style={footerLinkStyle}>
            {t('footer.links.contact')}
          </a>
          <a href={`${PUBLIC_SITE_URL}/privacidade`} style={footerLinkStyle}>
            {t('footer.links.privacy')}
          </a>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
