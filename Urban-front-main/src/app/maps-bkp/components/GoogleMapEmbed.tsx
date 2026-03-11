'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box } from '@chakra-ui/react';

// Função para criar ícone da propriedade com nome customizado
function createPropertyIcon(name: string, imageUrl: string) {
  return new L.DivIcon({
    html: `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        background: white;
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid #ccc;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        user-select: none;
        width: 120px;
      ">
        <img
          src="${imageUrl}"
          alt="${name}"
          style="
            width: 100px;
            height: 70px;
            object-fit: cover;
            border-radius: 4px;
            border: 1px solid #ddd;
            margin-bottom: 4px;
          "
        />
        <div style="
          font-weight: 600;
          font-size: 14px;
          color: #333;
          text-align: center;
          white-space: normal;
        ">
          ${name}
        </div>
      </div>
    `,
    className: "",
    iconSize: [120, 110], // largura x altura (ajuste se quiser)
    iconAnchor: [60, 110], // ponto da "âncora" do ícone (metade da largura na base)
    popupAnchor: [0, -110], // popup aparece acima do ícone
  });
}


// Função que cria um ícone de evento com texto "Em X dias" + gif pequeno ao lado
function createEventIcon(text: string) {
  return new L.DivIcon({
    html: `
      <div style="
        display: flex;
        align-items: center;
        background: white;
        padding: 4px 8px;
        border-radius: 30px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        font-weight: 600;
        font-size: 12px;
        color: #333;
        user-select: none;
        white-space: nowrap;
      ">
        <img src="https://i.ibb.co/fYqc8z5b/electric-guitar-unscreen.gif"
          style="width: 30px; height: 30px; margin-right: 6px;" />
        ${text}
      </div>
    `,
    className: "",
    iconSize: [110, 30],
    iconAnchor: [55, 15],
    popupAnchor: [0, -30],
  });
}

interface Location {
  id: number;
  title: string;
  description: string;
  position: [number, number];
  date?: string; // para eventos
  imageUrl?: string;
}

interface AirbnbMapProps {
  height?: string | number;
}

const FlyToProperty: React.FC<{ position: [number, number] }> = ({ position }) => {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(position, 14, { duration: 1.5 });
  }, [position, map]);
  return null;
};

export default function AirbnbMap({ height = 500 }: AirbnbMapProps) {
  // Agora é um array de propriedades
const properties: Location[] = [
  {
    id: 1,
    title: 'Rancho Beira Rio',
    description: 'Aconchegante apartamento em São Paulo, perto do centro.',
    position: [-23.55052, -46.633308],
    imageUrl: "https://a0.muscache.com/im/pictures/prohost-api/Hosting-1092870226086416637/original/dbe1c7b6-93d2-48ec-8950-b6755a0b44a3.jpeg?aki_policy=large"
  },
  {
    id: 2,
    title: 'Casa no Brooklin',
    description: 'Casa espaçosa com jardim e piscina.',
    position: [-23.59052, -46.650308],
    imageUrl: "https://a0.muscache.com/im/pictures/hosting/Hosting-1327620004253968642/original/03d958c4-161c-46dc-bb46-e8332122b55e.jpeg?aki_policy=large"
  },
];


  // Eventos iguais, sem alteração
  const events: Location[] = [
    { id: 101, title: 'Show no Allianz Parque', description: 'Concerto às 20h.', position: [-23.5275, -46.6813], date: '2025-08-21' },
    { id: 102, title: 'Feira de Artesanato', description: 'Comidas típicas.', position: [-23.556, -46.641], date: '2025-08-18' },
    { id: 103, title: 'Exposição no MASP', description: 'Arte moderna.', position: [-23.561, -46.655], date: '2025-08-19' },
  ];

  const today = new Date();

  function daysUntil(dateStr: string) {
    const eventDate = new Date(dateStr);
    const diffTime = eventDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const resolvedHeight = typeof height === "number" ? `${height}px` : height;

  // Garantir que center seja um tuple válido para MapContainer
  // Se não tiver propriedades, usa posição padrão qualquer (para evitar erro)
  const center: [number, number] =
    properties.length > 0
      ? properties[0].position
      : [-23.55052, -46.633308];

  return (
    <Box
      bg="white"
      borderRadius="md"
      boxShadow="md"
      p={1}
      mx="2"
      height={resolvedHeight}
      width="100%"
    >
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: "100%", width: "100%", borderRadius: "8px" }}
        scrollWheelZoom
      >
        <FlyToProperty position={center} />

        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a> contributors'
        />

        {/* Para cada propriedade */}
        {properties.map((property) => (
          <React.Fragment key={property.id}>
            {/* Círculo de 2 km em torno da propriedade */}
            <Circle
              center={property.position}
              radius={2000} // 2 km
              pathOptions={{ color: "#052c6b", fillColor: "#052c6b", fillOpacity: 0.2, weight: 2 }}
            />
<Marker
  key={property.id}
  position={property.position}
  icon={createPropertyIcon(property.title, property.imageUrl!)}
>
  <Popup>
    <strong>{property.title}</strong>
    <br />
    {property.description}
  </Popup>
</Marker>

          </React.Fragment>
        ))}

        {/* Eventos */}
        {events.map(event => {
          const dias = daysUntil(event.date!);
          const texto = dias > 0 ? `Em ${dias} dia${dias > 1 ? "s" : ""}` : "Hoje!";
          const icon = createEventIcon(texto);

          return (
            <Marker key={event.id} position={event.position} icon={icon}>
              <Popup>
                <strong>{event.title}</strong>
                <br />
                {event.description}
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </Box>
  );
}
