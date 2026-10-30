// components/Footer.tsx
"use client";

import React from 'react';
import "../../../i18n"; // inicializa o i18n
import { useTranslation } from 'react-i18next';
import styles from './Footer.module.css';

const PUBLIC_SITE_URL =
  process.env.NEXT_PUBLIC_PUBLIC_SITE_URL || "https://myurbanai.com";

const Footer = () => {
  const { t } = useTranslation();

  return (
    <footer className={styles.footerRoot}>
      <div className={styles.footerInner}>
        <p className={styles.footerCopy}>
          {t('footer.copy', { year: new Date().getFullYear() })}
        </p>
        <nav className={styles.footerNav}>
          <a href={`${PUBLIC_SITE_URL}/sobre`} className={styles.footerLink}>
            {t('footer.links.about')}
          </a>
          <a href={`${PUBLIC_SITE_URL}/contato`} className={styles.footerLink}>
            {t('footer.links.contact')}
          </a>
          <a href={`${PUBLIC_SITE_URL}/privacidade`} className={styles.footerLink}>
            {t('footer.links.privacy')}
          </a>
        </nav>
      </div>
    </footer>
  );
};

export default Footer;
