import { Box, Flex, Image, Spacer, Text } from '@chakra-ui/react'
import SelectLanguageChakra from './SelectLanguageChakra'

const HeaderLogin = () => {
  return (
    <Box bg="white" borderBottom="1px" borderBottomColor="#e8eef3" color="#0e161b" py={6} h="10vh">
    <Flex align="center" maxW="7xl" mx="auto" px={4}>
      <Image src="/image.png" alt="Logo" boxSize="30px" mr={2} />
      <Text className="font-press" fontWeight="normal" fontSize="lg">
        Ai Urban
      </Text>

      <Spacer />

      <SelectLanguageChakra />
    </Flex>
  </Box>
  )
}

export default HeaderLogin
