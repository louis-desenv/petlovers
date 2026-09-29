// server.js — Servidor Express para o Pet Agent Dr. Miau
// Substitui a API do Simli pela integração direta com a API do Google Gemini
// Inteligência artificial para classificação de sentimentos e respostas em tempo real.

const express = require("express");
const path = require("path");
const fs = require("fs");
const atlasCloudService = require("./src/services/atlasCloudService");
try { require("dotenv").config(); } catch (e) {}

// Função auxiliar para limpar chaves de API carregadas do .env ou process.env
function cleanApiVal(val) {
  if (!val) return "";
  return String(val)
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();
}

// Leitura direta de arquivos .env (.env, .env.local, .env.production) caso process.env ainda não tenha as chaves
function getEnvFileVar(varName) {
  try {
    const envFiles = [".env", ".env.local", ".env.production"];
    const baseDirs = [__dirname, process.cwd()];
    
    for (const baseDir of baseDirs) {
      for (const envFile of envFiles) {
        const envPath = path.join(baseDir, envFile);
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, "utf8");
          const lines = content.split("\n");
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("#")) continue;
            const eqIdx = trimmed.indexOf("=");
            if (eqIdx !== -1) {
              const key = trimmed.slice(0, eqIdx).trim();
              if (key.toUpperCase() === varName.toUpperCase()) {
                const val = trimmed.slice(eqIdx + 1);
                const cleaned = cleanApiVal(val);
                if (cleaned) return cleaned;
              }
            }
          }
        }
      }
    }
  } catch (e) {}
  return "";
}
const { GoogleGenAI, Type, ThinkingLevel } = require("@google/genai");

// Mensagens iniciais padrão do sistema para filtragem de histórico
const INITIAL_MESSAGE = "Olá! Sou o Dr. Miau. Estou aqui para ajudar você a criar uma cena 3D personalizada com o seu pet. Para começarmos, qual é o nome do seu companheiro e que tipo de animalzinho ele é? 🐾";
const ALT_INITIAL_MESSAGE = "Olá, eu sou o Dr. Miau, veterinário e apaixonado por todas as espécies do reino animal! 🐾🎬 Tenho uma surpresa especial preparada para o seu pet no final da nossa conversa. Para isso ficar incrível, me conta: qual é o nome dele e que espécie de animalzinho é?";
const OLD_INITIAL_MESSAGE = "Olá! Sou o Dr. Miau! 🐾 Me conta: que tipo de bichinho de estimação você tem? É um gatinho, um cãozinho ou outro amiguinho?";
const OLD_INITIAL_MESSAGE_2 = "Olá! Sou o Dr. Miau, seu agente de pets. Me conta sua ideia!";

