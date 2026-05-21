'use client';

import { ChevronDown, Languages } from 'lucide-react';
import NextImage from 'next/image';
import i18n from 'i18next';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

const languages = [
  { id: 1, label: 'Portugues', name: 'pt-br', code: 'pt', avatar: '/flag.png' },
  { id: 2, label: 'Ingles', name: 'en-us', code: 'en', avatar: '/united-states.png' },
  { id: 3, label: 'Espanhol', name: 'es-sp', code: 'es', avatar: '/spain.png' },
];

export default function SelectLanguage() {
  const [selected, setSelected] = useState(languages[1]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { t, ready } = useTranslation();

  useEffect(() => {
    console.log(t('not_member'), ready);
  }, [ready, t]);

  useEffect(() => {
    const storedLang = localStorage.getItem('i18nextLng') || 'en';
    const person = languages.find((p) => p.code === storedLang);
    if (!person) return;

    setSelected(person);
    if (i18n.isInitialized) {
      i18n.changeLanguage(person.code);
    } else {
      i18n.on('initialized', () => {
        i18n.changeLanguage(person.code);
      });
    }
  }, []);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const handleChange = (language: (typeof languages)[number]) => {
    setSelected(language);
    i18n.changeLanguage(language.code);
    localStorage.setItem('i18nextLng', language.code);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        style={{
          height: 40,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          border: '1px solid rgba(14,17,22,0.12)',
          borderRadius: 10,
          background: '#fff',
          color: '#0E1116',
          cursor: 'pointer',
        }}
      >
        <Languages size={22} strokeWidth={1.8} />
        <ChevronDown size={16} strokeWidth={1.8} />
        <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {selected.name}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            zIndex: 20,
            minWidth: 180,
            padding: 6,
            border: '1px solid rgba(14,17,22,0.10)',
            borderRadius: 10,
            background: '#fff',
            boxShadow: '0 12px 32px rgba(14,17,22,0.14)',
          }}
        >
          {languages.map((language) => (
            <button
              key={language.id}
              type="button"
              role="menuitem"
              onClick={() => handleChange(language)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '8px 10px',
                border: 'none',
                borderRadius: 8,
                background: language.code === selected.code ? 'rgba(232,80,10,0.10)' : 'transparent',
                color: '#0E1116',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <NextImage src={language.avatar} alt="" width={28} height={28} style={{ borderRadius: 999 }} />
              {language.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
