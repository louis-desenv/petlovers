/**
 * Agregador Central de Rotas do Backend
 */

const express = require("express");
const router = express.Router();

const chatRoutes = require("./chat.routes");
const videoRoutes = require("./video.routes");
const authRoutes = require("./auth.routes");
const statusRoutes = require("./status.routes");
const statusController = require("../controllers/status.controller");

// Healthcheck no nível de rotas
router.get("/health", statusController.handleHealth);

// Rotas da API REST
router.use("/api", chatRoutes);
router.use("/api", videoRoutes);
router.use("/api", authRoutes);
router.use("/api", statusRoutes);

module.exports = router;
