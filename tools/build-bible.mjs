#!/usr/bin/env node
/* ============================================================
   build-bible.mjs — open-bibles → Dot Bible 내부 스키마

   공급처 형식(USFX·OSIS)을 그대로 쓰지 않고 앱 공통 구조로
   변환한다. 공개 API에만 의존하면 중단·호출제한에 묶이므로,
   허용된 번역본은 정규화해 배포 폴더에 함께 둔다.

   출력
     bible/<translationId>/<bookId>.json   { "1":["1절",...], "2":[...] }
     bible/LICENSES.md                     번역본별 출처·라이선스 표기

   사용
     node tools/build-bible.mjs                 등록된 전체
     node tools/build-bible.mjs eng-web         특정 번역본만
   ============================================================ */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const RAW = "https://raw.githubusercontent.com/seven1m/open-bibles/master/";

/* index.html의 TRANSLATIONS와 id가 일치해야 한다 */
const SOURCES = {
  "kor-krv":       { file:"kor-korean.osis.xml",    format:"osis",
                     attribution:"성경전서 개역한글판(1961) — 퍼블릭 도메인", license:"Public Domain" },
  "eng-web":       { file:"eng-web.usfx.xml",       format:"usfx",
                     attribution:"World English Bible — Public Domain", license:"Public Domain" },
  "spa-rv1909":    { file:"spa-rv1909.usfx.xml",    format:"usfx",
                     attribution:"Reina Valera 1909 — Public Domain", license:"Public Domain" },
  "fra-ostervald": { file:"fra-ostervald.osis.xml", format:"osis",
                     attribution:"French Ostervald 1996 — Public Domain", license:"Public Domain" },
  "chi-cuv":       { file:"chi-cuv.usfx.xml",       format:"usfx",
                     attribution:"Chinese Union Version — Public Domain", license:"Public Domain" }
};

/* USFM 코드 → 앱의 책 번호(1..66). 개신교 정경 순서 */
const BOOK_IDS = ["GEN","EXO","LEV","NUM","DEU","JOS","JDG","RUT","1SA","2SA","1KI","2KI",
"1CH","2CH","EZR","NEH","EST","JOB","PSA","PRO","ECC","SNG","ISA","JER","LAM","EZK","DAN",
"HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL","MAT","MRK","LUK",
"JHN","ACT","ROM","1CO","2CO","GAL","EPH","PHP","COL","1TH","2TH","1TI","2TI","TIT","PHM",
"HEB","JAS","1PE","2PE","1JN","2JN","3JN","JUD","REV"]
  .reduce((m,c,i)=>(m[c]=i+1,m),{});

/* OSIS 약어 66권 — BOOK_IDS와 같은 순서. 부분 별칭으로 두면
   빠진 권을 조용히 건너뛰게 되므로 전체를 명시한다. */
const OSIS_IDS = ["Gen","Exod","Lev","Num","Deut","Josh","Judg","Ruth","1Sam","2Sam",
"1Kgs","2Kgs","1Chr","2Chr","Ezra","Neh","Esth","Job","Ps","Prov","Eccl","Song","Isa",
"Jer","Lam","Ezek","Dan","Hos","Joel","Amos","Obad","Jonah","Mic","Nah","Hab","Zeph",
"Hag","Zech","Mal","Matt","Mark","Luke","John","Acts","Rom","1Cor","2Cor","Gal","Eph",
"Phil","Col","1Thess","2Thess","1Tim","2Tim","Titus","Phlm","Heb","Jas","1Pet","2Pet",
"1John","2John","3John","Jude","Rev"]
  .reduce((m,c,i)=>(m[c.toLowerCase()]=i+1,m),{});

/* 각주·상호참조는 본문이 아니다. 태그를 벗기기 전에 통째로 걷어낸다.
   (USFX: f·x·fe / OSIS: note) — 안 걷으면 절 안에 주석 문장이 섞인다. */
