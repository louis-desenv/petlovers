/**
 * Cliente de Serviços de API do Dr. Miau
 * Gerencia chamadas HTTP, SSE Streaming e comunicação com o backend sem cache indesejado.
 */

/**
 * Envia mensagem tradicional para o chat
 */
export async function postChatMessage(payload) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Erro na API de Chat: HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Envia mensagem com streaming SSE de resposta em tempo real
 */
export async function postChatStream(payload, onChunk, onDone, onError) {
  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload)
    });

    if (!response.ok || !response.body) {
      throw new Error(`Erro no streaming do chat: HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === "chunk" && event.chunk) {
              onChunk(event.chunk);
            } else if (event.type === "done" && event.data) {
              onDone(event.data);
            }
          } catch (e) {
            console.warn("Erro ao fazer parse de evento SSE:", e);
          }
        }
      }
    }
  } catch (err) {
    if (onError) onError(err);
    else throw err;
  }
}

/**
 * Consulta status e diagnóstico das APIs no backend
 */
export async function fetchApiStatus() {
  const res = await fetch("/api/status", { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Consulta o último prompt gerado para a conversa atual
 */
export async function fetchLastPrompt(conversationId, userId) {
  const url = `/api/last-prompt?conversationId=${encodeURIComponent(conversationId)}&userId=${encodeURIComponent(userId || "usr_anonymous")}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Solicita o reset do prompt e estado de uma conversa no servidor
 */
export async function resetPromptOnServer(payload) {
  return fetch("/api/reset-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload)
  }).then(r => r.json()).catch(() => ({ success: false }));
}

/**
 * Envia notificação de logout do usuário para o servidor
 */
export async function logoutUserOnServer(payload) {
  return fetch("/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload)
  }).then(r => r.json()).catch(() => ({ success: false }));
}

/**
 * Consulta status de renderização de um vídeo na Atlas Cloud
 */
export async function pollVideoTask(jobId) {
  const res = await fetch(`/api/video-status/${encodeURIComponent(jobId)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Atualiza dinamicamente a chave da Atlas Cloud no backend
 */
export async function updateAtlasKey(key) {
  const res = await fetch("/api/config/atlas-key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key })
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
