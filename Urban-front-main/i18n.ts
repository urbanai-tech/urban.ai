import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import translationPT from './public/locales/pt/common.json'
import translationEN from './public/locales/en/common.json'
import translationES from './public/locales/es/common.json'

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      pt: { translation: translationPT },
      en: { translation: translationEN },
      es: { translation: translationES },
    },
    lng: 'pt',
    fallbackLng: 'pt',
    interpolation: {
      escapeValue: false,
    },
  })
}

export default i18n