// Certifica de que a imagem dr-miau.png e os vídeos mp4 estão disponíveis no diretório public
try {
  const srcImg = path.join(__dirname, "src", "dr-miau.png");
  const destImg = path.join(__dirname, "public", "dr-miau.png");
  if (fs.existsSync(srcImg)) {
    fs.copyFileSync(srcImg, destImg);
    console.log("✅ Imagem dr-miau.png copiada com sucesso para public/");
  }

  const srcDir = path.join(__dirname, "src");
  const destVideosDir = path.join(__dirname, "public", "videos");
  if (!fs.existsSync(destVideosDir)) {
    fs.mkdirSync(destVideosDir, { recursive: true });
  }

  if (fs.existsSync(srcDir)) {
    const files = fs.readdirSync(srcDir);
    files.forEach(file => {
      if (file.endsWith(".mp4")) {
        const srcFile = path.join(srcDir, file);
        // Normaliza o nome sem espaços ou acentos estranhos
        let cleanName = file.replace(/\s+/g, "_");
        if (cleanName === "faliz1.mp4") cleanName = "feliz1.mp4";
        const destFile = path.join(destVideosDir, cleanName);
        fs.copyFileSync(srcFile, destFile);
        console.log(`✅ Vídeo ${file} sincronizado para public/videos/${cleanName}`);
      }
    });
  }
} catch (imgErr) {
  console.error("Erro ao sincronizar arquivos de mídia para public/", imgErr);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Enable CORS
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

// URLs dos vídeos pré-renderizados para sentimentos específicos do mascote Dr. Miau
const videoUrls = {
  bem_vindo: "/videos/bemvindo1.mp4",
  normal: "/videos/normal.mp4",
  feliz: "/videos/feliz.mp4",
  triste: "/videos/triste.mp4",
  raiva: "/videos/raiva.mp4",
  confuso: "/videos/confuso1.mp4"
};

// Histórico do último prompt gerado para o estúdio de vídeo
let lastVideoPromptInfo = {
  prompt: null,
  timestamp: null,
  jobId: null,
  status: null
};

// Copia vídeos do src/ para public/videos/ se necessário, sem baixar URLs expiradas que corrompem os arquivos mp4
async function downloadVideos() {
  try {
    const dir = path.join(__dirname, "public", "videos");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Copiar de forma proativa os vídeos locais do diretório src se existirem e não estiverem no destino
    if (fs.existsSync(path.join(__dirname, "src"))) {
      const srcFiles = fs.readdirSync(path.join(__dirname, "src"));
      for (const file of srcFiles) {
        if (file.endsWith(".mp4")) {
          const srcPath = path.join(__dirname, "src", file);
          const cleanName = file.replace(/\s+/g, "_");
          const destPath = path.join(dir, cleanName);
          if (fs.existsSync(srcPath)) {
            try {
              fs.copyFileSync(srcPath, destPath);
              if (file.includes(" ")) {
                fs.copyFileSync(srcPath, path.join(dir, file));
              }
            } catch (err) {}
          }
        }
      }
    }
  } catch (globalErr) {
    console.log("[Video Sync] Servindo vídeos estáticos da pasta public/videos.");
  }
}

// Inicia download de vídeos de suporte em background
downloadVideos().catch(err => console.error("Erro no downloader de vídeos de background:", err));

// Configuração do Google Gemini API com carregamento dinâmico via variável de ambiente (Railway, Vercel, Docker, .env)
function getCurrentKey() {
  // 1. Variáveis diretas prioritárias
  const candidateKeys = [
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "GOOGLE_GENAI_API_KEY",
    "GEMINI_KEY",
    "GEMINI_APIKEY",
    "GOOGLE_GEMINI_API_KEY",
    "VITE_GEMINI_API_KEY",
    "NEXT_PUBLIC_GEMINI_API_KEY",
    "RAILWAY_GEMINI_API_KEY",
    "API_KEY"
  ];

  for (const k of candidateKeys) {
    if (process.env[k]) {
      const cleaned = cleanApiVal(process.env[k]);
      if (cleaned) return cleaned;
    }
  }

  // 2. Busca dinâmica case-insensitive em todas as chaves do process.env (ótimo para Railway)
  for (const [key, val] of Object.entries(process.env)) {
    const lower = key.toLowerCase();
    if (lower.includes("gemini") || (lower.includes("google") && lower.includes("key"))) {
      const cleaned = cleanApiVal(val);
      if (cleaned && cleaned.length > 5) return cleaned;
    }
  }
  
  // 3. Busca em arquivos .env
  for (const k of candidateKeys) {
    const fileVal = getEnvFileVar(k);
    if (fileVal) return fileVal;
  }

  return "";
}

// Função de diagnóstico de status das APIs
async function checkApiStatuses() {
  const geminiKey = getCurrentKey();

  const status = {
    gemini: {
      keyConfigured: !!geminiKey,
      connected: false,
      keyPreview: geminiKey ? geminiKey.slice(0, 6) + "..." : "NÃO CONFIGURADA",
      error: null,
      message: ""
    },
    timestamp: new Date().toISOString()
  };

  if (!geminiKey) {
    status.gemini.error = "GEMINI_API_KEY_MISSING";
    status.gemini.message = "A variável GEMINI_API_KEY não foi encontrada. Adicione GEMINI_API_KEY com sua chave do Google AI Studio.";
  } else {
    const testModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest"];
    let pingSuccess = false;
    let lastErrMessage = "";

    for (const testModel of testModels) {
      if (pingSuccess) break;
      try {
        const ai = new GoogleGenAI({ apiKey: geminiKey });
        const testRes = await ai.models.generateContent({
          model: testModel,
          contents: "ping"
        });
        if (testRes && testRes.text) {
          status.gemini.connected = true;
          status.gemini.message = `Conexão com a API do Gemini estabelecida e respondendo normalmente (${testModel})! ✨`;
          pingSuccess = true;
          break;
        }
      } catch (err) {
        lastErrMessage = err.message || String(err);
        try {
          const restUrl = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${geminiKey}`;
          const restRes = await fetch(restUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: "ping" }] }] })
          });
          if (restRes.ok) {
            status.gemini.connected = true;
            status.gemini.message = `Conexão com a API do Gemini estabelecida via REST (${testModel})! ✨`;
            pingSuccess = true;
            break;
          }
        } catch (restErr) {
          lastErrMessage = restErr.message || String(restErr);
        }
      }
    }

    if (!pingSuccess) {
      status.gemini.connected = false;
      status.gemini.error = "GEMINI_PING_FAILED";
      status.gemini.message = `Chave detectada, mas os modelos não responderam: ${lastErrMessage.slice(0, 180)}`;
    }
  }

  const atlasStatus = await atlasCloudService.testConnection();
  status.atlascloud = {
    keyConfigured: atlasStatus.configured,
    connected: atlasStatus.connected,
    error: atlasStatus.error,
    model: "bytedance/seedance-2.0-mini/reference-to-video",
    resolution: "720p",
    duration: "15s",
    message: atlasStatus.message
  };
  status.magicHour = status.atlascloud;

  return status;
}

// Função auxiliar para garantir alternância estrita entre roles ("user" e "model") e suporte multimodal
function buildAlternatingContents(cleanedHistory, currentMessage, currentImage = null) {
  const rawTurns = [];

  if (Array.isArray(cleanedHistory)) {
    for (const h of cleanedHistory) {
      if (!h || (!h.text && !h.image) || h.text === INITIAL_MESSAGE || h.text === ALT_INITIAL_MESSAGE || h.text === OLD_INITIAL_MESSAGE || h.text === OLD_INITIAL_MESSAGE_2) continue;
      const role = (h.role === "user" || h.role === "User" || h.role === "Voce") ? "user" : "model";
      rawTurns.push({ 
        role, 
        text: String(h.text || "").trim(),
        image: h.image || h.imageUrl || null
      });
    }
  }

  const msgTrimmed = (currentMessage || "").trim();
  if (msgTrimmed || currentImage) {
    const lastTurn = rawTurns[rawTurns.length - 1];
    if (!lastTurn || lastTurn.role !== "user" || lastTurn.text !== msgTrimmed || lastTurn.image !== currentImage) {
      rawTurns.push({ role: "user", text: msgTrimmed, image: currentImage || null });
    }
  }

  const sanitizedTurns = [];
  for (const turn of rawTurns) {
    if (!turn.text && !turn.image) continue;

    if (sanitizedTurns.length === 0) {
      if (turn.role === "user") {
        sanitizedTurns.push({ role: "user", text: turn.text, image: turn.image });
      }
    } else {
      const prev = sanitizedTurns[sanitizedTurns.length - 1];
      if (prev.role === turn.role) {
        if (turn.text) {
          prev.text = prev.text ? `${prev.text}\n${turn.text}` : turn.text;
        }
        if (!prev.image && turn.image) prev.image = turn.image;
      } else {
        sanitizedTurns.push({ role: turn.role, text: turn.text, image: turn.image });
      }
    }
  }

  if (sanitizedTurns.length === 0) {
    sanitizedTurns.push({ role: "user", text: msgTrimmed || "Olá", image: currentImage || null });
  }

  return sanitizedTurns.map(t => {
    const parts = [];
    if (t.image && typeof t.image === "string" && t.image.includes("base64,")) {
      try {
        const [meta, b64] = t.image.split("base64,");
        const mimeMatch = meta.match(/data:([^;]+)/);
        const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
        parts.push({
          inlineData: {
            mimeType: mimeType.trim(),
            data: b64.trim()
          }
        });
      } catch (e) {
        console.warn("⚠️ Erro ao preparar inlineData para Gemini:", e.message);
      }
    }
    if (t.text) {
      parts.push({ text: t.text });
    } else if (parts.length === 0) {
      parts.push({ text: "Foto do pet enviada pelo tutor 📸" });
    }
    return {
      role: t.role,
      parts
    };
  });
}

let cachedWorkingModel = "gemini-3.8-flash";

const responseSchemaDef = {
  type: Type.OBJECT,
  properties: {
    response: {
      type: Type.STRING,
      description: "A resposta do Dr. Miau em português, 100% natural, carinhosa, empática, inteligente e conversacional (2 a 4 frases)."
    },
    sentiment: {
      type: Type.STRING,
      enum: ["alegre", "neutro", "preocupado", "protetor", "confuso"],
      description: "A emoção correspondente do avatar do Dr. Miau para o vídeo de reação."
    },
    phase: {
      type: Type.INTEGER,
      description: "A fase da conversa: 1 (Pet & História), 2 (Cenário), 3 (Ação), 4 (Síntese & Confirmação com o Dono)."
    },
    progress: {
      type: Type.INTEGER,
      description: "O progresso acumulado da jornada de 0 a 100."
    },
    pet_profile: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING, description: "Nome do pet" },
        species: { type: Type.STRING, description: "Espécie (cão, gato, ave, peixe, etc.)" },
        appearance: { type: Type.STRING, description: "Cores, pelagem, marcas e características físicas" },
        emotional_story: { type: Type.STRING, description: "História afetiva do tutor com o animal" },
        scenario: { type: Type.STRING, description: "Cenário dos sonhos imaginado" },
        action: { type: Type.STRING, description: "Ação que o pet executa na cena" }
      },
      description: "Dados estruturados do pet acumulados ao longo da conversa."
    },
    photo_requested: {
      type: Type.BOOLEAN,
      description: "Defina como true se o Dr. Miau acabou de convidar o envio da foto do pet."
    },
    ready_for_confirmation: {
      type: Type.BOOLEAN,
      description: "Defina como true quando os 3 pilares estiverem reunidos e o Dr. Miau apresentar a sinopse para aprovação do tutor."
    },
    trigger_video_generation: {
      type: Type.BOOLEAN,
      description: "Defina como true apenas quando o tutor confirmar a síntese e autorizar a renderização 3D na Atlas Cloud."
    },
    video_prompt: {
      type: Type.STRING,
      description: "O prompt sintetizado detalhado em inglês cinematográfico (CinePrompt AI com @image1) para a Atlas Cloud Seedance 2.0 Mini, preenchido apenas quando trigger_video_generation for true."
    }
  },
  required: ["response", "sentiment", "phase", "progress", "ready_for_confirmation", "trigger_video_generation", "video_prompt"]
};

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

// Criamos uma função de inicialização e consulta resiliente do Gemini
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

  const currentKey = getCurrentKey();
  if (!currentKey) {
    const errorDetails = "GEMINI_API_KEY_MISSING: A variável GEMINI_API_KEY não foi encontrada.";
    console.warn("⚠️ [Gemini Client] " + errorDetails);
    return generateSmartFallback(lastUserText, history, errorDetails);
  }

  const isToken = currentKey.startsWith("ya29.");
  console.log(`[Gemini Resilient Client] Chamando API com chave presente (isToken: ${isToken})`);

  // Modelos suportados oficiais em ordem de qualidade conversacional e velocidade
  const baseModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.1-pro-preview"];
  const modelsToTry = Array.from(new Set([cachedWorkingModel, ...baseModels]));
  const lastErrors = [];

  for (const modelName of modelsToTry) {
    // --- TENTATIVA 1: SDK Oficial ---
    try {
      const ai = new GoogleGenAI({ apiKey: currentKey });
      const sdkConfig = {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchemaDef,
        maxOutputTokens: 1200,
        temperature: 0.75
      };
      if (modelName.includes("3.")) {
        sdkConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }
      const response = await ai.models.generateContent({
        model: modelName,
        contents: contents,
        config: sdkConfig
      });

      if (response && response.text) {
        cachedWorkingModel = modelName;
        console.log(`⚡ [Gemini Fast Client] Resposta gerada com sucesso via ${modelName}!`);
        return response.text;
      }
    } catch (sdkErr) {
      const errMsg = String(sdkErr.message || sdkErr);
      const isQuotaError = errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || errMsg.includes("Quota") || errMsg.includes("quota");

      let errType = "SDK_ERROR";
      if (isQuotaError) {
        errType = "COTA_429";
      } else if (errMsg.includes("API key not valid") || errMsg.includes("401") || errMsg.includes("UNAUTHENTICATED")) {
        errType = "CHAVE_GEMINI_INVALIDA_401";
      } else if (errMsg.includes("403") || errMsg.includes("PERMISSION_DENIED")) {
        errType = "PERMISSAO_NEGADA_403";
      } else if (errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("overloaded")) {
        errType = "ALTA_DEMANDA_503";
      } else if (errMsg.includes("fetch failed") || errMsg.includes("ENOTFOUND")) {
        errType = "ERRO_CONEXAO_REDE";
      }

      const sdkErrLog = `[${errType} - SDK ${modelName}: ${errMsg.slice(0, 100)}]`;
      console.log(`⚠️ [Gemini Client] ${sdkErrLog}`);
      lastErrors.push(sdkErrLog);

      if (isQuotaError) {
        continue;
      }

      // --- TENTATIVA 2: REST API Direta ---
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

        const generationConfigObj = {
          responseMimeType: "application/json",
          responseSchema: restResponseSchemaDef,
          maxOutputTokens: 1200,
          temperature: 0.75
        };
        if (modelName.includes("3.")) {
          generationConfigObj.thinkingConfig = { thinkingLevel: "LOW" };
        }
        const payload = {
          contents: contents,
          systemInstruction: { parts: [{ text: systemInstruction }] },
          generationConfig: generationConfigObj
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
            console.log(`⚡ [Gemini Fast Client] Sucesso via REST com ${modelName}!`);
            return extracted;
          }
        } else {
          const errText = await res.text();
          const restHttpErrLog = `[REST_HTTP_${res.status} - ${modelName}: ${errText.slice(0, 100)}]`;
          console.log(`⚠️ [Gemini Client] ${restHttpErrLog}`);
          lastErrors.push(restHttpErrLog);
        }
      } catch (restErr) {
        const restNetErrLog = `[REST_NET_ERROR - ${modelName}: ${restErr.message}]`;
        console.log(`⚠️ [Gemini Client] ${restNetErrLog}`);
        lastErrors.push(restNetErrLog);
      }
    }
  }

  const failureReason = `FALHA_CONEXAO_GEMINI: Todas as tentativas com a API do Gemini falharam no servidor. Erros registrados: ${lastErrors.join(" | ")}`;
  console.error("❌ " + failureReason);
  return generateSmartFallback(lastUserText, history, failureReason);
}

// Função de streaming de texto do Gemini em tempo real
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

  const currentKey = getCurrentKey();
  if (!currentKey) {
    const errorDetails = "GEMINI_API_KEY_MISSING: Chave GEMINI_API_KEY não configurada.";
    const fb = generateSmartFallbackObject(lastUserText, history, errorDetails);
    if (onTextChunk && fb.response) {
      onTextChunk(fb.response);
    }
    return JSON.stringify(fb);
  }

  // Modelos suportados oficiais em ordem de velocidade e resiliência
  const baseModels = ["gemini-3.8-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3.1-pro-preview"];
  const modelsToTry = Array.from(new Set([cachedWorkingModel, ...baseModels]));

  for (const modelName of modelsToTry) {
    try {
      const ai = new GoogleGenAI({ apiKey: currentKey });
      const streamConfig = {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchemaDef,
        maxOutputTokens: 1200,
        temperature: 0.75
      };
      if (modelName.includes("3.")) {
        streamConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
      }
      const streamResult = await ai.models.generateContentStream({
        model: modelName,
        contents: contents,
        config: streamConfig
      });

      let accumulatedRaw = "";
      let streamedResponseLength = 0;

      for await (const chunk of streamResult) {
        const text = chunk.text || "";
        accumulatedRaw += text;

        const match = accumulatedRaw.match(/"response"\s*:\s*"((?:[^"\\]|\\.)*)/);
        if (match && match[1]) {
          const currentExtracted = match[1].replace(/\\"/g, '"').replace(/\\n/g, '\n');
          if (currentExtracted.length > streamedResponseLength) {
            const delta = currentExtracted.slice(streamedResponseLength);
            streamedResponseLength = currentExtracted.length;
            if (onTextChunk && delta) {
              onTextChunk(delta);
            }
          }
        }
      }

      if (accumulatedRaw.trim()) {
        cachedWorkingModel = modelName;
        console.log(`⚡ [Gemini Stream Client] Stream concluído com sucesso via ${modelName}!`);
        return accumulatedRaw;
      }
    } catch (streamErr) {
      console.warn(`⚠️ [Gemini Stream Client] Erro no stream com ${modelName}:`, streamErr.message?.slice(0, 100));
    }
  }

  // Fallback rápido via callGemini
  const regularResponse = await callGemini(contents, systemInstruction, history);
  try {
    const p = typeof regularResponse === "string" ? JSON.parse(regularResponse) : regularResponse;
    if (onTextChunk && p.response) {
      onTextChunk(p.response);
    }
  } catch {
    if (onTextChunk && regularResponse) {
      onTextChunk(regularResponse);
    }
  }
  return regularResponse;
}

function cleanPortugueseText(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/\bd!!a\b/gi, "dá")
    .replace(/\bd!!\b/gi, "dá")
    .replace(/\bT!!o\b/g, "Tão")
    .replace(/\bt!!o\b/g, "tão")
    .replace(/\bvoc!!\b/gi, "você")
    .replace(/\bc!!ozinho\b/gi, "cãozinho")
    .replace(/\bc!!es\b/gi, "cães")
    .replace(/\bc!!o\b/gi, "cão")
    .replace(/\bxod!!\b/gi, "xodó")
    .replace(/\best!!o\b/gi, "estão")
    .replace(/\best!!\b/gi, "está")
    .replace(/\bs!!o\b/gi, "são")
    .replace(/\bn!!o\b/gi, "não")
    .replace(/\btamb!!m\b/gi, "também")
    .replace(/\bat!!\b/gi, "até")
    .replace(/\bol!!\b/gi, "olá")
    .replace(/\bj!!\b/gi, "já")
    .replace(/\bs!!\b/gi, "só")
    .replace(/\btr!!s\b/gi, "três")
    .replace(/\bqu!!\b/gi, "quê")
    .replace(/\bqual !!\b/gi, "qual é")
    .replace(/\bque !!\b/gi, "que é")
    .replace(/ !! /g, " é ")
    .replace(/^!! /g, "É ")
    .replace(/ !!$/g, " é")
    .replace(/cora!!o/gi, "coração")
    .replace(/a!!o/gi, "ação")
    .replace(/!!a/g, "á")
    .replace(/!!o/g, "ão")
    .replace(/!!e/g, "ê")
    .replace(/!!i/g, "í")
    .replace(/!!u/g, "ú")
    .replace(/!!/g, "é");
}

const BREED_RELEVANT_SPECIES = [
  "cachorro", "cachorra", "cadela", "cão", "cao", "cãozinho", "caozinho", "dog", "doguinho", "filhote", "canino",
  "gato", "gata", "gatinho", "gatinha", "felino", "cat", "bichano",
  "cavalo", "égua", "egua", "potro", "potrinho", "equino"
];

const NON_BREED_SPECIES = [
  "peixe", "peixinho", "betta", "carpa", "kinguio", "lebiste", "tetra", "guppy", "baiacu",
  "coelho", "coelha", "coelhinho", "coelhinha",
  "calopsita", "canário", "canario", "periquito", "papagaio", "arara", "cacatua", "ave", "pássaro", "passarinho",
  "elefante", "elefanta", "elefantinho", "tartaruga", "jabuti", "cágado", "hamster", 
  "porquinho-da-índia", "porquinho da índia", "porquinho da india", "chinchila", "furão", "furao", 
  "iguana", "cobra", "serpente", "lagarto", "sapo", "camaleão", "camaleao", "leão", "leao", "leoa", 
  "tigre", "urso", "macaco", "girafa", "zebra", "jacaré", "jacare", "pinguim", "panda", "lobo", "raposa",
  "bode", "cabra", "ovelha", "porco", "porquinho", "vaca", "boi", "preguiça", "rinoceronte", "hipopótamo"
];

function translateToEnglishCinematicTerms(petType, petBreed, coatColor, scenarioText, actionText, petName) {
  const name = petName || "our cute hero";
  
  // Mapeamento de tipo de animal
  const typeMap = {
    "peixe": "goldfish",
    "peixinho": "little cute tropical fish",
    "betta": "magnificent Betta fish",
    "carpa": "majestic koi fish",
    "kinguio": "cute round goldfish",
    "cachorro": "adorable dog",
    "cachorra": "adorable dog",
    "cão": "adorable puppy dog",
    "cao": "adorable puppy dog",
    "dog": "playful dog",
    "doguinho": "sweet little puppy",
    "gato": "fluffy adorable cat",
    "gata": "sweet charming cat",
    "gatinho": "tiny playful kitten",
    "coelho": "fluffy cute bunny rabbit",
    "cavalo": "majestic gentle horse",
    "calopsita": "colorful cockatiel bird",
    "papagaio": "vibrant parrot",
    "passaro": "little sweet bird",
    "pássaro": "little sweet bird",
    "tartaruga": "cute friendly turtle",
    "hamster": "chubby little hamster"
  };

  const rawType = (petType || "").toLowerCase().trim();
  let enPetType = "adorable pet";
  for (const [pt, en] of Object.entries(typeMap)) {
    if (rawType.includes(pt)) {
      enPetType = en;
      break;
    }
  }

  // Mapeamento de cores (Continuity Tokens)
  const colorMap = {
    "vermelho": "radiant ruby red with shimmering highlights",
    "vermelha": "radiant ruby red with shimmering highlights",
    "azul": "vibrant royal blue with glowing tones",
    "amarelo": "bright sunny golden yellow coat",
    "dourado": "shimmering metallic golden coat",
    "preto": "sleek velvety midnight black fur",
    "branco": "pure snowy white fluffy coat",
    "laranja": "warm bright glowing orange coat",
    "caramelo": "warm golden caramel fur",
    "marrom": "rich warm chocolate brown fur",
    "cinza": "soft silver grey coat",
    "rajado": "expressive striped tabby pattern",
    "malhado": "spotted charming coat",
    "tricolor": "colorful three-tone pattern"
  };

  const rawColor = (coatColor || "").toLowerCase().trim();
  let enColor = "vibrant locked physical colors";
  for (const [pt, en] of Object.entries(colorMap)) {
    if (rawColor.includes(pt)) {
      enColor = en;
      break;
    }
  }

  // Mapeamento de cenário (Setting & Context)
  let enScenario = "set in a cozy, sun-drenched living room with soft ambient warmth and gentle dust motes in sunbeams";
  const rawScen = (scenarioText || "").toLowerCase().trim();
  if (rawScen.includes("praia") || rawScen.includes("mar") || rawScen.includes("oceano")) {
    enScenario = "set on a tropical sun-kissed golden sand beach during golden hour with gentle turquoise waves in the background";
  } else if (rawScen.includes("floresta") || rawScen.includes("bosque") || rawScen.includes("árvores")) {
    enScenario = "set inside an enchanted magical fairytale forest with bioluminescent mushrooms and soft volumetric god rays filtering through lush canopy";
  } else if (rawScen.includes("jardim") || rawScen.includes("flores") || rawScen.includes("parque")) {
    enScenario = "set in a lush blooming botanical garden with colorful oversized flowers and fluttering butterflies in warm morning sunlight";
  } else if (rawScen.includes("espaço") || rawScen.includes("espaco") || rawScen.includes("galáxia") || rawScen.includes("estrelas")) {
    enScenario = "set in a breathtaking cosmic space scene with glowing nebula clouds, twinkling distant stars, and weightless atmospheric physics";
  } else if (rawScen.includes("castelo") || rawScen.includes("reino")) {
    enScenario = "set inside a grand fantasy castle hall with royal velvet drapery, warm torchlight, and marble floors";
  } else if (rawScen.includes("cidade") || rawScen.includes("casa") || rawScen.includes("sala")) {
    enScenario = rawType.includes("peixe") 
      ? "set inside a crystal-clear modern sunlit glass aquarium decorated with miniature colorful coral structures and glowing water ripples" 
      : "set inside a warm sunlit Scandinavian living room with soft aesthetic decor and cozy ambient light";
  }

  // Mapeamento de ação (Subject & Action ao longo de 5 segundos)
  let enAction = "performing a joyful 5-second dynamic movement with fluid natural body animation and expressive facial reactions";
  const rawAct = (actionText || "").toLowerCase().trim();
  if (rawType.includes("peixe")) {
    enAction = "swimming gracefully in a smooth 360-degree loop, blowing glowing bubble streams and doing an acrobatic tail spin";
  } else if (rawAct.includes("correr") || rawAct.includes("correndo") || rawAct.includes("brincar")) {
    enAction = "running happily towards the camera in a bouncy rhythm, wagging tail and showing delighted expressive eyes";
  } else if (rawAct.includes("dormir") || rawAct.includes("soneca") || rawAct.includes("deitado")) {
    enAction = "curled up comfortably, taking a sweet peaceful nap with soft rhythmic chest breathing and occasional ear twitches";
  } else if (rawAct.includes("skate") || rawAct.includes("voar") || rawAct.includes("heroi") || rawAct.includes("herói")) {
    enAction = "performing an energetic heroic glide forward with playful confidence, dynamic wind effects, and proud pose";
  }

  const cameraMotion = "Medium eye-level shot, smooth low-angle dolly push tracking shot following the character motion.";

  return `[Subject & Action]: High-end 3D animation featuring ${enPetType} named ${name}, ${enAction} over 5 seconds. [Setting & Context]: ${enScenario}. [Camera Shot & Motion]: ${cameraMotion} [Continuity Tokens]: Physical attributes locked with ${enColor}, maintaining strict anatomical feature consistency without morphing. [Style & Lighting]: 3D Pixar-Disney cinematic style, volumetric rim lighting, Octane render 8k detail, 720p 1:1 square ratio. [Negative Prompt]: Avoid extra limbs, deformed face, character morphing, text, watermarks, chaotic motion, flickering artifacts.`;
}

function analyzePetProfile(history = [], currentMessage = "") {
  const turns = [];
  if (Array.isArray(history)) {
    history.forEach(h => {
      if (h && h.text && h.text !== INITIAL_MESSAGE && h.text !== ALT_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE_2) {
        turns.push({
          role: (h.role === "user" || h.role === "User" || h.role === "Voce") ? "user" : "assistant",
          text: h.text
        });
      }
    });
  }
  if (currentMessage) {
    turns.push({ role: "user", text: currentMessage });
  }

  const userTurns = turns.filter(t => t.role === "user");
  const userTexts = userTurns.map(t => t.text.toLowerCase());
  const combinedUserText = userTexts.join(" ");

  // 1. ESPÉCIE / QUAL É O ANIMAL DE ESTIMAÇÃO (gato, cachorro, peixe, cavalo, elefante...)
  let hasPetType = false;
  let petType = null;
  let isBreedRelevant = true; // Por padrão até descobrir a espécie

  for (const s of BREED_RELEVANT_SPECIES) {
    const reg = new RegExp(`\\b${s}\\b`, "i");
    if (reg.test(combinedUserText)) {
      hasPetType = true;
      petType = s;
      isBreedRelevant = true;
      break;
    }
  }

  if (!hasPetType) {
    for (const s of NON_BREED_SPECIES) {
      const reg = new RegExp(`\\b${s}\\b`, "i");
      if (reg.test(combinedUserText)) {
        hasPetType = true;
        petType = s;
        isBreedRelevant = false;
        break;
      }
    }
  }

  // Detecção via imagem do agente de visão
  if (!hasPetType) {
    if (combinedUserText.includes("cão") || combinedUserText.includes("cao") || combinedUserText.includes("cachorro")) {
      hasPetType = true;
      petType = "cachorro";
      isBreedRelevant = true;
    } else if (combinedUserText.includes("gato") || combinedUserText.includes("felino")) {
      hasPetType = true;
      petType = "gato";
      isBreedRelevant = true;
    }
  }

  let needsDoubleCheckPetType = false;
  if (!hasPetType) {
    for (let i = 0; i < turns.length - 1; i++) {
      const turn = turns[i];
      const nextTurn = turns[i + 1];
      if (turn.role === "assistant" && nextTurn.role === "user") {
        const askTypeReg = /(?:que\s+tipo\s+de\s+animalzinho|qual\s+animal|que\s+bichinho|gatinho,\s*cãozinho|espécie)/i;
        const isDoubleCheck = /(?:como\s+assim|tem\s+certeza|você\s+não\s+quer\s+me\s+contar|me\s+conta\s+só)/i.test(turn.text);
        if (askTypeReg.test(turn.text)) {
          const userReply = nextTurn.text.trim().toLowerCase();
          const isNegative = /^(?:n[ãa]o|nao|nenhum|nada|n[ãa]o\s+sei|j[aá]\s+disse)$/i.test(userReply) || userReply === "não" || userReply === "nao";
          if (isDoubleCheck) {
            hasPetType = true;
            petType = "amiguinho fofo";
            needsDoubleCheckPetType = false;
            break;
          } else if (isNegative) {
            if (i + 2 < turns.length) {
              hasPetType = true;
              petType = "amiguinho fofo";
              needsDoubleCheckPetType = false;
              break;
            } else {
              needsDoubleCheckPetType = true;
            }
          }
        }
      }
    }
  }

  // 2. NOME DO ANIMALZINHO (SEMPRE OBRIGATÓRIO)
  let hasPetName = false;
  let petName = null;

  const namePatterns = [
    /(?:se\s+chama|chama-se|o\s+nome\s+(?:dele|dela|do\s+bicho|do\s+pet|do\s+meu\s+pet)?\s*(?:é|e)|chamo\s+(?:ele|ela)\s+de|nome:\s*|o\s+nome\s+é|chama\s+)\s*([a-záàâãéèêíïóôõöúçñ]+)/i,
    /(?:ele|ela)\s+é\s+o\s+([a-záàâãéèêíïóôõöúçñ]+)/i,
    /(?:meu|minha)\s+(?:gato|gata|cachorro|cadela|cão|cao|coelho|elefante|peixe|cavalo)\s+([a-záàâãéèêíïóôõöúçñ]+)/i
  ];

  for (const pat of namePatterns) {
    const match = combinedUserText.match(pat);
    if (match && match[1]) {
      const candidate = match[1].trim();
      const forbiddenWords = ["um", "uma", "o", "a", "meu", "minha", "ele", "ela", "que", "de", "da", "do", "com", "muito", "bem", "não", "nao", "sim"];
      if (!forbiddenWords.includes(candidate.toLowerCase()) && candidate.length >= 2) {
        hasPetName = true;
        petName = candidate;
        break;
      }
    }
  }

  // Se o usuário disser explicitamente que não tem nome
  if (!hasPetName) {
    if (/(?:não|nao)\s+(?:tem|escolhi|coloquei|temos)\s+nome|sem\s+nome|ainda\s+(?:não|nao)\s+tem\s+nome/i.test(combinedUserText)) {
      hasPetName = true;
      petName = "sem nome definido ainda";
    }
  }

  // Contextual QA: se o assistente perguntou o nome na rodada anterior e o usuário respondeu diretamente
  if (!hasPetName) {
    for (let i = 0; i < turns.length - 1; i++) {
      const turn = turns[i];
      const nextTurn = turns[i + 1];
      if (turn.role === "assistant" && nextTurn.role === "user") {
        const askNameReg = /(?:qual\s+(?:é\s+o\s+)?nome|como\s+(?:ele|ela)\s+se\s+chama|o\s+nome\s+dele|o\s+nome\s+dela|qual\s+o\s+nome)/i;
        if (askNameReg.test(turn.text)) {
          const userReply = nextTurn.text.trim().replace(/[.!?]+$/, "");
          const words = userReply.split(/\s+/);
          if (words.length <= 4 && !/(?:não\s+sei|depois|cenário|ação|praia|vídeo)/i.test(userReply)) {
            hasPetName = true;
            petName = userReply;
            break;
          }
        }
      }
    }
  }

  // 3. RAÇA (SE FOR GATO, CACHORRO, PEIXE, CAVALO ETC. PERGUNTA RAÇA; SE FOR ELEFANTE OU ANIMAL SEM RAÇAS FAMOSAS, NÃO PERGUNTA)
  let hasBreed = false;
  let petBreed = null;

  if (!isBreedRelevant) {
    hasBreed = true;
    petBreed = "não se aplica (animal sem raças conhecidas)";
  } else {
    const breedPatterns = [
      /(?:vira[\s-]?lata|srd|sem\s+ra[çc]a|mistura|mesti[çc]o|misturadinho|n[ãa]o\s+tem\s+ra[çc]a|n[ãa]o\s+sei\s+a\s+ra[çc]a|n[ãa]o\s+sei|desconhecida|comum)/i,
      /(?:poodle|golden|retriever|labrador|pitbull|pit\s*bull|bulldog|buldogue|shih[\s-]?tzu|shitzu|beagle|pastor|rottweiler|husky|siberiano|dachshund|teckel|salsicha|pinscher|yorkshire|yorkie|malt[eê]s|border\s+collie|chihuahua|chow[\s-]?chow|d[aá]lmata|boxer|pug|spitz|lulu|doberman|dogue|cocker|akita|bernese|lhasa|schnauzer|basset|corgi|samoieda|fila|cane\s+corso|fox|weimaraner|whippet)/i,
      /(?:siam[eê]s|persa|maine\s+coon|bengal|sphynx|ragdoll|angor[aá]|british|azul\s+russo|bombaim|siberiano|munchkin|chartreux|birman[eê]s)/i,
      /(?:mangalarga|quarto\s+de\s+milha|puro\s+sangue|[aá]rabe|crioulo|campolina|pampa|bret[aã]o)/i,
      /(?:betta|carpa|kinguio|lebiste|tetra|guppy|acar[aá]|palha[çc]o|baiacu)/i,
      /(?:lionhead|mini\s+lop|holand[eê]s)/i,
      /(?:calopsita|can[aá]rio|periquito|agapornis|cacatua)/i,
      /(?:ra[çc]a\s*(?:é|e|:)?\s*([a-záàâãéèêíïóôõöúçñ\s]+))/i
    ];

    for (const pat of breedPatterns) {
      const match = combinedUserText.match(pat);
      if (match) {
        hasBreed = true;
        petBreed = match[1] || match[0];
        break;
      }
    }

    if (!hasBreed) {
      for (let i = 0; i < turns.length - 1; i++) {
        const turn = turns[i];
        const nextTurn = turns[i + 1];
        if (turn.role === "assistant" && nextTurn.role === "user") {
          const askBreedReg = /(?:qual\s+(?:é\s+a\s+)?ra[çc]a|qual\s+a\s+ra[çc]a|de\s+qual\s+ra[çc]a|é\s+de\s+ra[çc]a|vira-lata)/i;
          if (askBreedReg.test(turn.text)) {
            const userReply = nextTurn.text.trim().replace(/[.!?]+$/, "");
            const words = userReply.split(/\s+/);
            if (words.length <= 5 && !/(?:cenário|praia|vídeo|ação)/i.test(userReply)) {
              hasBreed = true;
              petBreed = userReply;
              break;
            }
          }
        }
      }
    }
  }

  // 4. COLORAÇÃO DE PELE OU PELOS (SEMPRE OBRIGATÓRIO)
  let hasCoatColor = false;
  let coatColor = null;

  const colorKeywords = [
    "preto", "preta", "pretos", "pretas", "pretinho", "pretinhos", "pretinha", "pretinhas", "negro", "negros", "negra", "negras",
    "branco", "branca", "brancos", "brancas", "branquinho", "branquinhos", "branquinha", "branquinhas", "alvo",
    "marrom", "marrons", "castanho", "castanhos", "castanha", "castanhas", "chocolate", "caramelo", "caramelos", "dourado", "dourados", "dourada", "douradas", "amarelo", "amarelos", "amarela", "amarelas",
    "cinza", "cinzas", "cinzento", "cinzentos", "cinzenta", "cinzentas", "acinzentado", "acinzentados", "azul", "azuis", "azulado", "vermelho", "vermelhos", "vermelha", "vermelhas", "ruivo", "ruivos", "ruiva", "ruivas", "laranja", "laranjas", "alaranjado",
    "rajado", "rajados", "rajada", "rajadas", "tigrado", "tigrados", "tigrada", "tigradas", "mesclado", "mesclados", "mesclada", "mescladas", "tricolor", "tricolores", "bicolor", "bicolores", "malhado", "malhados", "malhada", "malhadas",
    "creme", "cremes", "bege", "beges", "chumbo", "prateado", "prateados", "prata", "camurça", "tostado", "baio"
  ];

  for (const c of colorKeywords) {
    const reg = new RegExp(`\\b${c}\\b`, "i");
    if (reg.test(combinedUserText)) {
      hasCoatColor = true;
      coatColor = c;
      break;
    }
  }

  if (!hasCoatColor) {
    for (let i = 0; i < turns.length - 1; i++) {
      const turn = turns[i];
      const nextTurn = turns[i + 1];
      if (turn.role === "assistant" && nextTurn.role === "user") {
        const askColorReg = /(?:cor\s+(?:dos\s+pelos|da\s+pelagem|da\s+pele|dele|dela)|colora[çc][ãa]o)/i;
        if (askColorReg.test(turn.text)) {
          const userReply = nextTurn.text.trim().replace(/[.!?]+$/, "");
          const words = userReply.split(/\s+/);
          if (words.length <= 5 && !/(?:cenário|praia|vídeo)/i.test(userReply)) {
            hasCoatColor = true;
            coatColor = userReply;
            break;
          }
        }
      }
    }
  }

  // 5. SE O ANIMAL POSSUI ALGUMA AVARIAÇÃO, SEJA MANCHAS, ALGUMA DEFICIÊNCIA ETC. (SEMPRE OBRIGATÓRIO)
  let hasAvariacao = false;
  let avariacao = null;
  let needsDoubleCheckAvariacao = false;

  const avariacaoPresenceKeywords = [
    "mancha", "manchas", "manchinha", "manchinhas", "manchado", "manchada",
    "pinta", "pintas", "pintinhas", "listra", "listras", "listrado", "listrada", "sardas",
    "deficiência", "deficiencia", "deficiente", "cego", "ceguinho", "sem um olho", "caolho",
    "sem uma pata", "sem pata", "perneta", "manco", "manca", "mancando", "três patas", "3 patas",
    "duas patas", "2 patas", "surdo", "surdinho", "sem orelha", "orelha caída", "orelha torta",
    "orelha cortada", "rabinho curto", "sem rabo", "sem cauda", "cauda curta", "cicatriz",
    "cicatrizes", "machucado", "cadeirante", "cadeira de rodas", "amputado", "amputada"
  ];

  for (const a of avariacaoPresenceKeywords) {
    if (combinedUserText.includes(a)) {
      hasAvariacao = true;
      avariacao = a;
      break;
    }
  }

  if (!hasAvariacao) {
    const avariacaoNegativePatterns = [
      /(?:n[ãa]o\s+tem|sem)\s+(?:nenhuma\s+)?(?:mancha|manchas|defici[êe]ncia|avaria[çc][ãa]o|marca|marcas|cicatriz)/i,
      /(?:nenhuma\s+mancha|nenhuma\s+defici[êe]ncia|nenhuma\s+avaria[çc][ãa]o|nada\s+disso|n[ãa]o\s+tem\s+nada|ele\s+[eé]\s+perfeito|100%\s+perfeito|perfeitinho|tudo\s+normal|ele\s+[eé]\s+normal|cor\s+lisa|lisinho|sem\s+marcas|sadio|saud[aá]vel|completinho)/i
    ];
    for (const pat of avariacaoNegativePatterns) {
      if (pat.test(combinedUserText)) {
        hasAvariacao = true;
        avariacao = "nenhuma (sem marcas/perfeito)";
        break;
      }
    }
  }

  if (!hasAvariacao) {
    for (let i = 0; i < turns.length - 1; i++) {
      const turn = turns[i];
      const nextTurn = turns[i + 1];
      if (turn.role === "assistant" && nextTurn.role === "user") {
        const askAvariacaoReg = /(?:avaria[çc][ãa]o|mancha|manchas|defici[êe]ncia|cicatriz|marca\s+especial)/i;
        const isDoubleCheckQuestion = /(?:tem\s+certeza|nenhumazinha|escondid|nem\s+uma\s+manchinha|pontinha)/i.test(turn.text);

        if (askAvariacaoReg.test(turn.text)) {
          const userReply = nextTurn.text.trim().toLowerCase();
          const isNegativeReply = /^(?:n[ãa]o|nao|nenhuma|nada|n[ãa]o\s+tem|sem\s+mancha|n[ãa]o\s+sei|liso|lisinho|j[aá]\s+disse|num\s+tem|certeza)$/i.test(userReply) ||
            userReply.includes("não") || userReply.includes("nao") || userReply.includes("nenhum");

          if (isDoubleCheckQuestion) {
            // O assistente JÁ FEZ o double-check brincalhão de 1 rodada. Aceita QUALQUER resposta agora!
            hasAvariacao = true;
            avariacao = isNegativeReply ? "nenhuma (pelagem lisa/sem marcas)" : userReply;
            needsDoubleCheckAvariacao = false;
            break;
          } else if (isNegativeReply) {
            // Primeira resposta negativa do usuário sobre manchas!
            if (i + 2 < turns.length) {
              // Já houve rodadas seguintes na conversa: considera respondido e aceita!
              hasAvariacao = true;
              avariacao = "nenhuma (pelagem lisa/sem marcas)";
              needsDoubleCheckAvariacao = false;
              break;
            } else {
              // É a mensagem atual: sinaliza para fazer o 1-turn double check carinhoso
              needsDoubleCheckAvariacao = true;
            }
          } else {
            // Usuário deu uma resposta positiva ou descrição
            hasAvariacao = true;
            avariacao = userReply;
            break;
          }
        }
      }
    }
  }

  // 6. HISTÓRIA DO TUTOR COM O ANIMAL (COMO SE CONHECERAM, ADOÇÃO, MEMÓRIAS, TRAVESSURAS)
  let hasPetStory = false;
  let petStory = null;

  const storyKeywords = [
    "adot", "resgat", "achei", "encontrei", "comprei", "ganhei", "rua", "filhote", "filhotinho", "bebê",
    "história", "historia", "conheci", "conhecemos", "trouxe", "anos juntos", "meses juntos", "dia em que",
    "lembro", "memória", "primeira vez", "apaixonei", "amor", "grude", "dorme comigo", "companheiro", "companheira",
    "mudou minha vida", "travessura", "apronta", "brincalhão", "carinhoso", "fofinho", "resgate", "abrigo", "feira de adoção",
    "doação", "doaram", "veio pra casa", "apareceu", "adotivo", "adotiva"
  ];

  for (const sk of storyKeywords) {
    if (combinedUserText.includes(sk)) {
      hasPetStory = true;
      petStory = "história compartilhada pelo tutor";
      break;
    }
  }

  let needsDoubleCheckPetStory = false;
  if (!hasPetStory) {
    for (let i = 0; i < turns.length - 1; i++) {
      const turn = turns[i];
      const nextTurn = turns[i + 1];
      if (turn.role === "assistant" && nextTurn.role === "user") {
        const askStoryReg = /(?:hist[oó]ria|como\s+(?:voc[êe]s\s+)?se\s+conheceram|como\s+ele\s+chegou|dia\s+em\s+que|momento\s+marcante|travessura|como\s+foi\s+quando|adot|resgat)/i;
        const isDoubleCheck = /(?:como\s+assim|tem\s+certeza|você\s+não\s+quer\s+me\s+contar|uma\s+lembrança)/i.test(turn.text);
        if (askStoryReg.test(turn.text)) {
          const userReply = nextTurn.text.trim().toLowerCase();
          const isNegative = /^(?:n[ãa]o|nao|nenhuma|nada|n[ãa]o\s+sei|j[aá]\s+disse|sem\s+hist[oó]ria)$/i.test(userReply) || userReply === "não" || userReply === "nao";
          if (isDoubleCheck) {
            hasPetStory = true;
            petStory = "história cheia de mistério";
            needsDoubleCheckPetStory = false;
            break;
          } else if (isNegative) {
            if (i + 2 < turns.length) {
              hasPetStory = true;
              petStory = "história cheia de mistério";
              needsDoubleCheckPetStory = false;
              break;
            } else {
              needsDoubleCheckPetStory = true;
            }
          } else if (userReply.length >= 2) {
            hasPetStory = true;
            petStory = userReply;
            break;
          }
        }
      }
    }
  }

  const missingParams = [];
  if (!hasPetName) missingParams.push("Nome do animal");
  if (!hasPetType) missingParams.push("Tipo do animal (gato, cachorro, cavalo, peixe, elefante...)");
  if (isBreedRelevant && !hasBreed) missingParams.push("Raça (ou confirmação de vira-lata/SRD)");
  if (!hasCoatColor) missingParams.push("Coloração de pele ou pelos");
  if (!hasAvariacao) missingParams.push("Avariações ou características marcantes (manchas, cicatriz, deficiência ou confirmação de que não possui)");
  if (!hasPetStory) missingParams.push("História do tutor com o animal (como se conheceram, memórias, travessuras)");

  const isPhase1Complete = hasPetType && hasPetName && hasBreed && hasCoatColor && hasAvariacao && hasPetStory;

  const checklistText = `
- 1. Nome do animal: ${hasPetName ? `✅ CONHECIDO ("${petName}")` : "❌ PENDENTE (Perguntar o nome do animalzinho)"}
- 2. Tipo do animal: ${hasPetType ? `✅ CONHECIDO ("${petType}")` : "❌ PENDENTE (Perguntar qual é o animal: gato, cachorro, elefante...)"}
- 3. História do tutor com o pet: ${hasPetStory ? `✅ CONHECIDA ("${petStory}")` : "❌ PENDENTE (Perguntar como se conheceram, como foi a chegada dele ou momentos marcantes)"}
- 4. Raça: ${!isBreedRelevant ? "➖ NÃO SE APLICA (animal sem raças conhecidas)" : hasBreed ? `✅ CONHECIDO ("${petBreed}")` : "❌ PENDENTE (Perguntar a raça ou se é vira-lata)"}
- 5. Coloração da pele, pelagem ou plumagem: ${hasCoatColor ? `✅ CONHECIDO ("${coatColor}")` : "❌ PENDENTE (Perguntar a cor da pele ou pelos)"}
- 6. Variação ou característica marcante: ${hasAvariacao ? `✅ CONHECIDO ("${avariacao}")` : "❌ PENDENTE (Perguntar se possui manchas, deficiência, cicatriz ou se é sem marcas especiais)"}
`.trim();

  return {
    hasPetType,
    petType,
    isBreedRelevant,
    hasBreed,
    petBreed,
    hasPetName,
    petName,
    hasCoatColor,
    coatColor,
    hasAvariacao,
    avariacao,
    needsDoubleCheckAvariacao,
    needsDoubleCheckPetType,
    needsDoubleCheckPetStory,
    hasPetStory,
    petStory,
    missingParams,
    isPhase1Complete,
    checklistText
  };
}

function evaluateConversationState(history = [], currentMessage = "", sessionState = null) {
  const userTexts = [];
  if (Array.isArray(history)) {
    history.forEach(h => {
      if (h && h.text && (h.role === "user" || h.role === "User" || h.role === "Voce")) {
        userTexts.push(h.text.toLowerCase());
      }
    });
  }
  if (currentMessage) {
    userTexts.push(currentMessage.toLowerCase());
  }
  const combinedUserText = userTexts.join(" ");

  const isDanone = combinedUserText.includes("danone");
  if (isDanone) {
    return {
      hasPetDetails: true,
      hasScenarioDetails: true,
      hasActionDetails: true,
      maxAllowedPhase: 3,
      suggestedProgress: 100,
      canTriggerVideo: true,
      isDanone: true,
      userMessagesCount: userTexts.length,
      petProfile: {
        hasPetType: true,
        petType: "pet danone",
        isBreedRelevant: false,
        hasBreed: true,
        petBreed: "especial",
        hasPetName: true,
        petName: "Danone",
        hasCoatColor: true,
        coatColor: "mágico",
        hasAvariacao: true,
        avariacao: "nenhuma",
        missingParams: [],
        isPhase1Complete: true,
        checklistText: "Código Danone ativado."
      }
    };
  }

  // Análise detalhada dos 5 parâmetros obrigatórios da Fase 1
  const petProfile = analyzePetProfile(history, currentMessage);
  const hasPetDetails = petProfile.isPhase1Complete;

  // Limpa descrições geradas pelo agente de visão da Parte 1 para não contaminar a detecção de Cenário e Ação
  const userTextsClean = userTexts.map(text => {
    return text
      .replace(/\[imagem analisada pelo agente de visão[^]*?\]:[^]*?(\n\ncomentário do usuário:|$)/gi, " ")
      .replace(/\[foto do pet enviada pelo tutor[^]*?\]:[^]*?(\n\ncomentário do usuário:|$)/gi, " ");
  });
  const combinedUserTextClean = userTextsClean.join(" ");

  // 1. ANÁLISE DE CENÁRIO (FASE 2) — Só é avaliada se a Fase 1 (Detalhes do Pet) estiver completa
  let hasScenarioDetails = false;
  let scenarioTurnIndex = -1;

  // Turns do diálogo para inferência contextual
  const turns = [];
  if (Array.isArray(history)) {
    history.forEach(h => {
      if (h && h.text && h.text !== INITIAL_MESSAGE && h.text !== ALT_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE_2) {
        turns.push({
          role: (h.role === "user" || h.role === "User" || h.role === "Voce") ? "user" : "assistant",
          text: h.text
        });
      }
    });
  }
  if (currentMessage) {
    turns.push({ role: "user", text: currentMessage });
  }

  // Palavras-chave específicas e inequívocas de cenário
  const explicitScenarioKeywords = [
    "praia", "floresta", "espaço", "espaco", "castelo", "nuvens", "mar", "montanha",
    "parte 2 - o cenário", "universo", "lua", "planeta", "neve", "piscina", "mundo de doces",
    "campo verde", "mato alto", "reino", "na praia", "na floresta", "no espaço", "no castelo",
    "no jardim", "no cenario", "no cenário", "cenário de", "cenario de", "fundo de", "galáxia", "nave"
  ];

  // Checagem se o assistente perguntou sobre cenário no histórico
  let assistantAskedScenario = false;
  for (let i = 0; i < turns.length - 1; i++) {
    const t = turns[i];
    const next = turns[i + 1];
    if (t.role === "assistant" && next.role === "user") {
      if (/(?:cen[aá]rio|lugar|ambiente|onde\s+(?:voc[êe]\s+)?gostaria|em\s+qual\s+(?:lugar|cen[aá]rio)|fase\s+2)/i.test(t.text)) {
        assistantAskedScenario = true;
        if (next.text && next.text.trim().length >= 2) {
          hasScenarioDetails = true;
          scenarioTurnIndex = i + 1;
          break;
        }
      }
    }
  }

  // Se a Fase 1 estiver completa (ou o assistente perguntou sobre cenário), aceita palavras-chave específicas de cenário
  if (hasPetDetails || assistantAskedScenario) {
    if (!hasScenarioDetails && explicitScenarioKeywords.some(kw => combinedUserTextClean.includes(kw))) {
      hasScenarioDetails = true;
    }
    // Palavras cotidianas (como casa, rua, sala) só valem se a Fase 1 estiver completa E o usuário respondeu à Fase 2
    if (!hasScenarioDetails && hasPetDetails) {
      const genericScenarioKeywords = ["sala", "quarto", "cozinha", "parque", "quintal", "rua", "casa", "lago", "rio", "fazenda", "céu", "ceu"];
      const lastUserTurn = turns.filter(t => t.role === "user").pop();
      if (lastUserTurn && genericScenarioKeywords.some(kw => lastUserTurn.text.toLowerCase().includes(kw)) && assistantAskedScenario) {
        hasScenarioDetails = true;
      }
    }
  }

  // 2. ANÁLISE DE AÇÃO (FASE 3) — Só é ativada se a Fase 1 E a Fase 2 já estiverem completas!
  let hasActionDetails = false;

  if (hasPetDetails && hasScenarioDetails) {
    // Checa se o assistente perguntou sobre a ação do vídeo
    for (let i = 0; i < turns.length - 1; i++) {
      const t = turns[i];
      const next = turns[i + 1];
      if (t.role === "assistant" && next.role === "user") {
        if (/(?:qual\s+a[çc][ãa]o|a[çc][ãa]o\s+voc[êe]\s+gostaria|fazendo\s+no\s+v[íi]deo|o\s+que\s+gostaria\s+de\s+ver|qualquer\s+a[çc][ãa]o|o\s+que\s+ele\s+vai\s+fazer|que\s+a[çc][ãa]o|fazendo\s+o\s+que)/i.test(t.text)) {
          if (next.text && next.text.trim().length >= 2) {
            hasActionDetails = true;
            break;
          }
        }
      }
    }

    const actionKeywords = [
      "dormindo", "dormir", "correr", "correndo", "pular", "pulando", "voar", "voando",
      "skate", "andando de skate", "brincar", "brincando", "dançar", "dancar", "dançando",
      "nadar", "nadando", "caçar", "caçando", "faz o vídeo", "faz o video", "gera o vídeo", "gera o video"
    ];
    if (!hasActionDetails && actionKeywords.some(kw => combinedUserTextClean.includes(kw))) {
      hasActionDetails = true;
    }

    // Se Pet e Cenário já foram estabelecidos e o usuário enviou uma mensagem nova na fase 3
    if (!hasActionDetails && currentMessage && currentMessage.trim().length >= 2) {
      const lastAssistantTurn = turns.filter(t => t.role === "assistant").pop();
      if (lastAssistantTurn && /(?:a[çc][ãa]o|fazendo|fazer|vídeo|video)/i.test(lastAssistantTurn.text)) {
        hasActionDetails = true;
      }
    }
  }

  const totalUserTurns = userTexts.length;

  let maxAllowedPhase = 1;
  let suggestedProgress = 10;
  let canTriggerVideo = false;

  // CÁLCULO ESTRITO DE PROGRESSO E FASE:
  // Enquanto a Fase 1 não estiver completa, NUNCA sai da Fase 1
  if (!hasPetDetails) {
    maxAllowedPhase = 1;
    let completedCount = 0;
    if (petProfile.hasPetType) completedCount++;
    if (petProfile.hasPetName) completedCount++;
    if (petProfile.hasBreed) completedCount++;
    if (petProfile.hasCoatColor) completedCount++;
    if (petProfile.hasAvariacao) completedCount++;
    suggestedProgress = 5 + (completedCount * 6); // 5% a 35%
    canTriggerVideo = false;
    hasScenarioDetails = false;
    hasActionDetails = false;
  } else if (!hasScenarioDetails) {
    // Pet 100% conhecido, mas cenário ainda não definido: FASE 2
    maxAllowedPhase = 2;
    suggestedProgress = 55;
    canTriggerVideo = false;
    hasActionDetails = false;
  } else if (!hasActionDetails) {
    // Cenário definido, mas ação ainda não definida: FASE 3
    maxAllowedPhase = 3;
    suggestedProgress = 80;
    canTriggerVideo = false;
  } else {
    // Pet, Cenário e Ação todos definidos em ordem!
    maxAllowedPhase = 3;
    suggestedProgress = 100;
    canTriggerVideo = true;
  }

  return {
    hasPetDetails,
    hasScenarioDetails,
    hasActionDetails,
    maxAllowedPhase,
    suggestedProgress,
    canTriggerVideo,
    isDanone: false,
    userMessagesCount: totalUserTurns,
    petProfile
  };
}

function generateSmartFallbackObject(lastMessageText, history = [], apiErrorMsg = null) {
  const cleanedHistory = Array.isArray(history) 
    ? history.filter(h => h && h.text && h.text !== INITIAL_MESSAGE && h.text !== ALT_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE_2) 
    : [];

  const evalState = evaluateConversationState(cleanedHistory, lastMessageText);
  const pet = evalState.petProfile;

  let phase = evalState.maxAllowedPhase;
  let progress = evalState.suggestedProgress;
  let sentiment = "alegre";
  let response = "";
  let trigger_video_generation = evalState.canTriggerVideo;
  let video_prompt = trigger_video_generation ? `An adorable 3D Pixar-style animated scene of a cute ${pet.petType || "pet"} named ${pet.petName || "hero"} in an epic adventure. Vibrant lighting, ultra detailed 8k.` : "";

  const trimmedMsg = (lastMessageText || "").trim().toLowerCase();
  const isConfused = /^(?:n[ãa]o\s+sei|como\s+assim|o\s+que|qu[êe]|n[ãa]o\s+entendi|me\s+ajuda|n[ãa]o\s+compreendi|\?+$)/i.test(trimmedMsg);

  let ready_for_confirmation = false;

  // Se o usuário confirmou na fase 4
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
    // Fase 4: Apresenta a síntese e pede confirmação do dono
    phase = 4;
    progress = 90;
    ready_for_confirmation = true;
    sentiment = "alegre";
    const nameDisplay = pet.petName || "seu pet";
    response = `Miau! *ronrom* Reuni todos os detalhes mágicos: o ${nameDisplay} em um cenário encantador com muita alegria em ação! Ficou perfeito para você? Me dá o seu sinal verde que eu já inicio a renderização 3D na Atlas Cloud agora mesmo! 🎬✨`;
  } else {
    // Confirmação recebida: dispara a animação na Atlas Cloud
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
      evalState.scenarioText || "magical vibrant wonderland",
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

function generateSmartFallback(lastMessageText, history = [], apiErrorMsg = null) {
  return JSON.stringify(generateSmartFallbackObject(lastMessageText, history, apiErrorMsg));
}

// Agente Especialista em Análise e Descrição de Imagens
async function analyzeImageWithAgent(imageBase64, mimeType = "image/jpeg", phase = 1) {
  const currentKey = getCurrentKey();
  if (!currentKey) {
    return "Imagem recebida! O amiguinho na foto parece ser muito fofo e carismático.";
  }

  let cleanBase64 = imageBase64;
  if (imageBase64.includes("base64,")) {
    cleanBase64 = imageBase64.split("base64,")[1];
  }

  let phaseInstruction = "";
  if (phase === 1) {
    phaseInstruction = "Sua missão nesta Parte 1 é descrever EXCLUSIVAMENTE O ANIMAL/PET presente na foto para alimentar o perfil do Dr. Miau. Detalhe com extrema precisão: 1) a espécie (gato, cão, pássaro, etc.), 2) raça (ou mistura de raças / vira-lata se aplicável), 3) cores exatas e padrões da pelagem ou pele (manchas, listras, degrade), 4) se possui alguma avariação, mancha marcante, cicatriz ou deficiência física visível. IGNORE COMPLETAMENTE O CENÁRIO OU AMBIENTE AO FUNDO (o cenário do vídeo será definido separadamente na Parte 2). Foque 100% apenas nas características físicas do pet.";
  } else if (phase === 2) {
    phaseInstruction = "Sua missão nesta Parte 2 é descrever EXCLUSIVAMENTE O CENÁRIO / AMBIENTE presente na foto. Detalhe com extrema precisão: elementos do fundo, móveis, vegetação, iluminação, cores do ambiente, decoração, estilo do lugar (praia, jardim, sala, campo). IGNORE O ANIMAL. Foque 100% no cenário!";
  } else {
    phaseInstruction = "Sua missão nesta Parte 3 é descrever a ação, postura, acessórios, roupinhas e energia do pet e do cenário presente na foto para compor o vídeo final.";
  }

  const systemInstruction = `Você é o Agente Especialista em Análise de Imagens do Estúdio Dr. Miau. Seu único papel é analisar fotos com altíssima precisão de detalhes e gerar uma descrição técnica e minuciosa em português do Brasil.
Sua descrição será repassada diretamente ao Dr. Miau para sintetizar o prompt de animação 3D.
Responda diretamente com a descrição detalhada em 3 a 5 frases ricas, objetivas e encantadoras.`;

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
    console.log("[Vision Agent] Não foi possível chamar Gemini Vision (SDK). Tentando REST ou fallback local.");
    try {
      const isToken = currentKey.startsWith("ya29.");
      let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`;
      const headers = { "Content-Type": "application/json", "User-Agent": "aistudio-build" };
      if (isToken) {
        headers["Authorization"] = `Bearer ${currentKey}`;
      } else {
        apiUrl += `?key=${currentKey}`;
      }

      const payload = {
        contents: [
          {
            parts: [
              { inlineData: { mimeType: mimeType || "image/jpeg", data: cleanBase64 } },
              { text: phaseInstruction }
            ]
          }
        ],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: { maxOutputTokens: 400 }
      };

      const res = await fetch(apiUrl, { method: "POST", headers, body: JSON.stringify(payload) });
      if (res.ok) {
        const json = await res.json();
        const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return text.trim();
      }
    } catch (restErr) {
      console.log("[Vision Agent] Fallback para descrição padrão ativado.");
    }
  }

  return "Imagem analisada: Pet adorável com feições marcantes e pelagem bem definida na foto.";
}

// Rota do Agente Especialista em Imagens
app.post("/api/analyze-image", async (req, res) => {
  try {
    const { imageBase64, mimeType, phase } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: "Imagem em formato Base64 não fornecida." });
    }

    console.log(`[Vision Agent Request] Analisando foto para Parte ${phase || 1}...`);
    const description = await analyzeImageWithAgent(imageBase64, mimeType || "image/jpeg", Number(phase) || 1);
    console.log(`[Vision Agent Output]:`, description);

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
});

// Função de suporte para iniciar a geração de vídeos na API ElevenLabs (Modelo Seedance 2.5)
async function triggerElevenLabsVideoGeneration(prompt) {
  const apiKey = (getElevenLabsKey() || "").trim();
  console.log(`[ElevenLabs Seedance 2.5 Trigger] Iniciando geração de vídeo com ElevenLabsService: "${prompt}"`);
  
  if (!apiKey) {
    const err = new Error("ELEVENLABS_KEY_MISSING: A chave ELEVENLABS_API_KEY não foi configurada no ambiente do servidor.");
    err.code = "ELEVENLABS_KEY_MISSING";
    throw err;
  }

  const client = new ElevenLabsService(apiKey);
  const result = await client.generatePetAnimation(prompt);

  lastVideoPromptInfo = {
    prompt: prompt,
    timestamp: new Date().toISOString(),
    jobId: result.id,
    status: result.status,
    download_url: result.download_url
  };

  return result;
}

// Rota de Healthcheck
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Rota para consultar o último prompt enviado ao gerador de vídeo
app.get("/api/last-prompt", (req, res) => {
  res.json(lastVideoPromptInfo);
});

// Rota para resetar o último prompt gerado quando o usuário inicia nova conversa
app.post("/api/reset-prompt", (req, res) => {
  lastVideoPromptInfo = {
    prompt: null,
    timestamp: null,
    jobId: null,
    status: null
  };
  console.log("[Prompt Reset] Histórico de prompt de vídeo limpo com sucesso.");
  res.json({ success: true });
});

// Rota de Diagnóstico de Conexão das APIs (Gemini e ElevenLabs)
app.get("/api/status", async (req, res) => {
  try {
    const status = await checkApiStatuses();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET video URLs mapped to sentiment keys
app.get("/api/videos", (req, res) => {
  res.json(videoUrls);
});

// Rota para consultar o status de um vídeo gerado pela Atlas Cloud
app.get("/api/video-status/:id", async (req, res) => {
  const jobId = req.params.id;
  try {
    const status = await atlasCloudService.checkVideoTaskStatus(jobId);
    return res.json({
      id: jobId,
      status: status.status,
      video_url: status.videoUrl,
      download_url: status.videoUrl,
      outputs: status.outputs,
      error: status.error,
      metrics: status.metrics || null,
      raw: status.raw || null
    });
  } catch (err) {
    console.error(`[Atlas Cloud Status Error] Erro ao checar status da tarefa ${jobId}:`, err.message);
    return res.status(err.message === "ATLASCLOUD_API_KEY_MISSING" ? 401 : 500).json({
      id: jobId,
      status: "failed",
      error: err.message
    });
  }
});

// Rota de proxy para streaming e download de vídeo sem problemas de CORS
app.get("/api/proxy-video", async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl || typeof videoUrl !== "string") {
    return res.status(400).send("URL de vídeo obrigatória");
  }

  try {
    const fetchRes = await fetch(videoUrl);
    if (!fetchRes.ok) {
      return res.status(fetchRes.status).send(`Erro ao buscar vídeo remoto: ${fetchRes.statusText}`);
    }

    res.setHeader("Content-Type", fetchRes.headers.get("content-type") || "video/mp4");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    if (fetchRes.headers.get("content-length")) {
      res.setHeader("Content-Length", fetchRes.headers.get("content-length"));
    }
    if (fetchRes.headers.get("accept-ranges")) {
      res.setHeader("Accept-Ranges", fetchRes.headers.get("accept-ranges"));
    }

    const arrayBuffer = await fetchRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error("❌ Erro no proxy de vídeo:", err.message);
    return res.status(500).send("Erro interno ao transmitir vídeo");
  }
});

// Rota para salvar a chave da Atlas Cloud dinamicamente
app.post("/api/config/atlas-key", async (req, res) => {
  try {
    const { key } = req.body;
    if (!key || typeof key !== "string" || key.trim().length < 5) {
      return res.status(400).json({ error: "Chave inválida fornecida." });
    }
    atlasCloudService.setAtlasApiKey(key.trim());
    const testResult = await atlasCloudService.testConnection();
    res.json(testResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota para disparar a geração de vídeo usando a API Atlas Cloud (bytedance/seedance-2.0-mini/reference-to-video)
app.post("/api/generate-pet-video", async (req, res) => {
  try {
    const { imageUrl, prompt, ratio, aspectRatio, duration, resolution } = req.body;

    const result = await atlasCloudService.generateReferenceVideo({
      imageUrl: imageUrl || null,
      prompt: prompt || "An adorable 3D Pixar-style animated pet hero in a magical world, ultra detailed 8k, 16:9 aspect ratio",
      ratio: ratio || aspectRatio || "16:9",
      duration: duration || 15,
      resolution: resolution || "720p"
    });

    res.json(result);
  } catch (err) {
    console.error("❌ Erro no endpoint /api/generate-pet-video:", err);
    res.status(500).json({ error: err.message });
  }
});

// Rota para consultar status de uma tarefa da Atlas Cloud
app.get("/api/pet-video-status/:taskId", async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const status = await atlasCloudService.checkVideoTaskStatus(taskId);
    res.json(status);
  } catch (err) {
    console.error("❌ Erro no endpoint /api/pet-video-status:", err);
    res.status(500).json({ error: err.message });
  }
});

// Função centralizada para processar a conversa do Dr. Miau (compatível com chamadas REST normais e Streaming SSE)
async function processChatRequest({ message, history, sessionState = null, onChunk = null, image = null, mimeType = null }) {
  const cleanMsg = (message || "").toLowerCase().trim();

  try {
    const cleanedHistory = Array.isArray(history) 
      ? history.filter(h => h && (h.text || h.image || h.imageUrl) && h.text !== INITIAL_MESSAGE && h.text !== ALT_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE && h.text !== OLD_INITIAL_MESSAGE_2) 
      : [];

    const isDanone = cleanMsg.includes("danone");

    let parsed;

    if (isDanone) {
      console.log(`[Danone Cheat Code] Pulo direto para geração de vídeo na Atlas Cloud ativado!`);
      const danoneText = "Miau! Código especial Danone ativado! Estou enviando seu pedido para o estúdio Atlas Cloud (Seedance 2.0 Mini) agora mesmo! 🚀🎬✨";
      if (onChunk) {
        onChunk(danoneText);
      }
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

      const systemInstruction = `Como doutor miau. Você é um assistente de atendimento que ajuda clientes a criar uma cena personalizada com seu pet. Seu papel é conduzir uma conversa acolhedora e natural para conhecer o animal, a relação dele com o tutor e, depois, construir com o cliente um cenário e uma ação para o pet nesse cenário.

OBJETIVO PRINCIPAL

Antes de definir a cena, procure entender quem é o pet: sua personalidade, seus hábitos, características marcantes e a história que compartilha com o tutor. Use essas informações para tornar a cena pessoal, em vez de sugerir algo genérico.

ETAPAS DA CONVERSA

1. Conhecer o pet e o tutor
- Pergunte o nome do pet e descubra, aos poucos, como ele é.
- Explore assuntos relevantes, como personalidade, manias, brincadeiras, momentos especiais e a história do pet com o tutor.
- Faça uma pergunta de cada vez, aproveitando o que a pessoa acabou de contar.
- Não transforme a conversa em formulário: comente as respostas e demonstre interesse antes de seguir.
- Não invente características nem histórias. Quando faltar uma informação importante, pergunte.

2. Construir o cenário
- Quando já houver contexto suficiente, convide a pessoa a imaginar onde gostaria de ver o pet.
- Ajude-a a descrever o ambiente com perguntas curtas e específicas, apenas quando necessário.
- Relacione sugestões de cenário ao que foi contado sobre o pet, sem impor ideias.

3. Definir a ação do pet
- Pergunte o que o pet estaria fazendo nesse cenário.
- Se a pessoa estiver indecisa, ofereça poucas sugestões coerentes com a personalidade e os hábitos que ela descreveu.
- Confirme a ideia escolhida de modo breve, sem repetir toda a conversa.

REGRAS DE CONVERSA

- Mantenha as respostas curtas, fáceis de ler e com linguagem natural.
- Use o histórico disponível da sessão para manter a continuidade. Não peça novamente informações que a pessoa já forneceu.
- Não repita frases, perguntas ou resumos de mensagens anteriores.
- Se a pessoa mudar de assunto, responda ao que ela disse de forma pertinente. Depois, quando fizer sentido, retome o objetivo da conversa sem parecer que está seguindo um roteiro rígido.
- Não ignore uma resposta só porque ela não corresponde ao que você esperava.
- Não faça várias perguntas na mesma mensagem, salvo se forem muito simples e estiverem diretamente relacionadas.
- Evite elogios automáticos, excesso de entusiasmo e comentários usados apenas para prolongar a conversa.
- ${hasUserSentPhoto ? "IMPORTANTE: O tutor JÁ ENVIOU a foto do pet (que está salva como referência visual para a Atlas Cloud). Reconheça a imagem de forma breve e carinhosa sem ficar descrevendo tecnicamente e NUNCA peça para ele enviar foto de novo." : "Se a pessoa enviar uma foto do pet, reconheça a foto sem presumir detalhes que não consegue verificar e pergunte sobre a história dela com o animal. Ela será usada como referência visual na Atlas Cloud."}
- Se a pessoa quiser pular para o cenário ou para a ação, respeite a escolha. Você pode explicar brevemente que conhecer o pet ajuda a personalizar a cena, mas não insista nem bloqueie o avanço.
- Se a pessoa não souber responder, ofereça uma pergunta mais simples ou algumas opções.
- Nunca afirme lembrar de informações que não estejam no histórico disponível.

COMO DECIDIR A PRÓXIMA RESPOSTA

Antes de responder, identifique internamente:
1. O que a pessoa acabou de dizer ou pedir.
2. Quais informações sobre o pet já foram fornecidas.
3. Em que etapa a conversa está.
4. Qual é a próxima pergunta mais útil — ou se é melhor apenas responder, sugerir opções ou avançar.

Não mostre essa análise ao cliente. Retorne estritamente o JSON com o campo "response" contendo a mensagem de conversa natural.

GERAÇÃO DE VÍDEO 3D NA ATLAS CLOUD:
- Quando cenário e ação estiverem definidos e o cliente aprovar a ideia ("sim", "pode gerar", "ótimo", "vamos", "pode fazer", "ficou legal", etc.), defina \`trigger_video_generation: true\`, \`progress: 100\`, e crie em \`video_prompt\` uma descrição cinematográfica rica em inglês técnico 3D estilo Pixar (com '@image1' como referência do pet).`;

      const promptContents = buildAlternatingContents(cleanedHistory, message, image);
      console.log(`[Gemini Organic Request] Mensagem: "${message}" | Imagem presente: ${Boolean(image)} | Histórico turns: ${promptContents.length}`);

      const responseText = onChunk 
        ? await callGeminiStream(promptContents, systemInstruction, onChunk, cleanedHistory)
        : await callGemini(promptContents, systemInstruction, cleanedHistory);

      console.log("[Gemini Response Output Raw]:", responseText);

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
        console.warn("[Gemini JSON Parse Warning]:", jsonErr.message);
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

    // Limpa a resposta textual
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

    // Mapeamento dos sentimentos para os vídeos locais de reação do Dr. Miau
    const videoMapping = {
      alegre: "feliz",
      neutro: "normal",
      preocupado: "triste",
      protetor: "raiva",
      confuso: "confuso1"
    };

    const targetKey = videoMapping[parsed.sentiment] || "normal";
    const geminiKey = getCurrentKey();
    let atlasJobId = null;
    let atlasStatus = null;
    let atlasError = null;

    if (parsed.trigger_video_generation && parsed.video_prompt) {
      console.log(`[Atlas Cloud Trigger] Fim da conversa confirmado pelo tutor! Prompt: "${parsed.video_prompt}"`);

      // Encontra a foto enviada pelo usuário em qualquer momento da conversa ou no request atual
      const photoCandidate = (cleanedHistory || []).find(h => (h.image || h.imageUrl) && typeof (h.image || h.imageUrl) === "string");
      const petImageUrl = image || (photoCandidate ? (photoCandidate.image || photoCandidate.imageUrl) : null);

      lastVideoPromptInfo = {
        prompt: parsed.video_prompt,
        timestamp: new Date().toISOString(),
        jobId: `prompt_${Date.now()}`,
        status: "processing"
      };

      try {
        const atlasResult = await atlasCloudService.generateReferenceVideo({
          imageUrl: petImageUrl,
          prompt: parsed.video_prompt,
          ratio: "16:9",
          duration: 15,
          resolution: "720p"
        });

        if (atlasResult && atlasResult.taskId) {
          atlasJobId = atlasResult.taskId;
          atlasStatus = atlasResult.status || "processing";
          lastVideoPromptInfo.jobId = atlasJobId;
          console.log(`✅ [Atlas Cloud] Vídeo 720p 15s disparado com sucesso! TaskId: ${atlasJobId}`);
        }
      } catch (atlasErr) {
        console.error("❌ [Atlas Cloud] Erro ao disparar geração do vídeo:", atlasErr.message);
        atlasError = atlasErr.message;
      }
    }

    const apiStatus = {
      gemini_connected: !!geminiKey,
      gemini_error: !geminiKey ? "GEMINI_API_KEY_MISSING: Chave GEMINI_API_KEY não configurada no servidor." : null,
      atlascloud_configured: true,
      atlascloud_error: atlasError || null
    };

    return {
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
      fallbackUrl: videoUrls[targetKey] || videoUrls.normal,
      api_status: apiStatus
    };

  } catch (err) {
    console.error("[Gemini Chat Processing Error]:", err);
    return {
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
      fallbackUrl: videoUrls.normal,
      api_status: {
        gemini_connected: false,
        gemini_error: `CHAT_ERROR: ${err.message}`,
        atlascloud_configured: true,
        atlascloud_error: null
      }
    };
  }
}

// REST API para Chat tradicional
app.post("/api/chat", async (req, res) => {
  const { message, history, sessionState, image, imageUrl, mimeType } = req.body;
  if (!message && !image && !imageUrl) {
    return res.status(400).json({ error: "Sua mensagem é necessária." });
  }

  const result = await processChatRequest({ 
    message: message || "Enviei uma foto do meu pet 📸", 
    history, 
    sessionState, 
    image: image || imageUrl || null,
    mimeType: mimeType || "image/jpeg",
    onChunk: null 
  });
  res.json(result);
});

// REST API para Chat com Streaming SSE em tempo real (palavra por palavra instantâneo)
app.post("/api/chat/stream", async (req, res) => {
  const { message, history, sessionState, image, imageUrl, mimeType } = req.body;
  if (!message && !image && !imageUrl) {
    return res.status(400).json({ error: "Sua mensagem é necessária." });
  }

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
        response: "Olá! Adorei conversar com você. Me conta mais sobre seu pet!",
        sentiment: "alegre",
        phase: sessionState?.currentPhase || 1,
        progress: sessionState?.progress || 25
      }
    });
    res.end();
  }
});

// Servir arquivos estáticos do diretório public e vídeos com fallback seguro 404
app.use("/videos", express.static(path.join(__dirname, "public", "videos")));
app.use("/videos", express.static(path.join(__dirname, "dist", "videos")));
app.use("/videos", express.static(path.join(__dirname, "src")));
app.get("/videos/*", (req, res) => {
  res.status(404).type("text/plain").send("Vídeo não encontrado no servidor.");
});

app.use(express.static(path.join(__dirname, "public")));

// Retornar SPA em qualquer outra requisição não-estática
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Dr. Miau Pet Agent ativo e ouvindo na porta ${PORT}`);
  });
}

module.exports = app;
