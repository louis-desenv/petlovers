/**
 * Controller de Vídeo e Animações 3D
 * Gerencia a lista de vídeos locais do Dr. Miau, geração na Atlas Cloud e proxy de vídeo.
 */

const atlasService = require("../services/atlas.service");
const { VIDEO_URLS } = require("../config/constants");
const fetch = (...args) => import("node-fetch").then(({ default: fetch }) => fetch(...args));

/**
 * Retorna as URLs dos vídeos padrão de reação emocional
 */
function handleGetVideos(req, res) {
  res.json(VIDEO_URLS);
}

/**
 * Consulta status de um vídeo gerado pela Atlas Cloud
 */
async function handleGetVideoStatus(req, res) {
  const jobId = req.params.id;
  try {
    const status = await atlasService.checkVideoStatus(jobId);
    return res.json({
      id: jobId,
      status: status.status,
      video_url: status.videoUrl,
      download_url: status.videoUrl,
      outputs: status.videoUrl ? [status.videoUrl] : [],
      error: status.error,
      progress: status.progress
    });
  } catch (err) {
    console.error(`[Video Controller] Erro ao checar status da tarefa ${jobId}:`, err.message);
    return res.status(err.message === "ATLASCLOUD_API_KEY_MISSING" ? 401 : 500).json({
      id: jobId,
      status: "failed",
      error: err.message
    });
  }
}

/**
 * Rota de proxy para streaming e download de vídeo evitando problemas de CORS e bloqueios de mídia
 */
async function handleProxyVideo(req, res) {
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
}

/**
 * Dispara geração de vídeo direta
 */
async function handleGeneratePetVideo(req, res) {
  try {
    const { imageUrl, prompt, ratio, aspectRatio, duration, resolution } = req.body;
    const result = await atlasService.generateReferenceVideo({
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
}

/**
 * Consulta status pelo taskId da tarefa
 */
async function handleGetPetVideoStatus(req, res) {
  try {
    const taskId = req.params.taskId;
    const status = await atlasService.checkVideoStatus(taskId);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  handleGetVideos,
  handleGetVideoStatus,
  handleProxyVideo,
  handleGeneratePetVideo,
  handleGetPetVideoStatus
};
