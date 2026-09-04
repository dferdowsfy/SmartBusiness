"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";

interface ChatProfile {
  name?: string | null;
  business_type?: string | null;
  industry?: string | null;
  municipality?: string | null;
  business_structure?: string | null;
  location_type?: string | null;
}

interface ChatRequirement {
  code: string;
  name: string;
  status?: string;
  mandatory?: boolean;
  agency?: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  profile: ChatProfile;
  requirements: ChatRequirement[];
  language: "en" | "es";
}

export function SmartPRChatbot({ profile, requirements, language }: Props) {
  const es = language === "es";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          context: { profile, requirements, language },
        }),
      });
      const data = (await res.json()) as { reply?: string };
      const reply = data.reply || (es ? "Sin respuesta." : "No response.");
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: es ? "Lo siento, ocurrió un error. Inténtalo de nuevo." : "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  const greeting = es
    ? `Hola. Soy el asistente de SmartPR${profile.name ? ` para ${profile.name}` : ""}. ¿En qué puedo ayudarte?`
    : `Hi. I'm your SmartPR assistant${profile.name ? ` for ${profile.name}` : ""}. How can I help you?`;

  return (
    <>
      {open && (
        <div className="spr-chat-panel" role="dialog" aria-label={es ? "Asistente SmartPR" : "SmartPR Assistant"}>
          <div className="spr-chat-header">
            <span className="spr-chat-title">
              <span className="spr-chat-dot" />
              SmartPR
            </span>
            <button type="button" className="spr-chat-close" onClick={() => setOpen(false)} aria-label={es ? "Cerrar" : "Close"}>
              <X size={16} />
            </button>
          </div>

          <div className="spr-chat-body">
            <div className="spr-chat-greeting">{greeting}</div>
            {messages.map((m, i) => (
              <div key={i} className={`spr-chat-bubble ${m.role}`}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="spr-chat-bubble assistant">
                <span className="spr-chat-typing"><span /><span /><span /></span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="spr-chat-footer">
            <input
              ref={inputRef}
              className="spr-chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={es ? "Escribe una pregunta…" : "Ask a question…"}
              disabled={loading}
              maxLength={500}
              aria-label={es ? "Tu pregunta" : "Your question"}
            />
            <button
              type="button"
              className="spr-chat-send"
              onClick={() => void send()}
              disabled={loading || !input.trim()}
              aria-label={es ? "Enviar" : "Send"}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`rq-floating-help${open ? " active" : ""}`}
        title={es ? "Chatear con SmartPR" : "Chat with SmartPR"}
        aria-label={es ? "Chatear con SmartPR" : "Chat with SmartPR"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MessageCircle size={22} />
      </button>
    </>
  );
}
