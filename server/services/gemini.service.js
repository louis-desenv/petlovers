/**
 * Serviço de Integração com o Google Gemini
 * Utiliza o SDK oficial @google/genai com fallback inteligente e streaming.
 */

const { GoogleGenAI } = require("@google/genai");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { getGeminiApiKey } = require("../config/env");
const { testConnection: testAtlasConnection, getAtlasApiKey } = require("./atlas.service");
const { RESPONSE_SCHEMA_DEF, INITIAL_MESSAGE, ALT_INITIAL_MESSAGE, OLD_INITIAL_MESSAGE, OLD_INITIAL_MESSAGE_2 } = require("../config/constants");
const { translateToEnglishCinematicTerms, evaluateConversationState } = require("./prompt.service");

let cachedWorkingModel = "gemini-2.5-flash";

const restResponseSchemaDef = {
  type: "OBJECT",
  properties: {
    response: { type: "STRING" },
    sentiment: { type: "STRING", enum: ["alegre", "neutro", "preocupado", "protetor", "confuso"] },
    phase: { type: "INTEGER" },
    progress: { type: "INTEGER" },
    pet_profile: {
      type: "OBJECT",
      properties: {
        name: { type: "STRING" },
        species: { type: "STRING" },
        appearance: { type: "STRING" },
        emotional_story: { type: "STRING" },
        scenario: { type: "STRING" },
        action: { type: "STRING" }
      }
    },
    photo_requested: { type: "BOOLEAN" },
    ready_for_confirmation: { type: "BOOLEAN" },
    trigger_video_generation: { type: "BOOLEAN" },
    video_prompt: { type: "STRING" }
  },
  required: ["response", "sentiment", "phase", "progress", "ready_for_confirmation", "trigger_video_generation", "video_prompt"]
};

/**
 * Gera um objeto de fallback inteligente quando a IA externa está indisponível
 */
function generateSmartFallbackObject(lastMessageText, history = [], apiErrorMsg = null) {
  const cleanedHistory = Array.isArray(history) 
    ? history.filter(h => h && h.text && h.text !== INITIAL_MESSAGE && h.text !== ALT_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE_2)
    : [];

  const evalState = evaluateConversationState(cleanedHistory, lastMessageText);
  const pet = evalState.petProfile;

  let response = "";
  let sentiment = "alegre";
  let phase = evalState.maxAllowedPhase;
  let progress = evalState.suggestedProgress;
  let trigger_video_generation = false;
  let video_prompt = "";

  const trimmedMsg = (lastMessageText || "").trim().toLowerCase();
  const isConfused = /(?:como\s+assim|o\s+que|qu[êe]|n[ãa]o\s+entendi|me\s+ajuda|n[ãa]o\s+compreendi|\?+$)/i.test(trimmedMsg);
  let ready_for_confirmation = false;
  const isAffirmative = /^(?:sim|pode|pode\s+gerar|gerar|vamos|bora|adorei|ficou\s+[oó]timo|autorizado|manda\s+ver|ok|com\s+certeza|isso\s+mesmo|perfeito)/i.test(trimmedMsg);

  if (evalState.isDanone) {
    response = "Miau! Código especial Danone ativado! Pulei todas as etapas e estou enviando seu pedido para o estúdio de vídeo agora mesmo! 🚀🎬✨";
    trigger_video_generation = true;
  } else if (isConfused) {
    sentiment = "alegre";
    trigger_video_generation = false;
    video_prompt = "";
    const nameDisplay = pet.petName ? pet.petName : "seu amiguinho";
    response = `Miau! *ronrom* Fica super tranquilo, eu te ajudo! 🐾 Estamos criando um vídeo mágico para o ${nameDisplay}. Me conta: qual detalhe dele, do lugar ou da brincadeira você mais gostaria de ver na cena? ✨`;
  } else if (!pet.isPhase1Complete) {
    phase = 1;
    progress = Math.min(40, Math.max(15, (cleanedHistory.length + 1) * 8));
    sentiment = "alegre";
    const nameDisplay = pet.petName ? pet.petName : "seu companheiro";
    response = `Miau! *ronrom* Que encanto conhecer ${nameDisplay}! Se você tiver uma fotinho linda dele, pode anexar aqui no chat para usarmos de referência visual 📸. Me conta também: onde você gostaria de ver ele brilhando na nossa animação?`;
  } else if (!evalState.hasScenarioDetails) {
    phase = 2;
    progress = 55;
    sentiment = "alegre";
    const nameDisplay = pet.petName ? pet.petName : "seu pet";
    response = `Miau! Já consigo ver cada traço d${nameDisplay} com clareza! E para o cenário do nosso curta-metragem: em qual lugar mágico você gostaria de imaginá-lo? (Ex: numa praia paradisíaca, numa floresta encantada ou no aconchego de casa?) 🏖️🏰✨`;
  } else if (!evalState.hasActionDetails) {
    phase = 3;
    progress = 75;
    sentiment = "alegre";
    const nameDisplay = pet.petName ? pet.petName : "ele";
    response = `Que cenário sensacional! E o que você gostaria de ver o ${nameDisplay} fazendo nessa cena? (Ex: correndo alegre, brincando com borboletas mágicas ou tirando uma soneca gostosa?) 🎬🐾`;
  } else if (!isAffirmative && !trigger_video_generation) {
    phase = 4;
    progress = 90;
    ready_for_confirmation = true;
    sentiment = "alegre";
    const nameDisplay = pet.petName || "seu pet";
    response = `Miau! *ronrom* Reuni todos os detalhes mágicos: o ${nameDisplay} em um cenário encantador com muita alegria em ação! Ficou perfeito para você? Me dá o seu sinal verde que eu já inicio a renderização 3D na Atlas Cloud agora mesmo! 🎬✨`;
  } else {
    phase = 4;
    progress = 100;
    ready_for_confirmation = false;
    trigger_video_generation = true;
    sentiment = "alegre";
    const nameDisplay = pet.petName || "nosso amiguinho";
    const actionDesc = (lastMessageText && lastMessageText.trim().length >= 2 && !isAffirmative) 
      ? lastMessageText.trim().replace(/[.!?]+$/, "") 
      : "running joyfully with bouncy rhythm and happy expressive eyes";
    response = `Miau! Que espetáculo! Sinal verde recebido! Estou colocando os computadores da Atlas Cloud para renderizar essa linda animação 3D do ${nameDisplay} agora mesmo! 🚀🎬✨`;
    video_prompt = translateToEnglishCinematicTerms(
      pet.petType,
      pet.petBreed,
      pet.coatColor,
      "magical vibrant wonderland",
      actionDesc,
      pet.petName
    );
  }

  return {
    response,
    sentiment,
    phase,
    progress,
    pet_profile: pet,
    ready_for_confirmation,
    trigger_video_generation,
    video_prompt,
    api_fallback_used: true,
    api_error_detail: apiErrorMsg || null
  };
}

