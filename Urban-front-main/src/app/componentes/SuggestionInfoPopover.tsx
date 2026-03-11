import React from "react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverBody,
  PopoverArrow,
  PopoverCloseButton,
  Button,
} from "@chakra-ui/react";
import { FaRegLightbulb } from "react-icons/fa";

interface SuggestionInfoPopoverProps {
  buttonLabel?: string;       // Texto do botão
  title?: string;             // Título do popover
  description: string;        // Corpo do popover (explicação)
  borderColor?: string;       // Cor da borda do popover
}

export const SuggestionInfoPopover: React.FC<SuggestionInfoPopoverProps> = ({
  buttonLabel = "Como funciona?",
  title = "O que é o preço sugerido?",
  description,
  borderColor = "yellow.400",
}) => {
  return (
    <Popover placement="top" closeOnBlur>
      <PopoverTrigger>
        <Button
          leftIcon={<FaRegLightbulb />}
          colorScheme="yellow"
          variant="ghost"
          size="sm"
          fontWeight="semibold"
        >
          {buttonLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        bg="white"
        color="gray.800"
        borderRadius="lg"
        boxShadow="md"
        maxW="260px"
        borderWidth="1px"
        borderColor={borderColor}
      >
        <PopoverArrow />
        <PopoverCloseButton />
        <PopoverHeader fontWeight="bold" borderBottom="1px solid #eee">
          {title}
        </PopoverHeader>
        <PopoverBody fontSize="sm">{description}</PopoverBody>
      </PopoverContent>
    </Popover>
  );
};
