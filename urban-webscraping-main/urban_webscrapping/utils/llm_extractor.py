import os
import json
import logging
from google import genai
from pydantic import BaseModel, Field
from typing import Optional

logger = logging.getLogger(__name__)

# Pydantic schema para extração
class EventExtraction(BaseModel):
    is_event: bool = Field(
        description="True se o texto descreve um evento cultural, esportivo ou show real que ocorrerá no futuro."
    )
    is_in_scope: bool = Field(
        default=False,
        description=(
            "True se o evento for em São Paulo capital ou Grande São Paulo "
            "(ABCD, Guarulhos, Osasco, Cotia, Mauá, etc.). "
            "False se for em outra cidade/estado/país, ou se for online sem local físico. "
            "Eventos fora da Grande SP NÃO devem ser marcados como in_scope mesmo que sejam interessantes."
        ),
    )
    nome: Optional[str] = Field(None, description="Nome do evento. Ex: 'Jonas Brothers: Greetings From Your Hometown'")
    dataInicio: Optional[str] = Field(None, description="Data de início do evento no formato YYYY-MM-DD HH:MM:SS. Ex: 2026-05-13 20:00:00")
    enderecoCompleto: Optional[str] = Field(None, description="Endereço ou local do evento incluindo cidade e UF. Ex: 'Allianz Parque, São Paulo, SP'")
    cidade: Optional[str] = Field(None, description="Cidade do evento. Ex: 'São Paulo', 'Rio de Janeiro'")
    estado: Optional[str] = Field(None, description="UF do evento, 2 letras. Ex: 'SP', 'RJ'")
    categoria: Optional[str] = Field("Outros", description="Categoria do evento: Show, Teatro, Esportes, Conferência, etc.")


def extract_event_from_text(text: str) -> Optional[dict]:
    """
    Usa Gemini Flash para extrair informações de evento a partir de texto cru.

    Filtra duplamente:
      1. is_event = True (descarta texto que não é evento)
      2. is_in_scope = True (descarta evento fora da Grande SP)

    Retorna dict com campos do payload OU None se filtrado.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY não encontrada. Extração LLM ignorada.")
        return None

    try:
        client = genai.Client(api_key=api_key)

        prompt = f"Extraia os dados do evento do texto a seguir:\n\n{text[:4000]}"

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
            config=genai.types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=EventExtraction,
                temperature=0.1,
                system_instruction=(
                    "Você é um assistente de extração de dados de eventos para a Urban AI, "
                    "uma plataforma de precificação de aluguéis temporários em SÃO PAULO. "
                    "Seu objetivo é analisar o texto fornecido e: "
                    "(1) determinar se descreve um EVENTO REAL futuro (não notícia genérica, não evento passado), "
                    "(2) determinar se o evento ocorre em São Paulo capital ou Grande São Paulo "
                    "(rejeitar eventos em outras cidades/estados, mesmo que famosos). "
                    "Se ambos, extrair os detalhes. "
                    "Responda ESTRITAMENTE em JSON seguindo o schema solicitado."
                ),
            ),
        )

        result = json.loads(response.text)

        if not result.get("is_event") or not result.get("nome"):
            return None

        # Filtro de cobertura geográfica — descarta antes mesmo de bater no backend.
        # Backend tem CoverageService como segunda camada de defesa, mas filtrar aqui
        # economiza chamada HTTP + cobertura mais clean (não polui DB com out-of-scope).
        if not result.get("is_in_scope"):
            logger.debug(
                "[llm_extractor] descartado por out-of-scope: %s",
                result.get("nome"),
            )
            return None

        return {
            "nome": result.get("nome"),
            "dataInicio": result.get("dataInicio"),
            "enderecoCompleto": result.get("enderecoCompleto"),
            "cidade": result.get("cidade") or "São Paulo",
            "estado": result.get("estado") or "SP",
            "categoria": result.get("categoria"),
        }
    except Exception as e:
        logger.error(f"Erro na extração LLM via Gemini: {e}")
        return None
