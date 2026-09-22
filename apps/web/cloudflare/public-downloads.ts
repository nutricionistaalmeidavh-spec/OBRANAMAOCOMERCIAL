const PECUARIA_REPO='nutricionistaalmeidavh-spec/pecuaria';
const LATEST_RELEASE_API=`https://api.github.com/repos/${PECUARIA_REPO}/releases/latest`;
const CURRENT_INSTALLER='https://github.com/nutricionistaalmeidavh-spec/pecuaria/releases/download/v1.1.0/ArtiSys-Pecuaria-Setup-1.1.0.exe';

function installerAsset(release:any){
  const assets=Array.isArray(release?.assets)?release.assets:[];
  return assets.find((asset:any)=>/^ArtiSys-Pecuaria-Setup-\d+\.\d+\.\d+\.exe$/i.test(String(asset?.name??'')))
    ??assets.find((asset:any)=>/^ArtiSys-Pecuaria-Setup-.*\.exe$/i.test(String(asset?.name??'')));
}

export async function handlePublicDownload(request:Request,fetchImpl:typeof fetch=fetch){
  const url=new URL(request.url);
  if(url.pathname!=='/pecuaria/download')return null;
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method Not Allowed',{status:405,headers:{Allow:'GET, HEAD'}});

  try{
    const response=await fetchImpl(LATEST_RELEASE_API,{headers:{Accept:'application/vnd.github+json','User-Agent':'Artisys-Pecuaria-Download'}});
    if(!response.ok)throw new Error(`GitHub latest release returned ${response.status}`);
    const asset=installerAsset(await response.json());
    const target=String(asset?.browser_download_url??'');
    if(!target.startsWith('https://github.com/'))throw new Error('Latest Pecuaria installer asset was not found.');
    return Response.redirect(target,302);
  }catch{
    return Response.redirect(CURRENT_INSTALLER,302);
  }
}
