"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type ShopItem = {
  id: string;
  item_key: string;
  name: string;
  description: string;
  item_type:
    | "title"
    | "badge";
  price: number;
  sort_order: number;
};

type InventoryRow = {
  item_id: string;
};

type Profile = {
  world_points: number;
  equipped_title_item_id:
    | string
    | null;
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

export default function WorldShopPage() {
  const router =
    useRouter();

  const [
    items,
    setItems,
  ] =
    useState<
      ShopItem[]
    >([]);

  const [
    ownedIds,
    setOwnedIds,
  ] =
    useState<
      string[]
    >([]);

  const [
    worldPoints,
    setWorldPoints,
  ] =
    useState(0);

  const [
    worldStatus,
    setWorldStatus,
  ] =
    useState<
      WorldStatus | null
    >(null);

  const [
    equippedTitleId,
    setEquippedTitleId,
  ] =
    useState<
      string | null
    >(null);

  const [
    processingId,
    setProcessingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  useEffect(() => {
    void loadShop();
  }, []);

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

      const status: WorldStatus =
        {
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
        };

      setWorldStatus(
        status
      );

      setWorldPoints(
        status.world_points
      );
    }
  }

  async function loadShop() {
    setLoading(true);

    setErrorMessage("");

    try {
      const {
        data: {
          user,
        },
        error:
          userError,
      } =
        await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        router.replace(
          "/login"
        );
        return;
      }

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
            world_points,
            equipped_title_item_id
          `)
          .eq(
            "id",
            user.id
          )
          .single();

      if (
        profileError
      ) {
        throw profileError;
      }

      const profile =
        profileData as Profile;

      setWorldPoints(
        Number(
          profile.world_points ??
            0
        )
      );

      setEquippedTitleId(
        profile
          .equipped_title_item_id
      );

      await loadWorldStatus();

      const {
        data:
          itemData,
        error:
          itemError,
      } =
        await supabase
          .from(
            "world_shop_items"
          )
          .select(`
            id,
            item_key,
            name,
            description,
            item_type,
            price,
            sort_order
          `)
          .eq(
            "is_active",
            true
          )
          .order(
            "sort_order",
            {
              ascending:
                true,
            }
          );

      if (
        itemError
      ) {
        throw itemError;
      }

      setItems(
        (itemData ??
          []) as ShopItem[]
      );

      const {
        data:
          inventoryData,
        error:
          inventoryError,
      } =
        await supabase
          .from(
            "player_inventory"
          )
          .select(
            "item_id"
          )
          .eq(
            "player_id",
            user.id
          );

      if (
        inventoryError
      ) {
        throw inventoryError;
      }

      setOwnedIds(
        (
          (inventoryData ??
            []) as InventoryRow[]
        ).map(
          (
            row
          ) =>
            row.item_id
        )
      );
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "讀取世界商店時發生錯誤。"
      );
    } finally {
      setLoading(
        false
      );
    }
  }

  const equippedItem =
    useMemo(
      () =>
        items.find(
          (
            item
          ) =>
            item.id ===
            equippedTitleId
        ) ??
        null,
      [
        items,
        equippedTitleId,
      ]
    );

  const worldMaintenanceInsufficient =
    worldStatus
      ?.maintenance_status ===
    "insufficient";

  async function handlePurchase(
    item: ShopItem
  ) {
    if (
      processingId
    ) {
      return;
    }

    if (
      worldMaintenanceInsufficient
    ) {
      setErrorMessage(
        "世界維持不足：你的世界積分已耗盡，目前無法購買商品。"
      );

      return;
    }

    if (
      !worldStatus
        ?.can_spend_points
    ) {
      setErrorMessage(
        "目前世界狀態無法使用世界積分。"
      );

      return;
    }

    setProcessingId(
      item.id
    );

    setErrorMessage("");

    setSuccessMessage("");

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "purchase_world_shop_item",
          {
            p_item_id:
              item.id,
          }
        );

      if (error) {
        throw error;
      }

      const result =
        Array.isArray(data) &&
        data.length > 0
          ? data[0]
          : null;

      setSuccessMessage(
        `已購買「${item.name}」。`
      );

      if (result) {
        const newBalance =
          Number(
            result.remaining_world_points ??
              0
          );

        setWorldPoints(
          newBalance
        );

        if (
          newBalance <= 0
        ) {
          setWorldStatus(
            (
              current
            ) =>
              current
                ? {
                    ...current,

                    world_points:
                      0,

                    maintenance_status:
                      "insufficient",

                    can_spend_points:
                      false,

                    can_start_competition:
                      false,

                    can_send_task:
                      false,

                    status_message:
                      "你的世界積分已耗盡，目前處於世界維持不足狀態。請透過每日打卡、每日任務或其他活動重新取得世界積分。",
                  }
                : current
          );
        }
      }

      setOwnedIds(
        (
          current
        ) => {
          if (
            current.includes(
              item.id
            )
          ) {
            return current;
          }

          return [
            ...current,
            item.id,
          ];
        }
      );
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "購買商品時發生錯誤。"
      );

      await loadWorldStatus();
    } finally {
      setProcessingId(
        null
      );
    }
  }

  async function handleEquip(
    item: ShopItem
  ) {
    if (
      processingId
    ) {
      return;
    }

    setProcessingId(
      item.id
    );

    setErrorMessage("");

    setSuccessMessage("");

    try {
      const {
        error,
      } =
        await supabase.rpc(
          "equip_world_title",
          {
            p_item_id:
              item.id,
          }
        );

      if (error) {
        throw error;
      }

      setEquippedTitleId(
        item.id
      );

      setSuccessMessage(
        `已裝備稱號「${item.name}」。`
      );
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "裝備稱號時發生錯誤。"
      );
    } finally {
      setProcessingId(
        null
      );
    }
  }

  async function handleUnequip() {
    if (
      processingId
    ) {
      return;
    }

    setProcessingId(
      "unequip"
    );

    setErrorMessage("");

    setSuccessMessage("");

    try {
      const {
        error,
      } =
        await supabase.rpc(
          "unequip_world_title"
        );

      if (error) {
        throw error;
      }

      setEquippedTitleId(
        null
      );

      setSuccessMessage(
        "已卸下目前稱號。"
      );
    } catch (error) {
      setErrorMessage(
        error instanceof
          Error
          ? error.message
          : "卸下稱號時發生錯誤。"
      );
    } finally {
      setProcessingId(
        null
      );
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-400">
        正在讀取世界商店…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-5 py-10 text-neutral-100">
      <div className="mx-auto max-w-5xl">

        <header className="mb-8 flex flex-wrap items-start justify-between gap-4">

          <div>
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              SEQUENCE WORLD
            </p>

            <h1 className="mt-3 text-3xl font-semibold">
              世界商店
            </h1>

            <p className="mt-3 text-neutral-400">
              使用世界積分解鎖永久收藏與個人稱號。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              href="/world-ranking"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              世界排行榜
            </Link>

            <Link
              href="/dashboard"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
            >
              返回主頁
            </Link>

          </div>

        </header>

        {worldMaintenanceInsufficient && (
          <section className="mb-6 rounded-2xl border border-red-800 bg-red-950/30 p-6">

            <p className="text-sm font-medium text-red-400">
              WORLD MAINTENANCE WARNING
            </p>

            <h2 className="mt-2 text-2xl font-semibold text-red-200">
              世界維持不足
            </h2>

            <p className="mt-3 leading-7 text-red-100/80">
              你的世界積分已耗盡，目前無法購買世界商店商品。
              你仍然可以查看商品、裝備已經擁有的稱號，以及透過每日活動重新取得世界積分。
            </p>

            <div className="mt-5 flex flex-wrap gap-3">

              <Link
                href="/checkin"
                className="rounded-lg bg-red-100 px-4 py-2 text-sm font-medium text-red-950"
              >
                前往每日打卡
              </Link>

              <Link
                href="/daily-missions"
                className="rounded-lg border border-red-700 px-4 py-2 text-sm text-red-200 transition hover:border-red-500"
              >
                查看每日任務
              </Link>

            </div>

          </section>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-900 bg-red-950/40 p-4 text-red-300">
            {
              errorMessage
            }
          </div>
        )}

        {successMessage && (
          <div className="mb-6 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-emerald-300">
            {
              successMessage
            }
          </div>
        )}

        <section className="mb-6 grid gap-4 sm:grid-cols-2">

          <div
            className={`rounded-2xl border p-6 ${
              worldMaintenanceInsufficient
                ? "border-red-900/60 bg-red-950/20"
                : "border-neutral-800 bg-neutral-900"
            }`}
          >
            <p className="text-sm text-neutral-500">
              我的世界積分
            </p>

            <p
              className={`mt-3 text-4xl font-semibold ${
                worldMaintenanceInsufficient
                  ? "text-red-300"
                  : ""
              }`}
            >
              {
                worldPoints
              }
            </p>

            {worldMaintenanceInsufficient && (
              <p className="mt-3 text-sm text-red-400">
                世界維持不足
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6">

            <p className="text-sm text-neutral-500">
              目前稱號
            </p>

            <p className="mt-3 text-2xl font-semibold">
              {equippedItem
                ? equippedItem.name
                : "未裝備"}
            </p>

            {equippedItem && (
              <button
                type="button"
                disabled={
                  processingId !==
                  null
                }
                onClick={
                  handleUnequip
                }
                className="mt-4 rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-400 transition hover:border-neutral-500 hover:text-white disabled:opacity-50"
              >
                卸下稱號
              </button>
            )}

          </div>

        </section>

        <section>

          <div className="mb-4">

            <p className="text-sm text-neutral-500">
              商品
            </p>

            <h2 className="mt-2 text-2xl font-semibold">
              世界稱號
            </h2>

          </div>

          <div className="grid gap-4 md:grid-cols-2">

            {items.map(
              (
                item
              ) => {
                const owned =
                  ownedIds.includes(
                    item.id
                  );

                const equipped =
                  equippedTitleId ===
                  item.id;

                const affordable =
                  worldPoints >=
                  item.price;

                const purchaseBlocked =
                  worldMaintenanceInsufficient ||
                  !worldStatus
                    ?.can_spend_points;

                return (
                  <article
                    key={
                      item.id
                    }
                    className={`rounded-2xl border p-6 ${
                      equipped
                        ? "border-emerald-800 bg-emerald-950/20"
                        : "border-neutral-800 bg-neutral-900"
                    }`}
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div>

                        <p className="text-xl font-semibold">
                          {
                            item.name
                          }
                        </p>

                        <p className="mt-3 text-sm leading-6 text-neutral-400">
                          {
                            item.description
                          }
                        </p>

                      </div>

                      {equipped && (
                        <span className="rounded-full border border-emerald-800 px-3 py-1 text-xs text-emerald-300">
                          裝備中
                        </span>
                      )}

                      {!equipped &&
                        owned && (
                          <span className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-400">
                            已擁有
                          </span>
                        )}

                    </div>

                    <div className="mt-6 flex items-end justify-between gap-4">

                      <div>

                        <p className="text-xs text-neutral-600">
                          售價
                        </p>

                        <p className="mt-1 text-2xl font-semibold">
                          {
                            item.price
                          }

                          <span className="ml-2 text-sm font-normal text-neutral-500">
                            世界積分
                          </span>
                        </p>

                      </div>

                      {!owned && (
                        <button
                          type="button"
                          disabled={
                            processingId !==
                              null ||
                            !affordable ||
                            purchaseBlocked
                          }
                          onClick={() =>
                            handlePurchase(
                              item
                            )
                          }
                          className={`rounded-xl px-5 py-3 text-sm font-medium transition disabled:cursor-not-allowed ${
                            purchaseBlocked
                              ? "border border-red-900 bg-red-950/30 text-red-400 disabled:opacity-70"
                              : "bg-neutral-100 text-neutral-950 hover:bg-white disabled:opacity-30"
                          }`}
                        >
                          {processingId ===
                          item.id
                            ? "購買中…"
                            : worldMaintenanceInsufficient
                              ? "世界維持不足"
                              : !affordable
                                ? "積分不足"
                                : "購買"}
                        </button>
                      )}

                      {owned &&
                        !equipped && (
                          <button
                            type="button"
                            disabled={
                              processingId !==
                              null
                            }
                            onClick={() =>
                              handleEquip(
                                item
                              )
                            }
                            className="rounded-xl border border-neutral-600 px-5 py-3 text-sm text-neutral-200 transition hover:border-neutral-400 hover:bg-neutral-800 disabled:opacity-50"
                          >
                            {processingId ===
                            item.id
                              ? "處理中…"
                              : "裝備"}
                          </button>
                        )}

                      {equipped && (
                        <button
                          type="button"
                          disabled
                          className="rounded-xl border border-emerald-900 px-5 py-3 text-sm text-emerald-400 opacity-70"
                        >
                          使用中
                        </button>
                      )}

                    </div>

                  </article>
                );
              }
            )}

          </div>

        </section>

      </div>
    </main>
  );
}