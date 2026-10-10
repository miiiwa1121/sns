// 1行壊れた JSON で画面全体が落ちないよう、パース失敗時は fallback を返す
export function safeJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}
