import { translateText } from "./translate";

type SupaClient = { from: (t: string) => any };
type TaskLike = { id: string; title: string; description: string | null; sourceLanguage: string };

/**
 * 보는 사람 언어(viewerLang)로 태스크 제목/설명을 번역해 적용한 결과 맵 반환.
 * - 작성자 언어와 같으면 번역 안 함
 * - 이미 task_translations에 캐시된 건 재사용, 없는 것만 번역 후 upsert (토큰 절약)
 */
export async function translateTasks(
  admin: SupaClient,
  tasks: TaskLike[],
  viewerLang: string,
): Promise<Map<string, { title: string; description: string | null }>> {
  const result = new Map<string, { title: string; description: string | null }>();
  const ids = tasks.map((t) => t.id);
  if (ids.length === 0 || !viewerLang) return result;

  const { data: existing } = await admin
    .from("task_translations")
    .select("task_id, field, translated_text")
    .in("task_id", ids)
    .eq("target_language", viewerLang);

  const cache = new Map<string, string>(); // `${id}|${field}` -> text
  for (const e of existing || []) cache.set(`${e.task_id}|${e.field}`, e.translated_text);

  const toUpsert: { task_id: string; field: string; target_language: string; translated_text: string }[] = [];
  const jobs: Promise<void>[] = [];

  for (const t of tasks) {
    if (!t.sourceLanguage || t.sourceLanguage === viewerLang) continue;
    const fields: { field: string; text: string }[] = [
      { field: "title", text: t.title || "" },
      { field: "description", text: t.description || "" },
    ];
    for (const { field, text } of fields) {
      if (!text.trim()) continue;
      const key = `${t.id}|${field}`;
      if (cache.has(key)) continue;
      jobs.push(
        translateText(text, t.sourceLanguage, viewerLang).then((tr) => {
          cache.set(key, tr);
          toUpsert.push({ task_id: t.id, field, target_language: viewerLang, translated_text: tr });
        }).catch(() => { /* 번역 실패 시 원문 유지 */ }),
      );
    }
  }

  await Promise.all(jobs);
  if (toUpsert.length > 0) {
    await admin.from("task_translations").upsert(toUpsert, { onConflict: "task_id,field,target_language" });
  }

  for (const t of tasks) {
    result.set(t.id, {
      title: cache.get(`${t.id}|title`) ?? t.title,
      description: cache.has(`${t.id}|description`) ? cache.get(`${t.id}|description`)! : t.description,
    });
  }
  return result;
}
