"use client";

import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useChat as useAIChat } from "@ai-sdk/react";
import { UIMessage } from "ai";
import { useFileSystem } from "./file-system-context";
import { setHasAnonWork } from "@/lib/anon-work-tracker";

interface ChatContextProps {
  projectId?: string;
  initialMessages?: UIMessage[];
}

interface ChatContextType {
  messages: UIMessage[];
  input: string;
  setInput: (value: string) => void;
  sendMessage: (content: string) => void;
  status: string;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({
  children,
  projectId,
  initialMessages = [],
}: ChatContextProps & { children: ReactNode }) {
  const { fileSystem, handleToolCall } = useFileSystem();
  const [input, setInput] = useState("");
  const processedToolCalls = useRef(new Set<string>());

  const {
    messages,
    sendMessage: aiSendMessage,
    status,
  } = useAIChat({
    api: "/api/chat",
    initialMessages,
    body: {
      files: fileSystem.serialize(),
      projectId,
    },
  } as any);

  // Apply file system changes from completed tool calls in messages
  useEffect(() => {
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      for (const part of message.parts) {
        const p = part as any;
        // Check for tool parts with available output that haven't been processed
        if (
          (part.type === "dynamic-tool" || (part.type as string)?.startsWith("tool-")) &&
          (p.state === "output-available" || p.state === "output-error") &&
          p.toolCallId &&
          !processedToolCalls.current.has(p.toolCallId)
        ) {
          processedToolCalls.current.add(p.toolCallId);
          const toolName = p.toolName ?? (part.type as string).replace(/^tool-/, "");
          const args = p.input;
          if (args) {
            handleToolCall({ toolName, args });
          }
        }
      }
    }
  }, [messages, handleToolCall]);

  const sendMessage = useCallback(
    (content: string) => {
      if (!content.trim()) return;
      aiSendMessage({ text: content });
      setInput("");
    },
    [aiSendMessage]
  );

  // Track anonymous work
  useEffect(() => {
    if (!projectId && messages.length > 0) {
      setHasAnonWork(messages as any, fileSystem.serialize());
    }
  }, [messages, fileSystem, projectId]);

  return (
    <ChatContext.Provider
      value={{
        messages: messages as UIMessage[],
        input,
        setInput,
        sendMessage,
        status,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}
