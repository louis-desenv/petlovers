/**
 * Controller do Chat do Dr. Miau
 * Orquestra turnos do chat, streaming de respostas via SSE e análise de imagens pelo agente de visão.
 */

const { 
  getOrCreateConversation, 
  updatePromptInfo 
} = require("../services/session.store");
const { 
  cleanPortugueseText, 
  buildAlternatingContents 
} = require("../services/prompt.service");
const { 
  callGemini, 
  callGeminiStream, 
  analyzeImageWithAgent 
} = require("../services/gemini.service");
const atlasService = require("../services/atlas.service");
const { 
  VIDEO_URLS, 
  SENTIMENT_TO_VIDEO, 
  INITIAL_MESSAGE, 
  ALT_INITIAL_MESSAGE, 
  OLD_INITIAL_MESSAGE, 
  OLD_INITIAL_MESSAGE_2 
} = require("../config/constants");
const { getGeminiApiKey } = require("../config/env");

/**
 * Processa a requisição completa do chat (Gemini + Análise + Disparo de Vídeo)
 */
async function processChatRequest({
  message,
  history,
  sessionState = null,
  onChunk = null,
  image = null,
  mimeType = null,
  userId = null,
  sessionId = null,
  conversationId = null
}) {
  const cleanMsg = (message || "").toLowerCase().trim();

  // Identificadores de isolamento estrito
  const cleanUserId = userId || sessionState?.userId || `usr_anon_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanSessionId = sessionId || sessionState?.sessionId || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const cleanConvId = conversationId || sessionState?.conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const convRecord = getOrCreateConversation(cleanConvId, cleanUserId, cleanSessionId);

  try {
    const cleanedHistory = Array.isArray(history)
      ? history.filter(h => h && (h.text || h.image || h.imageUrl) && 
          h.text !== INITIAL_MESSAGE && 
          h.text !== ALT_INITIAL_MESSAGE && 
          h.text !== OLD_INITIAL_MESSAGE && 
          h.text !== OLD_INITIAL_MESSAGE_2)
      : [];

    const isDanone = cleanMsg.includes("danone");
    let parsed;

    if (isDanone) {
      console.log(`[Danone Cheat Code] Pulo direto para geração de vídeo na Atlas Cloud ativado!`);
      const danoneText = "Miau! Código especial Danone ativado! Estou enviando seu pedido para o estúdio Atlas Cloud (Seedance 2.0) agora mesmo! 🚀🎬✨";
      if (onChunk) onChunk(danoneText);

      parsed = {
        response: danoneText,
        sentiment: "alegre",
        phase: 3,
        progress: 100,
        ready_for_confirmation: false,
        trigger_video_generation: true,
        video_prompt: `High-end 3D Pixar-Disney style animation of an adorable hero pet in a magical glowing wonderland, cinematic volumetric lighting, 8k Octane render, 16:9 widescreen.`
      };
    } else {
      const hasUserSentPhoto = Boolean(
        image || 
        cleanedHistory.some(h => (h.image || h.imageUrl)) || 
        (sessionState && sessionState.photoReceived)
      );

      const hasUserRefusedPhoto = Boolean(
        (sessionState && sessionState.photoRefused) ||
        cleanedHistory.some(h => typeof h.text === "string" && (
          h.text.toLowerCase().includes("continuar apenas com a descrição") ||
          h.text.toLowerCase().includes("continuar sem foto") ||
          h.text.toLowerCase().includes("não tenho foto") ||
          h.text.toLowerCase().includes("prefiro sem foto") ||
          h.text.toLowerCase().includes("sem foto")
        ))
      );

      const userTurnCount = (cleanedHistory || []).filter(h => h.role === "user").length + 1;

      const systemInstruction = `Você é o Dr. Miau, um assistente carinhoso, empático e acolhedor que ajuda tutores a criar uma cena personalizada em animação 3D com seu pet. Seu objetivo é conduzir uma conversa fluida e natural para conhecer o animal e, em conjunto com o tutor, construir um cenário e uma ação inesquecível para ele.

OBJETIVO PRINCIPAL
Antes de definir a cena, procure entender quem é o pet: nome, espécie (gato, cachorro, etc.), características físicas marcantes (cor da pelagem, porte, olhos) e personalidade/manias. Use estritamente essas informações para tornar a cena única e pessoal.

ETAPAS DA CONVERSA
1. Conhecer o pet e o tutor
- Pergunte o nome e explore aos poucos como ele é fisicamente e de personalidade.
- Faça UMA pergunta por vez, comentando com carinho o que a pessoa acabou de contar.
- Não transforme a conversa em formulário. Nunca invente dados não mencionados pelo tutor.

SOLICITAÇÃO DE FOTO DO PET:
${hasUserSentPhoto 
  ? "- O tutor JÁ ENVIOU a foto do pet (está salva como referência visual única para a Atlas Cloud). Agradeça e comente a foto brevemente e NUNCA mais peça foto." 
  : hasUserRefusedPhoto 
    ? "- O tutor optou por CONTINUAR SEM FOTO. Respeite com entusiasmo! NUNCA mais peça foto e use 100% a descrição textual do animal fornecida por ele." 
    : userTurnCount >= 2 
      ? "- Como a conversa já iniciou e você já conhece o pet, convide o tutor com delicadeza pelo chat a enviar uma fotinho do pet (se ele tiver) ou continuar apenas com a descrição. Defina `photo_requested: true` no JSON." 
      : "- No início imediato, apenas converse pelo chat conhecendo o pet sem pressionar por foto."}

2. Construir o cenário
- Convide a pessoa a imaginar onde gostaria de ver o pet (ex: em cima de uma árvore, praia mágica, parque ensolarado, etc.).
- Relacione o ambiente aos hábitos do pet descritos pelo tutor.

3. Definir a ação do pet
- Pergunte o que o pet estaria fazendo no cenário (ex: explorando curioso, brincando, descansando na sombra).
- Confirme a ideia de modo breve e carinhoso.

GERAÇÃO DE VÍDEO 3D NA ATLAS CLOUD:
- Quando cenário e ação estiverem aprovados pelo tutor (ex: "sim", "pode gerar", "adorei", "vamos", "ficou ótimo"), defina:
  \`trigger_video_generation: true\`, \`progress: 100\`.
- Crie em \`video_prompt\` uma descrição cinematográfica técnica rica em inglês (Pixar/Disney 3D animation, cinematic volumetric lighting, 8k render, 16:9 widescreen):
  * ${hasUserSentPhoto ? "COMO HÁ FOTO DO TUTOR: O prompt DEVE incluir '@image1' como referência do personagem (ex: 'The character @image1 in this scene: ...')." : "COMO NÃO HÁ FOTO DO TUTOR: NUNCA USE '@image1' E NUNCA USE IMAGENS DO DR. MIAU. Descreva detalhadamente o animal na cena usando EXATAMENTE a espécie, cor da pelagem e características informadas pelo tutor."}

FORMATO DE RESPOSTA OBRIGATÓRIO:
Retorne SEMPRE E EXCLUSIVAMENTE um objeto JSON válido:
{
  "response": "Texto da sua mensagem para o tutor em português do Brasil",
  "sentiment": "alegre" | "neutro" | "preocupado" | "protetor" | "confuso",
  "phase": 1 | 2 | 3,
  "progress": 0 a 100,
  "photo_requested": true | false,
  "ready_for_confirmation": true | false,
  "trigger_video_generation": true | false,
  "video_prompt": ""
}`;

      const promptContents = buildAlternatingContents(cleanedHistory, message, image);
      const responseText = onChunk 
        ? await callGeminiStream(promptContents, systemInstruction, onChunk, cleanedHistory)
        : await callGemini(promptContents, systemInstruction, cleanedHistory);

      let cleanResponseText = (responseText || "").trim();
      const firstBrace = cleanResponseText.indexOf("{");
      const lastBrace = cleanResponseText.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanResponseText = cleanResponseText.substring(firstBrace, lastBrace + 1);
      } else if (cleanResponseText.startsWith("```")) {
        cleanResponseText = cleanResponseText.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
      }

      try {
        parsed = JSON.parse(cleanResponseText);
      } catch (jsonErr) {
        let extractedText = "";
        const partialMatch = cleanResponseText.match(/"response"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)/);
        if (partialMatch && partialMatch[1]) {
          extractedText = partialMatch[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
        }
        parsed = {
          response: extractedText || cleanResponseText || "Olá! Adorei conhecer mais sobre seu pet. Onde você gostaria de imaginar o cenário dele?",
          sentiment: "alegre",
          phase: sessionState?.currentPhase || 1,
          progress: sessionState?.progress || 25,
          ready_for_confirmation: false,
          trigger_video_generation: false,
          video_prompt: ""
        };
      }
    }

    if (!["alegre", "neutro", "preocupado", "protetor", "confuso"].includes(parsed.sentiment)) {
      parsed.sentiment = "alegre";
    }

    if (typeof parsed.response === "string") {
      let rText = parsed.response.trim()
        .replace(/^Here is the JSON requested:?/i, "")
        .replace(/```(json)?/gi, "")
        .replace(/```/g, "")
        .trim();
      parsed.response = cleanPortugueseText(rText);
    }

    if (!parsed.response || !parsed.response.trim()) {
      parsed.response = "Olá! Como posso ajudar você a criar a cena 3D perfeita para o seu pet hoje?";
    }

    const targetKey = SENTIMENT_TO_VIDEO[parsed.sentiment] || "normal";
    const geminiKey = getGeminiApiKey();

    let atlasJobId = null;
    let atlasStatus = null;
    let atlasError = null;

    if (parsed.trigger_video_generation && parsed.video_prompt) {
      let sanitizedVideoPrompt = parsed.video_prompt;
      if (typeof sanitizedVideoPrompt === "string") {
        if (sanitizedVideoPrompt.toLowerCase().includes("equações") || 
            sanitizedVideoPrompt.toLowerCase().includes("equacoes") || 
            sanitizedVideoPrompt.toLowerCase().includes("equation")) {
          sanitizedVideoPrompt = sanitizedVideoPrompt
            .replace(/equações\s*\d*/gi, "")
            .replace(/equacoes\s*\d*/gi, "")
            .replace(/equations?\s*\d*/gi, "")
            .trim();
          if (sanitizedVideoPrompt.length < 25) {
            sanitizedVideoPrompt = "High-end 3D Pixar-Disney style animation of an adorable hero pet in a magical glowing wonderland, cinematic volumetric lighting, 8k Octane render, 16:9 widescreen.";
          }
        }
      }

      let petImageUrl = null;
      if (!hasUserRefusedPhoto) {
        if (image && typeof image === "string" && image.trim().length > 100) {
          petImageUrl = image.trim();
        } else if (sessionState && sessionState.photoReceived) {
          const photoCandidate = (cleanedHistory || []).find(h => (h.image || h.imageUrl) && typeof (h.image || h.imageUrl) === "string" && (h.image || h.imageUrl).length > 100);
          if (photoCandidate) {
            petImageUrl = (photoCandidate.image || photoCandidate.imageUrl).trim();
          }
        }
      }

      updatePromptInfo(cleanConvId, {
        prompt: sanitizedVideoPrompt,
        jobId: `prompt_${Date.now()}`,
        status: "processing"
      });

      try {
        const atlasResult = await atlasService.generateReferenceVideo({
          imageUrl: petImageUrl,
          prompt: sanitizedVideoPrompt,
          ratio: "16:9",
          duration: 15,
          resolution: "720p"
        });

        if (atlasResult && atlasResult.taskId) {
          atlasJobId = atlasResult.taskId;
          atlasStatus = atlasResult.status || "processing";
          updatePromptInfo(cleanConvId, {
            jobId: atlasJobId,
            status: atlasStatus
          });
        }
      } catch (atlasErr) {
        console.error("❌ [Atlas Cloud] Erro ao disparar geração do vídeo:", atlasErr.message);
        atlasError = atlasErr.message;
        updatePromptInfo(cleanConvId, {
          status: "error",
          error: atlasErr.message
        });
      }
    }

    const apiStatus = {
      gemini_connected: !!geminiKey,
      gemini_error: !geminiKey ? "GEMINI_API_KEY_MISSING: Chave GEMINI_API_KEY não configurada no servidor." : null,
      atlascloud_configured: true,
      atlascloud_error: atlasError || null
    };

    return {
      userId: cleanUserId,
      sessionId: cleanSessionId,
      conversationId: cleanConvId,
      response: parsed.response,
      sentiment: parsed.sentiment,
      phase: parsed.phase || 1,
      progress: parsed.progress !== undefined ? parsed.progress : 0,
      pet_profile: parsed.pet_profile || null,
      photo_requested: parsed.photo_requested || false,
      ready_for_confirmation: parsed.ready_for_confirmation || false,
      trigger_video_generation: parsed.trigger_video_generation || false,
      video_prompt: parsed.video_prompt || "",
      jobId: atlasJobId || null,
      video_status: atlasStatus || null,
      nativeUrl: `/videos/${targetKey}.mp4`,
      fallbackUrl: VIDEO_URLS[targetKey] || VIDEO_URLS.normal,
      api_status: apiStatus
    };
  } catch (err) {
    console.error("[Gemini Chat Processing Error]:", err);
    return {
      userId: cleanUserId,
      sessionId: cleanSessionId,
      conversationId: cleanConvId,
      response: "Olá! Adorei conversar com você. Me conta mais sobre o que seu pet mais gosta de fazer!",
      sentiment: "alegre",
      phase: sessionState?.currentPhase || 1,
      progress: sessionState?.progress || 25,
      pet_profile: null,
      photo_requested: false,
      ready_for_confirmation: false,
      trigger_video_generation: false,
      video_prompt: "",
      jobId: null,
      video_status: null,
      nativeUrl: "/videos/normal.mp4",
      fallbackUrl: VIDEO_URLS.normal,
      api_status: {
        gemini_connected: false,
        gemini_error: `CHAT_ERROR: ${err.message}`,
        atlascloud_configured: true,
        atlascloud_error: null
      }
    };
  }
}

