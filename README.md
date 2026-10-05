# 🐾 Dr. Miau Pet Agent — Arquitetura do Sistema

Bem-vindo à documentação oficial do **Dr. Miau Pet Agent**! Este projeto combina inteligência artificial conversacional via **Google Gemini** com geração de animações 3D cinematográficas personalizadas na **Atlas Cloud (modelo Seedance 2.0)**.

O projeto foi totalmente refatorado com foco em **clareza, manutenibilidade, separação de responsabilidades** e facilidade de navegação, especialmente para desenvolvedores focados em **Front-end**.

---

## 📁 1. Estrutura de Pastas e Arquivos

```text
├── server/                       # ─── BACKEND (Arquitetura MVC Modular) ───
│   ├── config/
│   │   ├── env.js                # Resolução dinâmica e segura de variáveis (PORT, chaves)
│   │   └── constants.js          # Mapeamento de emoções, vídeos, schemas de IA e espécies
│   ├── controllers/
│   │   ├── chat.controller.js    # Orquestração de turnos de chat, streaming SSE e visão computacional
│   │   ├── video.controller.js   # Endpoints de mídia, proxy de vídeo e disparo na Atlas Cloud
│   │   ├── auth.controller.js    # Controle de sessão, isolamento de usuários, logout e reset
│   │   └── status.controller.js  # Diagnóstico em tempo real de APIs e healthcheck
│   ├── routes/
│   │   ├── chat.routes.js        # Rotas /api/chat, /api/chat/stream, /api/analyze-image
│   │   ├── video.routes.js       # Rotas /api/videos, /api/video-status, /api/proxy-video
│   │   ├── auth.routes.js        # Rotas /api/last-prompt, /api/reset-prompt, /api/auth/logout
│   │   ├── status.routes.js      # Rotas /health, /api/status, /api/config/atlas-key
│   │   └── index.js              # Agregador central de rotas do Express
│   └── services/
│       ├── gemini.service.js     # Integração com @google/genai, fallback inteligente e visão
│       ├── atlas.service.js      # Integração oficial Atlas Cloud Seedance 2.0 e fallback T2V
│       ├── prompt.service.js     # CinePrompt AI, normalização de texto e análise de perfil do pet
│       └── session.store.js      # Repositório em memória isolado por usuário e conversa
│
├── public/                       # ─── FRONTEND (Módulos ES6 e Assets) ───
│   ├── index.html                # Estrutura semântica HTML da Single Page Application
│   ├── styles.css                # CSS centralizado único, documentado com sumário e seções
│   ├── dr-miau.png               # Imagem estática do avatar do Dr. Miau
│   ├── videos/                   # Vídeos MP4 de suporte emocional pré-renderizados
│   ├── main.js                   # Ponto de entrada de compatibilidade (carrega js/app.js)
│   └── js/                       # Módulos JavaScript ES6 modernos
│       ├── app.js                # Orquestrador central da aplicação frontend
│       ├── state/
│       │   └── store.js          # Gerenciamento de estado global reativo e cache local
│       ├── services/
│       │   ├── api.service.js    # Chamadas HTTP/REST sem cache e leitor de streaming SSE
│       │   └── speech.service.js # Integração robusta com Web Speech API (Microfone)
│       ├── components/
│       │   ├── chat.component.js     # Renderização de mensagens, balão de fala e composer
│       │   ├── video.component.js    # Dual-buffer de vídeo sem cintilação e player modal
│       │   ├── photo.component.js    # Bandeja de prévia, seleção e envio de foto do pet
│       │   ├── progress.component.js # Barra de progresso da jornada e métricas da GPU
│       │   └── modal.component.js    # Modais de Galeria 3D, Perfil, Ajuda e Prompt
│       └── utils/
│           ├── dom.js            # Seletores utilitários, gerador de IDs e controle de zoom
│           └── text.js           # Sanitização profilática de caracteres em português
│
├── src/                          # Mídias fonte e serviços legados (re-exportados)
│   ├── services/
│   │   └── atlasCloudService.js  # Re-exportador compatível apontando para server/services/atlas.service.js
│   └── *.mp4                     # Vídeos originais sincronizados automaticamente no build
│
├── server.js                     # Ponto de entrada Express raiz limpo (< 100 linhas)
├── build.js                      # Script de build de produção (Vite + sincronização de assets)
├── package.json                  # Gerenciador de dependências e scripts npm
└── metadata.json                 # Metadados de identificação e permissões do applet
```

