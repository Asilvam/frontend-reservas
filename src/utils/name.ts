export const NAME_SPAM_REGEX = /([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ])\1{3,}/i;

export function hasRepetitiveSpam(text: string): boolean {
  return NAME_SPAM_REGEX.test(text);
}
