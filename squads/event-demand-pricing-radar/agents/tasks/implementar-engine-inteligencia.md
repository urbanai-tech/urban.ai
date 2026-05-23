# Task: Implementar engine de inteligencia

## Objetivo

Criar o motor v0 explicavel para demanda de evento, captura por imovel e curva de absorcao de preco.

## Entradas

- plano consolidado;
- contrato minimo do plano de execucao;
- services atuais de pricing e guardrail;
- dados de evento enriquecido.

## Trabalho

1. Criar funcoes/services para:
   - `eventDemandScore`;
   - `propertyCaptureScore`;
   - `priceAbsorptionCurve`;
   - cenarios conservador/recomendado/agressivo/extremo.
2. Definir regras v0 com pesos simples e testaveis.
3. Gerar explicacoes por driver.
4. Integrar com snapshot quando contrato da Lia estiver disponivel.
5. Criar testes unitarios com cenarios:
   - megaevento perto;
   - evento medio longe;
   - baixa confianca;
   - sem expectedAttendance;
   - guardrail limita preco;
   - multiplicador extremo.

## Output esperado

- Services/funcoes criadas.
- Specs criadas.
- Formula documentada.
- Campos necessarios de contrato.
- Riscos de calibracao.

## Veto

- Nao prometer reserva.
- Nao recomendar preco extremo sem risco e confianca.
- Nao alterar migrations sem alinhar com Lia.
