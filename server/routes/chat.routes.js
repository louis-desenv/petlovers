/**
 * Rotas de Chat, Streaming e Visão Computacional
 */

const express = require("express");
const router = express.Router();
const chatController = require("../controllers/chat.controller");

router.post("/chat", chatController.handleChat);
router.post("/chat/stream", chatController.handleChatStream);
router.post("/analyze-image", chatController.handleAnalyzeImage);

module.exports = router;
