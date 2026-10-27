/** Pluralização simples em pt-BR usada nos textos de alerta do painel admin. */
export function countPt(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}
