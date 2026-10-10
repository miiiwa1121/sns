import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, ExternalLink } from 'lucide-react';
import { loadProject, ProjectWithAll } from '@/lib/queries';
import { nextAction } from '@/lib/workflow';
import { safeJson } from '@/lib/json';
import { ENABLED_PLATFORMS, PLATFORM_LABEL, PlatformType } from '@/lib/types';
import { diagnosePerformance, weightedRetention } from '@/lib/agents/performanceDiagnosis';
import { YouTubePublisher } from '@/lib/publishers/youtubePublisher';
import {
  approveProject,
  collectYouTubeMetrics,
  deleteDraftProject,
  publishToYouTube,
  recordPostUrl,
  saveMetrics,
} from '@/app/actions';
import { OwnerBadge, StepBar } from '../../ui';
import { ActionButton, ActionForm, CopyButton } from './client';
import { mediaExists, mediaUrlPath, thumbRelPath } from '@/lib/storage';

type ScriptLine = { text: string; caption?: string };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();

  const next = nextAction(project);
  const clip = project.shortClips[0];
  const approved = Boolean(clip?.readyToPublish);
  const published = project.publishLogs.filter((l) => l.status === 'published');

  return (
    <div className="page">
      <Link href="/projects" className="row muted" style={{ gap: 6 }}><ArrowLeft size={16} />企画一覧</Link>

      <div className="stack" style={{ gap: 10 }}>
        <span className="muted">{project.account.name}</span>
        <h1>{project.title}</h1>
        <StepBar next={next} labels />
      </div>

      <div className="card row between">
        <div className="stack" style={{ gap: 2 }}>
          <span className="muted">次にやること</span>
          <strong>{next.label}</strong>
        </div>
        <OwnerBadge next={next} />
      </div>

      <VideoSection project={project} approved={approved} />
      {approved && <PublishSection project={project} />}
      {published.length > 0 && <MeasureSection project={project} />}
      <ScriptSection project={project} />
      <SourcesSection project={project} />

      {published.length === 0 && (
        <form action={deleteDraftProject.bind(null, project.id)}>
          <button className="btn danger">この企画を削除する</button>
        </form>
      )}
    </div>
  );
}

function VideoSection({ project, approved }: { project: ProjectWithAll; approved: boolean }) {
  const clip = project.shortClips[0];
  return (
    <section className="card">
      <h2>1. 動画を確認する</h2>
      {!clip?.renderedFilePath ? (
        <p className="lead">動画はまだできていません。エージェントが作るのを待ってください。</p>
      ) : !mediaExists(clip.renderedFilePath) ? (
        <p className="lead">動画ファイルは整理（clean）で削除済みです。</p>
      ) : (
        <div className="row" style={{ alignItems: 'flex-start', gap: 24, flexWrap: 'wrap' }}>
          <video src={mediaUrlPath(clip.renderedFilePath)} poster={mediaUrlPath(thumbRelPath(clip.renderedFilePath))} controls preload="metadata" />
          <div className="stack" style={{ flex: 1, minWidth: 240 }}>
            <p className="lead">再生して、次の点を確認してください。</p>
            <ul style={{ paddingLeft: 20, color: 'var(--sub)' }}>
              <li>読み上げが自然か（英語の読み方など）</li>
              <li>字幕に誤字や崩れがないか</li>
              <li>内容が出典と合っているか（下の「出典」）</li>
            </ul>
            {approved ? (
              <p className="notice ok">承認済みです</p>
            ) : (
              <ActionButton action={approveProject.bind(null, project.id)} label="この内容で公開してよい（承認）" pendingLabel="承認中…" primary />
            )}
            <p className="muted">直したいところがあれば、エージェントに伝えて作り直してもらってください。</p>
          </div>
        </div>
      )}
    </section>
  );
}

