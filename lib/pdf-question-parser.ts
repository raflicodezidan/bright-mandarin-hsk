export type ImportedChoiceDraft = {
  kind: "multiple_choice";
  sourceNumber: number;
  prompt: string;
  options: { label: string; text: string; imageDataUrl?: string | null }[];
  correctLabel: string;
  warning: string | null;
};

export type ImportedBlankDraft = {
  kind: "hanzi_blank";
  sourceNumber: number;
  prompt: string;
  choices: { label: string; text: string }[];
  correctLabel: string;
  warning: string | null;
};

export type ImportedMatchingDraft = {
  kind: "matching";
  sourceNumber: number;
  prompt: string;
  leftItems: { id: string; text: string }[];
  rightItems: { id: string; text: string }[];
  matches: Record<string, string>;
  warning: string | null;
};

export type ImportedQuestionDraft =
  | ImportedChoiceDraft
  | ImportedBlankDraft
  | ImportedMatchingDraft;

type Section = "hanzi_blank" | "multiple_choice" | "matching" | "rearrange";

const QUESTION_START = /^\s*(\d{1,3})\s*[.)、]\s*(.*)$/u;
const OPTION_START = /^\s*([A-Ea-e])\s*[.、)]\s*(.+)$/u;
const MATCH_RIGHT_START = /^\s*([A-Fa-f])\s*[.、)]\s*(.+)$/u;
const WORD_BANK_ITEM = /(?:^|\s)([a-f])\s*[.、)]\s*(.+?)(?=\s+[a-f]\s*[.、)]|$)/giu;
const ANSWER_KEY_LINE = /^(?:answer\s*key|答案|参考答案|听力答案|reading answer)/iu;

function compactCjk(text: string): string {
  return text
    .replace(/\s*\{\{blank\}\}\s*/gu, "{{blank}}")
    .replace(/\s*\*\s*/gu, "*")
    .replace(
      /(?<=[\p{Script=Han}，。！？、；：”’）】》])\s+(?=[\p{Script=Han}，。！？、；： “‘（【《])/gu,
      "",
    );
}

function clean(text: string): string {
  return compactCjk(text.replace(/\s+/gu, " ").trim());
}

function stripPinyin(text: string): string {
  return text
    .replace(/\s*[（(]([^（）()]*)[）)]\s*$/u, (full, inner: string) =>
      /[A-Za-z]/.test(inner) ? "" : full,
    )
    .trim();
}

function normalizeBlank(text: string): string {
  return text
    .replace(/[_＿]{2,}/gu, "{{blank}}")
    .replace(/[（(]\s*[）)]/gu, "{{blank}}")
    .replace(/\{\{\s*blank\s*\}\}/giu, "{{blank}}");
}

function stripBlank(text: string): string {
  return text
    .replace(/[_＿]{2,}/gu, "")
    .replace(/[（(]\s*[）)]/gu, "")
    .trim();
}

function sectionOf(line: string): Section | null {
  if (
    /^\s*(?:[IVX]+[.)、]?\s*)?(?:选词填空)/u.test(line) ||
    /fill in each blank/i.test(line)
  ) {
    return "hanzi_blank";
  }
  if (
    /^\s*(?:[IVX]+[.)、]?\s*)?(?:匹配句子)/u.test(line) ||
    /match the sentences/i.test(line)
  ) {
    return "matching";
  }
  if (
    /^\s*(?:[IVX]+[.)、]?\s*)?(?:连词成句|排列句子)/u.test(line) ||
    /rearrange/i.test(line)
  ) {
    return "rearrange";
  }
  if (
    /^\s*(?:[IVX]+[.)、]?\s*)?(?:选择正确答案)/u.test(line) ||
    /choose the correct answer for each question/i.test(line)
  ) {
    return "multiple_choice";
  }
  return null;
}

function parseWordBank(line: string): { label: string; text: string }[] | null {
  const matches = [...line.matchAll(WORD_BANK_ITEM)];
  if (matches.length < 2) return null;
  return matches
    .map((match) => ({
      label: match[1].toLowerCase(),
      text: clean(stripPinyin(match[2])),
    }))
    .filter((item) => item.text.length > 0);
}

