import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const source = process.argv[2];
if (!source) throw new Error('Usage: node scripts/generate-vegetable-gifs.mjs <source.png>');
const outDir = path.resolve('public/vegetables');
fs.mkdirSync(outDir, { recursive: true });

function decodePng(file) {
  const b = fs.readFileSync(file);
  let p = 8, w, h, type, data = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p); const kind = b.toString('ascii', p + 4, p + 8);
    const chunk = b.subarray(p + 8, p + 8 + len); p += len + 12;
    if (kind === 'IHDR') { w = chunk.readUInt32BE(0); h = chunk.readUInt32BE(4); type = chunk[9]; }
    if (kind === 'IDAT') data.push(chunk);
    if (kind === 'IEND') break;
  }
  if (type !== 2) throw new Error('Expected an 8-bit RGB PNG');
  const raw = zlib.inflateSync(Buffer.concat(data));
  const stride = w * 3, rgba = new Uint8Array(w * h * 4), prev = new Uint8Array(stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++], row = new Uint8Array(stride);
    for (let x = 0; x < stride; x++) {
      const v = raw[rp++], a = x >= 3 ? row[x - 3] : 0, c = prev[x], d = x >= 3 ? prev[x - 3] : 0;
      let q = v;
      if (filter === 1) q += a;
      else if (filter === 2) q += c;
      else if (filter === 3) q += Math.floor((a + c) / 2);
      else if (filter === 4) { const t = a + c - d, pa = Math.abs(t-a), pb = Math.abs(t-c), pc = Math.abs(t-d); q += pa <= pb && pa <= pc ? a : pb <= pc ? c : d; }
      row[x] = q & 255;
    }
    for (let x = 0; x < w; x++) {
      const si = x * 3, di = (y * w + x) * 4;
      rgba[di] = row[si]; rgba[di+1] = row[si+1]; rgba[di+2] = row[si+2]; rgba[di+3] = 255;
    }
    prev.set(row);
  }
  return { w, h, rgba };
}

const image = decodePng(source);
const vegetables = [
  ['carrot','にんじん',84,111,'leaf'],['potato','じゃがいも',205,111,'roll'],['sweet-potato','さつまいも',326,111,'wobble'],['daikon','大根',455,111,'leaf'],['turnip','かぶ',579,111,'bounce'],['radish','ラディッシュ',698,111,'bounce'],['burdock','ごぼう',827,111,'roll'],['lotus-root','れんこん',954,111,'rotate'],['ginger','しょうが',1077,111,'shake'],['taro','さといも',1207,111,'float'],['konjac','こんにゃく芋',1328,111,'squash'],['yam','長いも',1450,111,'stretch'],
  ['lettuce','レタス',79,263,'open'],['cabbage','キャベツ',201,263,'rotate'],['napa-cabbage','白菜',326,263,'open'],['spinach','ほうれん草',445,263,'stretch'],['komatsuna','小松菜',570,263,'leaf'],['bok-choy','チンゲンサイ',694,263,'leaf'],['mizuna','水菜',819,263,'leaf'],['red-leaf-lettuce','サニーレタス',950,263,'leaf'],['broccoli','ブロッコリー',1074,263,'shake'],['cauliflower','カリフラワー',1195,263,'float'],['kale','ケール',1320,263,'leaf'],['red-cabbage','紫キャベツ',1442,263,'rotate'],
  ['tomato','トマト',69,432,'bounce'],['cherry-tomato','ミニトマト',177,432,'bounce'],['eggplant','なす',284,432,'wobble'],['cucumber','きゅうり',390,432,'stretch'],['zucchini','ズッキーニ',488,432,'stretch'],['green-pepper','ピーマン',590,432,'bounce'],['paprika','パプリカ',689,432,'wobble'],['pumpkin','かぼちゃ',791,432,'float'],['corn','とうもろこし',892,432,'open'],['okra','オクラ',980,432,'rotate'],
  ['edamame','枝豆',1085,432,'open'],['broad-bean','そら豆',1180,432,'open'],['green-peas','グリーンピース',1274,432,'roll'],['snap-pea','スナップエンドウ',1371,432,'open'],['green-bean','インゲン',1470,432,'stretch'],
  ['shiitake','しいたけ',70,575,'float'],['enoki','えのき',162,575,'wobble'],['shimeji','しめじ',254,575,'wobble'],['eringi','エリンギ',353,575,'squash'],['maitake','まいたけ',451,575,'open'],['mushroom','マッシュルーム',549,575,'roll'],
  ['scallion','ねぎ',670,575,'stretch'],['long-scallion','長ねぎ',770,575,'leaf'],['chive','ニラ',865,575,'stretch'],['celery','セロリ',956,575,'leaf'],['shiso','しそ',1048,575,'leaf'],['cilantro','パクチー',1140,575,'leaf'],['basil','バジル',1235,575,'leaf'],['mint','ミント',1328,575,'bounce'],['parsley','パセリ',1415,575,'shake'],['rosemary','ローズマリー',1492,575,'stretch'],
  ['garlic','にんにく',66,738,'shake'],['onion','玉ねぎ',164,738,'roll'],['chili','唐辛子',259,738,'shake'],['green-chili','青唐辛子',356,738,'shake'],['myoga','みょうが',447,738,'leaf'],['goya','ゴーヤ',531,738,'wobble'],['winter-melon','冬瓜',1211,738,'float'],['yellow-zucchini','黄ズッキーニ',1306,738,'stretch'],['olive','オリーブ',1403,738,'roll'],['beet','ビーツ',1490,738,'leaf'],
];

