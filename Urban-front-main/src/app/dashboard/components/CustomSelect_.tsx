"use client";

import { PropertyDropdown } from "@/app/service/api";
import { Badge, Box, HStack, Image, Spinner } from "@chakra-ui/react";
import React, { JSX, useState, useEffect } from "react";
import ReactSelect, { SingleValue } from "react-select";

interface Props {
    propsInfo: PropertyDropdown[];
    setPropertyId: (id: string) => void;
}

const PropertySelect: React.FC<Props> = ({ propsInfo, setPropertyId }) => {

    const [loading, setLoading] = useState(true);
    const [prevPropsInfo, setPrevPropsInfo] = useState<PropertyDropdown[]>([]);

    // ✅ Detecta quando alguma propriedade ficou "completed" e notifica
    useEffect(() => {
        if (prevPropsInfo.length > 0 && propsInfo.length > 0) {
            const completedProps = prevPropsInfo.filter((oldItem) => {
                const newItem = propsInfo.find((n) => n.id === oldItem.id);
                return oldItem.analisado === "running" && newItem?.analisado === "completed";
            });

            if (completedProps.length > 0) {
                console.log("✅ Propriedades completadas no dropdown:", completedProps);
                // Aqui você pode adicionar uma animação ou toast se desejar
            }
        }
        setPrevPropsInfo(propsInfo);
    }, [propsInfo]);

    const options = propsInfo.map((p) => ({
        value: p.id,
        label: (
            <Box key={p.id}>
                <HStack spacing={2}>
                    <Image
                        src={p.image_url}
                        alt={p.propertyName}
                        boxSize="40px"
                        objectFit="cover"
                        borderRadius={4}
                        marginRight={0}
                        opacity={p?.analisado !== 'completed' ? 0.5 : 1} // escurece/transparentiza se estiver carregando
                        transition="all 0.3s ease-in-out" // ✅ Animação suave ao mudar status
                    />

                    <Box flex={1}>
                        {p?.analisado !== 'completed' ? (
                            <HStack spacing={1}>
                                <Badge colorScheme="yellow" animation="pulse 2s infinite">
                                    Processando...
                                </Badge>
                                <Spinner
                                    size="sm"
                                    speed="0.8s"
                                    color="yellow.500"
                                />
                            </HStack>
                        ) : (
                            <span style={{ color: '#2d3748', fontWeight: 500 }}>
                                ✅ {p.propertyName}
                            </span>
                        )}
                    </Box>
                </HStack>
            </Box>
        ),
    }));

    const handleChange = (selected: SingleValue<{ value: string; label: JSX.Element }>) => {
        if (selected) setPropertyId(selected.value);
    };

    return (
        <ReactSelect
            styles={{
                container: (provided) => ({ ...provided, width: 300 }),
                menu: (provided) => ({ ...provided, width: 300 }),
            }}
            options={options}
            onChange={handleChange}
            placeholder="Selecione"
        />
    );
};

export default PropertySelect;
