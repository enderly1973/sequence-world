"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Profile = {
  id: string;
  nickname: string;
  gender: "female" | "male" | "other";
  join_sequence: number;

  role:
    | "founder"
    | "administrator"
    | "manager"
    | "member";

  status:
    | "active"
    | "suspended"
    | "deleted";

  accepting_subordinates: boolean;
  subordinate_limit: number;

  world_points: number;
  arena_points: number;

  checkin_streak: number;
  last_checkin_date: string | null;

  equipped_title_item_id: string | null;
};

type Superior = {
  id: string;
  nickname: string;
  join_sequence: number;
} | null;

type TitleItem = {
  id: string;
  name: string;
};

type DailyMission = {
  mission_key: string;
  completed: boolean;
  reward_points: number;
};

type PendingActions = {
  pending_tasks: number;
  pending_relation_requests: number;
  pending_competitions: number;
};

type TaskReminderSummary = {
  received_pending: number;
  received_accepted: number;
  received_submitted: number;
  sent_submitted: number;
};

type RecentNotification = {
  id: string;
  notification_type: string;
  title: string;
  content: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

type DailyWorldCostResult = {
  settled_days: number;
  total_deducted: number;
  today_configured_points: number;
  today_deducted_points: number;
  balance_after: number;
  today_settled: boolean;
};

type DailyWorldCostRecord = {
  cost_date: string;
  configured_points: number;
  deducted_points: number;
  balance_after: number;
  created_at: string;
};

type WorldStatus = {
  world_points: number;

  maintenance_status:
    | "normal"
    | "insufficient"
    | "inactive"
    | "administrator";

  can_earn_points: boolean;
  can_spend_points: boolean;
  can_start_competition: boolean;
  can_send_task: boolean;

  status_message: string;
};

type DailyWorldEvent = {
  event_id: string;
  event_date: string;

  event_type:
    | "world_subsidy"
    | "peaceful_day"
    | "temporary_levy"
    | "mission_bonus";

  title: string;
  description: string;

  points_change: number;
  effect_value: number;
  bonus_awarded: number;

  world_points_before: number;
  world_points_after: number;

  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [superior, setSuperior] =
    useState<Superior>(null);

  const [title, setTitle] =
    useState<TitleItem | null>(null);

  const [
    subordinateCount,
    setSubordinateCount,
  ] = useState(0);

  const [
    dailyMissions,
    setDailyMissions,
  ] = useState<DailyMission[]>([]);

  const [
    unreadNotifications,
    setUnreadNotifications,
  ] = useState(0);

  const [
    chatUnreadCount,
    setChatUnreadCount,
  ] = useState(0);

  const [
    pendingActions,
    setPendingActions,
  ] = useState<PendingActions>({
    pending_tasks: 0,
    pending_relation_requests: 0,
    pending_competitions: 0,
  });

  const [
    taskReminderSummary,
    setTaskReminderSummary,
  ] = useState<TaskReminderSummary>({
    received_pending: 0,
    received_accepted: 0,
    received_submitted: 0,
    sent_submitted: 0,
  });

  const [
    recentNotifications,
    setRecentNotifications,
  ] = useState<
    RecentNotification[]
  >([]);

  const [
    dailyCost,
    setDailyCost,
  ] = useState<
    DailyWorldCostResult | null
  >(null);

  const [
    todayCostRecord,
    setTodayCostRecord,
  ] = useState<
    DailyWorldCostRecord | null
  >(null);

  const [
    worldStatus,
    setWorldStatus,
  ] = useState<WorldStatus | null>(
    null
  );

  const [
    dailyWorldEvent,
    setDailyWorldEvent,
  ] = useState<
    DailyWorldEvent | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  useEffect(() => {
    void loadDashboard();
  }, []);

  useEffect(() => {
    let active = true;

    let channel:
      | ReturnType<
          typeof supabase.channel
        >
      | null = null;

    async function startRealtime() {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user || !active) {
        return;
      }

      channel = supabase
        .channel(
          `dashboard-events-${user.id}-${crypto.randomUUID()}`
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter:
              `user_id=eq.${user.id}`,
          },
          async () => {
            if (!active) {
              return;
            }

            await Promise.all([
              loadUnreadCount(),
              loadRecentNotifications(
                user.id
              ),
            ]);
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tasks",
            filter:
              `receiver_id=eq.${user.id}`,
          },
          async () => {
            if (!active) {
              return;
            }

            await Promise.all([
              loadPendingActions(),
              loadTaskReminderSummary(user.id),
            ]);
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tasks",
            filter:
              `sender_id=eq.${user.id}`,
          },
          async () => {
            if (!active) {
              return;
            }

            await loadTaskReminderSummary(user.id);
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "relation_requests",
            filter:
              `target_id=eq.${user.id}`,
          },
          async () => {
            if (!active) {
              return;
            }

            await loadPendingActions();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "competitions",
            filter:
              `opponent_id=eq.${user.id}`,
          },
          async () => {
            if (!active) {
              return;
            }

            await loadPendingActions();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "master_slave_chat_messages",
          },
          async () => {
            if (!active) {
              return;
            }

            await loadChatUnreadCount(
              user.id
            );
          }
        )

        .subscribe();
    }

    void startRealtime();

    return () => {
      active = false;

      if (channel) {
        void supabase.removeChannel(
          channel
        );
      }
    };
  }, []);

  async function settleDailyCost() {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "settle_daily_world_costs"
      );

    if (error) {
      throw error;
    }

    if (
      Array.isArray(data) &&
      data.length > 0
    ) {
      const result =
        data[0];

      setDailyCost({
        settled_days:
          Number(
            result.settled_days ??
              0
          ),

        total_deducted:
          Number(
            result.total_deducted ??
              0
          ),

        today_configured_points:
          Number(
            result.today_configured_points ??
              0
          ),

        today_deducted_points:
          Number(
            result.today_deducted_points ??
              0
          ),

        balance_after:
          Number(
            result.balance_after ??
              0
          ),

        today_settled:
          Boolean(
            result.today_settled
          ),
      });
    }
  }

  async function loadTodayCostRecord() {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "get_my_daily_world_costs",
        {
          p_limit: 1,
        }
      );

    if (error) {
      throw error;
    }

    if (
      Array.isArray(data) &&
      data.length > 0
    ) {
      const row =
        data[0];

      setTodayCostRecord({
        cost_date:
          String(
            row.cost_date
          ),

        configured_points:
          Number(
            row.configured_points ??
              0
          ),

        deducted_points:
          Number(
            row.deducted_points ??
              0
          ),

        balance_after:
          Number(
            row.balance_after ??
              0
          ),

        created_at:
          String(
            row.created_at
          ),
      });
    } else {
      setTodayCostRecord(
        null
      );
    }
  }

  async function generateDailyWorldEvent() {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "generate_my_daily_world_event"
      );

    if (error) {
      throw error;
    }

    if (
      Array.isArray(data) &&
      data.length > 0
    ) {
      const result =
        data[0];

      setDailyWorldEvent({
        event_id:
          String(
            result.event_id
          ),

        event_date:
          String(
            result.event_date
          ),

        event_type:
          result.event_type,

        title:
          String(
            result.title ??
              ""
          ),

        description:
          String(
            result.description ??
              ""
          ),

        points_change:
          Number(
            result.points_change ??
              0
          ),

        effect_value:
          Number(
            result.effect_value ??
              0
          ),

        bonus_awarded:
          Number(
            result.bonus_awarded ??
              0
          ),

        world_points_before:
          Number(
            result.world_points_before ??
              0
          ),

        world_points_after:
          Number(
            result.world_points_after ??
              0
          ),

        created_at:
          String(
            result.created_at
          ),
      });
    } else {
      setDailyWorldEvent(
        null
      );
    }
  }

  async function loadWorldStatus() {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "get_my_world_status"
      );

    if (error) {
      throw error;
    }

    if (
      Array.isArray(data) &&
      data.length > 0
    ) {
      const result =
        data[0];

      setWorldStatus({
        world_points:
          Number(
            result.world_points ??
              0
          ),

        maintenance_status:
          result.maintenance_status,

        can_earn_points:
          Boolean(
            result.can_earn_points
          ),

        can_spend_points:
          Boolean(
            result.can_spend_points
          ),

        can_start_competition:
          Boolean(
            result.can_start_competition
          ),

        can_send_task:
          Boolean(
            result.can_send_task
          ),

        status_message:
          String(
            result.status_message ??
              ""
          ),
      });
    }
  }

  async function loadUnreadCount() {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "get_unread_notification_count"
      );

    if (!error) {
      setUnreadNotifications(
        Number(
          data ??
            0
        )
      );
    }
  }

  async function loadChatUnreadCount(
    userId: string
  ) {
    const {
      data: roomData,
      error: roomError,
    } =
      await supabase
        .from(
          "master_slave_chat_rooms"
        )
        .select("id")
        .or(
          `master_id.eq.${userId},slave_id.eq.${userId}`
        );

    if (roomError) {
      console.error(
        "讀取聊天室未讀數失敗:",
        roomError
      );
      return;
    }

    if (
      !roomData ||
      roomData.length === 0
    ) {
      setChatUnreadCount(0);
      return;
    }

    const roomIds =
      roomData.map(
        (room) =>
          room.id
      );

    const {
      data: readData,
      error: readError,
    } =
      await supabase
        .from(
          "master_slave_chat_reads"
        )
        .select(
          "room_id, last_read_at"
        )
        .eq(
          "user_id",
          userId
        )
        .in(
          "room_id",
          roomIds
        );

    if (readError) {
      console.error(
        "讀取聊天室已讀紀錄失敗:",
        readError
      );
      return;
    }

    const readMap =
      new Map(
        (
          readData ??
          []
        ).map(
          (row) => [
            row.room_id,
            row.last_read_at,
          ]
        )
      );

    const counts =
      await Promise.all(
        roomIds.map(
          async (
            roomId
          ) => {
            let query =
              supabase
                .from(
                  "master_slave_chat_messages"
                )
                .select(
                  "*",
                  {
                    count:
                      "exact",
                    head:
                      true,
                  }
                )
                .eq(
                  "room_id",
                  roomId
                )
                .neq(
                  "sender_id",
                  userId
                );

            const lastReadAt =
              readMap.get(
                roomId
              );

            if (
              lastReadAt
            ) {
              query =
                query.gt(
                  "created_at",
                  lastReadAt
                );
            }

            const {
              count,
              error,
            } =
              await query;

            if (error) {
              console.error(
                "計算聊天室未讀訊息失敗:",
                error
              );
              return 0;
            }

            return (
              count ??
              0
            );
          }
        )
      );

    setChatUnreadCount(
      counts.reduce(
        (
          total,
          count
        ) =>
          total +
          count,
        0
      )
    );
  }

  async function loadTaskReminderSummary(userId: string) {
    const [receivedResult, sentResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("status")
        .eq("receiver_id", userId)
        .in("status", ["pending", "accepted", "submitted"]),

      supabase
        .from("tasks")
        .select("status")
        .eq("sender_id", userId)
        .eq("status", "submitted"),
    ]);

    if (receivedResult.error) {
      console.error("讀取收到任務提醒失敗:", receivedResult.error);
      return;
    }

    if (sentResult.error) {
      console.error("讀取待確認任務提醒失敗:", sentResult.error);
      return;
    }

    const received = receivedResult.data ?? [];

    setTaskReminderSummary({
      received_pending: received.filter(
        (task) => task.status === "pending"
      ).length,

      received_accepted: received.filter(
        (task) => task.status === "accepted"
      ).length,

      received_submitted: received.filter(
        (task) => task.status === "submitted"
      ).length,

      sent_submitted: (sentResult.data ?? []).length,
    });
  }

  async function loadPendingActions() {
    const {
      data,
      error,
    } =
      await supabase.rpc(
        "get_my_pending_actions"
      );

    if (
      error ||
      !Array.isArray(data) ||
      data.length === 0
    ) {
      return;
    }

    setPendingActions({
      pending_tasks:
        Number(
          data[0]
            .pending_tasks ??
            0
        ),

      pending_relation_requests:
        Number(
          data[0]
            .pending_relation_requests ??
            0
        ),

      pending_competitions:
        Number(
          data[0]
            .pending_competitions ??
            0
        ),
    });
  }

  async function loadRecentNotifications(
    userId: string
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "notifications"
        )
        .select(`
          id,
          notification_type,
          title,
          content,
          link,
          is_read,
          created_at
        `)
        .eq(
          "user_id",
          userId
        )
        .order(
          "created_at",
          {
            ascending:
              false,
          }
        )
        .limit(5);

    if (!error) {
      setRecentNotifications(
        (data ??
          []) as RecentNotification[]
      );
    }
  }

  async function loadDashboard() {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: {
          session,
        },
        error:
          sessionError,
      } =
        await supabase.auth.getSession();

      if (
        sessionError
      ) {
        throw sessionError;
      }

      if (!session) {
        router.replace(
          "/login"
        );
        return;
      }

      const userId =
        session.user.id;

      const {
        data:
          roleData,
        error:
          roleError,
      } =
        await supabase
          .from(
            "profiles"
          )
          .select(`
            role,
            status
          `)
          .eq(
            "id",
            userId
          )
          .single();

      if (
        roleError
      ) {
        throw roleError;
      }

      if (
        roleData.role ===
          "administrator" ||
        roleData.role ===
          "founder"
      ) {
        router.replace(
          "/admin"
        );
        return;
      }

      /*
       * 固定順序：
       * 1. 結算今日維持費
       * 2. 讀取真正維持費帳本紀錄
       * 3. 產生／取得今日世界事件
       * 4. 讀取最新世界狀態
       */

      await settleDailyCost();

      await loadTodayCostRecord();

      await generateDailyWorldEvent();

      await loadWorldStatus();

      const {
        data:
          profileData,
        error:
          profileError,
      } =
        await supabase
          .from(
            "profiles"
          )
          .select(`
            id,
            nickname,
            gender,
            join_sequence,
            role,
            status,
            accepting_subordinates,
            subordinate_limit,
            world_points,
            arena_points,
            checkin_streak,
            last_checkin_date,
            equipped_title_item_id
          `)
          .eq(
            "id",
            userId
          )
          .single();

      if (
        profileError
      ) {
        throw profileError;
      }

      const loadedProfile =
        profileData as Profile;

      setProfile(
        loadedProfile
      );

      if (
        loadedProfile
          .equipped_title_item_id
      ) {
        const {
          data:
            titleData,
          error:
            titleError,
        } =
          await supabase
            .from(
              "world_shop_items"
            )
            .select(`
              id,
              name
            `)
            .eq(
              "id",
              loadedProfile
                .equipped_title_item_id
            )
            .maybeSingle();

        if (
          titleError
        ) {
          throw titleError;
        }

        setTitle(
          titleData as
            | TitleItem
            | null
        );
      } else {
        setTitle(
          null
        );
      }

      const {
        data:
          relationData,
        error:
          relationError,
      } =
        await supabase
          .from(
            "hierarchy_relations"
          )
          .select(
            "superior_id"
          )
          .eq(
            "subordinate_id",
            userId
          )
          .eq(
            "status",
            "active"
          )
          .maybeSingle();

      if (
        relationError
      ) {
        throw relationError;
      }

      if (
        relationData
          ?.superior_id
      ) {
        const {
          data:
            superiorData,
          error:
            superiorError,
        } =
          await supabase
            .from(
              "profiles"
            )
            .select(`
              id,
              nickname,
              join_sequence
            `)
            .eq(
              "id",
              relationData
                .superior_id
            )
            .single();

        if (
          superiorError
        ) {
          throw superiorError;
        }

        setSuperior(
          superiorData as Superior
        );
      } else {
        setSuperior(
          null
        );
      }

      const {
        count,
        error:
          countError,
      } =
        await supabase
          .from(
            "hierarchy_relations"
          )
          .select(
            "*",
            {
              count:
                "exact",
              head:
                true,
            }
          )
          .eq(
            "superior_id",
            userId
          )
          .eq(
            "status",
            "active"
          );

      if (
        countError
      ) {
        throw countError;
      }

      setSubordinateCount(
        count ??
          0
      );

      const {
        data:
          missionData,
        error:
          missionError,
      } =
        await supabase.rpc(
          "get_my_daily_missions"
        );

      if (
        missionError
      ) {
        throw missionError;
      }

      setDailyMissions(
        (missionData ??
          []) as DailyMission[]
      );

      await Promise.all([
        loadUnreadCount(),
        loadChatUnreadCount(
          userId
        ),
        loadPendingActions(),
        loadTaskReminderSummary(
          userId
        ),
        loadRecentNotifications(
          userId
        ),
      ]);
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "讀取玩家資料時發生錯誤。"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();

    router.replace(
      "/login"
    );

    router.refresh();
  }

  const checkedInToday =
    useMemo(() => {
      if (
        !profile
          ?.last_checkin_date
      ) {
        return false;
      }

      const formatter =
        new Intl.DateTimeFormat(
          "en-CA",
          {
            timeZone:
              "Asia/Taipei",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }
        );

      return (
        profile
          .last_checkin_date ===
        formatter.format(
          new Date()
        )
      );
    }, [profile]);

  const dailyCompletedCount =
    useMemo(
      () =>
        dailyMissions.filter(
          (
            mission
          ) =>
            mission.completed
        ).length,
      [dailyMissions]
    );

  const remainingMissionReward =
    useMemo(() => {
      return dailyMissions
        .filter(
          (
            mission
          ) =>
            !mission.completed
        )
        .reduce(
          (
            total,
            mission
          ) =>
            total +
            Number(
              mission.reward_points ??
                0
            ),
          0
        );
    }, [dailyMissions]);

  const remainingDailyBonus =
    dailyCompletedCount < 5
      ? 5
      : 0;

  const nextCheckinReward =
    useMemo(() => {
      if (
        !profile ||
        checkedInToday
      ) {
        return 0;
      }

      const formatter =
        new Intl.DateTimeFormat(
          "en-CA",
          {
            timeZone:
              "Asia/Taipei",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }
        );

      const now =
        new Date();

      const yesterday =
        new Date(
          now.getTime() -
            24 *
              60 *
              60 *
              1000
        );

      const yesterdayString =
        formatter.format(
          yesterday
        );

      let nextStreak =
        1;

      if (
        profile.last_checkin_date ===
        yesterdayString
      ) {
        nextStreak =
          profile.checkin_streak +
          1;
      }

      if (
        nextStreak === 1
      ) {
        return 5;
      }

      if (
        nextStreak === 2
      ) {
        return 6;
      }

      if (
        nextStreak === 3
      ) {
        return 7;
      }

      if (
        nextStreak === 4
      ) {
        return 8;
      }

      if (
        nextStreak === 5
      ) {
        return 9;
      }

      if (
        nextStreak === 6
      ) {
        return 10;
      }

      return 12;
    }, [
      profile,
      checkedInToday,
    ]);

  const totalRecoveryAvailable =
    nextCheckinReward +
    remainingMissionReward +
    remainingDailyBonus;

  const pointsNeededForActiveRights =
    Math.max(
      1 -
        (
          profile
            ?.world_points ??
          0
        ),
      0
    );

  const totalPending =
    pendingActions
      .pending_tasks +
    pendingActions
      .pending_relation_requests +
    pendingActions
      .pending_competitions;


  const receivedOpenTaskCount =
    taskReminderSummary.received_pending +
    taskReminderSummary.received_accepted +
    taskReminderSummary.received_submitted;

  const hasTaskReminder =
    receivedOpenTaskCount > 0 ||
    taskReminderSummary.sent_submitted > 0;

  function formatSequence(
    sequence: number
  ) {
    return String(
      sequence
    ).padStart(
      6,
      "0"
    );
  }

  function formatDate(
    value: string
  ) {
    return new Intl.DateTimeFormat(
      "zh-TW",
      {
        timeZone:
          "Asia/Taipei",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    ).format(
      new Date(value)
    );
  }

  function getGenderLabel(
    gender:
      Profile["gender"]
  ) {
    if (
      gender ===
      "female"
    ) {
      return "女性";
    }

    if (
      gender ===
      "male"
    ) {
      return "男性";
    }

    return "其他";
  }

  function getRoleLabel(
    role:
      Profile["role"]
  ) {
    if (
      role ===
      "manager"
    ) {
      return "管理成員";
    }

    return "一般成員";
  }

  function getNotificationTypeLabel(
    type: string
  ) {
    if (
      type.includes(
        "task"
      )
    ) {
      return "任務";
    }

    if (
      type.includes(
        "competition"
      )
    ) {
      return "競技";
    }

    if (
      type.includes(
        "relation"
      )
    ) {
      return "歸屬";
    }

    return "世界";
  }

  function formatEventPoints(
    value: number
  ) {
    if (
      value > 0
    ) {
      return `+${value}`;
    }

    return String(value);
  }

  function getEventStyle(
    eventType:
      DailyWorldEvent["event_type"]
  ) {
    if (
      eventType ===
      "world_subsidy"
    ) {
      return {
        section:
          "border-emerald-900/60 bg-emerald-950/10",

        label:
          "text-emerald-400",

        points:
          "text-emerald-300",
      };
    }

    if (
      eventType ===
      "temporary_levy"
    ) {
      return {
        section:
          "border-red-900/60 bg-red-950/10",

        label:
          "text-red-400",

        points:
          "text-red-300",
      };
    }

    if (
      eventType ===
      "mission_bonus"
    ) {
      return {
        section:
          "border-sky-900/60 bg-sky-950/10",

        label:
          "text-sky-400",

        points:
          "text-sky-300",
      };
    }

    return {
      section:
        "border-neutral-800 bg-neutral-900",

      label:
        "text-neutral-500",

      points:
        "text-neutral-400",
    };
  }

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取世界資料…
      </main>
    );
  }

  const eventStyle =
    dailyWorldEvent
      ? getEventStyle(
          dailyWorldEvent.event_type
        )
      : null;

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">

      <div className="mx-auto max-w-6xl">

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">

          <div>

            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD
            </p>

            {title && (
              <p className="mt-3 text-sm font-medium text-amber-300">
                「
                {
                  title.name
                }
                」
              </p>
            )}

            <h1 className="mt-2 text-3xl font-semibold">
              {profile
                ? `歡迎，${profile.nickname}`
                : "玩家主頁"}
            </h1>

            <p className="mt-3 text-neutral-400">
              你的世界身分、每日活動與重要事件。
            </p>

          </div>

          <div className="flex items-center gap-3">

            <Link
              href="/notifications"
              className="relative rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              通知中心

              {unreadNotifications >
                0 && (
                <span className="absolute -right-2 -top-2 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold text-white">
                  {unreadNotifications >
                  99
                    ? "99+"
                    : unreadNotifications}
                </span>
              )}
            </Link>

            <button
              type="button"
              onClick={
                handleLogout
              }
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              登出
            </button>

          </div>

        </header>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {
              errorMessage
            }
          </div>
        )}

        {profile &&
          hasTaskReminder && (
          <section className="mb-6 rounded-2xl border border-violet-900/60 bg-violet-950/10 p-6">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-sm font-medium text-violet-400">
                  TASK REMINDER
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  任務提醒
                </h2>

                <p className="mt-2 text-sm text-neutral-400">
                  你目前有需要處理或追蹤的主從任務。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {receivedOpenTaskCount > 0 && (
                  <Link
                    href="/tasks"
                    className="rounded-lg border border-violet-800 px-4 py-2 text-sm text-violet-300 transition hover:border-violet-600"
                  >
                    查看我的任務
                  </Link>
                )}

                {taskReminderSummary.sent_submitted > 0 && (
                  <Link
                    href="/tasks/sent"
                    className="rounded-lg bg-violet-100 px-4 py-2 text-sm font-medium text-violet-950 transition hover:bg-white"
                  >
                    前往確認任務
                  </Link>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <p className="text-xs text-neutral-500">
                  待接受
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {taskReminderSummary.received_pending}
                </p>
              </div>

              <div className="rounded-xl border border-blue-900/50 bg-blue-950/10 p-4">
                <p className="text-xs text-blue-400">
                  進行中
                </p>

                <p className="mt-2 text-2xl font-semibold text-blue-300">
                  {taskReminderSummary.received_accepted}
                </p>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">
                <p className="text-xs text-neutral-500">
                  我已提交
                </p>

                <p className="mt-2 text-2xl font-semibold">
                  {taskReminderSummary.received_submitted}
                </p>
              </div>

              <div className="rounded-xl border border-violet-900/50 bg-violet-950/20 p-4">
                <p className="text-xs text-violet-400">
                  等待我確認
                </p>

                <p className="mt-2 text-2xl font-semibold text-violet-300">
                  {taskReminderSummary.sent_submitted}
                </p>
              </div>
            </div>
          </section>
        )}

        {profile && (
          <>

            {worldStatus
              ?.maintenance_status ===
              "insufficient" && (
              <>

                <section className="mb-6 rounded-2xl border border-red-800 bg-red-950/30 p-6">

                  <div className="flex flex-wrap items-start justify-between gap-5">

                    <div>

                      <p className="text-sm font-medium text-red-400">
                        WORLD MAINTENANCE WARNING
                      </p>

                      <h2 className="mt-2 text-2xl font-semibold text-red-200">
                        世界維持不足
                      </h2>

                      <p className="mt-3 max-w-3xl leading-7 text-red-100/80">
                        {
                          worldStatus.status_message
                        }
                      </p>

                    </div>

                    <Link
                      href="/world-status"
                      className="rounded-lg border border-red-700 px-4 py-2 text-sm text-red-200 transition hover:border-red-500"
                    >
                      查看世界狀態
                    </Link>

                  </div>

                </section>

                <section className="mb-6 rounded-2xl border border-emerald-900/60 bg-emerald-950/10 p-6">

                  <div className="flex flex-wrap items-start justify-between gap-5">

                    <div>

                      <p className="text-sm font-medium text-emerald-400">
                        WORLD RECOVERY
                      </p>

                      <h2 className="mt-2 text-2xl font-semibold">
                        恢復世界積分
                      </h2>

                      <p className="mt-2 text-sm text-neutral-400">
                        完成仍可進行的世界活動，即可重新取得主動權。
                      </p>

                    </div>

                    <div className="rounded-xl border border-emerald-900/50 bg-neutral-950 px-5 py-4 text-right">

                      <p className="text-xs text-neutral-500">
                        恢復主動權還需要
                      </p>

                      <p className="mt-1 text-3xl font-semibold text-emerald-300">
                        {
                          pointsNeededForActiveRights
                        }
                      </p>

                      <p className="mt-1 text-xs text-neutral-500">
                        世界積分
                      </p>

                    </div>

                  </div>

                  <div className="mt-6 grid gap-4 lg:grid-cols-2">

                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <p className="text-sm text-neutral-500">
                            每日打卡
                          </p>

                          <h3 className="mt-2 text-lg font-medium">
                            {checkedInToday
                              ? "今日已完成"
                              : "今天尚未打卡"}
                          </h3>

                        </div>

                        <div className="text-right">

                          <p
                            className={
                              checkedInToday
                                ? "font-semibold text-emerald-400"
                                : "text-2xl font-semibold text-emerald-300"
                            }
                          >
                            {checkedInToday
                              ? "完成"
                              : `+${nextCheckinReward}`}
                          </p>

                          {!checkedInToday && (
                            <p className="mt-1 text-xs text-neutral-500">
                              打卡基本獎勵
                            </p>
                          )}

                        </div>

                      </div>

                      {!checkedInToday && (
                        <>

                          <p className="mt-4 text-sm leading-6 text-neutral-400">
                            完成打卡後，除了連續打卡獎勵，也會同步完成「每日打卡」每日任務。
                          </p>

                          <Link
                            href="/checkin"
                            className="mt-5 inline-flex rounded-lg bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-950 transition hover:bg-white"
                          >
                            前往每日打卡
                          </Link>

                        </>
                      )}

                    </div>

                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5">

                      <div className="flex items-start justify-between gap-4">

                        <div>

                          <p className="text-sm text-neutral-500">
                            每日任務
                          </p>

                          <h3 className="mt-2 text-lg font-medium">
                            {
                              dailyCompletedCount
                            }{" "}
                            / 5 已完成
                          </h3>

                        </div>

                        <div className="text-right">

                          <p className="text-2xl font-semibold text-emerald-300">
                            +
                            {
                              remainingMissionReward
                            }
                          </p>

                          <p className="mt-1 text-xs text-neutral-500">
                            尚可取得
                          </p>

                        </div>

                      </div>

                      {dailyCompletedCount <
                        5 ? (
                        <>

                          <p className="mt-4 text-sm leading-6 text-neutral-400">
                            完成剩餘每日任務可再取得{" "}
                            {
                              remainingMissionReward
                            }{" "}
                            世界積分；5 項全部完成後另有 +5 額外獎勵。
                          </p>

                          <Link
                            href="/daily-missions"
                            className="mt-5 inline-flex rounded-lg border border-emerald-800 px-4 py-2 text-sm text-emerald-300 transition hover:border-emerald-600"
                          >
                            查看每日任務
                          </Link>

                        </>
                      ) : (

                        <p className="mt-4 text-sm text-emerald-400">
                          今日每日任務已全部完成。
                        </p>

                      )}

                    </div>

                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-3">

                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">

                      <p className="text-xs text-neutral-500">
                        目前世界積分
                      </p>

                      <p className="mt-2 text-2xl font-semibold">
                        {
                          profile.world_points
                        }
                      </p>

                    </div>

                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-4">

                      <p className="text-xs text-neutral-500">
                        每日任務全完成獎勵
                      </p>

                      <p className="mt-2 text-2xl font-semibold">
                        {remainingDailyBonus >
                        0
                          ? `+${remainingDailyBonus}`
                          : "已取得"}
                      </p>

                    </div>

                    <div className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-4">

                      <p className="text-xs text-emerald-500">
                        今日尚可恢復
                      </p>

                      <p className="mt-2 text-2xl font-semibold text-emerald-300">
                        +
                        {
                          totalRecoveryAvailable
                        }
                      </p>

                    </div>

                  </div>

                </section>

              </>
            )}

            {dailyWorldEvent &&
              eventStyle && (
              <section
                className={`mb-6 rounded-2xl border p-6 ${eventStyle.section}`}
              >

                <div className="flex flex-wrap items-start justify-between gap-5">

                  <div>

                    <p
                      className={`text-sm font-medium ${eventStyle.label}`}
                    >
                      TODAY&apos;S WORLD EVENT
                    </p>

                    <h2 className="mt-2 text-2xl font-semibold">
                      {
                        dailyWorldEvent.title
                      }
                    </h2>

                    <p className="mt-3 max-w-3xl leading-7 text-neutral-400">
                      {
                        dailyWorldEvent.description
                      }
                    </p>

                    <Link
                      href="/world-events"
                      className="mt-4 inline-flex text-sm text-neutral-400 transition hover:text-white"
                    >
                      查看世界事件紀錄 →
                    </Link>

                  </div>

                  {dailyWorldEvent.event_type ===
                  "mission_bonus" ? (

                    <div className="rounded-xl border border-sky-900/50 bg-neutral-950 px-6 py-5 text-right">

                      <p className="text-xs text-neutral-500">
                        今日效果
                      </p>

                      <p className="mt-1 text-3xl font-semibold text-sky-300">
                        +
                        {
                          dailyWorldEvent.effect_value
                        }
                      </p>

                      <p className="mt-1 text-xs text-neutral-500">
                        每項每日任務
                      </p>

                    </div>

                  ) : (

                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-6 py-5 text-right">

                      <p className="text-xs text-neutral-500">
                        今日影響
                      </p>

                      <p
                        className={`mt-1 text-3xl font-semibold ${eventStyle.points}`}
                      >
                        {formatEventPoints(
                          dailyWorldEvent.points_change
                        )}
                      </p>

                      <p className="mt-1 text-xs text-neutral-500">
                        世界積分
                      </p>

                    </div>

                  )}

                </div>

                {dailyWorldEvent.event_type ===
                "mission_bonus" ? (

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">

                    <div className="rounded-xl border border-sky-900/40 bg-neutral-950/70 p-4">

                      <p className="text-xs text-neutral-500">
                        每項任務加成
                      </p>

                      <p className="mt-2 text-xl font-semibold text-sky-300">
                        +
                        {
                          dailyWorldEvent.effect_value
                        }{" "}
                        世界積分
                      </p>

                    </div>

                    <div className="rounded-xl border border-sky-900/40 bg-neutral-950/70 p-4">

                      <p className="text-xs text-neutral-500">
                        今日已透過加成取得
                      </p>

                      <p className="mt-2 text-xl font-semibold text-sky-300">
                        +
                        {
                          dailyWorldEvent.bonus_awarded
                        }{" "}
                        世界積分
                      </p>

                    </div>

                  </div>

                ) : (

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">

                    <div className="rounded-xl border border-neutral-800/70 bg-neutral-950/60 p-4">

                      <p className="text-xs text-neutral-600">
                        事件前
                      </p>

                      <p className="mt-1 text-lg font-medium">
                        {
                          dailyWorldEvent.world_points_before
                        }
                      </p>

                    </div>

                    <div className="rounded-xl border border-neutral-800/70 bg-neutral-950/60 p-4">

                      <p className="text-xs text-neutral-600">
                        事件後
                      </p>

                      <p className="mt-1 text-lg font-medium">
                        {
                          dailyWorldEvent.world_points_after
                        }
                      </p>

                    </div>

                  </div>

                )}

              </section>
            )}

            {dailyCost &&
              todayCostRecord && (
              <section className="mb-6 rounded-2xl border border-amber-900/50 bg-amber-950/10 p-6">

                <div className="flex flex-wrap items-center justify-between gap-5">

                  <div>

                    <p className="text-sm text-amber-400">
                      每日世界維持費
                    </p>

                    <h2 className="mt-2 text-2xl font-semibold">
                      今日已結算 -
                      {
                        todayCostRecord.deducted_points
                      }
                    </h2>

                    <p className="mt-2 text-sm text-neutral-400">
                      每日標準維持費：
                      {" "}
                      {
                        todayCostRecord.configured_points
                      }
                      {" "}
                      世界積分
                    </p>

                    {dailyCost.settled_days >
                      1 && (
                      <p className="mt-2 text-sm text-amber-300">
                        本次補結算{" "}
                        {
                          dailyCost.settled_days
                        }{" "}
                        天，共扣除{" "}
                        {
                          dailyCost.total_deducted
                        }{" "}
                        世界積分。
                      </p>
                    )}

                    <div className="mt-4 flex flex-wrap gap-4">

                      <Link
                        href="/maintenance-costs"
                        className="inline-flex text-sm font-medium text-amber-300 transition hover:text-amber-200"
                      >
                        查看維持費紀錄 →
                      </Link>

                      <Link
                        href="/world-status"
                        className="inline-flex text-sm font-medium text-neutral-400 transition hover:text-white"
                      >
                        查看世界狀態 →
                      </Link>

                    </div>

                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">

                    <div className="rounded-xl border border-amber-900/40 bg-neutral-950 px-5 py-4 text-right">

                      <p className="text-xs text-neutral-500">
                        維持費結算後
                      </p>

                      <p className="mt-1 text-2xl font-semibold">
                        {
                          todayCostRecord.balance_after
                        }
                      </p>

                    </div>

                    <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-5 py-4 text-right">

                      <p className="text-xs text-neutral-500">
                        目前世界積分
                      </p>

                      <p className="mt-1 text-2xl font-semibold">
                        {
                          profile.world_points
                        }
                      </p>

                    </div>

                  </div>

                </div>

              </section>
            )}

            {unreadNotifications >
              0 && (
              <Link
                href="/notifications"
                className="mb-6 block rounded-2xl border border-red-900/60 bg-red-950/20 p-6 transition hover:border-red-700"
              >

                <div className="flex flex-wrap items-center justify-between gap-5">

                  <div>

                    <p className="text-sm text-red-400">
                      你有新的世界事件
                    </p>

                    <h2 className="mt-2 text-2xl font-semibold">
                      {
                        unreadNotifications
                      }{" "}
                      則未讀通知
                    </h2>

                  </div>

                  <span className="rounded-xl bg-neutral-100 px-5 py-3 text-sm font-medium text-neutral-950">
                    查看通知
                  </span>

                </div>

              </Link>
            )}

            <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

              <div className="flex items-center justify-between gap-4">

                <div>

                  <p className="text-sm text-neutral-500">
                    ACTION CENTER
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold">
                    待處理中心
                  </h2>

                  <p className="mt-2 text-sm text-neutral-400">
                    目前共有{" "}
                    {
                      totalPending
                    }{" "}
                    項事情等待你處理。
                  </p>

                </div>

                {totalPending >
                  0 && (
                  <span className="rounded-full bg-red-500 px-3 py-1 text-sm font-semibold">
                    {
                      totalPending
                    }
                  </span>
                )}

              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">

                <Link
                  href="/tasks"
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-5"
                >
                  <p className="text-sm text-neutral-500">
                    待接受任務
                  </p>

                  <p className="mt-3 text-3xl font-semibold">
                    {
                      pendingActions.pending_tasks
                    }
                  </p>
                </Link>

                <Link
                  href="/requests"
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-5"
                >
                  <p className="text-sm text-neutral-500">
                    待處理歸屬申請
                  </p>

                  <p className="mt-3 text-3xl font-semibold">
                    {
                      pendingActions.pending_relation_requests
                    }
                  </p>
                </Link>

                <Link
                  href="/arena"
                  className="rounded-xl border border-neutral-800 bg-neutral-950 p-5"
                >
                  <p className="text-sm text-neutral-500">
                    待接受競技
                  </p>

                  <p className="mt-3 text-3xl font-semibold">
                    {
                      pendingActions.pending_competitions
                    }
                  </p>
                </Link>

              </div>

            </section>

            <section className="mb-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

              <div className="flex items-center justify-between gap-4">

                <div>

                  <p className="text-sm text-neutral-500">
                    RECENT EVENTS
                  </p>

                  <h2 className="mt-2 text-2xl font-semibold">
                    最近事件
                  </h2>

                </div>

                <Link
                  href="/notifications"
                  className="text-sm text-neutral-400 hover:text-white"
                >
                  查看全部 →
                </Link>

              </div>

              {recentNotifications.length ===
              0 ? (
                <div className="mt-5 rounded-xl bg-neutral-950 p-5 text-neutral-500">
                  目前沒有通知事件。
                </div>
              ) : (
                <div className="mt-5 space-y-3">

                  {recentNotifications.map(
                    (
                      notification
                    ) => (

                      <Link
                        key={
                          notification.id
                        }
                        href={
                          notification.link ??
                          "/notifications"
                        }
                        className="block rounded-xl border border-neutral-800 bg-neutral-950 p-4"
                      >

                        <div className="flex justify-between gap-4">

                          <div>

                            <p className="text-xs text-neutral-500">
                              {getNotificationTypeLabel(
                                notification.notification_type
                              )}
                            </p>

                            <p className="mt-2 font-medium">
                              {
                                notification.title
                              }
                            </p>

                            <p className="mt-1 text-sm text-neutral-400">
                              {
                                notification.content
                              }
                            </p>

                          </div>

                          <p className="text-xs text-neutral-600">
                            {formatDate(
                              notification.created_at
                            )}
                          </p>

                        </div>

                      </Link>

                    )
                  )}

                </div>
              )}

            </section>

            <section className="mb-6 grid gap-4 lg:grid-cols-2">

              <Link
                href="/checkin"
                className={`rounded-2xl border p-6 ${
                  checkedInToday
                    ? "border-emerald-900/60 bg-emerald-950/20"
                    : "border-amber-900/60 bg-amber-950/20"
                }`}
              >
                <p className="text-sm text-emerald-400">
                  每日打卡
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  {checkedInToday
                    ? "今日已完成"
                    : "今日尚未打卡"}
                </h2>

                <p className="mt-3 text-sm text-neutral-400">
                  連續{" "}
                  {
                    profile.checkin_streak
                  }{" "}
                  天
                </p>
              </Link>

              <Link
                href="/daily-missions"
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
              >
                <p className="text-sm text-neutral-500">
                  每日任務
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  {
                    dailyCompletedCount
                  }{" "}
                  / 5
                </h2>

                <p className="mt-3 text-sm text-neutral-400">
                  {dailyCompletedCount >=
                  5
                    ? "今日任務已全部完成"
                    : `還有 ${
                        5 -
                        dailyCompletedCount
                      } 項待完成`}
                </p>
              </Link>

            </section>

            <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
                <p className="text-sm text-neutral-500">
                  永久序號
                </p>

                <p className="mt-3 font-mono text-2xl tracking-widest">
                  {formatSequence(
                    profile.join_sequence
                  )}
                </p>
              </div>

              <Link
                href="/world-status"
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 transition hover:border-emerald-800 hover:bg-emerald-950/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-neutral-500">
                    世界積分
                  </p>

                  <span className="text-xs text-neutral-600">
                    狀態 →
                  </span>
                </div>

                <p className="mt-3 text-3xl font-semibold">
                  {
                    profile.world_points
                  }
                </p>

                <p
                  className={`mt-2 text-xs ${
                    worldStatus
                      ?.maintenance_status ===
                    "insufficient"
                      ? "text-red-400"
                      : "text-emerald-400"
                  }`}
                >
                  {worldStatus
                    ?.maintenance_status ===
                  "insufficient"
                    ? "世界維持不足"
                    : "世界資格正常"}
                </p>
              </Link>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
                <p className="text-sm text-neutral-500">
                  競技積分
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {
                    profile.arena_points
                  }
                </p>
              </div>

              <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
                <p className="text-sm text-neutral-500">
                  直接從屬者
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {
                    subordinateCount
                  }
                </p>
              </div>

              <Link
                href="/notifications"
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
              >
                <p className="text-sm text-neutral-500">
                  未讀通知
                </p>

                <p className="mt-3 text-3xl font-semibold">
                  {
                    unreadNotifications
                  }
                </p>
              </Link>

            </section>

            <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

              <p className="text-sm text-neutral-500">
                我的世界身分
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

                <div className="rounded-xl bg-neutral-950 p-4">
                  <p className="text-sm text-neutral-500">
                    性別
                  </p>

                  <p className="mt-2">
                    {getGenderLabel(
                      profile.gender
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-950 p-4">
                  <p className="text-sm text-neutral-500">
                    身分
                  </p>

                  <p className="mt-2">
                    {getRoleLabel(
                      profile.role
                    )}
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-950 p-4">
                  <p className="text-sm text-neutral-500">
                    目前上級
                  </p>

                  <p className="mt-2">
                    {superior
                      ? superior.nickname
                      : "無"}
                  </p>
                </div>

                <div className="rounded-xl bg-neutral-950 p-4">
                  <p className="text-sm text-neutral-500">
                    接收從屬者
                  </p>

                  <p className="mt-2">
                    {profile
                      .accepting_subordinates
                      ? `${subordinateCount} / ${profile.subordinate_limit}`
                      : "目前關閉"}
                  </p>
                </div>

              </div>

            </section>

            <section className="mt-8">

              <p className="text-sm text-neutral-500">
                DAILY & WORLD
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                每日與世界
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                <Link
                  href="/world-status"
                  className={`rounded-2xl border p-5 transition ${
                    worldStatus
                      ?.maintenance_status ===
                    "insufficient"
                      ? "border-red-900/60 bg-red-950/20 hover:border-red-700"
                      : "border-emerald-900/50 bg-emerald-950/10 hover:border-emerald-700"
                  }`}
                >
                  <p
                    className={
                      worldStatus
                        ?.maintenance_status ===
                      "insufficient"
                        ? "font-medium text-red-300"
                        : "font-medium text-emerald-300"
                    }
                  >
                    世界狀態
                  </p>

                  <p className="mt-2 text-sm text-neutral-500">
                    查看目前資格、權限與維持費
                  </p>
                </Link>

                <Link
                  href="/world-events"
                  className="rounded-2xl border border-violet-900/50 bg-violet-950/10 p-5 transition hover:border-violet-700"
                >
                  <p className="font-medium text-violet-300">
                    世界事件
                  </p>

                  <p className="mt-2 text-sm text-neutral-500">
                    查看每日世界變動與歷史紀錄
                  </p>
                </Link>

                <Link
                  href="/notifications"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  通知中心
                </Link>

                <Link
                  href="/checkin"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  每日打卡
                </Link>

                <Link
                  href="/daily-missions"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  每日任務
                </Link>

                <Link
                  href="/maintenance-costs"
                  className="rounded-2xl border border-amber-900/50 bg-amber-950/10 p-5"
                >
                  維持費紀錄
                </Link>

                <Link
                  href="/world-ranking"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  世界排行榜
                </Link>

                <Link
                  href="/shop"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  世界商店
                </Link>

              </div>

            </section>

            <section className="mt-8">

              <p className="text-sm text-neutral-500">
                HIERARCHY
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                階級與關係
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                <Link
                  href="/hierarchy"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  階級關係
                </Link>

                <Link
                  href="/subordinates"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  從屬者管理
                </Link>

                <Link
                  href="/chat"
                  className={`rounded-2xl border p-5 ${
                    chatUnreadCount > 0
                      ? "border-red-900/60 bg-red-950/20"
                      : "border-neutral-800 bg-neutral-900"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">

                    <span>
                      主從聊天室
                    </span>

                    {chatUnreadCount >
                      0 && (
                      <span className="flex min-h-6 min-w-6 items-center justify-center rounded-full bg-red-500 px-2 text-xs font-semibold text-white">
                        {chatUnreadCount >
                        99
                          ? "99+"
                          : chatUnreadCount}
                      </span>
                    )}

                  </div>
                </Link>

                <Link
                  href="/requests"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  歸屬申請
                </Link>

                <Link
                  href="/world-tree"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  世界階級圖
                </Link>

                <Link
                  href="/members"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  世界成員
                </Link>

                <Link
                  href="/history"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  關係紀錄
                </Link>

              </div>

            </section>

            <section className="mt-8">

              <p className="text-sm text-neutral-500">
                ACTIVITY
              </p>

              <h2 className="mt-2 text-2xl font-semibold">
                任務與競技
              </h2>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                <Link
                  href="/tasks"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  我的任務
                </Link>

                <Link
                  href="/tasks/sent"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  我發出的任務
                </Link>

                <Link
                  href="/arena"
                  className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5"
                >
                  競技場
                </Link>

              </div>

            </section>

          </>
        )}

      </div>

    </main>
  );
}