const strip = (t)=> t
  .replace(/<f\b[\s\S]*?<\/f>/g," ").replace(/<fe\b[\s\S]*?<\/fe>/g," ")
  .replace(/<x\b[\s\S]*?<\/x>/g," ").replace(/<note\b[\s\S]*?<\/note>/g," ");

/* OSIS 원본에는 책 이름이 없다. 그런 번역본만 여기서 채운다.
   USFX는 <h> 에 원어 책 이름이 들어 있어 그대로 뽑아 쓴다. */
const FALLBACK_NAMES = {
  "fra-ostervald":["Genèse","Exode","Lévitique","Nombres","Deutéronome","Josué","Juges","Ruth",
"1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther",
"Job","Psaumes","Proverbes","Ecclésiaste","Cantique des Cantiques","Ésaïe","Jérémie","Lamentations",
"Ézéchiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée","Nahum","Habacuc","Sophonie",
"Aggée","Zacharie","Malachie","Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens",
"2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens",
"2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre",
"2 Pierre","1 Jean","2 Jean","3 Jean","Jude","Apocalypse"],
  "kor-krv":["창세기","출애굽기","레위기","민수기","신명기","여호수아","사사기","룻기","사무엘상",
"사무엘하","열왕기상","열왕기하","역대상","역대하","에스라","느헤미야","에스더","욥기","시편","잠언",
"전도서","아가","이사야","예레미야","예레미야애가","에스겔","다니엘","호세아","요엘","아모스","오바댜",
"요나","미가","나훔","하박국","스바냐","학개","스가랴","말라기","마태복음","마가복음","누가복음",
"요한복음","사도행전","로마서","고린도전서","고린도후서","갈라디아서","에베소서","빌립보서","골로새서",
"데살로니가전서","데살로니가후서","디모데전서","디모데후서","디도서","빌레몬서","히브리서","야고보서",
"베드로전서","베드로후서","요한일서","요한이서","요한삼서","유다서","요한계시록"]
};

const clean = (t)=> strip(t).replace(/<[^>]+>/g," ").replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d))
  .replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"')
  .replace(/&apos;/g,"'").replace(/\s+/g," ").trim();

