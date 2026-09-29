# Plano de Implementação — Solicitação de Foto Interativa e Geração Fiel na Atlas Cloud

## 🎯 Objetivo
1. **Eliminar 100% qualquer envio de imagens pré-fabricadas** (como `dr-miau.png`) para a Atlas Cloud. Apenas a foto real enviada pelo tutor é utilizada.
2. **Geração baseada na descrição fiel do pet**: Se o tutor não enviar foto, a Atlas Cloud recebe um prompt cinematográfico Text-to-Video completo com a espécie, cor (ex: gato preto), cenário (ex: em cima da árvore) e ações descritas pelo tutor.
3. **Fluxo de foto amigável e interativo no chat**:
   - Início da conversa pelo chat conhecendo o pet e sua história.
   - Após as primeiras trocas, exibição de um card/popup interativo dentro do chat com botões para **"Enviar Foto"** (com prévia inline) ou **"Continuar apenas com a descrição"** (recusar).

---

## 📋 Etapas de Execução

### 1. `src/services/atlasCloudService.js` & `server.js` (Backend)
- Remover a função `getDefaultPetReferenceImage()` e qualquer fallback para `dr-miau.png`.
- Ajustar a montagem do payload para a Atlas Cloud:
  - **Com foto do tutor**: envia `referenceImages: [imageUrl]` e condicionamento `@image1`.
  - **Sem foto do tutor**: envia `referenceImages: []`, sem tags `@image1`, permitindo que o modelo gere a cena 3D puramente a partir do prompt descritivo detalhado do animal.
- Atualizar as instruções do Gemini (`systemInstruction`) para sintetizar prompts 3D que incorporem estritamente os traços descritos pelo tutor (espécie, cores, pelagem, cenário, humor).

### 2. `public/index.html` & `public/main.js` (Frontend & Chat Interativo)
- **Card/Popup interativo de Foto no Chat**:
  - Criar um componente visual dentro do fluxo de mensagens do chat quando o Dr. Miau convida o tutor para compartilhar a foto.
  - Opção 1: Botão destacado para selecionar/tirar foto (com preview e confirmação).
  - Opção 2: Botão claro "Continuar sem foto (usar apenas a descrição)".
- **Controle de Estado**:
  - Se o tutor enviar a imagem, marca como foto confirmada e exibe miniatura na mensagem.
  - Se o tutor recusar, avisa o Dr. Miau para focar na descrição textual e avançar suavemente no roteiro da cena 3D.
- Atualizar a barra de ferramentas de anexo e input para manter sincronização completa.

### 3. Validação e Testes
- Testar fluxo de conversa com envio de foto e verificar que apenas a foto do tutor é repassada ao endpoint.
- Testar fluxo de conversa recusando o envio da foto (gato preto na árvore) e verificar que nenhuma imagem é enviada à Atlas Cloud, conferindo se o prompt de texto contém a descrição completa.
- Executar `compile_applet` e reiniciar o servidor.
