import fs from 'fs';
import { Readable } from 'stream';
import { resolveMediaPath } from '@/lib/storage';

// data/projects/<id>/ の動画とサムネイルを返す。管理画面のプレーヤーと、Instagram が取りに来る動画 URL に使う。
// シークと再生開始を速くするため Range リクエストに応える。
const TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg' };

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const file = resolveMediaPath(segments.join('/'));
  if (!file || !fs.existsSync(file)) return new Response('Not Found', { status: 404 });

  const size = fs.statSync(file).size;
  const headers: Record<string, string> = {
    'Content-Type': TYPES[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache',
  };

  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
  if (range && (range[1] || range[2])) {
    // "bytes=-N" は末尾 N バイト
    const start = range[1] ? Number(range[1]) : Math.max(size - Number(range[2]), 0);
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
    });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)) as ReadableStream, {
    headers: { ...headers, 'Content-Length': String(size) },
  });
}