/* USFX: <book id="GEN"> <c id="1"/> <v id="1"/>본문<ve/> */
function parseUsfx(xml){
  const out = {};
  for(const bm of xml.matchAll(/<book\s+id=["']([A-Z0-9]{3})["'][^>]*>([\s\S]*?)<\/book>/g)){
    const id = BOOK_IDS[bm[1]];
    if(!id) continue;
    const chapters = {};
    let ch = null;
    const body = bm[2];
    const h = body.match(/<h>([^<]+)<\/h>/);
    if(h) (parseUsfx.names ||= {})[id] = clean(h[1]);
    const re = /<c\s+id=["'](\d+)["'][^>]*\/?>|<v\s+id=["']([\d\-,]+)["'][^>]*\/?>([\s\S]*?)(?=<v\s|<ve\s*\/>|<c\s|$)/g;
    for(const m of body.matchAll(re)){
      if(m[1]){ ch = m[1]; chapters[ch] = chapters[ch] || []; continue; }
      if(!ch) continue;
      const text = clean(m[3] || "");
      if(text) chapters[ch].push(text);
    }
    out[id] = chapters;
  }
  return out;
}

/* OSIS: <verse osisID="Gen.1.1">본문</verse> 또는 milestone 형식 */
function parseOsis(xml){
  const out = {};
  const push = (bookRaw, c, v, text)=>{
    const id = OSIS_IDS[String(bookRaw).toLowerCase()];
    if(!id || !text) return;
    out[id] = out[id] || {};
    out[id][c] = out[id][c] || [];
    out[id][c][v-1] = text;
  };
  let n = 0;
  /* 공급처에 따라 속성 따옴표가 ' 또는 " 로 다르다 */
  for(const m of xml.matchAll(/<verse[^>]*osisID=["']([^"']+)["'][^>]*>([\s\S]*?)<\/verse>/g)){
    const [b,c,v] = m[1].split(".");
    push(b, c, +v, clean(m[2])); n++;
  }
  if(n === 0){
    /* milestone 형식 — sID로 열고 eID로 닫는다 */
    const re = /<verse[^>]*sID=["'][^"']*["'][^>]*osisID=["']([^"']+)["'][^>]*\/>([\s\S]*?)<verse[^>]*eID=/g;
    for(const m of xml.matchAll(re)){
      const [b,c,v] = m[1].split(".");
      push(b, c, +v, clean(m[2]));
    }
  }
  /* 빈 칸 메우기 — 절 번호가 비면 뒤 인덱스가 밀린다 */
  for(const bid of Object.keys(out))
    for(const c of Object.keys(out[bid]))
      out[bid][c] = Array.from(out[bid][c], x => x || "");
  return out;
}

async function build(tid){
  const src = SOURCES[tid];
  if(!src) throw new Error("등록되지 않은 번역본: " + tid);
  process.stdout.write(`${tid} … 내려받는 중`);
  const res = await fetch(RAW + src.file);
  if(!res.ok) throw new Error(`${src.file} 내려받기 실패 (${res.status})`);
  const xml = await res.text();
  process.stdout.write(` ${(xml.length/1048576).toFixed(1)}MB · 변환 중`);

  parseUsfx.names = {};
  const books = src.format === "usfx" ? parseUsfx(xml) : parseOsis(xml);

  /* 책 이름 — USFX는 원본에서, OSIS는 표에서 */
  const names = new Array(66).fill("");
  const fb = FALLBACK_NAMES[tid];
  for(let i=1;i<=66;i++)
    names[i-1] = (parseUsfx.names && parseUsfx.names[i]) || (fb ? fb[i-1] : "") || "";
  const dir = join("bible", tid);
  await mkdir(dir, { recursive: true });

  let nb = 0, nv = 0;
  for(const [bid, chapters] of Object.entries(books)){
    const total = Object.values(chapters).reduce((a,c)=>a + c.length, 0);
    if(!total) continue;
    await writeFile(join(dir, `${bid}.json`), JSON.stringify(chapters));
    nb++; nv += total;
  }
  const named = names.filter(Boolean).length;
  if(named) await writeFile(join(dir, "books.json"), JSON.stringify(names));
  console.log(` → ${nb}권 / ${nv}절 / 책이름 ${named}개`);
  if(nb < 60) console.warn(`  ⚠ ${tid}: 책이 ${nb}권뿐입니다. 파서를 확인하세요.`);
  return { tid, books: nb, verses: nv, ...src };
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SOURCES);
const done = [];
for(const t of targets){
  try{ done.push(await build(t)); }
  catch(e){ console.error(`  ✗ ${t}: ${e.message}`); }
}

await mkdir("bible", { recursive: true });
await writeFile("bible/LICENSES.md",
`# 본문 출처와 라이선스

\`tools/build-bible.mjs\`가 생성합니다. 직접 고치지 마세요.
원본: https://github.com/seven1m/open-bibles

| 번역본 | 라이선스 | 표기 문구 | 책 | 절 |
|---|---|---|---|---|
${done.map(d=>`| ${d.tid} | ${d.license} | ${d.attribution} | ${d.books} | ${d.verses} |`).join("\n")}

CC BY 및 CC BY-SA 번역본은 화면에 출처와 라이선스를 반드시 표시해야 합니다.
본문을 수정·요약한 경우 변경 사실을 함께 밝히고, 원 번역본 이름을 그대로
쓰지 마세요. 앱에서는 \`TRANSLATIONS[id].modified\` 를 true로 두면
푸터 표기에 자동으로 반영됩니다.
`);
console.log(`\n완료 · ${done.length}개 번역본 · bible/LICENSES.md 갱신`);
