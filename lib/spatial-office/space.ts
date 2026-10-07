import { DESKS_PER_ROOM, deskBounds, zonePath, deskPosition, deskCorridor, type OfficeActivityZone, type DeskLayout, type OfficeMember } from './model';
import { normalizeOfficeMusic, resolveMusicSource, type OfficeMusic } from './music';

export const ORNAMENTS = {
  coffee_machine: { label:'Mesin kopi', category:'Perangkat meja', width:.44,depth:.4,height:.43 },
  round_meeting_table: { label: 'Meja bundar', category: 'Furnitur', width:2.5,depth:2.5,height:.86 },
  office_desk: { label: 'Meja kantor', category: 'Furnitur', width:1.4,depth:.75,height:.78 },
  meeting_table: { label: 'Meja meeting', category: 'Furnitur', width:2.3,depth:1.1,height:.8 },
  office_swivel_chair: { label: 'Kursi kantor', category: 'Furnitur', width:.7,depth:.7,height:1.18 },
  wood_chair: { label: 'Kursi kayu', category: 'Furnitur', width:.58,depth:.61,height:1.22 },
  round_stool: { label: 'Bangku', category: 'Furnitur', width:.6,depth:.6,height:.7 },
  sofa: { label: 'Sofa', category: 'Furnitur', width:1.9,depth:.76,height:1.19 },
  drawer_cabinet: { label: 'Laci dokumen', category: 'Furnitur', width:.9,depth:.48,height:1.44 },
  bookshelf: { label: 'Rak buku', category: 'Furnitur', width:1.04,depth:.42,height:1.94 },
  side_table: { label: 'Meja dekorasi', category: 'Furnitur', width:.72,depth:.72,height:.59 },
  room_divider: { label: 'Partisi portabel', category: 'Furnitur', width:1.4,depth:.4,height:1.6 },
  whiteboard: { label: 'Papan tulis', category: 'Kantor', width:1.76,depth:.23,height:1.7 },
  pinboard: { label: 'Papan catatan', category: 'Kantor', width:1.2,depth:.09,height:1.27 },
  laptop: { label: 'Laptop', category: 'Perangkat meja', width:.65,depth:.45,height:.48 },
  monitor: { label: 'Monitor', category: 'Perangkat meja', width:.8,depth:.26,height:1.15 },
  keyboard: { label: 'Keyboard', category: 'Perangkat meja', width:.53,depth:.18,height:.07 },
  mouse: { label: 'Mouse', category: 'Perangkat meja', width:.13,depth:.2,height:.08 },
  desk_lamp: { label: 'Lampu meja', category: 'Perangkat meja', width:.35,depth:.34,height:.84 },
  coffee_mug: { label: 'Cangkir kopi', category: 'Perangkat meja', width:.25,depth:.18,height:.21 },
  book_stack: { label: 'Tumpukan buku', category: 'Perangkat meja', width:.46,depth:.27,height:.35 },
  pen_cup: { label: 'Tempat pena', category: 'Perangkat meja', width:.18,depth:.18,height:.34 },
  desk_plant: { label: 'Tanaman meja', category: 'Tanaman', width:.35,depth:.35,height:.53 },
  floor_plant: { label: 'Tanaman besar', category: 'Tanaman', width:.65,depth:.65,height:.96 },
  flower_vase: { label: 'Vas bunga', category: 'Tanaman', width:.5,depth:.5,height:.73 },
  cactus: { label: 'Kaktus', category: 'Tanaman', width:.42,depth:.42,height:.68 },
  floor_lamp: { label: 'Lampu lantai', category: 'Dekorasi', width:.58,depth:.58,height:1.78 },
  framed_art: { label: 'Lukisan', category: 'Dekorasi', width:.7,depth:.1,height:1.1 },
  area_rug: { label: 'Karpet', category: 'Dekorasi', width:2,depth:1.35,height:.04 },
  cushion: { label: 'Bantal', category: 'Dekorasi', width:.56,depth:.56,height:.23 },
  storage_box: { label: 'Kotak penyimpanan', category: 'Dekorasi', width:.58,depth:.42,height:.48 },
  trash_bin: { label: 'Tempat sampah', category: 'Dekorasi', width:.36,depth:.36,height:.42 },
  team_radio: { label: 'Radio tim', category: 'Kantor', width:.86,depth:.36,height:1.2 },
  window: { label: 'Jendela dinding', category: 'Kantor', width:1.9,depth:.15,height:1.5 },
} as const;

