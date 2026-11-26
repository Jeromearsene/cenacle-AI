/** Account ids are used in file names (session partitions) and in messages: keep them plain. */
export const ID_RE = /^[\w-]{1,32}$/;

export const isId = (v: unknown): v is string => typeof v === 'string' && ID_RE.test(v);
