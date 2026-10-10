import { listProhibitions } from '@/lib/services/researchMethodService';
import { createProhibition, deleteProhibition, updateProhibition } from '../actions';
import { ProhibitionList } from './client';

// 依頼のときに選ぶ禁止事項の一覧（全アカウント共通）
export default async function ProhibitionsPage() {
  const prohibitions = await listProhibitions();
  return (
    <div className="page">
      <h1>禁止事項</h1>
      <p className="lead">
        AI にさせないことです。依頼するときに、使うものを選びます。「最初から選ぶ」にしたものは、依頼の画面で選んだ状態になります。
      </p>
      <p className="muted">
        ここから消しても、AI の作業中は承認・投稿・数字の記録をコマンドから実行できません（どちらの AI でも、コマンドの側で断ります）。事実は出典に書いてあることだけにする、特定の企業・人物を応援・批判しない（声の利用規約）、といった台本の決まりは指示書に固定で入ります。
      </p>
      <ProhibitionList
        create={createProhibition}
        rows={prohibitions.map((p) => ({
          id: p.id,
          text: p.text,
          isDefault: p.isDefault,
          update: updateProhibition.bind(null, p.id),
          remove: deleteProhibition.bind(null, p.id),
        }))}
      />
    </div>
  );
}
