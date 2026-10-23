> ⚠️ **Aposentado — ver [ADR 0007](../docs/adr/0007-aposentar-knn-microservice.md).** O motor de pricing ativo está em `urban-ai-backend-main/src/knn-engine/`. Esta pasta ainda compila, mas não recebe tráfego nem deve ganhar novos consumidores (gate `npm run audit:knn-legacy` no CI). Revisado em 2026-10-23.

# Urban AI Backend - Lógica de Precificação Inteligente (API RESTful)

Este projeto contém a implementação da lógica de inteligência artificial para a plataforma Urban AI, focada em precificação dinâmica de imóveis no Airbnb na cidade de São Paulo. A solução considera não apenas as características do imóvel, mas também eventos na cidade e a facilidade de acesso a esses eventos, utilizando inteligência geoespacial.

## Funcionalidades Principais

O backend é composto por três módulos principais que orquestram a lógica de precificação:

1.  **Módulo de Grafos e Isócronas (Tempo de Viagem)**: Simula o cálculo do tempo de viagem entre um imóvel e um local de evento, e a geração de isócronas (áreas de alcance em um determinado tempo). Em uma implementação real, este módulo se integraria a serviços de roteamento como OSRM, GraphHopper ou APIs de mapas.

2.  **Módulo KNN (K-Nearest Neighbors) para Contexto de Vizinhança**: Classifica imóveis com base em suas características e proximidade a pontos de interesse (como estações de metrô), agrupando-os em "clusters de conveniência".

3.  **Módulo de Matriz de Custo de Deslocamento**: Avalia a atratividade de um imóvel em relação a um evento específico, calculando um score baseado no tempo e custo estimado de deslocamento.

Esses módulos são integrados e orquestrados pelo `UrbanAIPricingEngine`, que gera sugestões de preço dinâmicas.

## Estrutura do Projeto

-   `isochrone.js`: Implementa a simulação de cálculo de tempo de viagem e geração de isócronas.
-   `knn-classifier.js`: Implementa o algoritmo KNN para classificação de imóveis.
-   `cost-matrix.js`: Implementa a lógica da matriz de custo de deslocamento.
-   `pricing-engine.js`: O motor principal que orquestra os módulos e gera as sugestões de preço.
-   `server.js`: Servidor Express.js que expõe a funcionalidade de precificação via API RESTful.
-   `package.json`: Define as dependências do projeto.

## Como Executar a API

Para executar a API RESTful:

1.  **Instale as dependências:**

    ```bash
    cd urban-ai-backend
    npm install
    ```

2.  **Inicie o servidor da API:**

    ```bash
    node server.js
    ```

    A API estará disponível em `http://localhost:3000` (ou na porta definida pela variável de ambiente `PORT`).

## Endpoints da API

### `GET /api/status`

Verifica o status da API.

-   **Método:** `GET`
-   **URL:** `http://localhost:3000/api/status`
-   **Resposta de Sucesso (200 OK):**
    ```json
    {
        "status": "online",
        "service": "Urban AI Pricing API"
    }
    ```

### `POST /api/pricing/suggest`

Sugere um preço para um imóvel com base em um evento e um preço base.

-   **Método:** `POST`
-   **URL:** `http://localhost:3000/api/pricing/suggest`
-   **Corpo da Requisição (JSON):**
    ```json
    {
        "property": {
            "id": 101,
            "lat": -23.6273,
            "lng": -46.6945,
            "metroDistance": 0.3, 
            "amenitiesCount": 5
        },
        "event": {
            "name": "GP de Fórmula 1",
            "lat": -23.7013,
            "lng": -46.6970
        },
        "basePrice": 400
    }
    ```
    -   `property`: Objeto com as características do imóvel (latitude, longitude, distância do metrô, contagem de amenidades).
    -   `event`: Objeto com as informações do evento (nome, latitude, longitude).
    -   `basePrice`: Preço base do imóvel sem considerar o evento.

-   **Resposta de Sucesso (200 OK):**
    ```json
    {
        "propertyId": 101,
        "eventName": "GP de Fórmula 1",
        "basePrice": 400,
        "suggestedPrice": 560,
        "increasePercentage": 40,
        "details": {
            "classification": "Premium",
            "attractivity": "Média Atratividade",
            "travelTimeMinutes": 24,
            "reasoning": "Imóvel classificado como 'Premium'. Acesso ao evento 'GP de Fórmula 1' em 24 min (Média Atratividade)."
        }
    }
    ```

-   **Resposta de Erro (400 Bad Request):**
    ```json
    {
        "error": "Campos obrigatórios: property, event, basePrice"
    }
    ```

-   **Resposta de Erro (500 Internal Server Error):**
    ```json
    {
        "error": "Erro interno ao calcular sugestão de preço."
    }
    ```

## Tecnologias Utilizadas

-   **Node.js**: Ambiente de execução JavaScript.
-   **Express.js**: Framework web para Node.js, utilizado para construir a API RESTful.
-   **CORS**: Middleware para habilitar o Cross-Origin Resource Sharing.
-   **Body-parser**: Middleware para parsear o corpo das requisições HTTP.
-   **Turf.js**: Biblioteca para operações geoespaciais (cálculo de distância, criação de círculos).
-   **ml-knn**: Implementação do algoritmo K-Nearest Neighbors.

## Próximos Passos (Sugestões para Melhoria)

-   **Integração com APIs de Roteamento**: Substituir a simulação de `TravelTimeEngine` por uma integração real com APIs como Google Maps Directions API, OSRM, GraphHopper ou Geoapify para cálculos precisos de tempo de viagem e isócronas baseadas em rotas reais.
-   **Dados Reais**: Utilizar dados reais de imóveis, eventos e tráfego para treinar e validar os modelos.
-   **Persistência de Dados**: Implementar um banco de dados para armazenar informações de imóveis, eventos e histórico de precificação.
-   **Autenticação e Autorização**: Adicionar mecanismos de segurança para proteger os endpoints da API.
-   **Validação de Entrada Mais Robusta**: Implementar validação de esquema para os dados de entrada da API.
-   **Otimização de KNN**: Explorar o uso de estruturas de dados como k-d trees para otimizar a busca por vizinhos próximos em grandes volumes de dados.
-   **Machine Learning Avançado**: Considerar modelos de Machine Learning mais complexos para a precificação, como Random Forests ou redes neurais, que podem capturar interações mais sofisticadas entre as variáveis.
