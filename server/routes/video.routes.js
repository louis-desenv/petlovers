/**
 * Rotas de Vídeo, Geração 3D e Proxy de Streaming
 */

const express = require("express");
const router = express.Router();
const videoController = require("../controllers/video.controller");

router.get("/videos", videoController.handleGetVideos);
router.get("/video-status/:id", videoController.handleGetVideoStatus);
router.get("/proxy-video", videoController.handleProxyVideo);
router.post("/generate-pet-video", videoController.handleGeneratePetVideo);
router.get("/pet-video-status/:taskId", videoController.handleGetPetVideoStatus);

module.exports = router;