---

## 🚀 2. Como Rodar o Projeto

### Pré-requisitos
- Node.js versão 18 ou superior.
- Variáveis de ambiente configuradas no arquivo `.env` (ou variáveis de ambiente do sistema):
  - `GEMINI_API_KEY`: Chave de API do Google Gemini.
  - `ATLASCLOUD_API_KEY`: Chave de API da Atlas Cloud (opcional, para renderização de vídeos 3D).
  - `PORT`: Porta do servidor (padrão: `3000`).

### Comandos
1. **Instalar Dependências:**
   ```bash
   npm install
   ```

2. **Executar em Modo de Desenvolvimento:**
   ```bash
   npm run dev
   # Inicia o servidor Express em http://localhost:3000
   ```

3. **Gerar Build de Produção:**
   ```bash
   npm run build
   # Executa o Vite e gera os pacotes estáticos otimizados na pasta dist/
   ```

4. **Iniciar em Produção:**
   ```bash
   npm start
   ```

---

## 🎨 3. Guia para Quem Mexe no Front-end

Se você é desenvolvedor front-end, esta seção foi feita sob medida para o seu dia a dia!

### 1. Onde ficam os Estilos visuais?
- **Arquivo principal:** `public/styles.css`
- **Organização:** O arquivo contém um **Sumário Documentado** no topo dividido em 9 seções lógicas:
  1. *Variáveis CSS e Design Tokens* (cores, sombras, bordas, fontes).
  2. *Resets e Viewport Lock* (proteção contra zoom mobile no iOS/Android).
  3. *Layout Principal (Stage)* (palco do avatar e dual-buffer de vídeo).
  4. *Balão de Fala do Dr. Miau*.
  5. *Composer* (campo de texto, microfone, prévia de imagem).
  6. *Chat e Mini-histórico* (bolhas de conversa, cards interativos).
  7. *Barra de Progresso e Banner de Status*.
  8. *Modais e Diálogos de Sistema* (Galeria 3D, Perfil, Ajuda, Prompt).
  9. *Responsividade* (breakpoints móveis e modo Lado a Lado).

### 2. Onde fica a Marcação HTML?
- `public/index.html` (e sincronizado com `index.html` na raiz).
- Todos os elementos interativos possuem seletores semânticos ou atributos `data-ui` e `data-action` (ex: `data-ui="bubbleText"`, `data-action="toggleListening"`).

### 3. Onde ficam os Componentes JavaScript?
- Na pasta `public/js/components/`:
  - `chat.component.js`: Controla a lista de mensagens na tela, digitação, repetição de respostas e o card de convite para foto.
  - `video.component.js`: Controla o dual-buffer de vídeo A/B (garantindo que um vídeo comece a rodar antes do outro sumir, eliminando qualquer tela preta ou cintilação).
  - `photo.component.js`: Cuida do upload de imagem, pré-visualização e botões de anexar/remover.
  - `progress.component.js`: Atualiza a barra de progresso da entrevista (0% a 100%) e o banner flutuante da GPU Atlas Cloud.
  - `modal.component.js`: Controla a Galeria de Vídeos gerados (`GalleryManager`), modal de perfil, ajuda e modal do prompt.

### 4. Como os Dados Chegam à Tela? (Fluxo de Dados Completo)