// Actual supplied GLB bounds after Z-up conversion: min/max X, Z and Y.
// Some wall decorations are asymmetric about their origin.
export const ORNAMENT_BOUNDS: Record<keyof typeof ORNAMENTS, readonly number[]> = {
  coffee_machine: [-.22,.22,-.24,.16,0,.43],
  round_meeting_table: [-1.25,1.25,-1.25,1.25,0,.86],
  office_desk: [-0.7,0.7,-0.375,0.375,0,0.775],
  meeting_table: [-1.185,1.185,-0.55,0.55,0,0.785],
  office_swivel_chair: [-0.3525,0.365,-0.3498,0.3498,0,1.175],
  wood_chair: [-0.29,0.29,-0.31,0.27,0.02,1.23],
  round_stool: [-0.27,0.3244,-0.2853,0.2853,-0.0064,0.695],
  sofa: [-0.91,0.91,-0.395,0.39,0,1.19],
  drawer_cabinet: [-0.45,0.45,-0.23,0.282,0,1.44],
  bookshelf: [-0.525,0.525,-0.21,0.21,0,1.935],
  side_table: [-0.36,0.36,-0.36,0.36,0,0.585],
  room_divider: [-0.7,0.6625,-0.2,0.2,0,1.58],
  whiteboard: [-0.8825,0.8825,-0.045,0.21,0.005,1.7025],
  pinboard: [-0.6,0.6,-0.025,0.08,0.425,1.275],
  laptop: [-0.325,0.325,-0.215,0.215,0.0175,0.465],
  monitor: [-0.4,0.4,-0.14,0.12,0.255,1.15],
  keyboard: [-0.265,0.265,-0.09,0.09,-0.0005,0.063],
  mouse: [-0.065,0.065,-0.1,0.1,-0.01,0.08],
  desk_lamp: [-0.27,0.16,-0.17,0.17,0,0.84],
  coffee_mug: [-0.09,0.2018,-0.09,0.09,0,0.21],
  book_stack: [-0.185,0.275,-0.135,0.148,0.0075,0.3375],
  pen_cup: [-0.09,0.09,-0.09,0.09,0,0.3828],
  desk_plant: [-0.2172,0.2466,-0.1922,0.2658,0,0.5365],
  floor_plant: [-0.3744,0.4438,-0.3314,0.4583,0,0.925],
  flower_vase: [-0.2683,0.297,-0.2897,0.2897,0.02,0.695],
  cactus: [-0.21,0.21,-0.15,0.15,0,0.66],
  floor_lamp: [-0.29,0.29,-0.29,0.29,0,1.77],
  framed_art: [-0.35,0.46,-0.025,0.053,0.16,1.1],
  area_rug: [-1,1,-0.675,0.675,-0.0005,0.039],
  cushion: [-0.28,0.28,-0.28,0.28,0,0.24],
  storage_box: [-0.29,0.29,-0.21,0.21,0,0.4725],
  trash_bin: [-0.18,0.18,-0.18,0.18,0.005,0.42],
  team_radio: [-.43,.43,-.18,.18,0,1.2],
  window: [-.95,.95,-.075,.075,0,1.5],
};
export type Ornament = { id: string; asset: keyof typeof ORNAMENTS; x: number; z: number; y?: number; scale?: [number,number,number]; color?: string; rotation: number; room: number };
function sameOrnament(a: Ornament | undefined, b: Ornament) {
  return Boolean(a && a.id===b.id && a.asset===b.asset && a.x===b.x && a.z===b.z && (a.y??0)===(b.y??0) && a.rotation===b.rotation && a.room===b.room && (a.color||'')===(b.color||'') && JSON.stringify(a.scale||[1,1,1])===JSON.stringify(b.scale||[1,1,1]));
}
export const ROOM_LIGHTS = {
  workspace:{label:'Workspace',x:0,z:0}, manager:{label:'Manager',x:-3,z:-9}, lead:{label:'Project Lead',x:3,z:-10.5},
  lounge:{label:'Lounge',x:9,z:-3}, pantry:{label:'Pantry',x:9,z:3.8}, meeting:{label:'Meeting room',x:9,z:-10.5}, corridor:{label:'Lorong meeting',x:7.5,z:-6.25},
} as const;
export type LightMode='auto'|'on'|'off';
export type StickyNote={id:string;boardId:string;authorId:string;text:string;color:string;revision:number};
export type OfficeChat={text:string;sentAt:number};
export type OfficeMusicPlayback={url:string;playing:boolean;startedAt:number;updatedAt:number;updatedBy:string};
export type SharedOfficeAction={type:'light';key:string;mode:LightMode}|{type:'note';boardId:string;id:string;text:string;color:string;expectedRevision:number;remove?:boolean}|{type:'music';url:string;title:string}|{type:'music-playback';playing:boolean}|{type:'sign';text:string}|{type:'chat';text:string};
export function lightEnabled(mode:LightMode|undefined,night:boolean) { return mode==='on'||(mode!=='off'&&night); }
export type OfficeSpace = { lights:Record<string,LightMode>; notes:StickyNote[]; music:OfficeMusic|null; musicPlayback:OfficeMusicPlayback|null; signText:string; chats:Record<string,OfficeChat>; furnishedRooms:number[]; version: number; revision: number; layoutRevision: number; claims: Record<string, number>; ornaments: Ornament[]; desks: DeskLayout[]; activities: Record<string, NonNullable<OfficeMember["activity"]>> };
export const OBJECT_COLORS = ['original', '#52684e', '#394c68', '#cfaa77', '#b68c92', '#efe7d5', '#59545a'] as const;
export function validObjectColor(color: unknown) { return color === undefined || color === 'original' || (typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color)); }
const privateOffice = (name: string, x: number): Ornament[] => [
  { id:`${name}-desk`, asset:'office_desk', x, z:-9, rotation:0, room:0 },
  { id:`${name}-chair`, asset:'office_swivel_chair', x, z:-10, rotation:0, room:0 },
  { id:`${name}-guest`, asset:'wood_chair', x, z:-7.75, rotation:Math.PI, room:0 },
  { id:`${name}-laptop`, asset:'laptop', x, z:-8.87, y:.78, rotation:Math.PI, room:0 },
  { id:`${name}-keyboard`, asset:'keyboard', x, z:-9.27, y:.78, rotation:Math.PI, room:0 },
  { id:`${name}-lamp`, asset:'desk_lamp', x:x-.5, z:-8.94, y:.78, rotation:0, room:0 },
  { id:`${name}-pen`, asset:'pen_cup', x:x+.5, z:-8.88, y:.78, rotation:0, room:0 },
  { id:`${name}-shelf`, asset:'bookshelf', x:x-2, z:-10.7, rotation:0, room:0 },
  { id:`${name}-cabinet`, asset:'drawer_cabinet', x:x-2, z:-8.7, rotation:0, room:0 },
  { id:`${name}-plant`, asset:'floor_plant', x:x-2, z:-7, rotation:0, room:0 },
  { id:`${name}-art`, asset:'framed_art', x, z:-11.6, y:.9, rotation:0, room:0 },
  { id:`${name}-rug`, asset:'area_rug', x, z:-9, rotation:0, room:0 },
];
export const EXECUTIVE_ORNAMENTS = [...privateOffice('manager', -3), ...privateOffice('lead', 3).map(o=>({...o,z:o.z-1.5}))];
const isExecutiveKit=(id:string)=>/^(manager|lead)-(desk|chair|laptop|keyboard|lamp|pen)$/.test(id);
export const DEFAULT_ORNAMENTS: Ornament[] = [
  { id:'plant-back', asset:'floor_plant', x:-5, z:-5, rotation:0, room:0 },
  { id:'shelf-back', asset:'bookshelf', x:-3.6, z:-5.4, rotation:0, room:0 },
  { id:'lamp-back', asset:'floor_lamp', x:.5, z:-5.2, rotation:0, room:0 },
  { id:'plant-front', asset:'floor_plant', x:-5, z:2.8, rotation:0, room:0 },
  { id:'rug-lounge', asset:'area_rug', x:9, z:-3, rotation:0, room:0 },
  { id:'workspace-radio', asset:'team_radio', x:1.35, z:-5.4, rotation:0, room:0 },
  ...EXECUTIVE_ORNAMENTS.filter(item=>!isExecutiveKit(item.id)),
];
// Every movable fixture has a stable ID; versioned seeding never restores deleted objects.
export const ROOM_FURNITURE: Ornament[] = [
  {id:'workspace-board',asset:'whiteboard',x:-5.6,z:-1.8,rotation:Math.PI/2,room:0},
  {id:'workspace-pinboard',asset:'pinboard',x:0,z:-5.9,y:.8,rotation:0,room:0},
  ...[7,9,11].flatMap((x,i)=>[-4,-1.4].map((z,j)=>({id:`lounge-sofa-${i*2+j}`,asset:'sofa' as const,x,z,scale:[.8,1,1] as [number,number,number],rotation:0,room:0}))),
  ...[7.2,9,10.8].flatMap((x,i)=>[
    {id:`pantry-counter-${i}`,asset:'drawer_cabinet' as const,x,z:5.6,scale:[1.8,.65,1] as [number,number,number],rotation:0,room:0},
    {id:`pantry-mug-${i}`,asset:'coffee_mug' as const,x:x-.25,z:5.55,y:.94,rotation:0,room:0}]),
  ...[[13.3,-4.8],[17.5,-4.8],[15.4,-4.8],[17.5,4.8]].map(([x,z],i)=>({id:`garden-plant-${i}`,asset:'floor_plant' as const,x,z,scale:[2.3,2.3,2.3] as [number,number,number],rotation:0,room:0})),
  ...Array.from({length:12},(_,i)=>({id:`garden-chair-${i}`,asset:'wood_chair' as const,x:13.25+Math.floor(i/2)*.95,z:i%2?-2.4:0,rotation:i%2?0:Math.PI,room:0})),
  {id:'pantry-coffee-machine',asset:'coffee_machine',x:9.35,z:5.5,y:.94,rotation:0,room:0},
  {id:'garden-table',asset:'side_table',x:16,z:-3.2,rotation:0,room:0},
  {id:'meeting-round-table',asset:'round_meeting_table',x:9,z:-10.75,rotation:0,room:0},
  ...Array.from({length:6},(_,i)=>{const a=i*Math.PI/3+Math.PI/6;return {id:`meeting-chair-${i}`,asset:'wood_chair' as const,x:9+Math.sin(a)*1.9,z:-10.75+Math.cos(a)*1.9,rotation:(a+Math.PI)%(Math.PI*2),room:0};}),
  {id:'meeting-vase',asset:'flower_vase',x:9,z:-10.75,y:.86,rotation:0,room:0},
];
export function applySharedAction(space:OfficeSpace,action:SharedOfficeAction,viewerId:string,admin:boolean):OfficeSpace {
  if(!Object.hasOwn(space.claims,viewerId)) throw new Error('Anda bukan anggota kantor.');
  if(action.type==='chat') {
    if(typeof action.text!=='string'||!action.text.trim()||action.text.trim().length>150) throw new Error('Pesan harus berisi 1–150 karakter.');
    return {...space,revision:space.revision+1,chats:{...space.chats,[viewerId]:{text:action.text.trim(),sentAt:Date.now()}}};
  }
  if(action.type==='sign') {
    if(!admin) throw new Error('Hanya admin atau owner yang dapat mengganti tulisan neon.');
    if(typeof action.text!=='string'||!action.text.trim()||action.text.trim().length>48) throw new Error('Tulisan neon harus berisi 1–48 karakter.');
    return {...space,revision:space.revision+1,signText:action.text.trim()};
  }
  if(action.type==='music-playback') {
    if(typeof action.playing!=='boolean') throw new Error('Status siaran radio tidak valid.');
    if(action.playing&&!space.music) throw new Error('Tambahkan playlist sebelum memulai siaran tim.');
    const now=Date.now();
    return {...space,revision:space.revision+1,musicPlayback:space.music?{url:space.music.url,playing:action.playing,startedAt:action.playing?now:(space.musicPlayback?.startedAt||0),updatedAt:now,updatedBy:viewerId}:null};
  }
  if(action.type==='light') {
    const [area,name]=String(action.key).split(':');
    if(!/^\d+$/.test(area)||Number(area)>=spaceCapacity(space,Object.keys(space.claims).length)/DESKS_PER_ROOM||!Object.hasOwn(ROOM_LIGHTS,name)||!['auto','on','off'].includes(action.mode)||action.key!==`${Number(area)}:${name}`) throw new Error('Pengaturan lampu tidak valid.');
    return {...space,revision:space.revision+1,lights:{...space.lights,[action.key]:action.mode}};
  }
  if(action.type==='music') {
    if(!admin) throw new Error('Hanya admin atau owner yang dapat mengganti playlist kantor.');
    if(typeof action.url!=='string'||typeof action.title!=='string'||action.title.trim().length>80) throw new Error('Nama playlist maksimum 80 karakter.');
    if(!action.url.trim()) return {...space,revision:space.revision+1,music:null,musicPlayback:null};
    const source=resolveMusicSource(action.url);
    return {...space,revision:space.revision+1,music:{provider:source.provider,url:source.url,title:action.title.trim()||`${source.label} kantor`,updatedAt:Date.now(),updatedBy:viewerId},musicPlayback:null};
  }
  if(!space.ornaments.some(o=>o.id===action.boardId&&o.asset==='whiteboard')) throw new Error('Papan tulis tidak tersedia.');
  if(typeof action.id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(action.id)) throw new Error('Catatan tidak valid.');
  const old=space.notes.find(n=>n.id===action.id);
  if(old&&(old.boardId!==action.boardId||(!admin&&old.authorId!==viewerId))) throw new Error('Hanya penulis atau admin yang dapat mengubah catatan ini.');
  if(action.expectedRevision!==(old?.revision??0)) throw new Error('Catatan telah berubah. Tutup lalu buka kembali papan tulis.');
  if(!action.remove&&(typeof action.text!=='string'||!action.text.trim()||action.text.length>500||!['yellow','pink','blue','green'].includes(action.color))) throw new Error('Isi catatan 1–500 karakter dan pilih warna yang tersedia.');
  if(!old&&!action.remove&&space.notes.length>=300) throw new Error('Papan kantor sudah penuh (300 catatan).');
  const notes=space.notes.filter(n=>n.id!==action.id);
  if(!action.remove) notes.push({id:action.id,boardId:action.boardId,authorId:old?.authorId??viewerId,text:action.text.trim(),color:action.color,revision:space.revision+1});
  return {...space,revision:space.revision+1,notes};
}
export function spaceCapacity(space: OfficeSpace, count: number) {
  return Math.max(DESKS_PER_ROOM, Math.ceil(count / DESKS_PER_ROOM) * DESKS_PER_ROOM, Math.ceil((Math.max(-1, ...Object.values(space.claims),...space.desks.map(d=>d.slot)) + 1) / DESKS_PER_ROOM) * DESKS_PER_ROOM);
}
export function normalizeSpace(value: unknown, members: Pick<OfficeMember, 'id'>[]): OfficeSpace {
  let raw = value && typeof value === 'object' ? value as Partial<OfficeSpace> : {};
  if ((raw.version || 0)<4) {
    const remap=(slot:number)=>Math.floor(slot/10)*DESKS_PER_ROOM+slot%10;
    const desks=(raw.desks||[]).map(d=>({...d,slot:remap(d.slot)}));
    for(const [id,slot] of [['manager',10],['lead',11]] as const) {
      const old=raw.ornaments?.find(o=>o.id===`${id}-desk`);
      if(old) desks.push({slot:old.room*DESKS_PER_ROOM+slot,x:old.x,z:old.z,rotation:old.rotation,...(old.color?{color:old.color}:{})});
      else if(raw.ornaments && (raw.version||0)>=2) { const d=deskPosition(slot); desks.push({slot,x:d.x,z:d.z,rotation:d.rotation,removed:true}); }
    }
    // Old custom decorations remain editable in the smaller meeting wing.
    const ornaments=raw.ornaments;
    raw={...raw,desks,ornaments,claims:Object.fromEntries(Object.entries(raw.claims||{}).map(([id,slot])=>[id,remap(slot)]))};
  }
  if((raw.version||0)<6) {
    raw={...raw,desks:raw.desks?.map(d=>d.slot%DESKS_PER_ROOM===11?{...d,z:d.z-1.5}:d),ornaments:raw.ornaments?.map(o=>{
      if(o.x>0&&o.x<6&&o.z<-6) return {...o,z:o.z-1.5};
      if(o.id.startsWith('lounge-sofa-')&&!o.scale) return {...o,scale:[.8,1,1] as [number,number,number]};
      return o;
    })};
  }
  if((raw.version||0)<7 && raw.ornaments) raw={...raw,ornaments:raw.ornaments.map(o=>{
    if(o.x>6&&o.x<12&&o.z>=-6&&o.z<1.5) {
      const item=o.id.startsWith('lounge-sofa-')&&o.z===-4.4?{...o,z:-4}:o;
      return snapOrnament(item,{...item,z:-3});
    }
    return o;
  })};
  const claims: Record<string, number> = {};
  const removed=new Set((Array.isArray(raw.desks)?raw.desks:[]).filter(d=>d.removed).map(d=>d.slot));
  const taken = new Set<number>();
  const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
  for (const member of sorted) {
    const slot = raw.claims?.[member.id];
    if (Number.isInteger(slot) && slot! >= 0 && slot! < 1200 && !taken.has(slot!) && !removed.has(slot!)) { claims[member.id] = slot!; taken.add(slot!); }
  }
  // Existing/new roster members get a free desk; saved ownership takes precedence.
  for (const member of sorted) {
    if (claims[member.id] !== undefined) continue;
    let slot = 0; while (taken.has(slot)||removed.has(slot)) slot++;
    claims[member.id] = slot; taken.add(slot);
  }
  const ornaments = Array.isArray(raw.ornaments) ? raw.ornaments.map(item => {
    if ((raw.version || 0) < 2 && item.id === 'plant-front' && item.x === -5 && item.z === 4.8) return { ...item, z:2.8 };
    if ((raw.version || 0) < 3 && item.rotation === 0) {
      if (item.id === 'shelf-back' && item.x === -2 && item.z === -5.4) return { ...item, x:-3.6 };
      if (item.id === 'lamp-back' && item.x === 4.5 && item.z === -5.2) return { ...item, x:.5 };
    }
    return item;
  }) : DEFAULT_ORNAMENTS.map(item => ({ ...item }));
  if(Array.isArray(raw.ornaments)&&(raw.version||0)<8&&!ornaments.some(item=>item.id==='workspace-radio')) ornaments.push({...DEFAULT_ORNAMENTS.find(item=>item.id==='workspace-radio')!});
  if (Array.isArray(raw.ornaments) && (raw.version || 0) < 2) for (const item of EXECUTIVE_ORNAMENTS) if (!ornaments.some(o => o.id === item.id)) ornaments.push({ ...item });
  const furnishedRooms=(raw.version||0)>=5&&Array.isArray(raw.furnishedRooms)?[...raw.furnishedRooms]:[];
  const areas=Math.max(1,Math.ceil((Math.max(-1,...Object.values(claims),...(raw.desks||[]).map(d=>d.slot))+1)/DESKS_PER_ROOM));
  if((raw.version||0)<5) for(let i=0;i<ornaments.length;i++) if(ornaments[i].x < -6) ornaments[i]=snapOrnament({...ornaments[i],x:Math.max(-11.4,ornaments[i].x)+18,z:Math.max(-2.4,Math.min(2.4,ornaments[i].z))-10.5},{...ornaments[i],x:9,z:-10.5});
  for(let area=0;area<areas;area++) if(!furnishedRooms.includes(area)) {
    for(const item of [...(area?DEFAULT_ORNAMENTS:[]),...ROOM_FURNITURE]) {const id=area?`${item.id}-area-${area}`:item.id;if(!ornaments.some(o=>o.id===id)) ornaments.push({...item,id,room:area});}
    furnishedRooms.push(area);
  }
  const chats=Object.fromEntries(sorted.flatMap(member=>{const chat=raw.chats?.[member.id];return chat&&typeof chat.text==='string'&&chat.text.trim()&&chat.text.length<=150&&Number.isFinite(chat.sentAt)?[[member.id,{text:chat.text.trim(),sentAt:chat.sentAt}]]:[];}));
  const music=normalizeOfficeMusic(raw.music),playback=music&&raw.musicPlayback&&raw.musicPlayback.url===music.url&&typeof raw.musicPlayback.playing==='boolean'&&Number.isFinite(raw.musicPlayback.startedAt)&&Number.isFinite(raw.musicPlayback.updatedAt)?{url:music.url,playing:raw.musicPlayback.playing,startedAt:raw.musicPlayback.startedAt,updatedAt:raw.musicPlayback.updatedAt,updatedBy:typeof raw.musicPlayback.updatedBy==='string'?raw.musicPlayback.updatedBy.slice(0,128):''}:null;
  const signText=typeof raw.signText==='string'&&raw.signText.trim().length<=48?raw.signText.trim():'';
  return { version:8, lights:raw.lights||{},notes:Array.isArray(raw.notes)?raw.notes:[],music,musicPlayback:playback,signText,chats,furnishedRooms, revision: Number.isSafeInteger(raw.revision) && raw.revision! >= 0 ? raw.revision! : 0, layoutRevision: Number.isSafeInteger(raw.layoutRevision) && raw.layoutRevision! >= 0 ? raw.layoutRevision! : 0, claims, desks: Array.isArray(raw.desks) ? raw.desks : [], activities: Object.fromEntries(sorted.flatMap(m => { if(('status' in m&&m.status!=='working')||('presenceIdle' in m&&m.presenceIdle)) return []; const a = raw.activities?.[m.id]; return a && ['desk', 'garden', 'pantry', 'lounge', 'meeting'].includes(a.zone) && Number.isFinite(a.until) ? [[m.id, a]] : []; })), ornaments:ornaments.filter(item=>!isExecutiveKit(item.id)) };
}
export function claimDesk(space: OfficeSpace, userId: string, slot: unknown, count: number): OfficeSpace {
  if (!Object.hasOwn(space.claims, userId)) throw new Error('Anda bukan anggota kantor ini.');
  if (typeof slot !== 'number' || !Number.isInteger(slot) || slot < 0 || slot >= spaceCapacity(space, count)) throw new Error('Meja tidak tersedia di area ini.');
  if(deskPosition(slot,space.desks).removed) throw new Error('Meja sudah dihapus. Pilih meja lain.');
  if (Object.entries(space.claims).some(([id, desk]) => id !== userId && desk === slot)) throw new Error('Meja ini sudah dimiliki anggota lain. Pilih meja kosong.');
  return { ...space, revision: space.revision + 1, claims: { ...space.claims, [userId]: slot } };
}
// Admin callers are authorized by the API; occupied targets swap owners atomically.
export function assignDesk(space: OfficeSpace, memberId: unknown, slot: unknown, count: number) {
  if(typeof memberId!=='string'||!Object.hasOwn(space.claims,memberId)) throw new Error('Pilih anggota tim yang masih aktif.');
  if(typeof slot!=='number'||!Number.isInteger(slot)||slot<0||slot>=spaceCapacity(space,count)||deskPosition(slot,space.desks).removed) throw new Error('Meja tidak tersedia.');
  const claims={...space.claims},old=claims[memberId],owner=Object.keys(claims).find(id=>claims[id]===slot);
  if(owner && owner!==memberId) claims[owner]=old;
  claims[memberId]=slot;
  return {...space,claims,revision:space.revision+1};
}
export function removeDesk(space: OfficeSpace, slot: unknown, count: number) {
  if(typeof slot!=='number'||!Number.isInteger(slot)||slot<0||slot>=spaceCapacity(space,count)||deskPosition(slot,space.desks).removed) throw new Error('Meja tidak tersedia.');
  const claims={...space.claims},owner=Object.keys(claims).find(id=>claims[id]===slot);
  if(owner) {
    const free=Array.from({length:spaceCapacity(space,count)},(_,i)=>i).find(i=>i!==slot&&!Object.values(claims).includes(i)&&!deskPosition(i,space.desks).removed);
    if(free===undefined) throw new Error('Semua meja terisi. Sediakan meja kosong sebelum menghapus meja milik anggota.');
    claims[owner]=free;
  }
  const p=deskPosition(slot,space.desks);
  return {...space,claims,revision:space.revision+1,layoutRevision:space.layoutRevision+1,desks:[...space.desks.filter(d=>d.slot!==slot),{slot,x:p.x,z:p.z,rotation:p.rotation,color:p.color,removed:true}]};
}
// Apply the final draft atomically; never relocate an owner to another removed desk.
export function applyLayout(space:OfficeSpace, action:{layoutRevision:number;desks?:unknown;ornaments:unknown}, count:number):OfficeSpace {
  if(action.layoutRevision!==space.layoutRevision) throw new Error('Denah telah diubah admin lain. Muat denah terbaru sebelum menyimpan.');
  const capacity=spaceCapacity(space,count),desks=parseDesks(action.desks??space.desks,capacity/DESKS_PER_ROOM);
  const desksUnchanged=Array.from({length:capacity},(_,slot)=>{
    const before=deskPosition(slot,space.desks),after=deskPosition(slot,desks);
    return before.x===after.x&&before.z===after.z&&before.rotation===after.rotation&&(before.color||'')===(after.color||'')&&Boolean(before.removed)===Boolean(after.removed);
  }).every(Boolean);
  const ornaments=parseOrnaments(action.ornaments,capacity/DESKS_PER_ROOM,desks,desksUnchanged?space.ornaments:undefined),claims={...space.claims};
  const displaced=Object.keys(claims).filter(id=>deskPosition(claims[id],desks).removed);
  const occupied=new Set(Object.entries(claims).filter(([id])=>!displaced.includes(id)).map(([,slot])=>slot));
  for(const id of displaced) {
    const free=Array.from({length:capacity},(_,i)=>i).find(i=>!occupied.has(i)&&!deskPosition(i,desks).removed);
    if(free===undefined) throw new Error('Semua meja terisi. Pulihkan atau sediakan meja kosong sebelum menghapus meja milik anggota.');
    claims[id]=free;occupied.add(free);
  }
  return {...space,desks,ornaments,claims,revision:space.revision+1,layoutRevision:space.layoutRevision+1};
}
function segmentDistance(x: number, z: number, a: [number, number], b: [number, number]) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
}
export function ornamentFootprint(item: Ornament) {
  const scale=item.scale||[1,1,1];
  const [xmin,xmax,zmin,zmax,ymin,ymax] = ORNAMENT_BOUNDS[item.asset].map((v,i)=>v*scale[i<2?0:i<4?2:1]);
  const c=Math.cos(item.rotation),s=Math.sin(item.rotation);
  const corners=[[xmin,zmin],[xmax,zmin],[xmax,zmax],[xmin,zmax]].map(([x,z])=>[item.x+x*c+z*s,item.z-x*s+z*c]);
  const xs=corners.map(p=>p[0]),zs=corners.map(p=>p[1]);
  return { corners, xmin:Math.min(...xs), xmax:Math.max(...xs), zmin:Math.min(...zs), zmax:Math.max(...zs), ymin:(item.y||0)+ymin, ymax:(item.y||0)+ymax };
}
const placementRoom = (item: Pick<Ornament,'x'|'z'>) => {
  if(item.x > 6 && item.z < -6) return [6,12,-13.5,-7.5];
  if(item.z < -6) return item.x < 0 ? [-6,0,-12,-6] : [0,6,-13.5,-7.5];
  if(item.x > 12) return [12.3,18.8,-6,6];
  if(item.x > 6) return item.z < 1.5 ? [6,12,-5,1.5] : [6,12,1.5,6];
  return [-6,6,-6,6];
};
export const isWallOrnament = (item: Ornament) => item.asset==='framed_art'||item.asset==='pinboard'||item.asset==='window';
export const DESK_SURFACE_Y = .79;
export function isDeskTopPlacement(item: Ornament, desks: DeskLayout[] = []) {
  const bounds=ornamentFootprint(item);
  if(bounds.ymin < DESK_SURFACE_Y-.025 || bounds.ymin > DESK_SURFACE_Y+.065) return false;
  for(let slot=0;slot<DESKS_PER_ROOM;slot++) {
    const desk=deskPosition(item.room*DESKS_PER_ROOM+slot,desks);
    if(desk.removed) continue;
    const c=Math.cos(desk.rotation),s=Math.sin(desk.rotation);
    const corners=bounds.corners.map(([x,z])=>[(x-desk.x)*c-(z-desk.z)*s,(x-desk.x)*s+(z-desk.z)*c]);
    if(corners.every(([x,z])=>Math.abs(x)<=.69&&Math.abs(z)<=.365)) return true;
  }
  return false;
}
// Keep the full GLB footprint on the room-facing surface, including rotation.
// Call with the previous position so dragging cannot jump through a partition.
export function snapOrnament(item: Ornament, previous: Ornament = item, attach = false): Ornament {
  const [xmin,xmax,zmin,zmax]=placementRoom(previous), gap=.075;
  const next={...item};
  if(xmin!==12.3 && (attach || isWallOrnament(item))) {
    const walls=[{distance:Math.abs(item.z-zmin),axis:'z',edge:zmin,rotation:0,sign:1},
      {distance:Math.abs(item.x-xmin),axis:'x',edge:xmin,rotation:Math.PI/2,sign:1},
      {distance:Math.abs(item.x-xmax),axis:'x',edge:xmax,rotation:Math.PI*1.5,sign:-1},
      {distance:Math.abs(item.z-zmax),axis:'z',edge:zmax,rotation:Math.PI,sign:-1}].sort((a,b)=>a.distance-b.distance);
    const wall=walls[0];
    if(attach || wall.distance<.65) {
      next.rotation=wall.rotation;
      if(isWallOrnament(next) && next.y===undefined) next.y=next.asset==='window'?.65:.9;
      const b=ornamentFootprint(next);
      if(wall.axis==='x') next.x+=wall.edge+wall.sign*gap-(wall.sign>0?b.xmin:b.xmax);
      else next.z+=wall.edge+wall.sign*gap-(wall.sign>0?b.zmin:b.zmax);
    }
  }
  const b=ornamentFootprint(next);
  next.x+=Math.max(0,xmin+gap-b.xmin)-Math.max(0,b.xmax-xmax+gap);
  next.z+=Math.max(0,zmin+gap-b.zmin)-Math.max(0,b.zmax-zmax+gap);
  if(next.y!==undefined) next.y=Math.max(0,Math.min(next.y,2,2.7-ORNAMENT_BOUNDS[next.asset][5]));
  return next;
}
export function ornamentError(item: Ornament, desks: DeskLayout[] = []): string {
  const b=ornamentFootprint(item), rx=(b.xmax-b.xmin)/2,rz=(b.zmax-b.zmin)/2;
  const center={...item,x:(b.xmin+b.xmax)/2,z:(b.zmin+b.zmax)/2};
  const [xmin,xmax,zmin,zmax]=placementRoom(item),gap=.074;
  if(b.xmin<xmin+gap||b.xmax>xmax-gap||b.zmin<zmin+gap||b.zmax>zmax-gap) return 'Objek menembus dinding atau keluar ruangan. Geser ke sisi dalam atau gunakan Tempel ke dinding.';
  if(b.ymax>2.701) return 'Objek terlalu tinggi. Turunkan agar tetap di bawah bagian atas dinding.';
  // A tabletop object occupies the desk's existing footprint, so it must not
  // be rejected by floor clearance rules for the chair and walking routes.
  if(isDeskTopPlacement(item,desks)) return '';
  item=center;
  if (item.asset !== 'area_rug') for (const [x,z,rotated] of [[-1.5,-6,0],[4.5,-7.5,0],[9,-7.5,0],[4.5,6,0],[12,4.5,1]]) {
    const along = rotated ? Math.abs(item.z-z) : Math.abs(item.x-x), across = rotated ? Math.abs(item.x-x) : Math.abs(item.z-z);
    if (along < .8 + (rotated ? rz : rx) && across < 1.05 + (rotated ? rx : rz)) return 'Sisakan bukaan dan jalur masuk pintu.';
  }
  if(item.asset!=='area_rug'&&b.xmax>4&&b.xmin<12&&b.zmax>-7.5&&b.zmin<(b.xmin>=6?-5:-5.65)) return 'Sisakan lorong dari workspace ke ruang meeting.';
  const garden = xmin===12.3;
  const privateRoom = zmax===-6||(xmin===0&&zmax===-7.5);

  if(xmin===6&&zmax===-7.5) return '';
  if(garden) {
    if(item.asset!=='area_rug' && Math.abs(item.z-1.9)<rz+.55) return 'Sisakan jalan utama taman.';
    return '';
  }
  // Lounge/pantry have movable furniture; pairwise bounds enforce clear placements.
  if(xmin===6) return '';
  if(isWallOrnament(item) && b.ymin>=.65 && Math.min(b.xmin-xmin,xmax-b.xmax,b.zmin-zmin,zmax-b.zmax)<.16) return '';
  if (item.asset === 'area_rug') return '';
  for (let i = 0; i < DESKS_PER_ROOM; i++) { const d = deskPosition(item.room * DESKS_PER_ROOM + i, desks); if(d.removed) continue; const dx = item.x - d.x, dz = item.z - d.z; if (Math.abs(dx * Math.cos(d.rotation) - dz * Math.sin(d.rotation)) < .7 + Math.max(rx, rz) && Math.abs(dx * Math.sin(d.rotation) + dz * Math.cos(d.rotation) + .35) < 1 + Math.max(rx, rz)) return 'Area meja dan kursi harus tetap kosong.'; }
  if(privateRoom && b.ymin>=.77) return '';
  for (let slot = 0; slot < DESKS_PER_ROOM; slot++) for (const zone of ['desk', 'lounge', 'pantry', 'garden', 'exit'] as const) {
    if(zone==='desk' && deskPosition(item.room*DESKS_PER_ROOM+slot,desks).removed) continue;
    const path = zonePath(item.room * DESKS_PER_ROOM + slot, zone, desks);
    for (let i = 1; i < path.length; i++) if (segmentDistance(item.x, item.z, path[i - 1], path[i]) < Math.max(rx, rz) + 0.38) return 'Sisakan lorong untuk jalur karakter.';
  }
  return '';
}
export function parseOrnaments(value: unknown, rooms: number, desks: DeskLayout[] = [], existing: Ornament[] = []): Ornament[] {
  if (!Array.isArray(value) || value.length > 1200) throw new Error('Maksimum 1200 objek per kantor.');
  const ids = new Set<string>();
  const unchanged = new Set<string>();
  const items = value.map(input => {
    if (!input || typeof input !== 'object') throw new Error('Data ornamen tidak valid.');
    const item = input as Ornament;
    if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(item.id) || ids.has(item.id) || !Object.hasOwn(ORNAMENTS, item.asset) || !validObjectColor(item.color) || (item.scale!==undefined && (!Array.isArray(item.scale)||item.scale.length!==3||!item.scale.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=.25&&n<=3))) || (item.y !== undefined && (typeof item.y !== 'number' || !Number.isFinite(item.y) || item.y < 0 || item.y > 2)) || ![item.x, item.z, item.rotation].every(v => typeof v === 'number' && Number.isFinite(v)) || Math.abs(item.rotation) > Math.PI * 2 + 0.01 || !Number.isInteger(item.room) || item.room < 0 || item.room >= rooms) throw new Error('Data ornamen tidak valid.');
    ids.add(item.id);
    const clean: Ornament = { id: item.id, asset: item.asset, x: item.x, z: item.z, rotation: item.rotation, room: item.room, ...(item.scale?{scale:item.scale}:{}), ...(item.y !== undefined ? { y:item.y } : {}), ...(item.color ? { color:item.color } : {}) };
    if(sameOrnament(existing.find(saved=>saved.id===clean.id),clean)) unchanged.add(clean.id);
    else { const error = ornamentError(clean, desks); if (error) throw new Error(`${ORNAMENTS[item.asset].label} (X ${item.x.toFixed(2)}, Z ${item.z.toFixed(2)}): ${error}`); }
    return clean;
  });
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    if (a.room !== b.room || a.asset === 'area_rug' || b.asset === 'area_rug') continue;
    const ba=ornamentFootprint(a),bb=ornamentFootprint(b);
    if(ba.ymax<=bb.ymin+.015||bb.ymax<=ba.ymin+.015) continue;
    const separate=[a.rotation,b.rotation].flatMap(r=>[[Math.cos(r),-Math.sin(r)],[Math.sin(r),Math.cos(r)]]).some(([x,z])=>{
      const pa=ba.corners.map(p=>p[0]*x+p[1]*z),pb=bb.corners.map(p=>p[0]*x+p[1]*z);
      return Math.max(...pa)<=Math.min(...pb)+.015||Math.max(...pb)<=Math.min(...pa)+.015;
    });
    if(!separate&&(!unchanged.has(a.id)||!unchanged.has(b.id))) throw new Error(`${ORNAMENTS[a.asset].label} (X ${a.x.toFixed(2)}, Z ${a.z.toFixed(2)}) bertabrakan dengan ${ORNAMENTS[b.asset].label} (X ${b.x.toFixed(2)}, Z ${b.z.toFixed(2)}). Geser salah satunya.`);
  }
  return items;
}

