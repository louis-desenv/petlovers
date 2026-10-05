/**
 * Controller de Autenticação, Isolamento de Usuários e Reset de Sessão
 * Controla logout limpo, descarte de histórico e consulta segura do último prompt.
 */

const {
  getPromptInfo,
  deleteConversation,
  deleteUserConversations
} = require("../services/session.store");

/**
 * Consulta o último prompt gerado para uma conversa com isolamento estrito
 */
function handleGetLastPrompt(req, res) {
  const conversationId = req.query.conversationId || req.headers["x-conversation-id"];
  const userId = req.query.userId || req.headers["x-user-id"] || "usr_anonymous";

  if (!conversationId) {
    return res.json({ prompt: null, timestamp: null, jobId: null, status: null });
  }

  const result = getPromptInfo(conversationId, userId);
  if (result.unauthorized) {
    console.warn(`[Security] Tentativa de acesso não autorizado à conversa ${conversationId} pelo usuário ${userId}`);
    return res.status(403).json({ error: "Acesso negado à conversa de outro usuário." });
  }

  res.json(result.data);
}

/**
 * Reseta o prompt e o estado em memória de uma conversa específica
 */
function handleResetPrompt(req, res) {
  const { conversationId, userId, sessionId } = req.body || {};
  const convId = conversationId || req.query.conversationId || req.headers["x-conversation-id"];
  const now = new Date().toISOString();

  if (convId) {
    deleteConversation(convId);
    console.log(`[Conversation Reset] Histórico da conversa removido do servidor: Conv ${convId} (User: ${userId || 'usr_anonymous'})`);
  }

  res.json({ success: true, conversationId: convId, clearedAt: now });
}

/**
 * Logout seguro do usuário: limpa sessões em memória e descarta referências ativas
 */
function handleLogout(req, res) {
  const { userId, sessionId, conversationId } = req.body || {};
  const now = new Date().toISOString();

  console.log(`[Auth Logout] Sessão do usuário encerrada: ${userId || 'usr_anonymous'} (${now})`);

  if (conversationId) {
    deleteConversation(conversationId);
  }
  if (userId && userId !== "usr_anonymous") {
    deleteUserConversations(userId);
  }

  res.json({
    success: true,
    message: "Sessão encerrada com sucesso no servidor.",
    userId: userId || "usr_anonymous",
    loggedOutAt: now
  });
}

module.exports = {
  handleGetLastPrompt,
  handleResetPrompt,
  handleLogout
};