```text
[Input do Usuário ou Voz]
           │
           ▼
[public/js/app.js: agentRespond()]
           │
           ├─► Atualiza UI: Ativa indicador de pensamento e vídeo de espera ("esperandoresposta.mp4")
           │
           ▼
[POST /api/chat/stream (SSE)] ou [POST /api/chat]
           │
           ▼
[server/controllers/chat.controller.js]
           │
           ├─► Consulta Gemini (@google/genai ou fallback inteligente)
           ├─► Analisa perfil do pet (Espécie, Nome, Raça, Cor, Avariações, História)
           ├─► Avalia fase da conversa (1 a 4) e progresso (0 a 100%)
           │
           ▼
[Resposta em Streaming recebida pelo Frontend]
           │
           ├─► chat.component.js: Renderiza texto palavra por palavra no balão do Dr. Miau
           ├─► video.component.js: Troca a animação do mascote de acordo com o sentimento retornado
           ├─► progress.component.js: Atualiza a barra de progresso acumulado
           │
           ▼
[Fase 4 - Aprovação do Tutor]
           │
           ▼
[Disparo de Vídeo 3D na Atlas Cloud (Seedance 2.0)]
           │
           ├─► Backend envia requisição para https://api.atlascloud.ai/api/v1/model/generateVideo
           ├─► Retorna taskId para o frontend
           │
           ▼
[Polling em Tempo Real (public/js/app.js: pollVideoStatus)]
           │
           ├─► Consulta /api/video-status/:id a cada 2 segundos
           ├─► Calcula progresso contínuo de 0% a 100% sem travamento em 95%
           │
           ▼
[Vídeo Concluído!]
           │
           ├─► Salva automaticamente na Galeria do Tutor
           ├─► Abre o modal de vídeo com reprodução instantânea e botão para Baixar MP4
           └─► Dr. Miau comemora com reação alegre!
```

### 5. Isolamento de Sessão e Cache Local
- Cada usuário possui uma chave de armazenamento própria no `localStorage` (`drMiau_chatState_${userId}_${convId}`).
- Quando o usuário clica em **Novo Chat** ou **Trocar de Usuário**, o front-end gera novos identificadores exclusivos (`conv_...` e `sess_...`), descartando o contexto antigo tanto no navegador quanto na memória do servidor, impedindo reaproveitamento de histórico acidental.

---

## 🛡️ 4. Lista de Arquivos e Itens em Dúvida

### Arquivos Criados ou Movidos na Refatoração
- `server/config/env.js` (Criado: resolução unificada de variáveis de ambiente)
- `server/config/constants.js` (Criado: constantes, mensagens e schemas de dados)
- `server/services/session.store.js` (Criado: repositório de conversas isolado)
- `server/services/prompt.service.js` (Criado: CinePrompt AI e heurísticas de perfil)
- `server/services/gemini.service.js` (Criado: integração oficial com @google/genai)
- `server/services/atlas.service.js` (Criado: integração Atlas Cloud Seedance 2.0)
- `server/controllers/chat.controller.js` (Criado: rotas de chat e streaming)
- `server/controllers/video.controller.js` (Criado: vídeos e proxy de mídia)
- `server/controllers/auth.controller.js` (Criado: isolamento e logout de usuários)
- `server/controllers/status.controller.js` (Criado: healthcheck e status de APIs)
- `server/routes/*.js` (Criados: roteadores modulares do Express)
- `public/js/utils/*.js` (Criados: seletores de DOM e higienização de texto)
- `public/js/state/store.js` (Criado: store reativo com persistência isolada)
- `public/js/services/*.js` (Criados: clientes de API e Web Speech)
- `public/js/components/*.js` (Criados: componentes modulares de UI)
- `public/js/app.js` (Criado: orquestrador ES6)
- `public/main.js` (Refatorado: ponte transparente de inicialização)
- `server.js` (Refatorado: bootstrap limpo de < 100 linhas)

### Arquivos Removidos e Motivos
- Nenhum arquivo de negócio foi excluído arbitrariamente; códigos mortos como a função não invocada `triggerElevenLabsVideoGeneration` dentro de `server.js` foram eliminados, mantendo 100% das funcionalidades ativas.

### Itens Mantidos em Dúvida (Segurança de Build)
- Pacotes como `@ai-sdk/react`, `ai`, `motion`, `lucide-react` foram mantidos no `package.json` para garantir total compatibilidade com extensões e plugins pré-instalados no ambiente de compilação do Vite.
- O arquivo `src/services/atlasCloudService.js` foi mantido como re-exportador para evitar regressões em caso de scripts externos referenciando o caminho original.