export function parseDesks(value: unknown, rooms: number): DeskLayout[] {
  if (!Array.isArray(value) || value.length > rooms * DESKS_PER_ROOM) throw new Error('Denah meja tidak valid.');
  const used = new Set<number>();
  const desks: DeskLayout[] = value.map(d => {
    if (!d || !Number.isInteger(d.slot) || d.slot < 0 || d.slot >= rooms * DESKS_PER_ROOM || used.has(d.slot) || ![d.x, d.z, d.rotation].every(n => typeof n === 'number' && Number.isFinite(n)) || Math.abs(d.rotation) > Math.PI * 2 + .01 || !validObjectColor(d.color) || (d.removed!==undefined && typeof d.removed!=='boolean')) throw new Error('Posisi meja tidak valid.');
    used.add(d.slot);
    return { slot: d.slot, x: d.x, z: d.z, rotation: d.rotation, ...(d.color ? { color:d.color } : {}),...(d.removed ? {removed:true}: {}) };
  });
  for (const room of new Set(desks.map(d => Math.floor(d.slot / DESKS_PER_ROOM)))) {
    const poses = Array.from({ length: DESKS_PER_ROOM }, (_, i) => deskPosition(room * DESKS_PER_ROOM + i, desks));
    // Separating-axis check for each desk + chair footprint, including rotation.
    const corners = poses.map(d => [[-.65,-1.15],[.65,-1.15],[.65,.36],[-.65,.36]].map(([x,z]) => [d.x + x*Math.cos(d.rotation)+z*Math.sin(d.rotation), d.z-x*Math.sin(d.rotation)+z*Math.cos(d.rotation)]));
    for (let i = 0; i < DESKS_PER_ROOM; i++) {
      if(poses[i].removed) continue;
      const [xmin,xmax,zmin,zmax]=deskBounds(room*DESKS_PER_ROOM+i);
      if (corners[i].some(([x,z]) => x < xmin || x > xmax || z < zmin || z > zmax)) throw new Error('Meja harus berada di ruang kerja dan tidak menutup lorong pintu.');
      for (let j = 0; j < i; j++) {
        if(poses[j].removed) continue;
        const separate = [poses[i].rotation, poses[j].rotation].flatMap(r => [[Math.cos(r),-Math.sin(r)],[Math.sin(r),Math.cos(r)]]).some(([x,z]) => {
          const a = corners[i].map(p => p[0]*x+p[1]*z), b = corners[j].map(p => p[0]*x+p[1]*z);
          return Math.max(...a) <= Math.min(...b) + .025 || Math.max(...b) <= Math.min(...a) + .025;
        });
        if (!separate) throw new Error('Meja atau kursi saling bertabrakan. Beri ruang di antaranya.');
      }
      if (!deskCorridor(room * DESKS_PER_ROOM + i, desks).length) throw new Error('Meja ini menutup jalur duduk. Sisakan lorong di belakang kursi.');
    }
  }
  return desks;
}
export function setActivity(space: OfficeSpace, viewerId: string, zone: unknown, now = Date.now()): OfficeSpace {
  if (!Object.hasOwn(space.claims, viewerId)) throw new Error('Anda bukan anggota kantor ini.');
  if (!['auto', 'desk', 'garden', 'pantry', 'lounge', 'meeting'].includes(String(zone))) throw new Error('Aktivitas tidak valid.');
  const activities = { ...space.activities };
  if (zone === 'auto') delete activities[viewerId];
  else {
    let seat:number|undefined;
    if(zone==='meeting') {
      const room=Math.floor(space.claims[viewerId]/DESKS_PER_ROOM);
      const occupied=new Set(Object.entries(activities).filter(([id,a])=>id!==viewerId&&a.zone==='meeting'&&a.until>now&&Math.floor(space.claims[id]/DESKS_PER_ROOM)===room).map(([,a])=>a.seat));
      seat=Array.from({length:6},(_,i)=>i).find(i=>!occupied.has(i)&&space.ornaments.some(o=>o.room===room&&(o.id===`meeting-chair-${i}`||o.id===`meeting-chair-${i}-area-${room}`)));
      if(seat===undefined) throw new Error('Kursi meeting sedang penuh atau belum tersedia. Pilih aktivitas lain.');
    }
    activities[viewerId] = {zone:zone as OfficeActivityZone,until:now+(zone==='meeting'?15:5)*60_000,...(seat!==undefined?{seat}:{})};
  }
  return { ...space, activities, revision: space.revision + 1 };
}

