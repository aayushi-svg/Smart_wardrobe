import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowUp, MessageSquarePlus, Plus, Square, Trash2, X } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useCloset } from "../store";
import { useToast } from "../components/Toast";
import TopBar from "../components/TopBar";
import type { ChatMessage, ChatThread } from "../types";

const STARTERS = [
  "What should I wear today?",
  "Build me an outfit for a dinner date",
  "What's missing from my wardrobe?",
  "Help me pack for a weekend trip",
];

/** A message that only exists locally while its reply streams in. */
const draftId = () => `local-${Math.random().toString(36).slice(2)}`;

export default function Chat() {
  const { user } = useAuth();
  const { items } = useCloset();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pending, setPending] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abort = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  const loadThreads = useCallback(async () => {
    try {
      setThreads(await api.chatThreads());
    } catch {
      /* the composer still works without the history list */
    }
  }, []);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    // Keep the newest message in view as the reply grows.
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, pending]);

  useEffect(() => {
    // Abort an in-flight stream if the user navigates away mid-reply.
    return () => abort.current?.abort();
  }, []);

  const openThread = async (id: string) => {
    setHistoryOpen(false);
    setError(null);
    try {
      const thread = await api.chatThread(id);
      setThreadId(thread.id);
      setMessages(thread.messages);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const newChat = () => {
    abort.current?.abort();
    setThreadId(null);
    setMessages([]);
    setPending("");
    setStreaming(false);
    setHistoryOpen(false);
    setError(null);
    textarea.current?.focus();
  };

  const removeThread = async (id: string) => {
    await api.deleteChatThread(id);
    if (id === threadId) newChat();
    await loadThreads();
    toast.success("Conversation deleted.");
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || streaming) return;

    setInput("");
    setError(null);
    setStreaming(true);
    setPending("");
    setMessages((list) => [
      ...list,
      { id: draftId(), role: "user", content: message, createdAt: new Date().toISOString() },
    ]);

    const controller = new AbortController();
    abort.current = controller;
    let reply = "";

    try {
      await api.sendChatMessage(
        threadId,
        message,
        {
          onThread: setThreadId,
          onDelta: (chunk) => {
            reply += chunk;
            setPending(reply);
          },
          onDone: ({ messageId }) => {
            setMessages((list) => [
              ...list,
              {
                id: messageId,
                role: "assistant",
                content: reply,
                createdAt: new Date().toISOString(),
              },
            ]);
            setPending("");
            void loadThreads();
          },
          onError: (msg) => {
            setError(msg);
            setPending("");
          },
        },
        controller.signal,
      );
    } catch (e) {
      // An abort is the user pressing stop, not a failure worth reporting.
      if (!controller.signal.aborted) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setStreaming(false);
      abort.current = null;
    }
  };

  const stop = () => {
    abort.current?.abort();
    if (pending) {
      // Keep whatever arrived before the stop so the answer isn't lost. The
      // server discards its copy, so this turn is local-only from here.
      setMessages((list) => [
        ...list,
        {
          id: draftId(),
          role: "assistant",
          content: pending,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setPending("");
    setStreaming(false);
  };

  // The home screen's ask box hands its question over through router state.
  // Clearing the state first stops it re-sending on every back-navigation.
  const handedOver = useRef(false);
  useEffect(() => {
    const prompt = (location.state as { prompt?: string } | null)?.prompt?.trim();
    if (!prompt || handedOver.current) return;
    handedOver.current = true;
    navigate("/chat", { replace: true, state: null });
    void send(prompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const firstName = useMemo(
    () => (user?.displayName || "").trim().split(" ")[0],
    [user?.displayName],
  );

  const empty = messages.length === 0 && !pending;

  return (
    <div className="mx-auto flex h-full w-full max-w-[820px] flex-col px-5 pb-28">
      <TopBar />

      <div className="flex items-center justify-between pb-2">
        <h1 className="text-[17px] text-neutral-900">Ask Closei</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-3 py-1.5 text-[12px] text-neutral-600 hover:border-neutral-400"
          >
            <MessageSquarePlus size={14} strokeWidth={1.7} />
            History
            {threads.length > 0 && <span className="text-neutral-300">{threads.length}</span>}
          </button>
          <button
            type="button"
            onClick={newChat}
            aria-label="New chat"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800"
          >
            <Plus size={15} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto pt-2">
        {empty ? (
          <div className="animate-rise flex flex-col items-center pt-[10vh] text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-900 text-[18px] font-bold tracking-widest text-white">
              A
            </div>
            <p className="pt-5 text-[18px] text-neutral-900">
              {firstName ? `Hi ${firstName}.` : "Hi there."} What are we dressing for?
            </p>
            <p className="pt-1.5 text-[13px] text-neutral-400">
              {items.length > 0
                ? `Closei can see all ${items.length} ${items.length === 1 ? "piece" : "pieces"} in your closet.`
                : "Add pieces to your closet and Closei will style from them."}
            </p>

            <div className="stagger flex w-full max-w-md flex-col gap-2 pt-8">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => send(starter)}
                  className="rounded-2xl border border-neutral-200 px-4 py-3 text-left text-[13px] text-neutral-700 hover:border-neutral-900 hover:bg-neutral-50"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`animate-rise flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-[14px] leading-relaxed ${
                    message.role === "user"
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-900"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {(pending || streaming) && (
              <div className="flex justify-start">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-neutral-100 px-4 py-3 text-[14px] leading-relaxed text-neutral-900">
                  {pending || (
                    <span className="flex items-center gap-1 py-1">
                      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-neutral-500" />
                      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-neutral-500" />
                      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-neutral-500" />
                    </span>
                  )}
                </div>
              </div>
            )}

            {error && (
              <p className="animate-rise rounded-xl bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
                {error}
              </p>
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="sticky bottom-24 flex items-end gap-2 rounded-3xl border border-neutral-200 bg-white px-4 py-2.5 shadow-sm focus-within:border-neutral-900"
      >
        <textarea
          ref={textarea}
          rows={1}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            // Grow with the text instead of scrolling inside a one-line box.
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          placeholder="Ask Closei what to wear…"
          className="max-h-40 flex-1 resize-none bg-transparent py-1.5 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:outline-none"
        />
        {streaming ? (
          <button
            type="button"
            onClick={stop}
            aria-label="Stop generating"
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
          >
            <Square size={13} strokeWidth={2.4} className="fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            aria-label="Send message"
            className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-30"
          >
            <ArrowUp size={16} strokeWidth={2.2} />
          </button>
        )}
      </form>

      {historyOpen && (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex justify-end bg-neutral-900/20"
          onClick={() => setHistoryOpen(false)}
        >
          <aside
            className="animate-slide-left flex h-full w-full max-w-sm flex-col bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
              <h2 className="text-[15px] text-neutral-900">Your conversations</h2>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                aria-label="Close history"
                className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100"
              >
                <X size={16} strokeWidth={1.8} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-3 py-3">
              {threads.length === 0 ? (
                <p className="px-2 pt-6 text-[13px] text-neutral-400">
                  No conversations yet.
                </p>
              ) : (
                <ul className="stagger flex flex-col gap-1">
                  {threads.map((thread) => (
                    <li key={thread.id} className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openThread(thread.id)}
                        className={`min-w-0 flex-1 truncate rounded-xl px-3 py-2.5 text-left text-[13px] hover:bg-neutral-100 ${
                          thread.id === threadId ? "bg-neutral-100 text-neutral-900" : "text-neutral-600"
                        }`}
                      >
                        {thread.title}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeThread(thread.id)}
                        aria-label={`Delete ${thread.title}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-300 opacity-0 hover:text-rose-600 group-hover:opacity-100"
                      >
                        <Trash2 size={14} strokeWidth={1.7} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              type="button"
              onClick={newChat}
              className="m-3 flex items-center justify-center gap-2 rounded-full bg-neutral-900 py-3 text-[13px] text-white hover:bg-neutral-800"
            >
              <Plus size={15} strokeWidth={2} />
              New conversation
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
