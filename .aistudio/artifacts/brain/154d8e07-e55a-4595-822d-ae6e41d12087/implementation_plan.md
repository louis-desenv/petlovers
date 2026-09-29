# Garantia de Geração do Vídeo Atlas Cloud e Visibilidade da Galeria

Plano de correção para garantir que a geração de vídeo na API Atlas Cloud seja disparada **automaticamente** quando o vídeo for ativado (incluindo o código especial Danone), com imagem de referência padrão quando nenhuma foto for anexada pelo usuário, e com destaque total para a Galeria de Vídeos.

---

## 1. Problemas Identificados e Soluções

1. **Geração não disparava sem foto prévia**:
   - Se o usuário digitava "Danone" sem anexar uma foto primeiro, o sistema solicitava foto e interrompia a geração na Atlas Cloud.
   - **Solução**: Se não houver foto enviada pelo tutor, o sistema usará automaticamente uma imagem de referência de alta qualidade de um pet fofinho para que a Atlas Cloud sempre processe o vídeo sem erros.

2. **Geração Automática (Auto-Trigger)**:
   - Quando o Dr. Miau ativava a fase de vídeo (`isVideoTriggered`), o vídeo ficava aguardando um clique manual.
   - **Solução**: Adicionar um `useEffect` para iniciar o envio à Atlas Cloud de forma 100% automática assim que a etapa de vídeo for acionada!

3. **Destaque Visual da Galeria de Vídeos**:
   - O botão da galeria ficava apenas no cabeçalho superior.
   - **Solução**:
     - Adicionar um botão destacado com brilho de néon e badge de contagem no cabeçalho.
     - Adicionar um segundo painel/botão "🎬 Galeria de Vídeos" na barra lateral esquerda (abaixo da Ficha do Pet) para acesso imediato.
     - Exibir o modal de galeria imediatamente ao concluir a renderização do vídeo.

---

## 2. Etapas de Modificação

1. **Atualizar `src/App.tsx`**:
   - Implementar imagem de referência de fallback (`DEFAULT_PET_REF_IMAGE`).
   - Implementar disparo automático (`useEffect` escutando `state.isVideoTriggered`).
   - Adicionar o botão da Galeria também na coluna lateral esquerda (abaixo da Ficha do Pet).
   - Garantir que a requisição POST para `/api/generate-pet-video` seja enviada e o polling seja iniciado.
2. **Atualizar `server.js`**:
   - Assegurar que `/api/generate-pet-video` converta a imagem para formato válido e chame `atlasCloudService.generateReferenceVideo`.
3. **Verificação com `compile_applet`**:
   - Garantir compilação sem erros.
