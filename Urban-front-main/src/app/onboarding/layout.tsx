"use client"
import { Box, Flex, Image } from '@chakra-ui/react'
import React from 'react'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <Flex minH="100vh" bg="#f8fafb" direction="column">
      <Box as="main" flex="1" py={8}>
        <Image src="/ul.png" alt="Urban AI Logo" mx="auto" h="40px" mb={4} />
        {children}
      </Box>
    </Flex>
  )
}
