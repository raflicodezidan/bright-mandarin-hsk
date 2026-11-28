// Acak deterministik dari sebuah seed (misalnya id soal). Urutan hasilnya sama
// di server dan klien sehingga tidak memicu hydration mismatch, tetapi tetap
// tidak menampilkan urutan jawaban yang benar kepada murid.
export function shuffleForSeed<T>(items: T[], seed: string): T[] {
  let state = 0;
  for (let i = 0; i < seed.length; i += 1) {
    state = (Math.imul(state, 31) + seed.charCodeAt(i)) >>> 0;
  }
  const next = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
