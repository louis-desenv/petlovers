/**
 * Rotas de Autenticação, Sessão e Gerenciamento de Histórico
 */

const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");

router.get("/last-prompt", authController.handleGetLastPrompt);
router.post("/reset-prompt", authController.handleResetPrompt);
router.post("/auth/logout", authController.handleLogout);

module.exports = router;
