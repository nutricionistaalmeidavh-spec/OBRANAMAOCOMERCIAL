import {describe,expect,it,vi} from 'vitest';
import {handlePublicDownload} from './public-downloads';

describe('permanent Pecuaria download redirect',()=>{
  it('ignores unrelated paths',async()=>{
    const fetchMock=vi.fn();
    expect(await handlePublicDownload(new Request('https://artisys.dev/outro'),fetchMock as any)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirects to the installer asset from the latest GitHub release',async()=>{
    const target='https://github.com/nutricionistaalmeidavh-spec/pecuaria/releases/download/v1.2.0/ArtiSys-Pecuaria-Setup-1.2.0.exe';
    const fetchMock=vi.fn(async()=>new Response(JSON.stringify({assets:[{name:'ArtiSys-Pecuaria-Setup-1.2.0.exe',browser_download_url:target}]}),{status:200,headers:{'content-type':'application/json'}}));
    const response=await handlePublicDownload(new Request('https://artisys.dev/pecuaria/download'),fetchMock as any);
    expect(response?.status).toBe(302);
    expect(response?.headers.get('location')).toBe(target);
  });

  it('falls back to the current certified installer if GitHub lookup fails',async()=>{
    const fetchMock=vi.fn(async()=>new Response('rate limited',{status:403}));
    const response=await handlePublicDownload(new Request('https://artisys.dev/pecuaria/download'),fetchMock as any);
    expect(response?.status).toBe(302);
    expect(response?.headers.get('location')).toContain('/v1.1.0/ArtiSys-Pecuaria-Setup-1.1.0.exe');
  });
});
