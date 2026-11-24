export const lessons = [
  { id: 'can-run', target: 'I can run.', meaning: '我會跑步。', difficulty: 1,
    hint: '想像沿著竹林小徑跑步。試著一口氣念完。', context: 'stone', exp: 8 },
  { id: 'can-jump', target: 'I can jump.', meaning: '我會跳躍。', difficulty: 1,
    hint: '想到「跳」時，注意最後一個字。', context: 'optional', exp: 8 },
  { id: 'can-fight', target: 'I can fight.', meaning: '我會戰鬥。', difficulty: 1,
    hint: '想像影空在石陣練劍。', context: 'optional', exp: 8 },
  { id: 'my-sword', target: 'This is my sword.', meaning: '這是我的劍。', difficulty: 2,
    hint: '像是在向長老介紹你的劍。可以先聽慢速。', context: 'elder', exp: 10 },
  { id: 'am-ready', target: 'I am ready.', meaning: '我準備好了。', difficulty: 1,
    hint: '出發前，告訴長老你準備好了。', context: 'elder', exp: 8 },
  { id: 'strong-wind', target: 'The wind is strong.', meaning: '風很強。', difficulty: 2,
    hint: '想像竹葉被風吹動。可以先聽慢速。', context: 'stone', exp: 10 },
] as const;

export type Lesson = typeof lessons[number];
export type LessonId = Lesson['id'];
export const englishLocale = 'en-US';

export function recommendLesson(context: 'elder' | 'stone', completed: (id: LessonId) => boolean): LessonId {
  return (lessons.find(lesson => lesson.context === context && !completed(lesson.id))
    ?? lessons.find(lesson => lesson.context === context) ?? lessons[0]).id;
}
