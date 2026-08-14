"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type PrivateChatRoom = {
  id: string;
  master_id: string;
  slave_id: string;
  other_name: string;
  relationship: "主人" | "附屬者";
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
};

type HierarchyChatRoom = {
  id: string;
  superior_id: string;
  superior_name: string;
  member_count: number;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  is_superior: boolean;
};

export default function ChatPage() {
  const router = useRouter();

  const [privateRooms, setPrivateRooms] =
    useState<PrivateChatRoom[]>([]);

  const [hierarchyRooms, setHierarchyRooms] =
    useState<HierarchyChatRoom[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadRooms();
  }, []);

  async function loadRooms() {
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

      await Promise.all([
        loadPrivateRooms(user.id),
        loadHierarchyRooms(user.id),
      ]);
    } catch (err) {
      console.error(err);
      setError("無法讀取聊天室");
    } finally {
      setLoading(false);
    }
  }

  async function loadPrivateRooms(userId: string) {
    const { data: roomData, error: roomError } =
      await supabase
        .from("master_slave_chat_rooms")
        .select("id, master_id, slave_id, created_at")
        .or(
          `master_id.eq.${userId},slave_id.eq.${userId}`
        );

    if (roomError) {
      throw roomError;
    }

    if (!roomData || roomData.length === 0) {
      setPrivateRooms([]);
      return;
    }

    const otherIds = [
      ...new Set(
        roomData.map((room) =>
          room.master_id === userId
            ? room.slave_id
            : room.master_id
        )
      ),
    ];

    const { data: profiles, error: profilesError } =
      await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", otherIds);

    if (profilesError) {
      throw profilesError;
    }

    const nameMap = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        profile.nickname ?? "未命名玩家",
      ])
    );

    const { data: readData, error: readError } =
      await supabase
        .from("master_slave_chat_reads")
        .select("room_id, last_read_at")
        .eq("user_id", userId);

    if (readError) {
      throw readError;
    }

    const readMap = new Map(
      (readData ?? []).map((item) => [
        item.room_id,
        item.last_read_at,
      ])
    );

    const result: PrivateChatRoom[] =
      await Promise.all(
        roomData.map(async (room) => {
          const isMaster =
            room.master_id === userId;

          const otherId = isMaster
            ? room.slave_id
            : room.master_id;

          const {
            data: lastMessage,
            error: lastMessageError,
          } = await supabase
            .from("master_slave_chat_messages")
            .select("content, created_at")
            .eq("room_id", room.id)
            .order("created_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

          if (lastMessageError) {
            throw lastMessageError;
          }

          const lastReadAt =
            readMap.get(room.id);

          let unreadQuery = supabase
            .from("master_slave_chat_messages")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq("room_id", room.id)
            .neq("sender_id", userId);

          if (lastReadAt) {
            unreadQuery =
              unreadQuery.gt(
                "created_at",
                lastReadAt
              );
          }

          const {
            count,
            error: unreadError,
          } = await unreadQuery;

          if (unreadError) {
            throw unreadError;
          }

          return {
            id: room.id,
            master_id: room.master_id,
            slave_id: room.slave_id,
            other_name:
              nameMap.get(otherId) ??
              "未知玩家",
            relationship: isMaster
              ? "附屬者"
              : "主人",
            last_message:
              lastMessage?.content ?? null,
            last_message_at:
              lastMessage?.created_at ?? null,
            unread_count:
              count ?? 0,
          };
        })
      );

    result.sort((a, b) => {
      if (
        !a.last_message_at &&
        !b.last_message_at
      ) {
        return 0;
      }

      if (!a.last_message_at) return 1;
      if (!b.last_message_at) return -1;

      return (
        new Date(
          b.last_message_at
        ).getTime() -
        new Date(
          a.last_message_at
        ).getTime()
      );
    });

    setPrivateRooms(result);
  }

  async function loadHierarchyRooms(
    userId: string
  ) {
    const { data: roomData, error: roomError } =
      await supabase
        .from("hierarchy_chat_rooms")
        .select(
          "id, superior_id, created_at"
        );

    if (roomError) {
      throw roomError;
    }

    if (
      !roomData ||
      roomData.length === 0
    ) {
      setHierarchyRooms([]);
      return;
    }

    const superiorIds = [
      ...new Set(
        roomData.map(
          (room) => room.superior_id
        )
      ),
    ];

    const { data: profiles, error: profilesError } =
      await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", superiorIds);

    if (profilesError) {
      throw profilesError;
    }

    const nameMap = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        profile.nickname ?? "未命名玩家",
      ])
    );

    const {
      data: readData,
      error: readError,
    } = await supabase
      .from("hierarchy_chat_reads")
      .select("room_id, last_read_at")
      .eq("user_id", userId);

    if (readError) {
      throw readError;
    }

    const readMap = new Map(
      (readData ?? []).map((item) => [
        item.room_id,
        item.last_read_at,
      ])
    );

    const result: HierarchyChatRoom[] =
      await Promise.all(
        roomData.map(async (room) => {
          const {
            count: memberCount,
            error: memberError,
          } = await supabase
            .from("hierarchy_chat_members")
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq("room_id", room.id);

          if (memberError) {
            throw memberError;
          }

          const {
            data: lastMessage,
            error: lastMessageError,
          } = await supabase
            .from(
              "hierarchy_chat_messages"
            )
            .select("content, created_at")
            .eq("room_id", room.id)
            .order("created_at", {
              ascending: false,
            })
            .limit(1)
            .maybeSingle();

          if (lastMessageError) {
            throw lastMessageError;
          }

          const lastReadAt =
            readMap.get(room.id);

          let unreadQuery = supabase
            .from(
              "hierarchy_chat_messages"
            )
            .select("*", {
              count: "exact",
              head: true,
            })
            .eq("room_id", room.id)
            .neq("sender_id", userId);

          if (lastReadAt) {
            unreadQuery =
              unreadQuery.gt(
                "created_at",
                lastReadAt
              );
          }

          const {
            count: unreadCount,
            error: unreadError,
          } = await unreadQuery;

          if (unreadError) {
            throw unreadError;
          }

          return {
            id: room.id,
            superior_id:
              room.superior_id,
            superior_name:
              nameMap.get(
                room.superior_id
              ) ?? "未知上級",
            member_count:
              memberCount ?? 0,
            last_message:
              lastMessage?.content ??
              null,
            last_message_at:
              lastMessage?.created_at ??
              null,
            unread_count:
              unreadCount ?? 0,
            is_superior:
              room.superior_id ===
              userId,
          };
        })
      );

    result.sort((a, b) => {
      if (
        !a.last_message_at &&
        !b.last_message_at
      ) {
        return 0;
      }

      if (!a.last_message_at) return 1;
      if (!b.last_message_at) return -1;

      return (
        new Date(
          b.last_message_at
        ).getTime() -
        new Date(
          a.last_message_at
        ).getTime()
      );
    });

    setHierarchyRooms(result);
  }

  function formatTime(
    value: string | null
  ) {
    if (!value) return "";

    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }
    ).format(new Date(value));
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#080808",
        color: "#f5f5f5",
        padding: "40px 24px",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
        }}
      >
        <button
          onClick={() =>
            router.push("/dashboard")
          }
          style={{
            background: "transparent",
            border: "1px solid #333",
            color: "#aaa",
            borderRadius: 8,
            padding: "10px 14px",
            cursor: "pointer",
            marginBottom: 30,
          }}
        >
          ← 返回世界
        </button>

        <div
          style={{
            marginBottom: 32,
          }}
        >
          <div
            style={{
              color: "#888",
              fontSize: 13,
              letterSpacing: 2,
              marginBottom: 10,
            }}
          >
            COMMUNICATION
          </div>

          <h1
            style={{
              fontSize: 30,
              margin: 0,
              marginBottom: 10,
            }}
          >
            通訊中心
          </h1>

          <div
            style={{
              color: "#777",
            }}
          >
            與你的主人、附屬者及所屬階層進行對話。
          </div>
        </div>

        {loading && (
          <div
            style={{
              color: "#777",
            }}
          >
            載入聊天室中...
          </div>
        )}

        {error && (
          <div
            style={{
              border:
                "1px solid #7f1d1d",
              background: "#1f0a0a",
              color: "#f87171",
              borderRadius: 10,
              padding: 16,
            }}
          >
            {error}
          </div>
        )}

        {!loading &&
          !error && (
            <>
              {/* 階層聊天室 */}
              {hierarchyRooms.length >
                0 && (
                <section
                  style={{
                    marginBottom: 42,
                  }}
                >
                  <div
                    style={{
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        letterSpacing: 2,
                        color:
                          "#7c3aed",
                        marginBottom: 6,
                      }}
                    >
                      HIERARCHY CHAT
                    </div>

                    <h2
                      style={{
                        fontSize: 22,
                        margin: 0,
                      }}
                    >
                      階層聊天室
                    </h2>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 14,
                    }}
                  >
                    {hierarchyRooms.map(
                      (room) => (
                        <button
                          key={room.id}
                          onClick={() =>
                            router.push(
                              `/chat/hierarchy/${room.id}`
                            )
                          }
                          style={{
                            background:
                              "#130f1a",
                            border:
                              room.unread_count >
                              0
                                ? "1px solid #ef4444"
                                : "1px solid #3b2754",
                            borderRadius: 12,
                            padding: 20,
                            color: "#fff",
                            cursor:
                              "pointer",
                            textAlign:
                              "left",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: 20,
                            }}
                          >
                            <div
                              style={{
                                minWidth: 0,
                                flex: 1,
                              }}
                            >
                              <div
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  gap: 10,
                                  marginBottom: 6,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                  }}
                                >
                                  {room.is_superior
                                    ? "我的階層聊天室"
                                    : `${room.superior_name} 的階層聊天室`}
                                </div>

                                <span
                                  style={{
                                    padding:
                                      "3px 8px",
                                    borderRadius: 999,
                                    background:
                                      "#2e1d46",
                                    color:
                                      "#c4b5fd",
                                    fontSize: 12,
                                  }}
                                >
                                  {
                                    room.member_count
                                  }{" "}
                                  人
                                </span>

                                {room.unread_count >
                                  0 && (
                                  <span
                                    style={{
                                      minWidth: 22,
                                      height: 22,
                                      padding:
                                        "0 6px",
                                      borderRadius: 999,
                                      background:
                                        "#ef4444",
                                      color:
                                        "#fff",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      display:
                                        "inline-flex",
                                      alignItems:
                                        "center",
                                      justifyContent:
                                        "center",
                                    }}
                                  >
                                    {room.unread_count >
                                    99
                                      ? "99+"
                                      : room.unread_count}
                                  </span>
                                )}
                              </div>

                              <div
                                style={{
                                  color:
                                    "#8b7d9e",
                                  fontSize: 13,
                                  marginBottom: 10,
                                }}
                              >
                                {room.is_superior
                                  ? "你與直屬附屬者"
                                  : `上級：${room.superior_name}`}
                              </div>

                              <div
                                style={{
                                  color:
                                    room.last_message
                                      ? "#bbb"
                                      : "#6b6175",
                                  fontSize: 14,
                                  overflow:
                                    "hidden",
                                  textOverflow:
                                    "ellipsis",
                                  whiteSpace:
                                    "nowrap",
                                }}
                              >
                                {room.last_message ??
                                  "目前還沒有訊息"}
                              </div>
                            </div>

                            <div
                              style={{
                                color:
                                  "#6b6175",
                                fontSize: 12,
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {formatTime(
                                room.last_message_at
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    )}
                  </div>
                </section>
              )}

              {/* 私人聊天室 */}
              {privateRooms.length >
                0 && (
                <section>
                  <div
                    style={{
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        letterSpacing: 2,
                        color: "#888",
                        marginBottom: 6,
                      }}
                    >
                      PRIVATE CHAT
                    </div>

                    <h2
                      style={{
                        fontSize: 22,
                        margin: 0,
                      }}
                    >
                      私人聊天室
                    </h2>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gap: 14,
                    }}
                  >
                    {privateRooms.map(
                      (room) => (
                        <button
                          key={room.id}
                          onClick={() =>
                            router.push(
                              `/chat/${room.id}`
                            )
                          }
                          style={{
                            background:
                              "#111",
                            border:
                              room.unread_count >
                              0
                                ? "1px solid #7f1d1d"
                                : "1px solid #292929",
                            borderRadius: 12,
                            padding: 20,
                            color: "#fff",
                            cursor:
                              "pointer",
                            textAlign:
                              "left",
                          }}
                        >
                          <div
                            style={{
                              display:
                                "flex",
                              justifyContent:
                                "space-between",
                              gap: 20,
                            }}
                          >
                            <div
                              style={{
                                minWidth: 0,
                                flex: 1,
                              }}
                            >
                              <div
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  gap: 10,
                                  marginBottom: 5,
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: 18,
                                    fontWeight: 700,
                                  }}
                                >
                                  {
                                    room.other_name
                                  }
                                </div>

                                {room.unread_count >
                                  0 && (
                                  <span
                                    style={{
                                      minWidth: 22,
                                      height: 22,
                                      padding:
                                        "0 6px",
                                      borderRadius: 999,
                                      background:
                                        "#ef4444",
                                      color:
                                        "#fff",
                                      fontSize: 12,
                                      fontWeight: 700,
                                      display:
                                        "inline-flex",
                                      alignItems:
                                        "center",
                                      justifyContent:
                                        "center",
                                    }}
                                  >
                                    {room.unread_count >
                                    99
                                      ? "99+"
                                      : room.unread_count}
                                  </span>
                                )}
                              </div>

                              <div
                                style={{
                                  color:
                                    "#777",
                                  fontSize: 13,
                                  marginBottom: 10,
                                }}
                              >
                                {
                                  room.relationship
                                }
                              </div>

                              <div
                                style={{
                                  color:
                                    room.last_message
                                      ? "#aaa"
                                      : "#666",
                                  fontSize: 14,
                                  overflow:
                                    "hidden",
                                  textOverflow:
                                    "ellipsis",
                                  whiteSpace:
                                    "nowrap",
                                }}
                              >
                                {room.last_message ??
                                  "目前還沒有訊息"}
                              </div>
                            </div>

                            <div
                              style={{
                                color:
                                  "#666",
                                fontSize: 12,
                                whiteSpace:
                                  "nowrap",
                              }}
                            >
                              {formatTime(
                                room.last_message_at
                              )}
                            </div>
                          </div>
                        </button>
                      )
                    )}
                  </div>
                </section>
              )}

              {hierarchyRooms.length ===
                0 &&
                privateRooms.length ===
                  0 && (
                  <div
                    style={{
                      border:
                        "1px solid #292929",
                      background:
                        "#111",
                      borderRadius: 12,
                      padding: 32,
                      textAlign:
                        "center",
                      color: "#777",
                    }}
                  >
                    目前沒有可以使用的聊天室。
                  </div>
                )}
            </>
          )}
      </div>
    </main>
  );
}