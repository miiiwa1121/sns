import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { safeJson } from '@/lib/json';
import type { ScriptLine } from '@/lib/script';
import { mediaExists, mediaUrlPath, thumbRelPath } from '@/lib/storage';
import { editBlockedReason, renderProgress } from '@/lib/services/editService';
import { renderProject, saveProjectScript, sendEditChat, stopProjectWork } from '@/app/actions';
import { AutoRefresh } from '../../../jobs/[id]/client';
import { ChatScroll } from '@/app/components/workspace';
import { ChatForm } from '@/app/components/chat';
import { VideoEditor } from './editor';

// 動画編集画面（企画の「1. 動画を確認する」から）
export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      account: { include: { platformConnections: true } },
      shortClips: true,
      editMessages: { orderBy: { createdAt: 'asc' } },
    },
  });
  const clip = project?.shortClips[0];
  if (!project || !clip) notFound();

  const lines = safeJson<ScriptLine[]>(clip.scriptJson, []);
  const rendering = clip.renderStatus === 'rendering';
  const chatBusy = project.editMessages.some((m) => m.status === 'pending');
  const video = clip.renderedFilePath && mediaExists(clip.renderedFilePath) ? clip.renderedFilePath : null;
  const handle = project.account.platformConnections.find((c) => c.platform === 'youtube')?.handle ?? '';
  const blockedReason = await editBlockedReason(project.id);

  return (
    <>
      <AutoRefresh active={rendering || chatBusy} interval={2000} />
      <VideoEditor
        // 保存・AI の手直し・作り直しで中身が変わったら、編集中の状態を作り直す
        key={`${clip.updatedAt.toISOString()}-${project.updatedAt.toISOString()}`}
        projectId={project.id}
        initialTitle={project.title}
        initialLines={lines}
        brandName={project.account.name}
        handle={handle}
        videoUrl={video ? mediaUrlPath(video) : null}
        posterUrl={video ? mediaUrlPath(thumbRelPath(video)) : null}
        outdated={Boolean(clip.renderedScriptJson && clip.renderedScriptJson !== clip.scriptJson)}
        rendering={rendering}
        renderProgress={rendering ? renderProgress(project.id) : null}
        renderError={clip.renderStatus === 'failed' ? clip.renderError : null}
        chatBusy={chatBusy}
        blockedReason={blockedReason}
        save={saveProjectScript.bind(null, project.id)}
        render={renderProject.bind(null, project.id)}
        stop={stopProjectWork.bind(null, project.id)}
        chat={
          <>
            <ChatScroll count={project.editMessages.map((m) => `${m.id}:${m.status}`).join(',')}>
              {project.editMessages.length === 0 && (
                <p className="muted">直したいことを伝えてください。AI が台本を直します（例: 「3行目を短く」「最後をもっと前向きに」）。直した内容は左の台本に入り、中央のプレビューで確かめられます。</p>
              )}
              {project.editMessages.map((m) => (
                <div key={m.id} className={`bubble ${m.role}`}>
                  {m.status === 'pending' && <span className="muted">直しています…</span>}
                  {m.status === 'failed' && <span className="notice ng">うまくいきませんでした: {m.error}</span>}
                  {m.status === 'canceled' && <span className="muted">止めました</span>}
                  {m.status === 'done' && <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>}
                  {m.linesJson && <span className="muted" style={{ display: 'block', marginTop: 4 }}>台本を直しました</span>}
                </div>
              ))}
            </ChatScroll>
            <ChatForm action={sendEditChat.bind(null, project.id)} disabled={chatBusy || rendering || blockedReason !== null} placeholder="例: 3行目を短くして / 最後の行をもっと前向きに" />
          </>
        }
      />
    </>
  );
}
