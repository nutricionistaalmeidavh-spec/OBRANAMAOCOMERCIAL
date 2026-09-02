type Visual={id:string;sourceId?:string;prompt:string;alt:string;src:string};
const MAP_URL='./resources/question-visual-map.json';
let mapPromise:Promise<Record<string,Visual>>|null=null;
const normalize=(value:string)=>value.normalize('NFKC').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g,' ');

async function loadMap(){
  if(mapPromise)return mapPromise;
  mapPromise=fetch(MAP_URL,{cache:'force-cache'}).then(async response=>{
    if(!response.ok)throw new Error('Mapa visual ausente');
    return await response.json() as Record<string,Visual>;
  }).catch(error=>{mapPromise=null;throw error});
  return mapPromise;
}

function setUnavailable(node:HTMLElement,retry:()=>void){
  node.innerHTML='<button type="button" class="edu-question-visual-unavailable">Imagem indisponível. Tentar novamente</button>';
  node.querySelector('button')?.addEventListener('click',retry,{once:true});
}

export async function hydrateQuestionVisuals(root:ParentNode=document){
  const nodes=Array.from(root.querySelectorAll<HTMLElement>('[data-question-visual]'));
  if(!nodes.length)return;
  try{
    const map=await loadMap();
    const byPrompt=new Map<string,Visual>();
    Object.values(map).forEach(visual=>byPrompt.set(normalize(visual.prompt),visual));
    await Promise.all(nodes.map(async node=>{
      const retry=()=>{mapPromise=null;void hydrateQuestionVisuals(node.parentElement||document)};
      try{
        const id=String(node.dataset.questionId||'');
        const visual=(id&&map[id])||byPrompt.get(normalize(node.dataset.questionPrompt||''));
        if(!visual)return setUnavailable(node,retry);
        const img=document.createElement('img');
        img.src=visual.src;
        img.alt=visual.alt;
        img.loading='eager';
        img.decoding='async';
        img.addEventListener('error',()=>setUnavailable(node,retry),{once:true});
        node.replaceChildren(img);
      }catch(error){
        console.warn('Falha ao carregar imagem de apoio',error);
        setUnavailable(node,retry);
      }
    }));
  }catch(error){
    console.warn('Falha ao preparar apoios visuais',error);
    nodes.forEach(node=>setUnavailable(node,()=>{mapPromise=null;void hydrateQuestionVisuals(root)}));
  }
}