function PublishSection({ project }: { project: ProjectWithAll }) {
  const clip = project.shortClips[0];
  const videoUrl = mediaUrlPath(clip.renderedFilePath!);
  const youtubeReady = YouTubePublisher.getAuthorizedClient(project.account.slug) !== null;
  const log = (p: PlatformType) => project.publishLogs.find((l) => l.platform === p);

  return (
    <section className="card stack" style={{ gap: 20 }}>
      <div className="row between">
        <h2 style={{ margin: 0 }}>2. YouTube に投稿する</h2>
        <a className="btn" href={videoUrl} download>
          <Download size={16} />動画をダウンロード
        </a>
      </div>

      {ENABLED_PLATFORMS.map((p) => {
        const l = log(p);
        const done = l?.status === 'published';
        const text = p === 'youtube' ? [l?.title, l?.caption].filter(Boolean).join('\n\n') : l?.caption ?? '';
        return (
          <div key={p} className="stack" style={{ gap: 10, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <div className="row between">
              <strong>{PLATFORM_LABEL[p]}</strong>
              {done ? (
                l?.postUrl ? (
                  <a href={l.postUrl} target="_blank" rel="noreferrer" className="row badge ok" style={{ gap: 4 }}>
                    投稿済み <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="badge ok">投稿済み</span>
                )
              ) : l?.status === 'failed' ? (
                <span className="badge ng">失敗</span>
              ) : (
                <span className="badge">未投稿</span>
              )}
            </div>

            {!done && (
              <>
                {p === 'youtube' && youtubeReady && (
                  <ActionButton
                    action={publishToYouTube.bind(null, project.id)}
                    label="YouTube に投稿する（非公開）"
                    pendingLabel="アップロード中…"
                    primary
                    confirm="YouTube に非公開でアップロードします。よろしいですか？"
                  />
                )}
                {l?.status === 'failed' && l.errorMessage && <p className="notice ng">{l.errorMessage}</p>}
                {text && (
                  <div className="stack" style={{ gap: 6 }}>
                    <textarea className="input" readOnly value={text} rows={Math.min(8, text.split('\n').length + 1)} />
                    <div><CopyButton text={text} /></div>
                  </div>
                )}
                <ActionForm action={recordPostUrl.bind(null, project.id)} submitLabel="投稿 URL を記録する">
                  <input type="hidden" name="platform" value={p} />
                  <div className="field">
                    <label>{p === 'youtube' && youtubeReady ? '手動で投稿した場合はこちらに URL を入力' : `${PLATFORM_LABEL[p]} に投稿したら URL を入力`}</label>
                    <input className="input" name="url" placeholder="https://" />
                  </div>
                </ActionForm>
              </>
            )}
            {done && p === 'youtube' && <p className="muted">公開するには YouTube Studio で公開範囲を「公開」に切り替えてください。</p>}
          </div>
        );
      })}
    </section>
  );
}

function MeasureSection({ project }: { project: ProjectWithAll }) {
  const published = project.publishLogs.filter((l) => l.status === 'published');
  const metric = (p: string) => project.analytics.find((a) => a.platform === p);
  const platforms = project.analytics.map((a) => ({
    platform: a.platform as PlatformType,
    views: a.views,
    likes: a.likes,
    shares: a.shares,
    comments: a.comments,
    engagementRate: a.engagementRate,
    retentionRate: a.retentionRate,
  }));
  const diagnosis = platforms.length > 0 ? diagnosePerformance(project.title, { retentionRate: weightedRetention(platforms), platforms }) : null;

  return (
    <section className="card stack" style={{ gap: 20 }}>
      <div className="stack" style={{ gap: 4 }}>
        <h2 style={{ margin: 0 }}>3. 数字を入れて分析する</h2>
        <p className="muted">公開から1〜2日たったら、各アプリのインサイトの数字を入れてください。保存すると自動で分析します。</p>
      </div>

      {published.map((l) => {
        const m = metric(l.platform);
        const p = l.platform as PlatformType;
        return (
          <div key={l.id} className="stack" style={{ gap: 10, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
            <strong>{PLATFORM_LABEL[p]}</strong>
            {p === 'youtube' && l.externalId && (
              <ActionButton action={collectYouTubeMetrics.bind(null, project.id)} label="YouTube から自動で取得する" pendingLabel="取得中…" />
            )}
            <ActionForm action={saveMetrics.bind(null, project.id)} submitLabel="保存して分析する">
              <input type="hidden" name="platform" value={p} />
              <div className="grid2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))' }}>
                {[
                  ['views', '再生数（必須）', m?.views],
                  ['likes', 'いいね', m?.likes],
                  ['comments', 'コメント', m?.comments],
                  ['shares', 'シェア', m?.shares],
                  ['retention', '視聴維持率 %（任意）', m?.retentionRate],
                ].map(([name, label, value]) => (
                  <div key={name as string} className="field">
                    <label>{label as string}</label>
                    <input className="input" name={name as string} inputMode="decimal" defaultValue={value ?? ''} />
                  </div>
                ))}
              </div>
            </ActionForm>
          </div>
        );
      })}

      {diagnosis && (
        <div className="stack" style={{ gap: 8, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <strong>分析</strong>
          <p>{diagnosis.summary}</p>
          {[...diagnosis.strengths.map((s) => `+ ${s}`), ...diagnosis.weaknesses.map((w) => `- ${w}`)].map((t) => (
            <p key={t} className="lead">{t}</p>
          ))}
          <p className="muted">
            {diagnosis.actionableKnowledge
              ? '知見として保存し、次の台本づくりに使います。'
              : '再生数が1,000回未満のため、知見にはしていません。'}
          </p>
        </div>
      )}
    </section>
  );
}

function ScriptSection({ project }: { project: ProjectWithAll }) {
  const lines = safeJson<ScriptLine[]>(project.shortClips[0]?.scriptJson, []);
  if (lines.length === 0) return null;
  return (
    <section className="card">
      <h2>台本</h2>
      <table>
        <thead>
          <tr><th>#</th><th>字幕</th><th>読み上げ</th></tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className="muted">{i + 1}</td>
              <td style={{ whiteSpace: 'pre-line', fontWeight: 600 }}>{l.caption ?? l.text}</td>
              <td className="lead">{l.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function SourcesSection({ project }: { project: ProjectWithAll }) {
  const sources = safeJson<{ title: string; url: string }[]>(project.trendResearch?.sourcesJson, []);
  return (
    <section className="card">
      <h2>出典</h2>
      {project.trendResearch?.summary && <p className="lead" style={{ marginBottom: 12 }}>{project.trendResearch.summary}</p>}
      {sources.length === 0 ? (
        <p className="muted">出典が登録されていません。</p>
      ) : (
        <ul style={{ paddingLeft: 20 }}>
          {sources.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-strong)' }}>{s.title}</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
