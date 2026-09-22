import React, { createContext, useContext, ReactNode } from "react";
import { useChat } from "@ai-sdk/react";

interface ChatContextType {
  messages: any[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e?: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  error?: Error | undefined;
  append: (message: any) => Promise<string | null | undefined>;
  reload: () => Promise<string | null | undefined>;
  stop: () => void;
  setMessages: (messages: any[]) => void;
  setInput: (input: string) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export interface ChatProviderProps {
  children: ReactNode;
  api?: string;
  initialMessages?: any[];
}

export function ChatProvider({
  children,
  api = "/api/chat/stream",
  initialMessages = []
}: ChatProviderProps) {
  const chatState = useChat({
    api,
    initialMessages,
  });

  return (
    <ChatContext.Provider value={chatState as unknown as ChatContextType}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextType {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
