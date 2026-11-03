import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { APP_PATHS, isPlainNavigation, routeFromPath } from '../src/app/routes';
describe('standalone app routes',()=>{
  it('resolves every canonical page and trailing slashes; root retains quick practice',()=>{
    for(const [route,path] of Object.entries(APP_PATHS)){expect(routeFromPath(path)).toBe(route);expect(routeFromPath(path+'/')).toBe(route);}
    expect(routeFromPath('/')).toBe('practice');expect(routeFromPath('/missing')).toBe('practice');
  });
  it('intercepts ordinary clicks while preserving modified and nonprimary link navigation',()=>{
    const click={button:0,metaKey:false,ctrlKey:false,shiftKey:false,altKey:false,defaultPrevented:false};
    expect(isPlainNavigation(click)).toBe(true);
    for(const key of ['metaKey','ctrlKey','shiftKey','altKey','defaultPrevented'])expect(isPlainNavigation({...click,[key]:true})).toBe(false);
    for(const button of [1,2])expect(isPlainNavigation({...click,button})).toBe(false);
  });
  it('serves all standalone paths on Vercel without rewriting asset or venue URLs',()=>{
    const config=JSON.parse(readFileSync('vercel.json','utf8'));
    expect(config.rewrites).toEqual(Object.values(APP_PATHS).map(source=>({source,destination:'/index.html'})));
  });
});
