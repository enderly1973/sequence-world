import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-6xl px-5 py-10">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm tracking-[0.3em] text-neutral-500">
              SEQUENCE WORLD
            </p>
          </div>

          <Link
            href="/login"
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 transition hover:border-neutral-500 hover:text-white"
          >
            登入
          </Link>
        </header>

        {/* Hero */}
        <section className="py-24 md:py-32">
          <div className="max-w-4xl">
            <p className="text-sm font-medium tracking-[0.25em] text-violet-400">
              DOM × SUB
            </p>

            <h1 className="mt-5 text-4xl font-semibold leading-tight md:text-6xl">
              關係不只是稱呼。
              <br />
              它可以成為一套真正運作的規則。
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-neutral-400">
              Sequence World 是以 Dom / Sub
              關係為核心建立的互動世界。
              任務、權限、獎勵、懲罰與紀錄，
              都會成為關係的一部分。
            </p>

            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/login"
                className="rounded-xl bg-neutral-100 px-6 py-3 font-medium text-neutral-950 transition hover:bg-white"
              >
                進入 Sequence World
              </Link>
            </div>
          </div>
        </section>

        {/* Roles */}
        <section className="grid gap-5 md:grid-cols-2">
          <article className="rounded-3xl border border-violet-900/50 bg-violet-950/10 p-8">
            <p className="text-sm tracking-[0.2em] text-violet-400">
              DOM
            </p>

            <h2 className="mt-4 text-3xl font-semibold">
              建立秩序
            </h2>

            <p className="mt-5 leading-7 text-neutral-400">
              作為 Dom，你可以向自己的 Sub
              發送任務，決定內容、期限、完成獎勵與逾期懲罰，
              並追蹤任務從接受到完成的整個過程。
            </p>

            <div className="mt-7 space-y-3 text-sm text-neutral-300">
              <p>發送與管理任務</p>
              <p>設定完成獎勵與逾期懲罰</p>
              <p>查看照片與影片證明</p>
              <p>確認完成或判定任務失敗</p>
              <p>在任務提交前取消指令</p>
            </div>
          </article>

          <article className="rounded-3xl border border-neutral-800 bg-neutral-900 p-8">
            <p className="text-sm tracking-[0.2em] text-neutral-500">
              SUB
            </p>

            <h2 className="mt-4 text-3xl font-semibold">
              接受規則
            </h2>

            <p className="mt-5 leading-7 text-neutral-400">
              作為 Sub，你會收到來自 Dom
              的正式任務。你可以選擇接受或拒絕，
              接受後執行任務、提交證明，
              並等待最後的結果。
            </p>

            <div className="mt-7 space-y-3 text-sm text-neutral-300">
              <p>接受或拒絕任務</p>
              <p>查看期限與任務條件</p>
              <p>上傳照片或影片證明</p>
              <p>提交完成等待確認</p>
              <p>透過任務取得世界積分</p>
            </div>
          </article>
        </section>

        {/* Flow */}
        <section className="py-24">
          <div className="mb-10">
            <p className="text-sm tracking-[0.25em] text-neutral-500">
              TASK SYSTEM
            </p>

            <h2 className="mt-3 text-3xl font-semibold md:text-4xl">
              每一個任務，都有完整的結果
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                number: "01",
                title: "建立任務",
                description:
                  "Dom 建立任務，設定內容、期限、獎勵與懲罰。",
              },
              {
                number: "02",
                title: "接受與執行",
                description:
                  "Sub 決定是否接受，並在任務期間提交照片或影片證明。",
              },
              {
                number: "03",
                title: "產生結果",
                description:
                  "任務最終可能完成、失敗、拒絕、取消或因逾期受到懲罰。",
              },
            ].map((item) => (
              <div
                key={item.number}
                className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6"
              >
                <p className="font-mono text-sm text-neutral-600">
                  {item.number}
                </p>

                <h3 className="mt-5 text-xl font-medium">
                  {item.title}
                </h3>

                <p className="mt-3 text-sm leading-6 text-neutral-400">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* World */}
        <section className="rounded-3xl border border-neutral-800 bg-neutral-900 p-8 md:p-12">
          <p className="text-sm tracking-[0.25em] text-neutral-500">
            THE WORLD
          </p>

          <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight md:text-5xl">
            你不是在使用一張待辦清單。
            <br />
            你正在進入一個有規則的世界。
          </h2>

          <p className="mt-6 max-w-3xl leading-8 text-neutral-400">
            世界積分、每日活動、階級關係、Dom / Sub
            關係與任務紀錄共同構成 Sequence World。
            每一次選擇，都會留下結果。
          </p>
        </section>

        {/* CTA */}
        <section className="py-24 text-center">
          <p className="text-sm tracking-[0.25em] text-violet-400">
            ENTER SEQUENCE WORLD
          </p>

          <h2 className="mt-5 text-4xl font-semibold">
            建立你的關係與秩序
          </h2>

          <p className="mx-auto mt-5 max-w-xl text-neutral-400">
            進入 Sequence World，
            開始建立屬於你們的規則。
          </p>

          <Link
            href="/login"
            className="mt-8 inline-flex rounded-xl bg-neutral-100 px-7 py-3 font-medium text-neutral-950 transition hover:bg-white"
          >
            登入 / 開始
          </Link>
        </section>

        <footer className="border-t border-neutral-900 py-8 text-center text-sm text-neutral-600">
          SEQUENCE WORLD
        </footer>
      </div>
    </main>
  );
}