'use client'

import { Button, Image, Menu, MenuButton, MenuItem, MenuList, Text } from '@chakra-ui/react'
import { ChevronDownIcon } from '@heroicons/react/16/solid'
import { LanguageIcon } from '@heroicons/react/20/solid'
import i18n from 'i18next'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const languages = [
  { id: 1, name: 'pt-br', code: 'pt', avatar: '/flag.png' },
  { id: 2, name: 'en-us', code: 'en', avatar: '/united-states.png' },
  { id: 3, name: 'es-sp', code: 'es', avatar: '/spain.png' },
]




export default function SelectLanguageChakra() {

  const [, setSelected] = useState(languages[1]) // default to English
  const [, setLanguage] = useState('en')

  const { t, ready } = useTranslation()


  useEffect(() => {
    console.log(t('not_member'), ready)
  }, [ready, t])

  useEffect(() => {
    const storedLang = localStorage.getItem('i18nextLng') || 'en'
    const person = languages.find(p => p.code === storedLang)
    if (person) {
      setSelected(person)
      setLanguage(person.code)

      if (i18n.isInitialized) {
        i18n.changeLanguage(person.code)
      } else {
        i18n.on('initialized', () => {
          i18n.changeLanguage(person.code)
        })
      }
    }
  }, [])


  const handleChange = (language: (typeof languages)[number]) => {
    setSelected(language)
    setLanguage(language.code)
    i18n.changeLanguage(language.code)
    localStorage.setItem('i18nextLng', language.code)
  }

  return (
    <Menu>
      <MenuButton as={Button} rightIcon={<ChevronDownIcon />}>
        <Text fontSize="md"><LanguageIcon width={24} /></Text>
      </MenuButton>
      <MenuList>
  <MenuItem onClick={() => handleChange(languages[0])}>
    <Image w={10} mr={3} h={10} src='/flag.png' alt="Bandeira do Brasil" />
    Português
  </MenuItem>
  <MenuItem onClick={() => handleChange(languages[1])}>
    <Image w={10} mr={3} h={10} src='/united-states.png' alt="Bandeira dos Estados Unidos" />
    Inglês
  </MenuItem>
  <MenuItem onClick={() => handleChange(languages[2])}>
    <Image w={10} mr={3} h={10} src='/spain.png' alt="Bandeira da Espanha" />
    Espanhol
  </MenuItem>
</MenuList>

    </Menu>
  )
}
