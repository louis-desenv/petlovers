/**
 * Repositório e Armazenamento de Sessões em Memória
 * Garante o isolamento estrito de conversas por userId e conversationId.
 */

const conversationStore = new Map();

/**
 * Obtém uma conversa existente ou cria uma nova com isolamento
 * @param {string} convId 
 * @param {string} userId 
 * @param {string} sessionId 
 * @returns {object|null}
 */
function getOrCreateConversation(convId, userId = "usr_anonymous", sessionId = null) {
  if (!convId) return null;
  
  if (!conversationStore.has(convId)) {
    conversationStore.set(convId, {
      conversationId: convId,
      userId: userId || "usr_anonymous",
      sessionId: sessionId || "sess_unknown",
      promptInfo: {
        prompt: null,
        timestamp: null,
        jobId: null,
        status: null,
        error: null
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  const entry = conversationStore.get(convId);
  if (userId && userId !== "usr_anonymous") entry.userId = userId;
  if (sessionId) entry.sessionId = sessionId;
  entry.updatedAt = new Date().toISOString();
  return entry;
}

/**
 * Recupera uma conversa pelo ID
 * @param {string} convId 
 * @returns {object|null}
 */
function getConversation(convId) {
  if (!convId) return null;
  return conversationStore.get(convId) || null;
}

/**
 * Remove uma conversa específica
 * @param {string} convId 
 * @returns {boolean}
 */
function deleteConversation(convId) {
  if (!convId) return false;
  return conversationStore.delete(convId);
}

/**
 * Remove todas as conversas associadas a um usuário (Logout)
 * @param {string} userId 
 * @returns {number} Quantidade de conversas removidas
 */
function deleteUserConversations(userId) {
  if (!userId || userId === "usr_anonymous") return 0;
  let count = 0;
  for (const [cId, entry] of conversationStore.entries()) {
    if (entry.userId === userId) {
      conversationStore.delete(cId);
      count++;
    }
  }
  return count;
}

/**
 * Recupera informações do prompt armazenado para uma conversa com verificação de posse
 * @param {string} convId 
 * @param {string} userId 
 * @returns {{ unauthorized?: boolean, data: object }}
 */
function getPromptInfo(convId, userId = "usr_anonymous") {
  if (!convId) {
    return { data: { prompt: null, timestamp: null, jobId: null, status: null } };
  }
  
  const record = conversationStore.get(convId);
  if (!record || !record.promptInfo) {
    return { data: { prompt: null, timestamp: null, jobId: null, status: null } };
  }
  
  if (userId && userId !== "usr_anonymous" && record.userId && record.userId !== "usr_anonymous" && record.userId !== userId) {
    return { unauthorized: true, data: null };
  }
  
  return { unauthorized: false, data: record.promptInfo };
}

/**
 * Atualiza as informações do prompt e status de geração de vídeo
 * @param {string} convId 
 * @param {object} promptInfoUpdate 
 */
function updatePromptInfo(convId, promptInfoUpdate) {
  const record = conversationStore.get(convId);
  if (!record) return;
  record.promptInfo = {
    ...(record.promptInfo || {}),
    ...promptInfoUpdate,
    timestamp: new Date().toISOString()
  };
  record.updatedAt = new Date().toISOString();
}

module.exports = {
  conversationStore,
  getOrCreateConversation,
  getConversation,
  deleteConversation,
  deleteUserConversations,
  getPromptInfo,
  updatePromptInfo
};
