/**
 * Rotas de Status, Diagnóstico e Configuração de Chaves
 */

const express = require("express");
const router = express.Router();
const statusController = require("../controllers/status.controller");

router.get("/status", statusController.handleStatus);
router.post("/config/atlas-key", statusController.handleSetConfigAtlasKey);

module.exports = router;
