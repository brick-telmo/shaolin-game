import {MatchmakingService} from './online-service.js';
import assets from './.build/assets.js';

export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname.startsWith('/api/online/'))return new MatchmakingService(env.DB).handle(request);
    if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
    const path=url.pathname==='/'?'/index.html':url.pathname==='/boss-demo'?'/boss-demo.html':url.pathname;
    const asset=assets[path];
    if(!asset)return new Response('Not found',{status:404});
    return new Response(request.method==='HEAD'?null:asset.body,{headers:{'content-type':asset.type,'cache-control':'no-cache','x-content-type-options':'nosniff'}});
  }
};
