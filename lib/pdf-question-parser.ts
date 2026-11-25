export type ImportedQuestionDraft = {
  sourceNumber: number;
  prompt: string;
  options: { label: string; text: string }[];
  correctLabel: string;
  warning: string | null;
};

const QUESTION_START = /^\s*(\d{1,3})\s*[.)、]\s*(.*)$/u;
const OPTION_START = /^\s*([A-Ea-e])\s*[.、)]\s*(.+)$/u;
const ANSWER_KEY_LINE = /^(?:answer\s*key|答案|参考答案|听力答案|reading answer)/iu;

export function parseReadingPdfLines(lines: string[]): ImportedQuestionDraft[] {
  const drafts: ImportedQuestionDraft[] = [];
  let current: { number: number; prompt: string; options: { label: string; text: string }[] } | null = null;
  let answerKeyPage = false;

  const flush = () => {
    if (!current) return;
    const prompt = current.prompt.replace(/\s+/gu, " ").trim();
    const options = current.options.map((option) => ({
      label: option.label.toUpperCase(),
      text: option.text.replace(/\s+/gu, " ").trim(),
    }));
    if (prompt && options.length >= 2 && options.length <= 5) {
      drafts.push({
        sourceNumber: current.number,
        prompt,
        options,
        correctLabel: "",
        warning: "Pilih kunci jawaban yang benar. Kunci dari halaman jawaban tidak diimpor.",
      });
    }
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (ANSWER_KEY_LINE.test(line)) {
      flush();
      answerKeyPage = true;
      continue;
    }
    if (answerKeyPage) continue;
    if (/^\s*(?:name\s*\/|class\s*\/|date\s*\/|bright mandarin\b)/iu.test(line)) continue;
    if (/^(?:[IVX]+[.)]?\s+)?(?:[\p{Script=Han}].*\bmatch\s+the\s+sentences|match\s+the\s+sentences)/iu.test(line)) {
      flush();
      continue;
    }

    const questionMatch = line.match(QUESTION_START);
    if (questionMatch) {
      flush();
      current = {
        number: Number(questionMatch[1]),
        prompt: questionMatch[2],
        options: [],
      };
      continue;
    }

    if (!current) continue;
    const optionMatch = line.match(OPTION_START);
    if (optionMatch) {
      current.options.push({
        label: optionMatch[1].toUpperCase(),
        text: optionMatch[2],
      });
      continue;
    }

    // PDF.js can split a question or option across visual lines. Append to the
    // active option if one has started; otherwise keep it in the prompt.
    if (current.options.length > 0) {
      const last = current.options[current.options.length - 1];
      last.text = `${last.text} ${line}`;
    } else {
      current.prompt = `${current.prompt} ${line}`;
    }
  }
  flush();
  return drafts;
}
