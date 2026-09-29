const fs = require("fs");
const path = require("path");

const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

let runtimeApiKey = "";

/**
 * Obtém a chave de API da Atlas Cloud de múltiplas fontes:
 * 1. Runtime memory (se atualizada dinamicamente)
 * 2. Variáveis de ambiente (ATLASCLOUD_API_KEY, ATLAS_CLOUD_API_KEY, etc.)
 * 3. Arquivo .env local
 */
function getAtlasApiKey() {
  if (runtimeApiKey && runtimeApiKey.trim()) {
    return runtimeApiKey.trim();
  }

  const candidateKeys = [
    "ATLASCLOUD_API_KEY",
    "ATLAS_CLOUD_API_KEY",
    "ATLAS_API_KEY",
    "VITE_ATLASCLOUD_API_KEY"
  ];

  for (const k of candidateKeys) {
    if (process.env[k] && process.env[k].trim()) {
      return process.env[k].trim().replace(/^["']|["']$/g, "");
    }
  }

  // Leitura do arquivo .env
  try {
    const envPath = path.join(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#")) continue;
        const [k, ...v] = trimmed.split("=");
        if (k && candidateKeys.includes(k.trim())) {
          const val = v.join("=").trim().replace(/^["']|["']$/g, "");
          if (val) return val;
        }
      }
    }
  } catch (e) {}

  return "";
}

/**
 * Define em runtime e persiste no .env a chave da Atlas Cloud
 */
function setAtlasApiKey(newKey) {
  if (!newKey) return;
  const clean = String(newKey).trim().replace(/^["']|["']$/g, "");
  runtimeApiKey = clean;
  process.env.ATLASCLOUD_API_KEY = clean;

  try {
    const envPath = path.join(process.cwd(), ".env");
    let content = "";
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, "utf8");
    }
    if (content.includes("ATLASCLOUD_API_KEY=")) {
      content = content.replace(/ATLASCLOUD_API_KEY=.*/g, `ATLASCLOUD_API_KEY=${clean}`);
    } else {
      content += `\nATLASCLOUD_API_KEY=${clean}\n`;
    }
    fs.writeFileSync(envPath, content, "utf8");
    console.log("[AtlasCloudService] Chave ATLASCLOUD_API_KEY salva no arquivo .env com sucesso.");
  } catch (e) {
    console.warn("[AtlasCloudService] Não foi possível salvar no .env:", e.message);
  }
}

/**
 * Dispara a geração de vídeo na Atlas Cloud API
 * Modelo: bytedance/seedance-2.0-mini/reference-to-video
 * 
 * @param {Object} params
 * @param {string} params.prompt - Prompt em inglês técnico gerado pelo agente do Gemini
 * @param {string|null} [params.imageUrl] - Foto do pet (URL ou data URI Base64)
 * @param {string} [params.ratio] - "16:9", "adaptive", "1:1", etc.
 * @param {number} [params.duration] - Duração do vídeo em segundos (padrão: 15s)
 * @param {string} [params.resolution] - Resolução (padrão: "720p")
 */
async function generateReferenceVideo({
  prompt,
  imageUrl = null,
  ratio = "16:9",
  aspectRatio = null,
  duration = 15,
  resolution = "720p"
}) {
  const apiKey = getAtlasApiKey();
  console.log(`[AtlasCloudService] Disparando geração de vídeo na Atlas Cloud. API Key presente: ${!!apiKey}`);

  if (!apiKey) {
    console.warn("⚠️ [AtlasCloudService] ATLASCLOUD_API_KEY não configurada no servidor (.env ou variáveis de ambiente).");
    throw new Error("ATLASCLOUD_API_KEY_MISSING: Por favor configure sua chave da Atlas Cloud no arquivo .env ou no painel de diagnóstico.");
  }

  // Prepara as imagens de referência:
  // Usa UNICAMENTE a foto real enviada pelo tutor. Se o tutor não enviou foto, NUNCA usa imagens pré-fabricadas.
  let referenceImages = [];
  const hasUserPhoto = Boolean(imageUrl && typeof imageUrl === "string" && imageUrl.trim());

  if (hasUserPhoto) {
    console.log(`[AtlasCloudService] Usando foto enviada pelo usuário como referência única de personagem.`);
    referenceImages = [imageUrl.trim()];
  } else {
    console.log(`[AtlasCloudService] Nenhuma foto enviada pelo tutor. Gerando animação 3D puramente via Text-to-Video a partir da descrição do pet.`);
  }

  const endpoint = "https://api.atlascloud.ai/api/v1/model/generateVideo";

  // Normaliza resolução para as opções suportadas pela API ("720p", "1080p-SR", "1440p-SR")
  const finalResolution = (resolution === "720p" || !resolution) ? "720p" : ((resolution === "1080p" || resolution === "1080p-SR") ? "1080p-SR" : resolution);
  const finalDuration = (typeof duration === "number" && duration > 0) ? duration : 15;
  const finalRatio = ratio || aspectRatio || "16:9";

  let cleanPrompt = prompt || "An adorable 3D Pixar-style animated pet hero in a magical world, vibrant cinematic lighting, ultra detailed 8k, 16:9 aspect ratio.";
  
  if (hasUserPhoto) {
    // Quando há foto do tutor, usa condicionamento @image1
    if (!cleanPrompt.includes("@image1") && !cleanPrompt.includes("@Image1")) {
      cleanPrompt = `The character @image1 in this scene: ${cleanPrompt}`;
    }
  } else {
    // Quando NÃO há foto do tutor, limpa qualquer tag @image1 acidental do prompt para garantir modo Text-to-Video 100% puro
    cleanPrompt = cleanPrompt.replace(/@image\d+/gi, "").replace(/the character\s+in this scene:/gi, "").trim();
  }

  // Monta payload estritamente compatível: se houver foto usa reference-to-video com reference_images;
  // se não houver foto usa text-to-video sem reference_images
  const payload = {
    model: hasUserPhoto 
      ? "bytedance/seedance-2.0-mini/reference-to-video" 
      : "bytedance/seedance-2.0-mini/text-to-video",
    prompt: cleanPrompt,
    duration: finalDuration,
    resolution: finalResolution,
    ratio: finalRatio,
    bitrate_mode: "standard",
    generate_audio: true,
    seed: -1,
    watermark: false,
    return_last_frame: false
  };

  if (hasUserPhoto && referenceImages.length > 0) {
    payload.reference_images = referenceImages;
  }

  console.log(`[AtlasCloudService] Enviando POST para ${endpoint} com payload:`, {
    model: payload.model,
    prompt: payload.prompt.slice(0, 120) + "...",
    duration: payload.duration,
    resolution: payload.resolution,
    hasUserPhoto,
    referenceImagesCount: payload.reference_images ? payload.reference_images.length : 0
  });

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const resJson = await response.json().catch(() => null);

  if (!response.ok || !resJson) {
    const errorMsg = resJson?.error || resJson?.message || resJson?.data?.error || `Erro HTTP ${response.status}`;
    console.error("❌ [AtlasCloudService] Falha na chamada da API:", errorMsg, resJson);
    throw new Error(`Atlas Cloud API error (${response.status}): ${typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg)}`);
  }

  const predictionId = resJson?.data?.id || resJson?.id;

  if (!predictionId) {
    console.error("❌ [AtlasCloudService] Resposta da API não contém ID de predição:", resJson);
    throw new Error("Atlas Cloud não retornou um ID de predição válido.");
  }

  // Registra metadados da tarefa para cálculo preciso de métricas em tempo real
  activeTasks.set(predictionId, {
    startTime: Date.now(),
    prompt: cleanPrompt,
    duration: finalDuration,
    resolution: finalResolution,
    ratio: finalRatio
  });

  console.log(`✅ [AtlasCloudService] Tarefa iniciada com sucesso na Atlas Cloud! ID: ${predictionId}`);

  return {
    success: true,
    taskId: predictionId,
    status: resJson?.data?.status || resJson?.status || "processing",
    raw: resJson
  };
}

// Mapa em memória para rastreamento de tarefas e métricas de tempo
const activeTasks = new Map();

/**
 * Consulta o status da predição na Atlas Cloud com métricas técnicas detalhadas
 * @param {string} predictionId
 */
async function checkVideoTaskStatus(predictionId) {
  if (!predictionId) {
    throw new Error("predictionId é obrigatório para consultar status na Atlas Cloud.");
  }

  const apiKey = getAtlasApiKey();
  if (!apiKey) {
    throw new Error("ATLASCLOUD_API_KEY_MISSING");
  }

  const pollUrl = `https://api.atlascloud.ai/api/v1/model/prediction/${predictionId}`;

  const response = await fetch(pollUrl, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`
    }
  });

  const resJson = await response.json().catch(() => null);

  if (!response.ok || !resJson) {
    throw new Error(`Falha HTTP ${response.status} ao consultar status na Atlas Cloud`);
  }

  const data = resJson.data || resJson;
  const status = data.status || "processing";
  const outputs = data.outputs || [];
  const videoUrl = Array.isArray(outputs) && outputs.length > 0 ? outputs[0] : null;

  const isCompleted = status === "completed" || status === "succeeded";
  const isFailed = status === "failed";
  const isTimeout = status === "timeout";

  // Cálculo de métricas reais
  const meta = activeTasks.get(predictionId);
  const startTime = meta?.startTime || (data.created_at && !data.created_at.startsWith("0001") ? new Date(data.created_at).getTime() : Date.now());
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - startTime) / 1000));
  const executionTime = data.executionTime || 0;
  const inferenceTime = data.timings?.inference || 0;
  const isQueueing = (executionTime === 0 && !isCompleted && !isFailed);

  let workerStage = "Inicializando container GPU";
  if (isCompleted) {
    workerStage = "Concluído";
  } else if (isFailed) {
    workerStage = "Falha";
  } else if (executionTime > 0 || inferenceTime > 0) {
    workerStage = "Inferência ativa na GPU";
  } else if (elapsedSeconds > 25) {
    workerStage = "Aguardando worker GPU na fila Atlas Cloud";
  }

  return {
    id: predictionId,
    status: isCompleted ? "completed" : (isFailed ? "failed" : (isTimeout ? "timeout" : status)),
    videoUrl: videoUrl,
    outputs: outputs,
    error: data.error || (isTimeout ? "Tempo limite de processamento atingido na Atlas Cloud" : null),
    metrics: {
      status,
      elapsedSeconds,
      executionTime,
      inferenceTime,
      workerStage,
      isQueueing,
      createdAt: data.created_at,
      completionTokens: data.completion_tokens || 0,
      totalTokens: data.total_tokens || 0,
      resolution: meta?.resolution || "720p",
      duration: meta?.duration || 15
    },
    raw: data
  };
}


/**
 * Valida a conexão com a API da Atlas Cloud
 */
async function testConnection() {
  const apiKey = getAtlasApiKey();
  if (!apiKey) {
    return {
      connected: false,
      configured: false,
      error: "ATLASCLOUD_API_KEY_MISSING",
      message: "Chave ATLASCLOUD_API_KEY não configurada no servidor."
    };
  }

  try {
    // Testa chamada de autenticação com a API da Atlas Cloud
    const testUrl = "https://api.atlascloud.ai/api/v1/model/prediction/test_auth_check";
    const res = await fetch(testUrl, {
      method: "GET",
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    
    // Status 404 para ID inexistente significa que o Bearer token foi aceito pela API!
    // Status 401 ou 403 significa chave inválida.
    if (res.status === 401 || res.status === 403) {
      return {
        connected: false,
        configured: true,
        error: "INVALID_API_KEY",
        message: "Chave ATLASCLOUD_API_KEY inválida ou não autorizada na Atlas Cloud."
      };
    }

    return {
      connected: true,
      configured: true,
      error: null,
      message: "Conexão com a Atlas Cloud API ativa (Modelo Seedance 2.0 Mini)! 🎬"
    };
  } catch (err) {
    return {
      connected: false,
      configured: true,
      error: err.message,
      message: `Erro ao testar Atlas Cloud: ${err.message}`
    };
  }
}

module.exports = {
  getAtlasApiKey,
  setAtlasApiKey,
  generateReferenceVideo,
  checkVideoTaskStatus,
  testConnection
};
