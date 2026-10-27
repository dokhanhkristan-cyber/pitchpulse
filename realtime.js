// Lightweight same-origin realtime client using native fetch + Server-Sent Events.
// Exposes the tiny io() API used by app.js; no external JavaScript dependencies.
window.io = function io() {
  const handlers = new Map();
  let token = null, stream = null, hadConnectionError = false;
  const api = {
    connected: true,
    on(type, callback) {
      if (!handlers.has(type)) handlers.set(type, []);
      handlers.get(type).push(callback);
    },
    timeout(ms) {
      return {emit:async (event,payload,cb) => {
        const abort = new AbortController();
        const timer = setTimeout(() => abort.abort(),ms);
        try {
          const response = await fetch('/api/action', {
            method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({event,payload,token}),signal:abort.signal
          });
          const result = await response.json();
          if(result.sessionToken) {
            token = result.sessionToken;
            openStream();
          }
          cb(null,result);
        } catch(e) {
          api.connected=false;
          cb(e,null);
        } finally {clearTimeout(timer);}
      }};
    }
  };
  function dispatch(name,data) {for(const fn of handlers.get(name)||[])fn(data);}
  function openStream() {
    if(stream)stream.close();
    stream = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);
    for(const name of ['host:snapshot','team:snapshot']) {
      stream.addEventListener(name,e=>{
        try {dispatch(name,JSON.parse(e.data));}catch(err){console.error('Stream parse error:',err);}
      });
    }
    stream.onopen=()=>{
      const reconnecting=hadConnectionError;
      hadConnectionError=false;api.connected=true;
      if(reconnecting)dispatch('connect');
    };
    stream.onerror=()=>{
      if(!hadConnectionError) {hadConnectionError=true;api.connected=false;dispatch('disconnect');}
    };
  }
  queueMicrotask(()=>dispatch('connect'));
  return api;
};
