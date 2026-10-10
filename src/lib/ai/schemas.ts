// AI に返させる JSON の形（JSON Schema）。Claude Code・Claude API・Gemini API で共用する。
// Claude API の構造化出力は、すべての object に additionalProperties: false が必要で、配列の個数などの制約は使えない
// （個数は受け取った後に検証する）。Gemini には toGeminiSchema で変換して渡す。
import { MOODS } from '../../../remotion/types';

type Schema = Record<string, unknown>;

const str: Schema = { type: 'string' };
const num: Schema = { type: 'number' };
const strArray: Schema = { type: 'array', items: str };
const nullable = (s: Schema): Schema => ({ anyOf: [s, { type: 'null' }] });

/** additionalProperties: false の object。required に無い項目は省略してよい */
export function obj(properties: Record<string, Schema>, required: string[] = Object.keys(properties)): Schema {
  return { type: 'object', properties, required, additionalProperties: false };
}

const tag = (t: string): Schema => ({ type: 'string', enum: [t] });

// remotion/types.ts の ChatReply / Scene と同じ形
const CHAT_REPLY: Schema = {
  anyOf: [
    obj({ type: tag('text'), text: str }),
    obj({ type: tag('table'), headers: strArray, rows: { type: 'array', items: strArray } }),
    obj({ type: tag('bill'), total: num, people: num }),
    obj({ type: tag('chart'), title: str, bars: { type: 'array', items: obj({ label: str, value: num }) } }, ['type', 'bars']),
    obj({ type: tag('calculator'), expression: str, result: str }),
  ],
};

export const SCENE_SCHEMA: Schema = {
  anyOf: [
    obj({ type: tag('hook'), text: str, sub: str }, ['type', 'text']),
    obj({ type: tag('keyword'), label: str, text: str }, ['type', 'text']),
    obj({ type: tag('compare'), left: obj({ label: str, body: str }), right: obj({ label: str, body: str }) }),
    obj({ type: tag('chat'), user: str, reply: CHAT_REPLY }),
    obj({ type: tag('timeline'), title: str, steps: { type: 'array', items: obj({ label: str, detail: str }, ['label']) } }, ['type', 'steps']),
    obj({ type: tag('chips'), title: str, items: strArray }, ['type', 'items']),
    obj({ type: tag('select'), title: str, options: strArray, selected: { type: 'integer' } }, ['type', 'options']),
    obj({ type: tag('outro'), text: str }, ['type']),
  ],
};

export const SCRIPT_LINE_SCHEMA: Schema = obj(
  { text: str, caption: str, emphasis: strArray, mood: { type: 'string', enum: MOODS }, scene: SCENE_SCHEMA },
  ['text']
);

const lines: Schema = { type: 'array', items: SCRIPT_LINE_SCHEMA };

/** 構成案の相談の答え */
export const WORKSHOP_CHAT_SCHEMA = obj({ reply: str, revisedBody: nullable(str), sampleTopic: nullable(str) });

/** 構成案の試作の答え */
export const WORKSHOP_SAMPLE_SCHEMA = obj({ title: str, note: str, lines });

/** 動画編集の手直しの答え */
export const EDIT_SCHEMA = obj({ reply: str, title: nullable(str), lines: nullable(lines) });

/**
 * 動画づくりの依頼の「台本」の工程の答え（agent/cli.ts の project:create に渡す形。trendId は受け取った後に足す）。
 * 制作の設定に「おまかせ」があれば、その分を produce として選択肢の中から選ばせる
 */
export function projectSchema(auto: { voice?: string[]; speed?: string[]; bgm?: string[] }): Schema {
  const choices = Object.fromEntries(Object.entries(auto).filter(([, v]) => v && v.length > 0).map(([k, v]) => [k, { type: 'string', enum: v }]));
  if (Object.keys(choices).length === 0) return PROJECT_SCHEMA;
  const base = PROJECT_SCHEMA as { properties: Record<string, Schema>; required: string[] };
  return obj({ ...base.properties, produce: obj(choices) });
}

export const PROJECT_SCHEMA = obj({
  title: str,
  concept: str,
  lines,
  publish: obj({
    youtube: obj({ title: str, description: str, tags: strArray }),
    tiktok: obj({ caption: str, tags: strArray }),
    instagram: obj({ caption: str, tags: strArray }),
    x: obj({ text: str }),
  }),
});

/** 接続テストの答え */
export const PING_SCHEMA = obj({ reply: str });

/**
 * Gemini API（generateContent の responseSchema）向けに変換する。OpenAPI の部分集合のため、
 * null を含む anyOf は nullable に、additionalProperties は外す。
 */
export function toGeminiSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const s = schema as Schema;
  if (Array.isArray(s.anyOf)) {
    const variants = s.anyOf as Schema[];
    const nonNull = variants.filter((v) => v.type !== 'null');
    if (nonNull.length < variants.length) {
      const base = nonNull.length === 1 ? (toGeminiSchema(nonNull[0]) as Schema) : { anyOf: nonNull.map(toGeminiSchema) };
      return { ...base, nullable: true };
    }
  }
  const out: Schema = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'additionalProperties') continue;
    out[k] = typeof v === 'object' ? toGeminiSchema(v) : v;
  }
  return out;
}
