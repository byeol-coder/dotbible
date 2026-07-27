#!/usr/bin/env node
/* ============================================================
   vendor-liblouis.mjs — liblouis 브라우저 번들 내려받기

   liblouis/js-build 저장소에서 emscripten 빌드와 필요한 테이블만
   골라 vendor/liblouis/ 에 넣는다. 테이블 472개를 통째로 담으면
   3.7MB가 되므로, 쓰는 테이블에서 include를 재귀로 따라가
   실제 의존만 가져온다.

   빌드 파일에는 한 가지 손을 댄다. 원본은 끝에서
     liblouisBuild = liblouisBuild();
   로 스스로를 호출해버려 힙 크기를 지정할 수 없다. 기본 힙으로는
   ko-2006-g2 컴파일 중 메모리가 모자라 abort 한다. 그 줄을 떼고
   팩토리 함수를 window에 남겨, 앱이 TOTAL_MEMORY를 주고 부르게 한다.

   사용: node tools/vendor-liblouis.mjs
   ============================================================ */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RAW  = "https://raw.githubusercontent.com/liblouis/js-build/master/";
const OUT  = join("vendor", "liblouis");
const BUILD = "build-no-tables-utf32.js";

/* index.html TRANSLATIONS[].louis 와 일치해야 한다 */
const ROOTS = [
  "unicode.dis",        // 출력 문자를 점자 유니코드로
  "ko-2006-g2.ctb",     // 한국어 2종(약자)
  "en-ueb-g2.ctb",      // 영어 UEB Grade 2
  "es-g1.ctb",          // 스페인어
  "fr-bfu-g2.ctb",      // 프랑스어
  "zh-tw.ctb"           // 중국어(번체)
];

const cache = new Map();
async function grab(name){
  if(cache.has(name)) return cache.get(name);
  const res = await fetch(RAW + "tables/" + name);
  const body = res.ok ? await res.text() : null;
  cache.set(name, body);
  return body;
}

/* 테이블 안의 `include <파일>` 을 재귀로 따라간다 */
async function closure(roots){
  const seen = new Set(), queue = [...roots];
  while(queue.length){
    const name = queue.shift();
    if(seen.has(name)) continue;
    const body = await grab(name);
    if(body == null){ console.warn(`  ⚠ 테이블 없음: ${name}`); continue; }
    seen.add(name);
    for(const m of body.matchAll(/^\s*include\s+([^\s#]+)/gm))
      if(!seen.has(m[1])) queue.push(m[1]);
  }
  return seen;
}

await mkdir(join(OUT, "tables"), { recursive: true });

process.stdout.write("빌드 내려받는 중 … ");
const res = await fetch(RAW + BUILD);
if(!res.ok) throw new Error(`${BUILD} 실패 (${res.status})`);
let js = await res.text();
console.log(`${(js.length/1048576).toFixed(1)}MB`);

const before = js.length;
js = js.replace(/liblouisBuild\s*=\s*liblouisBuild\(\)\s*;?\s*$/, "");
if(js.length === before) throw new Error("자동 호출 구문을 찾지 못했습니다. 원본 형식이 바뀌었는지 확인하세요.");
js += "\ntry{ window.liblouisBuild = liblouisBuild; }catch(e){}\n";
await writeFile(join(OUT, BUILD), js);

/* 번역본마다 필요한 테이블만 받게 하려고 루트별 의존 목록을 따로 낸다.
   전부 받으면 2.5MB인데, 한 언어는 대개 그 일부면 된다. */
process.stdout.write("테이블 의존 계산 중 … ");
const base = await closure(["unicode.dis"]);
const manifest = { build: BUILD, heapMB: 128, tables: {} };
for(const root of ROOTS){
  if(root === "unicode.dis") continue;
  const dep = await closure([root, "unicode.dis"]);
  manifest.tables[root] = [...dep];
}
const files = await closure(ROOTS);
console.log(`${files.size}개`);

let bytes = 0;
const size = {};
for(const name of files){
  const body = cache.get(name);
  await writeFile(join(OUT, "tables", name), body);
  size[name] = body.length;
  bytes += body.length;
}
for(const [root, dep] of Object.entries(manifest.tables)){
  const kb = dep.reduce((a,n)=>a+(size[n]||0),0)/1024;
  console.log(`  ${root.padEnd(18)} ${String(dep.length).padStart(2)}개 · ${kb.toFixed(0)}KB`);
}
await writeFile(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));

await writeFile(join(OUT, "README.md"),
`# vendor/liblouis

\`tools/vendor-liblouis.mjs\` 가 생성합니다. 직접 고치지 마세요.

- 원본: https://github.com/liblouis/js-build (liblouis ${"3.38"} 계열)
- 라이선스: liblouis 는 LGPL-2.1+, 테이블은 각 파일 상단 표기를 따릅니다.
- 빌드 파일은 끝의 \`liblouisBuild = liblouisBuild();\` 자동 호출을 제거하고
  \`window.liblouisBuild\` 팩토리를 노출하도록 수정했습니다. 앱이 힙 크기를
  지정해 호출해야 하기 때문입니다(기본 힙으로는 ko-2006-g2 컴파일이 실패).

테이블 ${files.size}개 · ${(bytes/1024).toFixed(0)}KB
`);

console.log(`\n완료 · ${OUT}/ · 빌드 ${(js.length/1048576).toFixed(1)}MB + 테이블 ${(bytes/1024).toFixed(0)}KB`);
