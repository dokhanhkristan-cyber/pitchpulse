'use strict';
// Pitch Pulse: zero-dependency Node.js server with Server-Sent Events (SSE).
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, 'public');
const FILE = path.join(__dirname, 'data', 'rooms.json');
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms = new Map();
const sessions = new Map(); // Browser session tokens, ephemeral after server restart.
const listeners = new Map(); // session token -> SSE response.

function codeGen() {
  let code;
  do {code = Array.from({length:6}, () => LETTERS[crypto.randomInt(LETTERS.length)]).join('');}
  while (rooms.has(code));
  return code;
}
function cleanName(str, max=40) {
  return String(str ?? '').replace(/[<>\r\n]/g,'').trim().replace(/\s+/g,' ').slice(0,max);
}
function pinHash(code, pin) {
  return crypto.createHash('sha256').update(`${code}:${pin}:${process.env.PIN_PEPPER || 'classroom-demo'}`).digest('hex');
}
function bad(error) {return {ok:false,error};}
function save() {
  clearTimeout(save.timer);
  save.timer = setTimeout(() => {
    try {
      fs.mkdirSync(path.dirname(FILE), {recursive:true});
      const tmp = `${FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify([...rooms.values()].map(r => ({
        code:r.code,title:r.title,hostKey:r.hostKey,phase:r.phase,revealAt:r.revealAt,
        teams:[...r.teams.values()]
      })),null,2));
      fs.renameSync(tmp,FILE);
    } catch(e) {console.error('Could not save room:',e.message);}
  },150);
}
try {
  for (const r of JSON.parse(fs.readFileSync(FILE,'utf8'))) {
    if (r && r.code && r.hostKey) rooms.set(r.code,{...r,teams:new Map((r.teams||[]).map(t=>[t.id,t]))});
  }
  console.log(`Restored ${rooms.size} room(s).`);
} catch(e) {if(e.code!=='ENOENT') console.warn('Could not restore rooms:',e.message);}

const teams = room => [...room.teams.values()];
const committed = room => teams(room).filter(t=>t.amount!==null);
function totals(room) {
  return {
    total:Math.round(committed(room).reduce((n,t)=>n+t.amount,0)*100)/100,
    teams:teams(room).map(t=>({id:t.id,name:t.name,amount:t.amount,demo:!!t.demo}))
      .sort((a,b)=>(b.amount??-1)-(a.amount??-1)||a.name.localeCompare(b.name)),
    groupCount:room.teams.size,investedCount:committed(room).length
  };
}
function common(room) {
  return {code:room.code,title:room.title,phase:room.phase,revealAt:room.revealAt,
    groupCount:room.teams.size,investedCount:committed(room).length,
    ...(room.phase==='revealed'?{result:totals(room)}:{})};
}
function hostState(room) {
  return {...common(room),teams:teams(room).map(t=>({id:t.id,name:t.name,submitted:t.amount!==null,demo:!!t.demo}))};
}
function teamState(room,id) {
  const team=room.teams.get(id);
  return {...common(room),me:team&&{id:team.id,name:team.name,amount:team.amount}};
}
function sessionInfo(role,code,extras={}) {
  const token=crypto.randomBytes(32).toString('hex');
  sessions.set(token,{role,code,...extras,createdAt:Date.now()});
  return token;
}
function pushSnapshot(token) {
  const client=listeners.get(token), s=sessions.get(token), room=rooms.get(s?.code);
  if(!client||!s||!room)return;
  const event=s.role==='host'?'host:snapshot':'team:snapshot';
  const data=s.role==='host'?hostState(room):teamState(room,s.teamId);
  try {client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);} catch(e) {listeners.delete(token);}
}
function broadcast(room) {
  for(const [token,s] of sessions) if(s.code===room.code&&listeners.has(token))pushSnapshot(token);
}
function reveal(room) {
  if(room.phase!=='countdown')return;
  room.phase='revealed';room.revealAt=null;save();broadcast(room);
}
function scheduleReveal(room) {setTimeout(()=>reveal(room),Math.max(0,room.revealAt-Date.now()));}
for(const room of rooms.values())if(room.phase==='countdown')scheduleReveal(room);

function handle(event,payload,token) {
  payload=payload||{};
  if(event==='host:create') {
    if(rooms.size>=500)return bad('Máy chủ đã đạt giới hạn 500 phòng.');
    const code=codeGen();
    const room={code,title:cleanName(payload.title,70)||'THE NEXT BIG IDEA',
      hostKey:crypto.randomBytes(32).toString('hex'),phase:'open',revealAt:null,teams:new Map()};
    rooms.set(code,room);save();
    return {ok:true,code,hostKey:room.hostKey,sessionToken:sessionInfo('host',code),snapshot:hostState(room)};
  }
  if(event==='host:resume') {
    const code=String(payload.code||'').toUpperCase().trim(),room=rooms.get(code);
    if(!room||!payload.hostKey||payload.hostKey!==room.hostKey)return bad('Mã phòng hoặc quyền Host không hợp lệ.');
    return {ok:true,sessionToken:sessionInfo('host',code),snapshot:hostState(room)};
  }
  if(event==='team:join') {
    const code=String(payload.code||'').toUpperCase().trim(),name=cleanName(payload.name),pin=String(payload.pin??'');
    const room=rooms.get(code);
    if(!room)return bad('Không tìm thấy phòng. Kiểm tra lại mã tham gia.');
    if(name.length<2||name.length>40)return bad('Tên nhóm cần ít nhất 2 ký tự.');
    if(!/^\d{4}$/.test(pin))return bad('PIN phải gồm đúng 4 chữ số.');
    let team=teams(room).find(t=>t.name.toLocaleLowerCase()===name.toLocaleLowerCase());
    if(team) {
      if(team.demo||team.pinHash!==pinHash(code,pin))return bad('Tên nhóm đã tồn tại hoặc PIN không đúng.');
    } else {
      if(room.phase!=='open')return bad('Phòng đã khóa đăng ký.');
      if(room.teams.size>=100)return bad('Phòng đã đủ 100 nhóm.');
      team={id:crypto.randomUUID(),name,pinHash:pinHash(code,pin),amount:null,demo:false};
      room.teams.set(team.id,team);save();
    }
    const response={ok:true,sessionToken:sessionInfo('team',code,{teamId:team.id}),snapshot:teamState(room,team.id)};
    broadcast(room);
    return response;
  }
  const s=sessions.get(token),room=rooms.get(s?.code);
  if(!s||!room)return bad('Phiên kết nối hết hạn. Vui lòng tải lại trang.');
  if(event==='team:invest') {
    const team=room.teams.get(s.teamId),amount=payload.amount;
    if(s.role!=='team'||!team||team.demo)return bad('Tài khoản nhóm không hợp lệ.');
    if(room.phase!=='open')return bad('Đã khóa đầu tư.');
    if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0||amount>10||Math.abs(Math.round(amount*100)-amount*100)>1e-8)
      return bad('Chọn số tiền từ 0 đến 10, tối đa 2 số thập phân.');
    team.amount=Math.round(amount*100)/100;save();broadcast(room);return {ok:true};
  }
  if(s.role!=='host')return bad('Chỉ Host được thực hiện thao tác này.');
  if(event==='host:reveal') {
    if(room.phase!=='open')return bad('Phòng không ở trạng thái nhận đầu tư.');
    if(committed(room).length===0)return bad('Chưa có nhóm nào đầu tư.');
    room.phase='countdown';room.revealAt=Date.now()+7500;
    save();broadcast(room);scheduleReveal(room);return {ok:true};
  }
  if(event==='host:newProject') {
    if(room.phase==='countdown')return bad('Vui lòng chờ kết thúc reveal.');
    room.title=cleanName(payload.title,70)||'THE NEXT BIG IDEA';
    room.phase='open';room.revealAt=null;
    for(const t of room.teams.values())t.amount=null;
    save();broadcast(room);return {ok:true};
  }
  if(event==='host:demo') {
    if(room.phase!=='open')return bad('Chỉ có thể thêm nhóm demo khi đang mở đầu tư.');
    if(room.teams.size+5>100)return bad('Không đủ chỗ cho 5 nhóm demo.');
    const names=['Nova Ventures','Apex Capital','Moonshot Club','Orbit Labs','NextGen Fund'];
    const amounts=[8.5,6,9.25,4.5,7.75];
    names.forEach((name,i)=>{
      const label=teams(room).some(t=>t.name===name)?`${name} DEMO`:name;
      const id=crypto.randomUUID();
      room.teams.set(id,{id,name:label,pinHash:'',amount:amounts[i],demo:true});
    });
    save();broadcast(room);return {ok:true};
  }
  if(event==='host:clearDemo') {
    if(room.phase!=='open')return bad('Chỉ xóa demo trước lúc reveal.');
    for(const [id,team] of room.teams)if(team.demo)room.teams.delete(id);
    save();broadcast(room);return {ok:true};
  }
  return bad('Thao tác không tồn tại.');
}
function json(res,status,data) {
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}
function handleAction(req,res) {
  let body='',size=0;
  req.on('data',chunk=>{size+=chunk.length;if(size>16000){req.destroy();return;}body+=chunk;});
  req.on('end',()=>{
    try {
      const input=JSON.parse(body);
      const response=handle(String(input.event||''),input.payload,input.token);
      json(res,200,response);
    } catch(e) {console.error('Action error:',e);json(res,400,bad('Yêu cầu không hợp lệ.'));}
  });
}
function handleEvents(req,res,url) {
  const token=url.searchParams.get('token'),session=sessions.get(token);
  if(!session)return json(res,401,bad('Phiên hết hạn.'));
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  res.write(': connected\n\n');
  const existing=listeners.get(token);if(existing)existing.end();
  listeners.set(token,res);
  pushSnapshot(token);
  const heart=setInterval(()=>{if(!res.destroyed)res.write(': ping\n\n');},18000);
  req.on('close',()=>{clearInterval(heart);if(listeners.get(token)===res)listeners.delete(token);});
}
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
  let url;
  try{url=new URL(req.url,'http://localhost');}catch(e){return json(res,400,bad('Invalid URL'));}
  if(req.method==='GET'&&url.pathname==='/api/health')return json(res,200,{ok:true,activeRooms:rooms.size});
  if(req.method==='POST'&&url.pathname==='/api/action')return handleAction(req,res);
  if(req.method==='GET'&&url.pathname==='/api/events')return handleEvents(req,res,url);
  if(req.method!=='GET')return json(res,405,bad('Method not allowed'));
  const requested=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file=path.resolve(ROOT,requested);
  if(!file.startsWith(ROOT+path.sep)&&file!==ROOT)return json(res,403,bad('Forbidden'));
  fs.stat(file,(err,stat)=>{
    if(err||!stat.isFile())return json(res,404,bad('Not found'));
    res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
    fs.createReadStream(file).pipe(res);
  });
});
server.listen(PORT,'0.0.0.0',()=>console.log(`✦ PITCH PULSE online at http://localhost:${PORT}`));
