/**
 * Serviço de Integração com a API Atlas Cloud
 * Suporta o modelo Seedance 2.0 (bytedance/seedance-2.0/reference-to-video e text-to-video)
 * Inclui fallback automático resiliente e polling de status.
 */

const fs = require("fs");
const path = require("path");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));
const { getAtlasApiKey: getEnvAtlasKey } = require("../config/env");

let runtimeApiKey = "";
const activeTasks = new Map();

/**
 * Define uma chave em memória em tempo de execução
 * @param {string} key 
 */
function setRuntimeApiKey(key) {
  if (key && typeof key === "string") {
    runtimeApiKey = key.trim();
  }
}

/**
 * Obtém a chave da Atlas Cloud priorizando runtime, env vars e arquivos .env
 * @returns {string}
 */
function getAtlasApiKey() {
  if (runtimeApiKey && runtimeApiKey.trim()) {
    return runtimeApiKey.trim();
  }
  return getEnvAtlasKey();
}

/**
 * Testa a conexão e autenticação com a API da Atlas Cloud
 * @returns {Promise<object>}
 */
async function testConnection() {
  const apiKey = getAtlasApiKey();
  if (!apiKey) {
    return {
      connected: false,
      configured: false,
      error: "ATLASCLOUD_API_KEY_MISSING",
      message: "Chave da Atlas Cloud não configurada no ambiente."
    };
  }

  try {
    const res = await fetch("https://api.atlascloud.ai/api/v1/model/list", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`
      }
    });

    if (res.ok) {
      return {
        connected: true,
        configured: true,
        status: res.status,
        message: "Conexão com Atlas Cloud estabelecida com sucesso."
      };
    } else {
      const errText = await res.text().catch(() => "");
      return {
        connected: false,
        configured: true,
        status: res.status,
        error: `HTTP_${res.status}`,
        message: `Atlas Cloud retornou status ${res.status}: ${errText.slice(0, 150)}`
      };
    }
  } catch (err) {
    return {
      connected: false,
      configured: true,
      error: "NETWORK_ERROR",
      message: `Erro ao conectar com Atlas Cloud: ${err.message}`
    };
  }
}

/**
 * Dispara a geração de vídeo 3D na Atlas Cloud
 * @param {object} params
 * @param {string} params.prompt
 * @param {string|null} [params.imageUrl]
 * @param {string} [params.ratio]
 * @param {number} [params.duration]
 * @param {string} [params.resolution]
 * @returns {Promise<object>}
 */
async function generateReferenceVideo({
  prompt,
  imageUrl = null,
  ratio = "16:9",
  aspectRatio = "16:9",
  duration = 15,
  resolution = "720p"
}) {
  const apiKey = getAtlasApiKey();
  if (!apiKey) {
    throw new Error("ATLASCLOUD_API_KEY_MISSING: Chave da Atlas Cloud não encontrada.");
  }

  const endpoint = "https://api.atlascloud.ai/api/v1/model/generateVideo";

  // Identifica e valida imagens de referência
  const referenceImages = [];
  if (imageUrl && typeof imageUrl === "string" && imageUrl.trim().length > 0) {
    referenceImages.push(imageUrl.trim());
  }

  const hasUserPhoto = referenceImages.length > 0;
  const finalResolution = (resolution === "720p" || !resolution) ? "720p" : ((resolution === "1080p" || resolution === "1080p-SR") ? "1080p-SR" : resolution);
  const finalDuration = (typeof duration === "number" && duration > 0) ? duration : 15;
  const finalRatio = ratio || aspectRatio || "16:9";

  let cleanPrompt = prompt || "An adorable 3D Pixar-style animated pet hero in a magical world, vibrant cinematic lighting, ultra detailed 8k, 16:9 aspect ratio.";

  if (hasUserPhoto) {
    if (!cleanPrompt.includes("@image1") && !cleanPrompt.includes("@Image1")) {
      cleanPrompt = `The character @image1 in this scene: ${cleanPrompt}`;
    }
  } else {
    cleanPrompt = cleanPrompt.replace(/@image\d+/gi, "").replace(/the character\s+in this scene:/gi, "").trim();
  }

  // Monta payload compatível com Seedance 2.0
  const payload = {
    model: hasUserPhoto 
      ? "bytedance/seedance-2.0/reference-to-video" 
      : "bytedance/seedance-2.0/text-to-video",
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

  console.log(`[AtlasService] Enviando POST para ${endpoint} | Modelo: ${payload.model} | Duração: ${payload.duration}s`);

  let response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  let resJson = await response.json().catch(() => null);

  // Fallback automático para Text-to-Video em caso de HTTP 400 (ex: dimensões de imagem incompatíveis)
  if (!response.ok && hasUserPhoto && response.status === 400) {
    const origError = resJson?.msg || resJson?.error || resJson?.message || `HTTP 400`;
    console.warn(`⚠️ [AtlasService] 400 em reference-to-video ("${origError}"). Acionando fallback automático para text-to-video...`);

    const fallbackPrompt = cleanPrompt.replace(/@image\d+/gi, "").replace(/the character\s+in this scene:/gi, "").trim();
    const fallbackPayload = {
      model: "bytedance/seedance-2.0/text-to-video",
      prompt: fallbackPrompt,
      duration: finalDuration,
      resolution: finalResolution,
      ratio: finalRatio,
      bitrate_mode: "standard",
      generate_audio: true,
      seed: -1,
      watermark: false,
      return_last_frame: false
    };

    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify(fallbackPayload)
    });

    resJson = await response.json().catch(() => null);
  }

  if (!response.ok || !resJson) {
    const errorMsg = resJson?.msg || resJson?.error || resJson?.message || resJson?.data?.error || `Erro HTTP ${response.status}`;
    console.error("❌ [AtlasService] Falha na chamada da API:", { status: response.status, errorMsg });
    throw new Error(`Atlas Cloud API error (${response.status}): ${typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg)}`);
  }

  const predictionId = resJson?.data?.id || resJson?.id;
  if (!predictionId) {
    throw new Error("Atlas Cloud não retornou um ID de predição válido.");
  }

  activeTasks.set(predictionId, {
    startTime: Date.now(),
    prompt: cleanPrompt,
    duration: finalDuration,
    resolution: finalResolution,
    ratio: finalRatio
  });

  return {
    taskId: predictionId,
    id: predictionId,
    status: "processing",
    model: payload.model,
    prompt: cleanPrompt
  };
}

/**
 * Consulta o status de processamento da tarefa de vídeo
 * @param {string} taskId 
 * @returns {Promise<object>}
 */
async function checkVideoStatus(taskId) {
  const apiKey = getAtlasApiKey();
  if (!apiKey) {
    throw new Error("ATLASCLOUD_API_KEY_MISSING");
  }

  const endpoint = `https://api.atlascloud.ai/api/v1/model/prediction/${taskId}`;

  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${apiKey}`
    }
  });

  if (!response.ok) {
    throw new Error(`Erro ao verificar status do vídeo: HTTP ${response.status}`);
  }

  const resJson = await response.json();
  const data = resJson.data || resJson;

  let videoUrl = null;
  if (data.outputs && Array.isArray(data.outputs) && data.outputs.length > 0) {
    videoUrl = data.outputs[0];
  } else if (data.output) {
    videoUrl = typeof data.output === "string" ? data.output : data.output.url;
  } else if (data.video_url) {
    videoUrl = data.video_url;
  }

  const statusRaw = (data.status || "").toLowerCase();
  let normalizedStatus = "processing";

  if (["succeeded", "completed", "success", "done"].includes(statusRaw)) {
    normalizedStatus = "completed";
  } else if (["failed", "error", "canceled"].includes(statusRaw)) {
    normalizedStatus = "failed";
  }

  return {
    taskId,
    status: normalizedStatus,
    rawStatus: statusRaw,
    videoUrl,
    progress: data.progress || (normalizedStatus === "completed" ? 100 : 50),
    error: data.error || null
  };
}

module.exports = {
  getAtlasApiKey,
  setRuntimeApiKey,
  setAtlasApiKey: setRuntimeApiKey,
  testConnection,
  generateReferenceVideo,
  checkVideoStatus,
  checkVideoTaskStatus: checkVideoStatus,
  activeTasks
};