export function parseReadingPdfLines(lines: string[]): ImportedQuestionDraft[] {
  const drafts: ImportedQuestionDraft[] = [];
  let section: Section | null = null;
  let wordBank: { label: string; text: string }[] = [];
  let inAnswerKey = false;

  let blank: { number: number; prompt: string } | null = null;
  let choice: {
    number: number;
    prompt: string;
    options: { label: string; text: string }[];
  } | null = null;
  let matching: {
    prompt: string;
    left: { number: number; text: string }[];
    right: { label: string; text: string }[];
  } | null = null;

  function flush() {
    if (blank) {
      const prompt = normalizeBlank(clean(blank.prompt));
      if (prompt && wordBank.length >= 2) {
        drafts.push({
          kind: "hanzi_blank",
          sourceNumber: blank.number,
          prompt,
          choices: wordBank.map((item) => ({ ...item })),
          correctLabel: "",
          warning: "Isi kunci jawaban setelah soal dibuat.",
        });
      }
      blank = null;
    }

    if (choice) {
      const prompt = clean(stripPinyin(choice.prompt));
      const options = choice.options
        .map((option) => ({
          label: option.label.toUpperCase(),
          text: clean(stripPinyin(option.text)),
        }))
        .filter((option) => option.text.length > 0);
      if (prompt && options.length >= 2 && options.length <= 5) {
        drafts.push({
          kind: "multiple_choice",
          sourceNumber: choice.number,
          prompt,
          options,
          correctLabel: "",
          warning: "Isi kunci jawaban setelah soal dibuat.",
        });
      }
      choice = null;
    }

    if (matching) {
      const leftItems = matching.left
        .map((item) => ({
          id: `left-${item.number}`,
          text: clean(stripPinyin(item.text)),
        }))
        .filter((item) => item.text.length > 0);
      const rightItems = matching.right
        .map((item) => ({
          id: `right-${item.label.toLowerCase()}`,
          text: clean(stripPinyin(item.text)),
        }))
        .filter((item) => item.text.length > 0);

      if (leftItems.length >= 2 && rightItems.length >= 2) {
        const first = matching.left[0]?.number;
        const last = matching.left[matching.left.length - 1]?.number;
        const range =
          first !== undefined && last !== undefined ? ` (${first}–${last})` : "";
        drafts.push({
          kind: "matching",
          sourceNumber: first ?? 0,
          prompt: `${clean(matching.prompt)}${range}`,
          leftItems,
          rightItems,
          matches: {},
          warning: "Isi kunci pasangan setelah soal dibuat.",
        });
      }
      matching = null;
    }
  }

  for (const rawLine of lines) {
    const line = clean(rawLine);
    if (!line) continue;

    if (ANSWER_KEY_LINE.test(line)) {
      flush();
      inAnswerKey = true;
      continue;
    }
    if (inAnswerKey) continue;
    if (/^(?:name\s*\/|class\s*\/|date\s*\/|bright mandarin\b)/iu.test(line)) {
      continue;
    }

    const nextSection = sectionOf(line);
    if (nextSection) {
      flush();
      section = nextSection;
      if (section === "hanzi_blank") {
        wordBank = [];
      }
      if (section === "matching") {
        matching = { prompt: line, left: [], right: [] };
      }
      continue;
    }

    if (section === "hanzi_blank") {
      const bank = parseWordBank(line);
      if (bank) {
        wordBank = bank;
        continue;
      }
      const questionMatch = line.match(QUESTION_START);
      if (questionMatch) {
        flush();
        blank = { number: Number(questionMatch[1]), prompt: questionMatch[2] };
        continue;
      }
      if (blank) {
        blank.prompt = `${blank.prompt} ${line}`;
      }
      continue;
    }

    if (section === "multiple_choice") {
      const questionMatch = line.match(QUESTION_START);
      if (questionMatch) {
        flush();
        choice = {
          number: Number(questionMatch[1]),
          prompt: questionMatch[2],
          options: [],
        };
        continue;
      }
      if (choice) {
        const optionMatch = line.match(OPTION_START);
        if (optionMatch) {
          choice.options.push({
            label: optionMatch[1].toUpperCase(),
            text: optionMatch[2],
          });
        } else if (choice.options.length > 0) {
          const last = choice.options[choice.options.length - 1];
          last.text = `${last.text} ${line}`;
        } else {
          choice.prompt = `${choice.prompt} ${line}`;
        }
      }
      continue;
    }

    if (section === "matching" && matching) {
      const questionMatch = line.match(QUESTION_START);
      if (questionMatch) {
        matching.left.push({
          number: Number(questionMatch[1]),
          text: stripBlank(questionMatch[2]),
        });
        continue;
      }
      const rightMatch = line.match(MATCH_RIGHT_START);
      if (rightMatch) {
        matching.right.push({
          label: rightMatch[1].toUpperCase(),
          text: rightMatch[2],
        });
        continue;
      }
      if (matching.left.length > 0) {
        const last = matching.left[matching.left.length - 1];
        last.text = `${last.text} ${line}`;
      } else if (matching.right.length > 0) {
        const last = matching.right[matching.right.length - 1];
        last.text = `${last.text} ${line}`;
      }
      continue;
    }
  }

  flush();
  return drafts;
}
