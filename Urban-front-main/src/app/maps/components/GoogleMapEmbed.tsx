'use client';

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box } from '@chakra-ui/react';

// ===== ICONES CUSTOMIZADOS =====
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
    iconSize: [120, 110],
    iconAnchor: [60, 110],
    popupAnchor: [0, -110],
  });
}

// Pílula estilo Google Maps (com pin em SVG inline)
function createEventIcon(text: string) {
  // estimativa do tamanho do texto para manter a âncora centralizada
  const CHAR_W = 7;       // largura média por caractere (~13px font)
  const ICON_W = 18;      // largura do SVG do pin
  const GAP = 8;          // espaço entre pin e texto
  const PADDING_X = 12;   // padding lateral
  const BASE = ICON_W + GAP + PADDING_X * 2;

  const textW = Math.max(40, Math.min(220, text.length * CHAR_W));
  const width = BASE + textW;
  const height = 36;

  return new L.DivIcon({
    html: `
      <div style="
        display:inline-flex;align-items:center;
        background:#fff;
        border:1px solid #dadce0;
        border-radius:9999px;
        box-shadow:0 1px 2px rgba(60,64,67,.3),0 1px 3px 1px rgba(60,64,67,.15);
        padding:8px ${PADDING_X}px;
        font:500 13px/1.2 'Roboto','Helvetica Neue',Arial,sans-serif;
        color:#3c4043;
        white-space:nowrap;
        user-select:none;
      ">
        <svg width="${ICON_W}" height="${ICON_W}" viewBox="0 0 24 24" aria-hidden="true" focusable="false" style="display:block;margin-right:${GAP}px">
          <path fill="#EA4335" d="M12 2C8.13 2 5 5.1 5 8.97c0 5.45 7 13.03 7 13.03s7-7.58 7-13.03C19 5.1 15.87 2 12 2z"></path>
          <circle cx="12" cy="9.5" r="3.5" fill="#fff"></circle>
        </svg>
        ${text}
      </div>
    `,
    className: "",
    iconSize: [width, height],
    iconAnchor: [width / 2, height / 2],
    popupAnchor: [0, -height / 2],
  });
}

// ===== TIPAGEM =====
export interface Property {
  id: string;
  propertyName: string;
  latitude: string;
  longitude: string;
  image_url: string;
}

interface AirbnbMapProps {
  height?: string | number;
  events: {
    id: string;
    nome: string;
    descricao?: string | null;
    dataInicio: string;
    enderecoCompleto: string;
    latitude: string;
    longitude: string;
    imagem_url?: string;
    
  }[];
  property?: Property | null;
}

// ===== COMPONENTES AUX =====
const FlyToProperty: React.FC<{ position: [number, number] }> = ({ position }) => {
  const map = useMap();
  React.useEffect(() => {
    map.flyTo(position, 13, { duration: 1.5 });
  }, [position, map]);
  return null;
};

// ===== MAPA PRINCIPAL =====
export default function AirbnbMap({ height = 500, events, property }: AirbnbMapProps) {
  const today = new Date();

  function daysUntil(dateStr: string) {
    const eventDate = new Date(dateStr);
    const diffTime = eventDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  const resolvedHeight = typeof height === "number" ? `${height}px` : height;

  const center: [number, number] =
    property
      ? [parseFloat(property.latitude), parseFloat(property.longitude)]
      : events.length > 0
        ? [parseFloat(events[0].latitude), parseFloat(events[0].longitude)]
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
        zoom={12}
        style={{ height: "100%", width: "100%", borderRadius: "8px" }}
        scrollWheelZoom
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {property && (
          <Marker
            key={property.id}
            position={[parseFloat(property.latitude), parseFloat(property.longitude)]}
            icon={createPropertyIcon(property.propertyName, property.image_url)}
          >
            <Popup>
              <img
                src={property.image_url}
                alt={property.propertyName}
                style={{
                  width: "200px",
                  height: "120px",
                  objectFit: "cover",
                  borderRadius: "8px",
                  marginBottom: "6px"
                }}
              />
              <strong>{property.propertyName}</strong>
            </Popup>
            <FlyToProperty position={[parseFloat(property.latitude), parseFloat(property.longitude)]} />
          </Marker>
        )}

        {events.map(ev => {
          const dias = daysUntil(ev.dataInicio);
          const texto = dias > 0 ? `Em ${dias} dia${dias > 1 ? "s" : ""}` : "Hoje!";
          const icon = createEventIcon(texto);

          return (
            <Marker
              key={ev.id}
              position={[parseFloat(ev.latitude), parseFloat(ev.longitude)]}
              icon={icon}
            >
              <Popup>
                {ev.imagem_url && (
                  <img
                    src={ev.imagem_url}
                    alt={ev.nome}
                    style={{
                      width: '200px',
                      height: '120px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      marginBottom: '6px'
                    }}
                  />
                )}
                <strong>{ev.nome}</strong>
                <br />
                <small>{ev.enderecoCompleto}</small>
                <br />
                <small>
                  Data: {new Date(ev.dataInicio).toLocaleDateString('pt-BR')}
                </small>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </Box>
  );
}