/**
 * Endpoint POST /api/chat
 */
async function handleChat(req, res) {
  const { message, history, sessionState, image, imageUrl, mimeType, userId, sessionId, conversationId } = req.body;
  if (!message && !image && !imageUrl) {
    return res.status(400).json({ error: "Sua mensagem é necessária." });
  }

  const effectiveUserId = userId || req.headers["x-user-id"] || sessionState?.userId || "usr_anonymous";
  const effectiveSessionId = sessionId || req.headers["x-session-id"] || sessionState?.sessionId || null;
  const effectiveConvId = conversationId || req.headers["x-conversation-id"] || sessionState?.conversationId || null;

  const result = await processChatRequest({
    message: message || "Enviei uma foto do meu pet 📸",
    history,
    sessionState,
    image: image || imageUrl || null,
    mimeType: mimeType || "image/jpeg",
    userId: effectiveUserId,
    sessionId: effectiveSessionId,
    conversationId: effectiveConvId,
    onChunk: null
  });

  res.json(result);
}

/**
 * Endpoint POST /api/chat/stream
 */
async function handleChatStream(req, res) {
  const { message, history, sessionState, image, imageUrl, mimeType, userId, sessionId, conversationId } = req.body;
  if (!message && !image && !imageUrl) {
    return res.status(400).json({ error: "Sua mensagem é necessária." });
  }

  const effectiveUserId = userId || req.headers["x-user-id"] || sessionState?.userId || "usr_anonymous";
  const effectiveSessionId = sessionId || req.headers["x-session-id"] || sessionState?.sessionId || null;
  const effectiveConvId = conversationId || req.headers["x-conversation-id"] || sessionState?.conversationId || null;

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const result = await processChatRequest({
      message: message || "Enviei uma foto do meu pet 📸",
      history,
      sessionState,
      image: image || imageUrl || null,
      mimeType: mimeType || "image/jpeg",
      userId: effectiveUserId,
      sessionId: effectiveSessionId,
      conversationId: effectiveConvId,
      onChunk: (chunk) => {
        sendEvent("chunk", { chunk });
      }
    });

    sendEvent("done", { data: result });
    res.end();
  } catch (err) {
    console.error("[Chat Stream Endpoint Error]:", err);
    sendEvent("done", {
      data: {
        userId: effectiveUserId,
        sessionId: effectiveSessionId,
        conversationId: effectiveConvId,
        response: "Olá! Adorei conversar com você. Me conta mais sobre seu pet!",
        sentiment: "alegre",
        phase: sessionState?.currentPhase || 1,
        progress: sessionState?.progress || 25
      }
    });
    res.end();
  }
}

/**
 * Endpoint POST /api/analyze-image
 */
async function handleAnalyzeImage(req, res) {
  try {
    const { imageBase64, mimeType, phase } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Imagem em formato Base64 não fornecida." });
    }

    const description = await analyzeImageWithAgent(imageBase64, mimeType || "image/jpeg", Number(phase) || 1);
    res.json({
      success: true,
      phase: Number(phase) || 1,
      description: cleanPortugueseText(description)
    });
  } catch (err) {
    console.error("[Vision Agent Endpoint Error]:", err);
    res.status(500).json({
      error: err.message,
      description: "Imagem recebida com sucesso! O pet na foto é extremamente fofo e encantador."
    });
  }
}

module.exports = {
  processChatRequest,
  handleChat,
  handleChatStream,
  handleAnalyzeImage
};
