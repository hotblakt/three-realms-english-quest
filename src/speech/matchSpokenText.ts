const fillers = new Set(['um', 'uh', 'erm']);

function words(text: string): string[] {
  return (text.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'")
    .match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? []).filter(word => !fillers.has(word));
}

export function matchesSpokenText(transcript: string, target: string): boolean {
  const expected = words(target);
  const heard = words(transcript);
  return expected.length > 0 && expected.length === heard.length
    && expected.every((word, index) => word === heard[index]);
}
