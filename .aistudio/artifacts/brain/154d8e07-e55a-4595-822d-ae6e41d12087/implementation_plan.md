# Plano de Refatoração Arquitetural Completa — Pet Agent Dr. Miau

Refatoração estrutural completa da arquitetura do projeto para torná-lo limpo, desacoplado, modular e intuitivo para manutenção por desenvolvedores com foco em front-end, preservando 100% dos comportamentos, recursos de IA (Gemini 3.8 Flash), estúdio de animação 3D (Atlas Cloud Seedance), streaming SSE e isolamento de sessões.

## Decisões Confirmadas e Diretrizes do Projeto

> [!IMPORTANT]
> **Decisões Alinhadas na Fase de Clarificação:**
> 1. **Backend Node.js/Express:** Arquitetura **MVC modular** com separação explícita de `routes/`, `controllers/`, `services/` e `config/`.
> 2. **JavaScript do Frontend:** **Módulos ES6 nativos** (`import`/`export`) distribuídos por componentes funcionais de tela e serviços de API.
> 3. **Estilos CSS:** **Arquivo CSS centralizado e único** (`styles.css`), reestruturado com seções claras, tokens de variáveis CSS e documentação no topo de cada bloco.
> 4. **Segurança de Código:** Regra de "Zero quebra funcional" — nenhuma rota ou comportamento existente será descontinuado. Dependências sem uso direto no código (`@ai-sdk/react`, `react`, `lucide-react`, `motion`) serão mantidas em `package.json` para evitar riscos de pipeline e documentadas na seção de itens em dúvida.

---

## 1. Visão Geral e Diagnóstico Atual

### 1.1 Diagnóstico do Código Atual
- **`server.js` (2.312 linhas):** Monólito contendo configuração do Express, resolução dinâmica de chaves de API, lógica de conexão com Gemini e Atlas Cloud, geração de prompts cinematográficos em inglês, analisador heurístico de perfil do pet, armazenamento de conversas em memória, download/sincronização de vídeos e todas as rotas HTTP e SSE.
- **`public/main.js` (3.055 linhas):** Monólito no front-end contendo todo o estado global, persistência em `localStorage`/`sessionStorage`, controle de microfone e reconhecimento de fala (Web Speech API), lógica de players duplos para transição de vídeo sem engasgos, renderização de chat, modal de galeria, menu de perfil e disparo de requisições.
- **`public/styles.css` (3.283 linhas):** Folha de estilos extensa com algumas classes duplicadas e regras sobrepostas que dificultam a leitura rápida.
- **Duplicação de HTML:** `index.html` (na raiz, lido pelo Vite) e `public/index.html` (servido pelo Express) apresentavam pequenas divergências de texto.

---

## 2. Nova Arquitetura Proposta

### 2.1 Diagrama de Arquitetura do Sistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Navegador / SPA)                      │
│                                                                        │
│   public/index.html (HTML Semântico limpo, sem scripts inline)         │
│   public/styles.css (Design Tokens, Temas, Componentes, Responsivo)    │
│                                                                        │
│   public/js/app.js (Bootstrap & Orquestrador ES6)                      │
│      ├── state/store.js          (Estado Global e Cache Isolado)       │
│      ├── services/               (Comunicação Externa)                 │
│      │     ├── api.service.js    (REST & SSE Streaming)               │
│      │     ├── speech.service.js (Reconhecimento de Voz)               │
│      │     └── audio.service.js  (Efeitos Sonoros)                     │
│      └── components/             (Componentes Visuais da Tela)         │
│            ├── chat.component.js (Mensagens, Balão e Mini-Histórico)   │
│            ├── video.component.js(Dual-Buffer & Expressões do Miau)    │
│            ├── photo.component.js(Upload de Fotos & Card Interativo)   │
│            ├── progress.component.js (Banner de Renderização 3D)       │
│            └── modal.component.js(Perfil, Galeria, Prompt e Ajuda)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Requisições HTTP / SSE Streaming
┌───────────────────────────────────▼────────────────────────────────────┐
│                        BACKEND (Node.js & Express)                     │
│                                                                        │
│   server.js (Bootstrap leve: middlewares, CORS e montagem de rotas)    │
│                                                                        │
│   server/routes/                                                       │
│      ├── chat.routes.js   (/api/chat, /api/chat/stream, /api/analyze)  │
│      ├── video.routes.js  (/api/videos, /api/video-status, /proxy)     │
│      ├── auth.routes.js   (/api/reset-prompt, /api/auth/logout, etc.)  │
│      └── status.routes.js (/health, /api/status, /api/config/atlas)    │
│                                                                        │
│   server/controllers/                                                  │
│      ├── chat.controller.js   (Orquestra turnos do chat e SSE)         │
│      ├── video.controller.js  (Disparo e polling de vídeo 3D)          │
│      ├── auth.controller.js   (Reset de histórico e logout limpo)      │
│      └── status.controller.js (Diagnóstico de chaves e conexão)        │
│                                                                        │
│   server/services/                                                     │
│      ├── gemini.service.js    (Integração @google/genai & Fallbacks)   │
│      ├── atlas.service.js     (Integração Atlas Cloud Seedance 2.0)    │
│      ├── prompt.service.js    (Sanitização e tradução CinePrompt AI)   │
│      └── session.store.js     (Armazenamento e isolamento de sessões)  │
│                                                                        │
│   server/config/                                                       │
│      ├── env.js               (Detecção dinâmica de chaves e portas)   │
│      └── constants.js         (Textos iniciais, sentimentos e vídeos)  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Plano de Execução em Etapas

### Etapa 1: Modularização do Backend (MVC)
1. **Configuração e Constantes (`server/config/`):**
   - Criar `server/config/env.js`: resolução unificada de `GEMINI_API_KEY` e `ATLASCLOUD_API_KEY`.
   - Criar `server/config/constants.js`: mapeamento de vídeos, emoções, mensagens iniciais e constantes de sistema.
