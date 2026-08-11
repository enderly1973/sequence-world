"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Room = {
  id: string;
  master_id: string;
  slave_id: string;
  other_name: string;
  relationship: "主人" | "附屬者";
};

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export default function ChatRoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadChat();
  }, [roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  // 即時監聽聊天室新訊息
  useEffect(() => {
    if (!currentUserId || !roomId) {
      return;
    }

    const channel = supabase
      .channel(`chat-room-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "master_slave_chat_messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const newMessage = payload.new as Message;

          setMessages((current) => {
            const alreadyExists = current.some(
              (item) => item.id === newMessage.id
            );

            if (alreadyExists) {
              return current;
            }

            return [...current, newMessage];
          });

          // 如果現在正在聊天室裡，
          // 對方的新訊息直接視為已讀
          if (newMessage.sender_id !== currentUserId) {
            await markAsRead(currentUserId);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, currentUserId]);

  async function loadChat() {
    try {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      setCurrentUserId(user.id);

      const { data: roomData, error: roomError } = await supabase
        .from("master_slave_chat_rooms")
        .select("id, master_id, slave_id")
        .eq("id", roomId)
        .single();

      if (roomError) {
        throw roomError;
      }

      const isParticipant =
        roomData.master_id === user.id ||
        roomData.slave_id === user.id;

      if (!isParticipant) {
        router.replace("/chat");
        return;
      }

      const isMaster = roomData.master_id === user.id;

      const otherId = isMaster
        ? roomData.slave_id
        : roomData.master_id;

      const { data: otherProfile, error: profileError } =
        await supabase
          .from("profiles")
          .select("nickname")
          .eq("id", otherId)
          .single();

      if (profileError) {
        throw profileError;
      }

      setRoom({
        id: roomData.id,
        master_id: roomData.master_id,
        slave_id: roomData.slave_id,
        other_name:
          otherProfile?.nickname ?? "未知玩家",
        relationship: isMaster
          ? "附屬者"
          : "主人",
      });

      await loadMessages();

      await markAsRead(user.id);
    } catch (err) {
      console.error(err);
      setError("無法讀取聊天室");
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages() {
    const { data, error } = await supabase
      .from("master_slave_chat_messages")
      .select("id, sender_id, content, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    setMessages(data ?? []);
  }

  async function markAsRead(userId: string) {
    const { error } = await supabase
      .from("master_slave_chat_reads")
      .upsert(
        {
          room_id: roomId,
          user_id: userId,
          last_read_at: new Date().toISOString(),
        },
        {
          onConflict: "room_id,user_id",
        }
      );

    if (error) {
      console.error("更新已讀失敗:", error);
    }
  }

  async function sendMessage() {
    const content = message.trim();

    if (!content || !currentUserId || sending) {
      return;
    }

    try {
      setSending(true);
      setError("");

      const { data, error } = await supabase
        .from("master_slave_chat_messages")
        .insert({
          room_id: roomId,
          sender_id: currentUserId,
          content,
        })
        .select("id, sender_id, content, created_at")
        .single();

      if (error) {
        throw error;
      }

      setMessage("");

      // 即使 Realtime 稍慢，也先立即顯示自己的訊息
      if (data) {
        setMessages((current) => {
          const alreadyExists = current.some(
            (item) => item.id === data.id
          );

          if (alreadyExists) {
            return current;
          }

          return [...current, data as Message];
        });
      }

      await markAsRead(currentUserId);
    } catch (err) {
      console.error(err);
      setError("訊息傳送失敗");
    } finally {
      setSending(false);
    }
  }

  function formatTime(value: string) {
    return new Intl.DateTimeFormat("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(value));
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#f5f5f5",
        padding: "30px 20px",
      }}
    >
      <div
        style={{
          maxWidth: 850,
          margin: "0 auto",
        }}
      >
        <button
          onClick={() => router.push("/chat")}
          style={{
            background: "transparent",
            border: "1px solid #333",
            color: "#aaa",
            borderRadius: 8,
            padding: "10px 14px",
            cursor: "pointer",
            marginBottom: 24,
          }}
        >
          ← 返回聊天室
        </button>

        {loading && (
          <div style={{ color: "#777" }}>
            載入聊天室中...
          </div>
        )}

        {!loading && room && (
          <>
            <div style={{ marginBottom: 22 }}>
              <div
                style={{
                  color: "#777",
                  fontSize: 12,
                  letterSpacing: 2,
                  marginBottom: 8,
                }}
              >
                PRIVATE CHAT
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: 26,
                }}
              >
                {room.other_name}
              </h1>

              <div
                style={{
                  color: "#777",
                  marginTop: 6,
                  fontSize: 13,
                }}
              >
                {room.relationship}
              </div>
            </div>

            {error && (
              <div
                style={{
                  marginBottom: 15,
                  color: "#f87171",
                }}
              >
                {error}
              </div>
            )}

            <div
              style={{
                minHeight: 480,
                maxHeight: "65vh",
                overflowY: "auto",
                background: "#101010",
                border: "1px solid #292929",
                borderRadius: 12,
                padding: 18,
                marginBottom: 14,
              }}
            >
              {messages.length === 0 && (
                <div
                  style={{
                    color: "#666",
                    textAlign: "center",
                    paddingTop: 120,
                  }}
                >
                  目前還沒有訊息。
                </div>
              )}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {messages.map((item) => {
                  const mine =
                    item.sender_id === currentUserId;

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        justifyContent: mine
                          ? "flex-end"
                          : "flex-start",
                      }}
                    >
                      <div
                        style={{
                          maxWidth: "72%",
                          background: mine
                            ? "#262626"
                            : "#171717",
                          border: "1px solid #333",
                          borderRadius: 10,
                          padding: "10px 12px",
                        }}
                      >
                        <div
                          style={{
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            lineHeight: 1.6,
                          }}
                        >
                          {item.content}
                        </div>

                        <div
                          style={{
                            color: "#666",
                            fontSize: 11,
                            marginTop: 6,
                            textAlign: "right",
                          }}
                        >
                          {formatTime(item.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div ref={bottomRef} />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
              }}
            >
              <textarea
                value={message}
                onChange={(e) =>
                  setMessage(e.target.value)
                }
                placeholder="輸入訊息..."
                rows={2}
                style={{
                  flex: 1,
                  resize: "none",
                  background: "#111",
                  color: "#fff",
                  border: "1px solid #333",
                  borderRadius: 10,
                  padding: 12,
                  fontSize: 15,
                  outline: "none",
                }}
              />

              <button
                onClick={sendMessage}
                disabled={
                  sending || !message.trim()
                }
                style={{
                  width: 100,
                  border: "none",
                  borderRadius: 10,
                  background:
                    sending || !message.trim()
                      ? "#333"
                      : "#f5f5f5",
                  color:
                    sending || !message.trim()
                      ? "#777"
                      : "#111",
                  cursor:
                    sending || !message.trim()
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: 700,
                }}
              >
                {sending ? "傳送中" : "傳送"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}