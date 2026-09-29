# Substituição do Chatbot pelo Gemini Fluido & Envio Direto de Imagem para a Atlas Cloud

Plano de modernização da interface de conversa para remover roteiros engessados e mensagens repetitivas, implementando um Chatbot Gemini 100% conversacional, empático e inteligente, que encaminha a foto do pet diretamente como referência para a Atlas Cloud sem loops ou repetições.

## Decisões Confirmadas na Etapa de Alinhamento

> [!IMPORTANT]
> - **Estilo de Diálogo**: Assistente Inteligente e Fluido (sem fases forçadas, sem perguntas em loop ou roteiros engessados).
> - **Comportamento com Fotos**: Ao receber a imagem do pet, o Gemini não entra em loop pedindo foto novamente. A foto é registrada imediatamente como referência visual (`image_url`) para a renderização do vídeo 3D na **Atlas Cloud** (`bytedance/seedance-2.0-mini`) e o chatbot confirma o recebimento de forma natural e acolhedora.

---

## 1. Visão Geral & Nova Experiência

- **Diálogo Orgânico e Contextual**: O chatbot manterá o histórico contínuo (multi-turn) usando `gemini-3.8-flash` (e `gemini-3.1-flash-lite` para respostas ultra-rápidas), respondendo como um verdadeiro diretor criativo e parceiro de animação 3D.
- **Detecção de Foto e Envio Imediato**: Quando o usuário anexa uma imagem, o backend armazena o upload diretamente no estado da sessão do vídeo e prepara a referência fotográfica para a geração do vídeo cinematográfico.
- **Fim das Repetições**: O prompt de sistema será completamente limpo de restrições artificiais de "fases 1, 2, 3" e instruções que causavam o Dr. Miau a pedir repetidamente fotos ou repetir frases prévias.

---

## 2. Experiência do Usuário & Design Visual

```
┌────────────────────────────────────────────────────────────────────────┐
│                        BARRA SUPERIOR (HEADER)                         │
│  [Ícone Pet Agent]        Dr. Miau • Studio 3D AI         [Ajuda (?)]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                     HISTÓRICO DA CONVERSA                        │  │
│  │  👤 Usuário: [Foto do pet enviada] "Quero ele voando no espaço"   │  │
│  │                                                                  │  │
│  │  🐾 Gemini: "Foto recebida e adicionada como referência visual!  │  │
│  │     Já preparei a cena espacial para a renderização 3D!"         │  │
│  │     [⚡ Card de Confirmação e Geração de Vídeo Atlas Cloud]       │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  [📎 Anexar Foto] [ Digite sua ideia ou converse... ] [🎙️ Voz] [🚀 Enviar] │
└────────────────────────────────────────────────────────────────────────┘
```

- **Notificação Visual Imediata de Imagem**: Assim que a foto é anexada ou enviada, o chat exibe uma miniatura com badge de confirmação verde *"Foto anexada como referência visual para a Atlas Cloud"*.
- **Transição Fluida**: O botão de geração de vídeo 3D da Atlas Cloud fica acessível a qualquer momento que o usuário definir sua ideia ou enviar a foto.

---

## 3. Arquitetura Técnica & Fluxo de Dados

```
 ┌─────────────────┐        ┌──────────────────┐        ┌───────────────────────┐
 │   Navegador /   │ ──1──> │  Servidor Node   │ ──2──> │  Gemini API MultiTurn │
 │  Chat Interface │        │   (server.js)    │        │   (gemini-3.8-flash)  │
 └─────────────────┘        └──────────────────┘        └───────────────────────┘
          │                           │
          │ (Envio de Imagem Base64)  │ (Guarda referência visual)
          ▼                           ▼
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │                    Atlas Cloud API (Seedance 2.0 Mini)                       │
 │  Prompt Cinematográfico + @image1 (Foto do pet do usuário como referência)   │
 └──────────────────────────────────────────────────────────────────────────────┘
```

### Principais Alterações no Código:
1. **Remodelagem do Prompt de Sistema (`systemInstruction`)**:
   - Eliminação de regras que forçavam a repetição de perguntas ("qual é o nome do pet? envie a foto").
   - Nova instrução: Se uma foto já estiver presente ou for enviada, reconheça imediatamente e integre-a à criação do vídeo 3D sem solicitar novamente.
2. **Atualização do Tratamento de Mídia no Frontend (`index.html` e `client.js`)**:
   - Garantir que a imagem enviada pelo usuário seja anexada ao payload `/api/chat` de forma persistente e o estado `hasPetPhoto` seja ativado no cliente.
3. **Geração na Atlas Cloud**:
   - Ao disparar a geração de vídeo, a foto enviada pelo usuário é enviada no parâmetro de imagem da API Atlas Cloud com prompt enriquecido.

---

## 4. Plano de Execução & Testes

1. **Ajuste do Servidor**: Reescrever as instruções do sistema no `server.js` para diálogo livre, empático e inteligente.
2. **Ajuste da Gestão de Estado**: Fazer com que o upload de foto marque o pet como identificado e pronto para renderizar.
3. **Validação & Testes**:
   - Testar conversa multi-turn sem loops.
   - Enviar foto do pet e verificar se a IA responde naturalmente e conecta com a geração Atlas Cloud sem pedir imagem novamente.
