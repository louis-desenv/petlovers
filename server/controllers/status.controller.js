/**
 * Controller de Diagnóstico, Status de APIs e Conectividade
 * Monitora a saúde do servidor Express e credenciais ativas.
 */

const { checkApiStatuses } = require("../services/gemini.service");
const atlasService = require("../services/atlas.service");

/**
 * Healthcheck imediato do backend
 */
function handleHealth(req, res) {
  res.json({ status: "ok" });
}

/**
 * Retorna o diagnóstico detalhado das APIs externas
 */
async function handleStatus(req, res) {
  try {
    const status = await checkApiStatuses();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/**
 * Atualiza a chave da Atlas Cloud em tempo de execução
 */
async function handleSetConfigAtlasKey(req, res) {
  try {
    const { key } = req.body;
    if (!key || typeof key !== "string" || key.trim().length < 5) {
      return res.status(400).json({ error: "Chave inválida fornecida." });
    }

    atlasService.setRuntimeApiKey(key.trim());
    const testResult = await atlasService.testConnection();
    res.json(testResult);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  handleHealth,
  handleStatus,
  handleSetConfigAtlasKey
};