/**
 * Retorna o fallback inteligente formatado como JSON string
 */
function generateSmartFallback(lastMessageText, history = [], apiErrorMsg = null) {
  return JSON.stringify(generateSmartFallbackObject(lastMessageText, history, apiErrorMsg));
}

/**
 * Realiza a chamada principal ao modelo Gemini via SDK com fallback para REST e modelos alternativos
 */
async function callGemini(contents, systemInstruction, history = []) {
  let lastUserText = "";
  if (Array.isArray(contents) && contents.length > 0) {
    const lastItem = contents[contents.length - 1];
    if (typeof lastItem === "string") {
      lastUserText = lastItem;
    } else if (lastItem.parts && Array.isArray(lastItem.parts)) {
      const textPart = lastItem.parts.find(p => p.text);
      if (textPart) lastUserText = textPart.text;
    } else if (lastItem.text) {
      lastUserText = lastItem.text;
    }
  }

  const currentKey = getGeminiApiKey();
  if (!currentKey) {
    const errorDetails = "GEMINI_API_KEY_MISSING: A variável GEMINI_API_KEY não foi encontrada.";
    console.warn("⚠️ [Gemini Client] " + errorDetails);
    return generateSmartFallback(lastUserText, history, errorDetails);
  }

  const isToken = currentKey.startsWith("ya29.");
  const baseModels = ["gemini-2.5-flash", "gemini-2.5-pro"];
  const modelsToTry = Array.from(new Set([cachedWorkingModel, ...baseModels]));
  const lastErrors = [];

  for (const modelName of modelsToTry) {
    // 1. Chamada via SDK Oficial @google/genai
    try {
      const ai = new GoogleGenAI({ apiKey: currentKey });
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA_DEF,
          maxOutputTokens: 1200,
          temperature: 0.7
        }
      });

      if (response && response.text) {
        cachedWorkingModel = modelName;
        return response.text;
      }
    } catch (sdkErr) {
      const errMsg = String(sdkErr.message || sdkErr);
      const isQuotaError = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED");
      lastErrors.push(`[SDK ${modelName}: ${errMsg.slice(0, 100)}]`);
      if (isQuotaError) continue;

      // 2. Chamada via REST API direta
      try {
        let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
        const headers = {
          "Content-Type": "application/json",
          "User-Agent": "aistudio-build"
        };
        if (isToken) {
          headers["Authorization"] = `Bearer ${currentKey}`;
        } else {
          apiUrl += `?key=${currentKey}`;
        }

        const payload = {
          contents: contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: restResponseSchemaDef,
            maxOutputTokens: 1200,
            temperature: 0.7
          }
        };

        const res = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          const json = await res.json();
          const extracted = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (extracted) {
            cachedWorkingModel = modelName;
            return extracted;
          }
        }
      } catch (restErr) {
        lastErrors.push(`[REST ${modelName}: ${restErr.message}]`);
      }
    }
  }

  const failureReason = `FALHA_CONEXAO_GEMINI: Falha em todos os modelos. Erros: ${lastErrors.join(" | ")}`;
  console.error("❌ " + failureReason);
  return generateSmartFallback(lastUserText, history, failureReason);
}

/**
 * Chamada de streaming para o Gemini via SSE
 */
