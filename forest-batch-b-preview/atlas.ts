export type AtlasResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export function errorDescription(error: unknown): string {
  return error instanceof Error ? error.message : '未知錯誤';
}

/** Bound the entire optional operation, including a decoder that never settles. */
export async function optionalAtlas<T>(prepare: (signal: AbortSignal) => Promise<T>,
  deadline: number, timeoutMessage = '竹林圖集逾時'): Promise<AtlasResult<T>> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          reject(new Error(timeoutMessage));
          controller.abort();
        }, deadline);
      }),
      prepare(controller.signal),
    ]);
    return { ok: true, value };
  } catch (error) {
    return { ok: false, reason: errorDescription(error) };
  } finally {
    clearTimeout(timer);
  }
}

export function registerOptionalAtlas(register: () => void, validate: () => boolean,
  rollback: () => void): AtlasResult<undefined> {
  try {
    register();
    if (!validate()) throw new Error('圖集缺少必要幀');
    return { ok: true, value: undefined };
  } catch (error) {
    rollback();
    return { ok: false, reason: errorDescription(error) };
  }
}