2. **Serviços de Domínio (`server/services/`):**
   - Criar `server/services/session.store.js`: `conversationStore` isolado por `userId` e `conversationId`.
   - Criar `server/services/prompt.service.js`: heurística de perfil do pet, sanitização de texto e tradução cinematográfica.
   - Criar `server/services/gemini.service.js`: inicialização do `@google/genai`, chamada com stream/REST e fallbacks inteligentes.
   - Criar `server/services/atlas.service.js`: mover e enriquecer a lógica do `src/services/atlasCloudService.js`.
3. **Controllers (`server/controllers/`):**
   - `chat.controller.js`: handlers para `/api/chat` e `/api/chat/stream`.
   - `video.controller.js`: handlers para geração de vídeo, proxy de vídeo e polling de status.
   - `auth.controller.js`: handlers para `/api/reset-prompt` e `/api/auth/logout`.
   - `status.controller.js`: handlers para `/health`, `/api/status` e atualização de chave em runtime.
4. **Rotas (`server/routes/`):**
   - Modularizar cada grupo de rotas com Express Router e agregar em `server/routes/index.js`.
5. **Refatoração do `server.js` raiz:**
   - Reduzir de 2.312 linhas para menos de 90 linhas limpas e autoexplicativas.
6. **Verificação da Etapa:** Testar compilação (`compile_applet`), reiniciar servidor de desenvolvimento e testar endpoints de chat, health e status via node/curl.

---

### Etapa 2: Modularização do Frontend (Módulos ES6)
1. **Estado e Utilitários (`public/js/state/` e `public/js/utils/`):**
   - `public/js/utils/dom.js`: seletores `$` e `$$`, helpers de classe e scroll suave.
   - `public/js/utils/text.js`: sanitização de texto e profilaxia contra resíduos de JSON.
   - `public/js/state/store.js`: gerenciamento do `state`, chaves isoladas no `localStorage`/`sessionStorage` e logs de auditoria.
2. **Serviços do Cliente (`public/js/services/`):**
   - `public/js/services/api.service.js`: chamadas HTTP `fetch` com `cache: 'no-store'`, leitor do stream SSE e status de vídeo.
   - `public/js/services/speech.service.js`: reconhecimento de voz Web Speech API com tratamento de erros.
3. **Componentes da Interface (`public/js/components/`):**
   - `public/js/components/chat.component.js`: exibição de mensagens, balão do Dr. Miau e digitação.
   - `public/js/components/video.component.js`: dual-buffer de vídeo A/B, pré-carregamento e alternância de animações.
   - `public/js/components/photo.component.js`: bandeja de visualização e card interativo de convite de foto.
   - `public/js/components/progress.component.js`: progresso da jornada e barra de status do vídeo 3D.
   - `public/js/components/modal.component.js`: controle de modais (perfil com troca de usuário, galeria, ajuda e prompt).
4. **Ponto de Entrada (`public/js/app.js`):**
   - Orquestrador principal conectando eventos, inicializando componentes e disparando `init()`.
5. **Manter compatibilidade com `public/main.js`:**
   - O `public/main.js` atual poderá atuar como re-exportador ou bundle de transição para garantir que nenhuma referência estática quebre.
6. **Verificação da Etapa:** Testar build com Vite (`node build.js`), testar carregamento no navegador e validar compilação.

---

### Etapa 3: Higienização e Estruturação do CSS Centralizado
1. **Consolidação em `public/styles.css`:**
   - Adicionar sumário no topo do arquivo com mapa das seções.
   - Eliminar seletores duplicados mantendo exatamente a mesma aparência visual.
   - Preservar todas as variáveis de tema (`peach`, `emerald`, `ocean`, `purple`).
2. **Sincronização de `index.html`:**
   - Unificar o `index.html` da raiz com `public/index.html` para que tanto o Vite quanto o Express utilizem exatamente a mesma estrutura HTML sem divergências.
   - Extrair o pequeno polyfill inline do `<head>` para um arquivo próprio caso apropriado, mantendo a tag sem poluição.

---

### Etapa 4: Documentação Técnica Completa (README.md)
Criar um `README.md` abrangente focado no desenvolvedor front-end:
- **Visão Geral do Projeto:** O que é o Dr. Miau, quais APIs utiliza (Gemini 3.8 Flash e Atlas Cloud Seedance 2.0).
- **Mapa da Estrutura de Pastas:** Árvore comentada destacando onde mexer para cada necessidade.
- **Como Rodar Localmente:** Instruções de inicialização, variáveis de ambiente e scripts.
- **Guia para Desenvolvedores Front-end:**
  - Onde alterar estilos (`public/styles.css`).
  - Onde adicionar novos componentes ou botões (`public/js/components/`).
  - Como o fluxo de dados viaja do input do usuário -> backend -> streaming SSE -> tela.
  - Como funciona o isolamento de sessões e cache do navegador.
- **Lista de Itens em Dúvida:** Documentação transparente dos pacotes mantidos para segurança de build.

---

## 4. Garantia de Não-Regressão e Critérios de Aceite
- **Zero alteração de comportamento:** Todas as funcionalidades (chat em tempo real, expressões emocionais do mascote em vídeo, upload de foto, card interativo de recusa/envio de foto, disparo de vídeo 3D na Atlas Cloud, troca isolada de contas de usuário e reset limpo de conversa) devem permanecer 100% idênticas.
- **Compilação validada:** `compile_applet` e `node build.js` devem passar sem erros em cada etapa.
- **Servidor responsivo:** Endpoint `/health` e `/api/status` retornando HTTP 200 instantaneamente.
