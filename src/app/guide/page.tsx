const FLOW: { step: string; owner: 'エージェント' | 'あなた'; what: string }[] = [
  { step: '1. 依頼', owner: 'あなた', what: '「新しい動画を作る」でテーマ（任意）と AI（Claude Code / Antigravity）を選んで依頼する' },
  { step: '2. リサーチ', owner: 'エージェント', what: 'X や公式発表で話題を調べ、出典つきで登録する' },
  { step: '3. 台本', owner: 'エージェント', what: '台本と各 SNS の投稿文を書く' },
  { step: '4. 制作', owner: 'エージェント', what: '音声と動画を作り、字幕などを自分で点検する' },
  { step: '5. 承認', owner: 'あなた', what: '企画の画面で動画を再生して確認し、問題なければ「承認」を押す' },
  { step: '6. 配信', owner: 'あなた', what: 'ボタンで YouTube に投稿（非公開）し、YouTube Studio で「公開」に切り替える（当面は YouTube のみで検証）' },
  { step: '7. 計測・分析', owner: 'あなた', what: '投稿から1日後に「YouTube から自動で取得する」を押す。自動で分析し、知見が次の台本に活かされる' },
];

export default function GuidePage() {
  return (
    <div className="page">
      <h1>使い方</h1>
      <p className="lead">
        1本の動画は、次の流れで公開されます。あなたの番になると、ホームの「あなたの番」に出てきます。
      </p>
      <div className="card flat">
        <table>
          <thead>
            <tr><th>工程</th><th>担当</th><th>内容</th></tr>
          </thead>
          <tbody>
            {FLOW.map((f) => (
              <tr key={f.step}>
                <td style={{ whiteSpace: 'nowrap', fontWeight: 700 }}>{f.step}</td>
                <td><span className={`badge${f.owner === 'あなた' ? ' you' : ''}`}>{f.owner}</span></td>
                <td>{f.what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card stack" style={{ gap: 6 }}>
        <strong>知っておくこと</strong>
        <p className="lead">・YouTube への投稿は、YouTube の仕様で最初は非公開になります。公開は YouTube Studio で切り替えます。</p>
        <p className="lead">・動画の声は VOICEVOX のずんだもんです。投稿文にクレジットが自動で入ります。消さないでください。</p>
        <p className="lead">・右上のボタンで、画面の配色（白×水色 / 黒×オレンジ）を切り替えられます。</p>
      </div>
    </div>
  );
}
