const COMBINING_MARKS = /[̀-ͯ]/g;

export function normalizeText(input: string): string {
  return input.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}