// The supplied private desk sets move as a unit; detached decorations remain independent.
export function updateOrnament(items: Ornament[], id: string, patch: Partial<Ornament>): Ornament[] {
  const parent=items.find(o=>o.id===id); if(!parent) return items;
  const next={...parent,...patch}, prefix=id==='manager-desk' ? 'manager' : id==='lead-desk' ? 'lead' : '';
  const surface=ornamentFootprint(parent);
  const supported=items.filter(o=>o.id!==id&&o.room===parent.room&&o.x>=surface.xmin&&o.x<=surface.xmax&&o.z>=surface.zmin&&o.z<=surface.zmax&&(o.y||0)>=surface.ymax-.025&&(o.y||0)<=surface.ymax+.08);
  const angle=next.rotation-parent.rotation, c=Math.cos(angle), s=Math.sin(angle);
  return items.map(item=>{
    if(item.id===id) return next;
    if(!supported.some(o=>o.id===item.id)&&(!prefix || !['chair','laptop','keyboard','lamp','pen'].some(part=>item.id===`${prefix}-${part}`))) return item;
    const dx=item.x-parent.x,dz=item.z-parent.z;
    return {...item,x:next.x+dx*c+dz*s,z:next.z-dx*s+dz*c,y:(item.y||0)+(next.y||0)-(parent.y||0),rotation:(item.rotation+angle+Math.PI*2)%(Math.PI*2)};
  });
}

export function moveOrnament(items: Ornament[], id: string, patch: Partial<Ornament>, rooms: number, desks: DeskLayout[], attach = false, existing: Ornament[] = []) {
  const previous=items.find(item=>item.id===id); if(!previous) return items;
  const next=snapOrnament({...previous,...patch},previous,attach);
  return parseOrnaments(updateOrnament(items,id,next),rooms,desks,existing);
}

export function moveDesk(desks: DeskLayout[], slot: number, patch: Partial<DeskLayout>, rooms: number, ornaments: Ornament[]) {
  const previous=deskPosition(slot,desks);
  const next=parseDesks([...desks.filter(d=>d.slot!==slot),{slot,x:previous.x,z:previous.z,rotation:previous.rotation,color:previous.color,removed:previous.removed,...patch}],rooms);
  parseOrnaments(ornaments,rooms,next);
  return next;
}
