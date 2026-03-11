"use client";

import { PropertyDropdown } from "@/app/service/api";
import { Badge, Box, HStack, Image, Spinner } from "@chakra-ui/react";
import React, { JSX } from "react";
import ReactSelect, { SingleValue } from "react-select";

interface Props {
    propsInfo: PropertyDropdown[];
    setPropertyId: (id: string) => void;
    value?: string; // id da propriedade selecionada (opcional)
}

const PropertySelect: React.FC<Props> = ({ propsInfo, setPropertyId, value }) => {

    const options = propsInfo.map((p) => ({
        value: p.id,
        label: (
            <Box>
                <HStack>
                    <Image
                        src={p.image_url}
                        alt={p.propertyName}
                        boxSize="40px"
                        objectFit="cover"
                        borderRadius={4}
                        marginRight={2}
                        opacity={p?.analisado !== 'completed' ? 0.5 : 1}
                    />
                    {p?.analisado !== 'completed' ? (
                        <Badge colorScheme="yellow">Processando...</Badge>
                    ) : (
                        <span>{p.propertyName}</span>
                    )}
                    {p?.analisado !== 'completed' && (
                        <Spinner size="sm" transform="translate(-50%, -50%)" />
                    )}
                </HStack>
            </Box>
        ),
    }));

    const handleChange = (selected: SingleValue<{ value: string; label: JSX.Element }>) => {
        if (selected) setPropertyId(selected.value);
    };

    // encontra a opção correspondente ao value atual
    const selectedOption = options.find(o => o.value === value) || null;

    return (
        <ReactSelect
            styles={{
                container: (provided) => ({ ...provided, width: 300 }),
                menu: (provided) => ({ ...provided, width: 300 }),
            }}
            options={options}
            onChange={handleChange}
            value={selectedOption} // mantém a seleção
            placeholder="Selecione"
        />
    );
};

export default PropertySelect;
