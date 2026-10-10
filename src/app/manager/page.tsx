import Link from 'next/link';

// AI マネージャー: 人と OmniPulse Studio のあいだに立つ窓口の AI。今は動かない（役割と、動かすのに足りないものを示すだけ）。
// 設計は docs/architecture/ai-manager.md
export default function ManagerPage() {
  return (
    <div className="page">
      <div className="row" style={{ gap: 10 }}>
        <h1>AI マネージャー</h1>
        <span className="badge">準備中</span>
      </div>
      <p className="lead">
        人と OmniPulse Studio のあいだに立つ AI です。人はマネージャーに伝え、マネージャーが Studio を動かして、結果を人に伝えます。今はまだ動きません。それまでは、<Link href="/new" style={{ color: 'var(--accent-strong)', fontWeight: 700 }}>「作成する」</Link>などの画面から人が直接操作します。
      </p>

      <section className="card stack" style={{ gap: 8 }}>
        <h2 style={{ margin: 0 }}>任せる予定の仕事</h2>
        <ol className="stack" style={{ gap: 6, paddingLeft: 20 }}>
          <li><strong>話を聞いて依頼にする</strong><span className="muted"> … 「今週は◯◯の動画を3本」のような話から、アカウント・お題・構成案・リサーチ手法・禁止事項を選んで依頼する</span></li>
          <li><strong>進み具合と結果を伝える</strong><span className="muted"> … できた動画、失敗とやり直し、投稿した動画の数字と分析を知らせる</span></li>
          <li><strong>判断が要るところで聞く</strong><span className="muted"> … 動画を見せて承認・投稿してよいか聞き、OK をもらったら代わりに実行する。構成案などの改善案を出す</span></li>
          <li><strong>自分から提案する</strong><span className="muted"> … 次に作る動画や、数字から分かったことを提案する</span></li>
        </ol>
      </section>

      <section className="card stack" style={{ gap: 8 }}>
        <h2 style={{ margin: 0 }}>判断は人が行う</h2>
        <ul className="stack" style={{ gap: 6, paddingLeft: 20 }}>
          <li>承認・投稿・公開は、人がはっきり OK と言ったときだけマネージャーが実行します。自分の判断では行いません。</li>
          <li>構成案・リサーチ手法・禁止事項は、マネージャーは改善案を出すまでで、採るかどうかは人が決めます。</li>
          <li>今ある画面はそのまま残り、マネージャーを通さずに操作することもできます。</li>
        </ul>
      </section>

      <section className="card stack" style={{ gap: 8 }}>
        <h2 style={{ margin: 0 }}>動かすために足りないもの</h2>
        <ul className="stack" style={{ gap: 6, paddingLeft: 20 }}>
          <li>マネージャーと話す場所（まずこの画面のチャット、あとで Slack などの外のチャットからも）</li>
          <li>人の OK を記録して、それがあるときだけ承認・投稿を実行する仕組み</li>
          <li>数字の取得と分析を、マネージャーからは実行できるようにすること</li>
          <li>作る本数・時間帯の上限と、すぐ止めるスイッチ</li>
          <li>決まった時間に起動して、自分から知らせたり提案したりする仕組み</li>
        </ul>
      </section>
    </div>
  );
}