function cropSprite(cx, cy) {
  const box = { x: Math.max(0,cx-42), y: Math.max(0,cy-42), w: 84, h: 84 };
  let minX=box.w, minY=box.h, maxX=0, maxY=0;
  const isInk = (x,y) => { const i=((box.y+y)*image.w+box.x+x)*4; const r=image.rgba[i],g=image.rgba[i+1],b=image.rgba[i+2]; return !(r>238&&g>238&&b>238) && !(Math.abs(r-g)<8&&Math.abs(g-b)<8&&r>185); };
  for(let y=0;y<box.h;y++) for(let x=0;x<box.w;x++) if(isInk(x,y)){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  minX=Math.max(0,minX-2); minY=Math.max(0,minY-2); maxX=Math.min(box.w-1,maxX+2); maxY=Math.min(box.h-1,maxY+2);
  const sw=maxX-minX+1, sh=maxY-minY+1, scale=Math.min(20/sw,20/sh), dw=Math.max(1,Math.round(sw*scale)), dh=Math.max(1,Math.round(sh*scale));
  const base=new Uint8Array(24*24*4), ox=Math.floor((24-dw)/2), oy=Math.floor((24-dh)/2);
  for(let y=0;y<dh;y++) for(let x=0;x<dw;x++) {
    const sx=box.x+minX+Math.min(sw-1,Math.floor(x/scale)), sy=box.y+minY+Math.min(sh-1,Math.floor(y/scale)), si=(sy*image.w+sx)*4, di=((oy+y)*24+ox+x)*4;
    const r=image.rgba[si],g=image.rgba[si+1],b=image.rgba[si+2];
    if ((r>238&&g>238&&b>238)||(Math.abs(r-g)<8&&Math.abs(g-b)<8&&r>185)) continue;
    base[di]=r;base[di+1]=g;base[di+2]=b;base[di+3]=255;
  }
  return base;
}

function frame(base, pattern, step) {
  const out=new Uint8Array(base.length), phase=[0,1,-1,0][step], green=(r,g,b)=>g>r*1.08&&g>b*1.08;
  for(let y=0;y<24;y++) for(let x=0;x<24;x++) { const si=(y*24+x)*4; if(!base[si+3])continue; const r=base[si],g=base[si+1],b=base[si+2]; let nx=x,ny=y;
    if(pattern==='bounce') ny+=step===1?-2:step===2?-1:0;
    else if(pattern==='float') ny+=step===1?-1:step===2?1:0;
    else if(pattern==='squash') { ny=step===1?Math.min(23,Math.round(12+(y-12)*.88)+1):y; }
    else if(pattern==='shake') nx+=phase;
    else if(pattern==='wobble') nx+=y<12?phase:-phase;
    else if(pattern==='roll'||pattern==='rotate') { const a=(pattern==='rotate'?phase*.32:phase*.13),dx=x-12,dy=y-12;nx=Math.round(12+dx*Math.cos(a)-dy*Math.sin(a));ny=Math.round(12+dx*Math.sin(a)+dy*Math.cos(a)); }
    else if(pattern==='stretch') nx+=Math.round((12-y)*phase/12);
    else if(pattern==='leaf'&&green(r,g,b)) nx+=Math.round((14-y)*phase/7);
    else if(pattern==='open') { const side=x<12?-1:1; if(green(r,g,b)||y<12) nx+=step===1?side:0; }
    if(nx>=0&&nx<24&&ny>=0&&ny<24){const di=(ny*24+nx)*4;out.set(base.subarray(si,si+4),di);}
  }
  return out;
}

function paletteIndex(r,g,b,a){ if(!a)return 0; return 1+(((r>>5)<<5)|((g>>5)<<2)|(b>>6)); }
// 互換性を最優先し、各画素の前に clear code を入れる固定9bit LZW。
// ファイルは少し大きくなるが、Safariを含むデコーダー間のコード幅解釈差で
// フレームが横線状に欠ける問題を確実に避けられる。
function lzw(indices,min=8){const clear=1<<min,end=clear+1,bits=[];let cur=0,n=0;const emit=c=>{cur|=c<<n;n+=min+1;while(n>=8){bits.push(cur&255);cur>>=8;n-=8;}};for(const value of indices){emit(clear);emit(value);}emit(end);if(n)bits.push(cur&255);return Buffer.from(bits);}
function gif(frames,file){const chunks=[Buffer.from('GIF89a','ascii')],hdr=Buffer.alloc(7);hdr.writeUInt16LE(24,0);hdr.writeUInt16LE(24,2);hdr[4]=0xF7;chunks.push(hdr);const pal=Buffer.alloc(768);for(let i=1;i<256;i++){const q=i-1;pal[i*3]=((q>>5)&7)*255/7;pal[i*3+1]=((q>>2)&7)*255/7;pal[i*3+2]=(q&3)*255/3;}chunks.push(pal,Buffer.from([0x21,0xFF,0x0B]),Buffer.from('NETSCAPE2.0'),Buffer.from([3,1,0,0,0]));for(let f=0;f<frames.length;f++){const delay=f===0?200:13;chunks.push(Buffer.from([0x21,0xF9,4,0x09,delay&255,delay>>8,0,0,0x2C,0,0,0,0,24,0,24,0,0,8]));const idx=[];for(let i=0;i<frames[f].length;i+=4)idx.push(paletteIndex(frames[f][i],frames[f][i+1],frames[f][i+2],frames[f][i+3]));const dat=lzw(idx);for(let p=0;p<dat.length;p+=255)chunks.push(Buffer.from([Math.min(255,dat.length-p)]),dat.subarray(p,p+255));chunks.push(Buffer.from([0]));}chunks.push(Buffer.from([0x3B]));fs.writeFileSync(file,Buffer.concat(chunks));}

const manifest=[];
for(const [id,label,x,y,pattern] of vegetables){const base=cropSprite(x,y);gif([0,1,2,3].map(s=>frame(base,pattern,s)),path.join(outDir,`${id}.gif`));manifest.push({id,label,pattern,src:`/vegetables/${id}.gif`});}
fs.writeFileSync(path.join(outDir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Generated ${manifest.length} vegetable GIFs in ${outDir}`);
