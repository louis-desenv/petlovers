/**
 * Utilitários de higienização de texto e profilaxia contra caracteres corrompidos
 */

export function cleanPortugueseText(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/\bd!!a\b/gi, "dá")
    .replace(/\bd!!\b/gi, "dá")
    .replace(/\bT!!o\b/g, "Tão")
    .replace(/\bt!!o\b/g, "tão")
    .replace(/\bvoc!!\b/gi, "você")
    .replace(/\bc!!ozinho\b/gi, "cãozinho")
    .replace(/\bc!!es\b/gi, "cães")
    .replace(/\bc!!o\b/gi, "cão")
    .replace(/\bxod!!\b/gi, "xodó")
    .replace(/\best!!o\b/gi, "estão")
    .replace(/\best!!\b/gi, "está")
    .replace(/\bs!!o\b/gi, "são")
    .replace(/\bn!!o\b/gi, "não")
    .replace(/\btamb!!m\b/gi, "também")
    .replace(/\bat!!\b/gi, "até")
    .replace(/\bol!!\b/gi, "olá")
    .replace(/\bj!!\b/gi, "já")
    .replace(/\bs!!\b/gi, "só")
    .replace(/\btr!!s\b/gi, "três")
    .replace(/\bqu!!\b/gi, "quê")
    .replace(/\bqual !!\b/gi, "qual é")
    .replace(/\bque !!\b/gi, "que é")
    .replace(/ !! /g, " é ")
    .replace(/^!! /g, "É ")
    .replace(/ !!$/g, " é")
    .replace(/cora!!o/gi, "coração")
    .replace(/a!!o/gi, "ação")
    .replace(/!!a/g, "á")
    .replace(/!!o/g, "ão")
    .replace(/!!e/g, "ê")
    .replace(/!!i/g, "í")
    .replace(/!!u/g, "ú")
    .replace(/!!/g, "é");
}
