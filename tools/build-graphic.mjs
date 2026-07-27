#!/usr/bin/env node
/* ============================================================
   build-graphic.mjs — DTMS 저작 툴 산출물(.dtma) → 핵심 그래픽 스키마

   .dtma는 ZIP 컨테이너다. 안에 <제목>.dtms(JSON 메타데이터)와
   audio_N.mp3(페이지별 실제 녹음 내레이션)가 들어 있다.

   dtms의 items[].graphic.data는 이미 600자 dotpad320 hex라 트랜스코딩
   없이 그대로 쓴다. items[].text.plain을 alt로, 선행 절 번호가 있으면
   verse 앵커로 뽑는다(추정이라 없으면 null — 억지로 만들지 않는다).

   전체 66권 1189장에 적용하는 파이프라인이 아니다. 선별한 몇 개
   챕터에만 붙이는 opt-in 기능이라, bible/build-bible.mjs와 달리
   챕터 하나씩 수동으로 돌린다.

   사용
     node tools/build-graphic.mjs Jonah01.dtma 32-1
     (32 = 요나서 책 번호, 1 = 1장 — BOOKS 배열의 순번을 따른다)
   ============================================================ */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const [, , src, key] = process.argv;
if (!src || !key || !/^\d+-\d+$/.test(key)) {
  console.error("사용법: node tools/build-graphic.mjs <파일.dtma> <bookId>-<chapter>");
  console.error("예시:   node tools/build-graphic.mjs Jonah01.dtma 32-1");
  process.exit(1);
}
if (!existsSync(src)) { console.error(`파일 없음: ${src}`); process.exit(1); }

const tmp = join("/tmp", "dtma-" + Date.now());
mkdirSync(tmp, { recursive: true });
execFileSync("unzip", ["-o", "-q", src, "-d", tmp]);

const dtmsName = readdirSync(tmp).find(f => f.endsWith(".dtms"));
if (!dtmsName) throw new Error(".dtms 파일을 찾지 못했습니다 — 저작 툴 산출물이 맞는지 확인하세요");

const doc = JSON.parse(readFileSync(join(tmp, dtmsName), "utf8"));
if (!Array.isArray(doc.items) || !doc.items.length) throw new Error("items가 비어 있습니다");

const outDir = join("bible", "graphics", key);
mkdirSync(outDir, { recursive: true });

let audioCount = 0, badHex = 0;
const pages = doc.items.map((item, i) => {
  const hex = item.graphic?.data || "";
  if (hex.length !== 600) { badHex++; console.warn(`  ⚠ item[${i}]: hex 길이 ${hex.length} (600 아님) — dotpad320 규격 확인 필요`); }

  const audioName = item.audio?.fileName || null;
  if (audioName) {
    const from = join(tmp, audioName);
    if (existsSync(from)) {
      writeFileSync(join(outDir, audioName), readFileSync(from));
      audioCount++;
    } else {
      console.warn(`  ⚠ item[${i}]: 오디오 파일 없음 (${audioName})`);
    }
  }

  const plain = (item.text?.plain || "").trim();
  const m = plain.match(/^(\d+)\s/);   /* 선행 절 번호 — 없으면 null, 추정이라 강제하지 않는다 */
  return { hex, alt: plain, verse: m ? Number(m[1]) : null, audio: audioName };
});

writeFileSync(
  join("bible", "graphics", `${key}.json`),
  JSON.stringify({ title: doc.title || "", source: dtmsName.replace(/\.dtms$/, ""), pages })
);

rmSync(tmp, { recursive: true, force: true });

console.log(`완료 · ${key} · 페이지 ${pages.length}개 · 오디오 ${audioCount}개` + (badHex ? ` · hex 이상 ${badHex}개` : ""));
console.log(`  bible/graphics/${key}.json`);
console.log(`  bible/graphics/${key}/*.mp3`);
