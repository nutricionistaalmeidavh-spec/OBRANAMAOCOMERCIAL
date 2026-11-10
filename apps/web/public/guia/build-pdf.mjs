import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const pdfWriter=function pdfWriter(book){
 const W=595,H=842, color=v=>v.match(/\w\w/g).map(n=>(parseInt(n,16)/255).toFixed(3)).join(" ");
 const map={"→":"->","←":"<-","–":"-","—":"-","✓":"OK","•":"*","“":'"',"”":'"',"‘":"'","’":"'","…":"...","№":"No.","•":"*","×":"x"};
 const safe=s=>{let t="";for(const c of String(s)){const n=c.codePointAt(0);if(c==="("||c===")"||c==="\\")t+="\\"+c;else if(n>=32&&n<127)t+=c;else if(n>=160&&n<256)t+="\\"+n.toString(8).padStart(3,"0");else t+=map[c]||"?";}return t};
 const wrap=(s,max)=>{let lines=[];for(const section of String(s).split(/\r?\n/)){if(!section.trim()){lines.push("");continue}let line="";for(const word of section.trim().split(/\s+/)){if((line+" "+word).trim().length>max){if(line)lines.push(line);line=""}line+=(line?" ":"")+word;}lines.push(line)}return lines};
 const isCode=s=>s.includes("\n")&&(/^(name: |>|(?:npm|node|git) |\.github\/workflows\/)/i.test(s.trim())||/^\s+(- run:|- uses:|runs-on:)/m.test(s));
 const streams=[],stats=[];
 for(const page of book.pages){
  let commands=[],dark=page.number%2===1;
  const bg=dark?"#130C23":"#FAF9FC", fg=dark?"#F7F0FE":"#281A3A",muted=dark?"#C4B2D8":"#625372",accent=dark?"#D2A4FF":"#7138BD";
  const rect=(x,y,w,h,fill)=>commands.push(`${color(fill)} rg ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f\n`);
  const text=(x,y,s,sz,col,font="F1")=>commands.push(`BT /${font} ${sz.toFixed(2)} Tf ${color(col)} rg 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${safe(s)}) Tj ET\n`);
  rect(0,0,W,H,bg);rect(0,H-88,W,88,dark?"#1A102F":"#F0E9F8");rect(50,H-89,W-100,1,dark?"#543276":"#DDCDF0");
  text(50,805,"ARTISYS",14,fg,"F2");text(372,807,"DO PROMPT AO SOFTWARE",8,accent,"F2");
  text(50,764,page.chapter.toUpperCase()+"  /  "+String(page.number).padStart(2,"0"),8,accent,"F2");
  wrap(page.title.toUpperCase(),42).slice(0,2).forEach((line,i)=>text(50,722-i*25,line,22,fg,"F2"));
  rect(50,671,W-100,1,dark?"#543276":"#DDCDF0");
  const plan=page.blocks.filter(Boolean).map(block=>{
   const code=isCode(block),heading=block.length<92&&/^(CASO OU DECISÃO CENTRAL|PROMPT PARA USAR|ROTA R\$ ?0|ANTES DE CONFIAR|ARTEFATO|CHECKLIST DE ACEITE|HISTÓRIA DO USUÁRIO|TERMINAL|GIT PUSH|ACTIONS|PAGES|CLOUDFLARE|SEU PROJETO|REGRA DO GUIA|NOSSO COMPROMISSO)/i.test(block);
   const lines=wrap(block,code?77:heading?69:82);
   return {block,code,heading,lines};
  });
  const estimated=plan.reduce((sum,p)=>sum+p.lines.length*(p.code?10.5:p.heading?12.8:12.4)+(p.code?15:p.heading?9:8),0);
  const factor=Math.max(.70,Math.min(1,560/Math.max(1,estimated)));
  let y=652;
  for(const part of plan){
   const leading=(part.code?10.5:part.heading?12.8:12.4)*factor;
   if(part.code)rect(47,y-leading*part.lines.length-9,W-94,leading*part.lines.length+20,dark?"#27163C":"#EEE7F8");
   for(const line of part.lines){text(54,y,line,(part.code?8.3:part.heading?9.4:10.2)*factor,part.code?(dark?"#F6E8FF":"#332040"):part.heading?accent:fg,part.code?"F3":part.heading?"F2":"F1");y-=leading}
   y-= (part.code?15:part.heading?9:8)*factor;
  }
  rect(50,42,W-100,1,dark?"#543276":"#DDCDF0");
  text(50,27,"ARTISYS / GUIA GRATUITO / EDICAO WEB",8,muted,"F2");text(510,27,String(page.number).padStart(2,"0")+" / 40",8,muted,"F2");
  stats.push({page:page.number,lowest:y,factor});
  streams.push(commands.join(""));
 }
 const objs=[];
 objs[1]="<< /Type /Catalog /Pages 2 0 R >>";objs[2]=`<< /Type /Pages /Count ${streams.length} /Kids [${streams.map((_,i)=>`${6+i*2} 0 R`).join(" ")}] >>`;
 objs[3]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>";
 objs[4]="<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>";
 objs[5]="<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>";
 streams.forEach((s,i)=>{objs[6+2*i]=`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${7+2*i} 0 R >>`;objs[7+2*i]=`<< /Length ${s.length} >>\nstream\n${s}\nendstream`;});
 let result="%PDF-1.4\n%Artisys Web Edition\n",offset=[0];
 objs.slice(1).forEach((o,i)=>{offset[i+1]=result.length;result+=`${i+1} 0 obj\n${o}\nendobj\n`});
 const xref=result.length;
 result+=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;
 offset.slice(1).forEach(o=>result+=String(o).padStart(10,"0")+" 00000 n \n");
 result+=`trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 if(!/^[\x00-\x7F]*$/.test(result))throw Error("Non ASCII PDF");
 return {pdf:result,stats:{pages:stats.length,bytes:result.length,minY:Math.min(...stats.map(s=>s.lowest)),minFactor:Math.min(...stats.map(s=>s.factor)),overflows:stats.filter(s=>s.lowest<48)}};
};
const dir=dirname(fileURLToPath(import.meta.url));
const book=JSON.parse(readFileSync(join(dir,'conteudo.json'),'utf8'));
const result=pdfWriter(book);
if(result.stats.overflows.length)throw Error('PDF overflow: '+JSON.stringify(result.stats.overflows));
writeFileSync(join(dir,'guia-completo.pdf'),result.pdf,'ascii');
console.log(result.stats);