async function callGeminiStream(contents, systemInstruction, onTextChunk, history = []) {
  let lastUserText = "";
  if (Array.isArray(contents) && contents.length > 0) {
    const lastItem = contents[contents.length - 1];
    if (typeof lastItem === "string") {
      lastUserText = lastItem;
    } else if (lastItem.parts && Array.isArray(lastItem.parts) && lastItem.parts[0]) {
      lastUserText = lastItem.parts[0].text || "";
    } else if (lastItem.text) {
      lastUserText = lastItem.text;
    }
  }

  const currentKey = getGeminiApiKey();
  if (!currentKey) {
    const errorDetails = "GEMINI_API_KEY_MISSING: A variável GEMINI_API_KEY não foi encontrada.";
    console.warn("⚠️ [Gemini Stream] " + errorDetails);
    return generateSmartFallback(lastUserText, history, errorDetails);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: currentKey });
    const responseStream = await ai.models.generateContentStream({
      model: cachedWorkingModel || "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA_DEF,
        maxOutputTokens: 1200,
        temperature: 0.7
      }
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullText += chunk.text;
        if (onTextChunk) onTextChunk(chunk.text);
      }
    }

    if (fullText.trim()) return fullText;
  } catch (err) {
    console.warn(`[Gemini Stream Error] ${err.message}. Alternando para chamada padrão.`);
  }

  return callGemini(contents, systemInstruction, history);
}

/**
 * Agente Especialista em Análise de Imagens do Pet
 */
async function analyzeImageWithAgent(imageBase64, mimeType = "image/jpeg", phase = 1) {
  const currentKey = getGeminiApiKey();
  if (!currentKey) {
    return "Imagem recebida! O amiguinho na foto parece ser muito fofo e carismático.";
  }

  let cleanBase64 = imageBase64;
  if (imageBase64.includes("base64,")) {
    cleanBase64 = imageBase64.split("base64,")[1];
  }

  let phaseInstruction = "";
  if (phase === 1) {
    phaseInstruction = "Sua missão nesta Parte 1 é descrever EXCLUSIVAMENTE O ANIMAL/PET presente na foto para alimentar o perfil do Dr. Miau. Detalhe com extrema precisão: 1) a espécie (gato, cão, pássaro, etc.), 2) raça (ou mistura de raças / vira-lata se aplicável), 3) cores exatas e padrões da pelagem ou pele (manchas, listras, degrade), 4) se possui alguma avariação, mancha marcante, cicatriz ou deficiência física visível. IGNORE COMPLETAMENTE O CENÁRIO OU AMBIENTE AO FUNDO. Foque 100% apenas nas características físicas do pet.";
  } else if (phase === 2) {
    phaseInstruction = "Sua missão nesta Parte 2 é descrever EXCLUSIVAMENTE O CENÁRIO / AMBIENTE presente na foto. Detalhe com extrema precisão elementos do fundo, iluminação, cores e decoração. IGNORE O ANIMAL. Foque 100% no cenário!";
  } else {
    phaseInstruction = "Sua missão nesta Parte 3 é descrever a ação, postura, acessórios e energia do pet e do cenário presente na foto para compor o vídeo final.";
  }

  const systemInstruction = `Você é o Agente Especialista em Análise de Imagens do Estúdio Dr. Miau. Seu único papel é analisar fotos com altíssima precisão de detalhes e gerar uma descrição técnica e minuciosa em português do Brasil. Responda diretamente com a descrição detalhada em 3 a 5 frases ricas, objetivas e encantadoras.`;

  try {
    const ai = new GoogleGenAI({ apiKey: currentKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          parts: [
            { inlineData: { mimeType: mimeType || "image/jpeg", data: cleanBase64 } },
            { text: phaseInstruction }
          ]
        }
      ],
      config: {
        systemInstruction: systemInstruction,
        maxOutputTokens: 400
      }
    });

    if (response && response.text) {
      return response.text.trim();
    }
  } catch (sdkErr) {
    console.warn("[Vision Agent] Fallback para descrição padrão ativado.");
  }

  return "Imagem analisada: Pet adorável com feições marcantes e pelagem bem definida na foto.";
}

/**
 * Checa o status e a saúde de todas as APIs conectadas
 */
async function checkApiStatuses() {
  const geminiKey = getGeminiApiKey();
  const atlasKey = getAtlasApiKey();

  let geminiConnected = false;
  let geminiError = null;

  if (!geminiKey) {
    geminiError = "GEMINI_API_KEY_MISSING: Chave não encontrada no ambiente.";
  } else {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const testRes = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "teste",
        config: { maxOutputTokens: 5 }
      });
      geminiConnected = !!testRes;
    } catch (e) {
      geminiError = e.message;
    }
  }

  const atlasStatus = await testAtlasConnection();

  return {
    gemini: {
      connected: geminiConnected,
      configured: !!geminiKey,
      error: geminiError
    },
    atlas: atlasStatus,
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  callGemini,
  callGeminiStream,
  analyzeImageWithAgent,
  generateSmartFallbackObject,
  generateSmartFallback,
  checkApiStatuses
};
