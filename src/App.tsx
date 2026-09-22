import React from "react";
import { ChatProvider } from "./context/ChatContext";

export default function App() {
  return (
    <ChatProvider api="/api/chat/stream">
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center p-4">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-teal-400">Dr. Miau AI Agent</h1>
          <p className="text-slate-400 text-sm mt-1">
            Pronto para bater um papo em tempo real com streaming do Gemini
          </p>
        </header>
        <div id="dr-miau-container" className="w-full max-w-2xl bg-slate-800 rounded-2xl shadow-xl p-6 border border-slate-700">
          <p className="text-center text-slate-300">
            Conectado com sucesso ao provedor de chat do Vercel AI SDK e Gemini Streaming.
          </p>
        </div>
      </div>
    </ChatProvider>
  );
}

export { ChatProvider };
