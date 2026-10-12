'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type FormEvent, type SyntheticEvent } from 'react';
import { MapPin, Lightbulb, StickyNote, Radio, Send, Type, LayoutDashboard, PencilRuler, Moon, Sun, ArrowUpRight, Box, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Coffee, LogIn, LogOut, Pause, Play, Plus, RefreshCw, Settings, Users, X, BriefcaseBusiness, Target, ListChecks, Timer, Bell, FolderKanban, CircleAlert, CheckCircle2, CalendarOff, LockKeyhole } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { deskLabel, deskPosition, officeTime, type DeskLayout, type OfficeActivityZone, defaultAvatar, parseAvatar, workedSeconds, DESKS_PER_ROOM, reconcileSeats, statusLabel, type AvatarStyle, type OfficeMember, type OfficeSnapshot } from '@/lib/spatial-office/model';
import { OFFICE_BRAND } from '@/lib/spatial-office/branding';
import { normalizeAttendanceSchedule, type AttendanceSchedule } from '@/lib/attendance/schedule';
import FloatingAttendance from '@/components/attendance/FloatingAttendance';
import AvatarEditor from './AvatarEditor';
import OfficeEditor from './OfficeEditor';
import OfficeUtilities from './OfficeUtilities';
import OfficeActivityMenu, { OFFICE_ACTIONS } from './OfficeActivityMenu';
import OfficeObjectMenu from './OfficeObjectMenu';
import OfficeMusicPlayer from './OfficeMusicPlayer';
import OfficeSignEditor from './OfficeSignEditor';
import OfficeWeather from './OfficeWeather';
import HolidayAdminControl from './HolidayAdminControl';
import { useHolidayAccess } from '@/components/auth/HolidayAccessContext';
import type { ObjectMenuTarget, OfficeBubbleEvent } from '@/lib/spatial-office/scene';
import { applySharedAction, applyLayout, type SharedOfficeAction, normalizeSpace, claimDesk, assignDesk, removeDesk, ORNAMENTS, moveOrnament, moveDesk, moveRoomLight, setActivity, parseOrnaments, spaceCapacity, type OfficeSpace, type Ornament, type RoomLightKey, type RoomLightPosition } from '@/lib/spatial-office/space';
import { normalizeProjectLookupName, rememberWorkCenterProject, workCenterProjectHref } from '@/lib/projects/work-center-snapshot';
import './office.css';

const OfficeCanvas = dynamic(() => import('./OfficeCanvas'), { ssr: false, loading: () => <div className="office-viewport office-canvas-placeholder">Menyiapkan tampilan 3D…</div> });
const DEFAULT_SIGN_TEXT=/agency/i.test(OFFICE_BRAND.name)?OFFICE_BRAND.name:`${OFFICE_BRAND.name} Agency`;
const DEMO_MEMBERS: OfficeMember[] = [
  { id: 'demo-1', name: 'Alya', role: 'manager', status: 'working', project: 'Brand identity' },
  { id: 'demo-2', name: 'Bima', status: 'working', project: 'Website tim' },
  { id: 'demo-3', name: 'Citra', status: 'paused', project: 'Content plan' },
  { id: 'demo-4', name: 'Dara', status: 'working', project: 'Content plan' },
  { id: 'demo-5', name: 'Eka', status: 'offline', project: '' },
  { id: 'demo-6', name: 'Farhan', status: 'working', project: 'Social media' },
];
type Data = OfficeSnapshot & { seats: Map<string, number> };
type WorkCenterTab = 'today' | 'projects' | 'inbox';
type WorkCenterNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  entity_url?: string | null;
  is_read: boolean;
  created_at: string;
};
type WorkCenterApproval = {
  id: string;
  title: string;
  requested_by_name?: string;
  status: string;
  submitted_at?: string;
};
type WorkCenterFeed = {
  notifications: WorkCenterNotification[];
  unreadCount: number;
  approvals: WorkCenterApproval[];
  loading: boolean;
};
type WorkCenterChatMessage = {
  key: string;
  memberId: string;
  name: string;
  text: string;
  seenAt: number;
  profilePicture?: string;
};

function formatWorkDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}j ${minutes}m` : `${minutes}m`;
}

function roleLabel(value?: string) {
  if (!value) return 'Team member';
  return value.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function memberJobTitle(member?: OfficeMember) {
  return member?.profile?.roleTitle?.trim() || (member?.role ? roleLabel(member.role) : 'Anggota tim');
}

function memberStatusMeta(status: OfficeMember['status']) {
  if (status === 'working') return { label: 'On working', Icon: CheckCircle2 };
  if (status === 'paused') return { label: 'Idle', Icon: Clock3 };
  return { label: 'Offline', Icon: X };
}

function compactDate(value?: string) {
  if (!value) return 'Baru saja';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Baru saja';
  return date.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function holidayDateLabel(value?: string) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function memberProjectSummaries(member: OfficeMember, now: number) {
  const projects = (member.profile?.projects || []).map(project => ({ ...project }));
  if (!member.project) return projects;
  const current = projects.find(project => project.name.toLocaleLowerCase('id-ID') === member.project.toLocaleLowerCase('id-ID'));
  const sessionSeconds = workedSeconds(member, now);
  if (!current) {
    projects.unshift({ name: member.project, trackedSeconds: sessionSeconds, timeSource: 'session' as const, taskCount: member.tasks?.length || 0, completedTasks: 0 });
  } else if (current.timeSource !== 'tasks') {
    current.trackedSeconds += sessionSeconds;
  }
  return projects;
}

export default function OfficeDashboard({ demo = false, immersive = false, workCenterPreview = false, embeddedAttendance = false, onStatistics }: { demo?: boolean; immersive?: boolean; workCenterPreview?: boolean; embeddedAttendance?: boolean; onStatistics?: () => void }) {
  const { access: holidayAccess, locked: holidayLocked } = useHolidayAccess();
  const [data, setData] = useState<Data>(() => ({ members: demo ? DEMO_MEMBERS : [], syncedAt: '', seats: reconcileSeats(new Map(), demo ? DEMO_MEMBERS : []) }));
  const [now, setNow] = useState(0);
  const [schedule, setSchedule] = useState<AttendanceSchedule>();
  useEffect(() => {
    const tick = () => setNow(Date.now()); queueMicrotask(tick); const timer = setInterval(tick, 1000);
    let cancelled = false;
    const load = () => { if (!demo) void fetch('/api/attendance/schedule', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(data => { if (!cancelled && data?.schedule) setSchedule(normalizeAttendanceSchedule(data.schedule, data.storage_ready)); }).catch(() => {}); };
    load(); const poll = setInterval(load, 300000);
    return () => { cancelled = true; clearInterval(timer); clearInterval(poll); };
  }, [demo]);
  const clock = officeTime(now, schedule);
  const [activityMenu,setActivityMenu]=useState(false);
  const [musicOpen,setMusicOpen]=useState(false);
  const [signOpen,setSignOpen]=useState(false);
  const [objectLibrary,setObjectLibrary]=useState(false);
  const [utility,setUtility]=useState<{boardId:string|null}|null>(null);
  const [panel, setPanel] = useState<'team' | 'desks' | 'member' | null>(null);
  const [selectedDesk, setSelectedDesk] = useState<number | null>(null);
  const [objectMenu,setObjectMenu]=useState<(ObjectMenuTarget & {room:number}) | null>(null);
  const closeObjectMenu=useCallback(()=>setObjectMenu(null),[setObjectMenu]);
  const [draft, setDraft] = useState<{ ornaments: Ornament[]; desks: DeskLayout[]; lightPositions:Record<string,RoomLightPosition>; layoutRevision: number } | null>(null);
  const [selectedOrnament, setSelectedOrnament] = useState('');
  const [spaceError, setSpaceError] = useState('');
  const [spaceSaving, setSpaceSaving] = useState(false);
  const [demoAdmin, setDemoAdmin] = useState(true);
  const [editing, setEditing] = useState<{ id: string; avatar: AvatarStyle } | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [refreshing, setRefreshing] = useState(!demo);
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState('');
  const [room, setRoom] = useState(0);
  const [motion, setMotion] = useState(true);
  const [showSceneBubbles,setShowSceneBubbles]=useState(false);
  const [query, setQuery] = useState('');
  const [chatText,setChatText]=useState('');
  const [workCenterChatHistory,setWorkCenterChatHistory]=useState<WorkCenterChatMessage[]>([]);
  const [workCenterTab,setWorkCenterTab]=useState<WorkCenterTab>('today');
  const [workCenterFeed,setWorkCenterFeed]=useState<WorkCenterFeed>({notifications:[],unreadCount:0,approvals:[],loading:true});
  const [memberProfilePopover,setMemberProfilePopover]=useState<{id:string;left:number;bottom:number}|null>(null);
  const [accountPopover,setAccountPopover]=useState<{left:number;bottom:number}|null>(null);
  const [demoCounter, setDemoCounter] = useState(7);
  const [holidayMessagePreview, setHolidayMessagePreview] = useState<string | null>(null);

  useEffect(()=>{
    if(!memberProfilePopover) return;
    const closeFromOutside=(event:PointerEvent)=>{
      const target=event.target as Element | null;
      if(target?.closest('.office-member-profile-popover,.office-agent-card')) return;
      setMemberProfilePopover(null);
    };
    const closeFromKeyboard=(event:KeyboardEvent)=>{if(event.key==='Escape')setMemberProfilePopover(null);};
    const closeFromViewport=()=>setMemberProfilePopover(null);
    document.addEventListener('pointerdown',closeFromOutside);
    document.addEventListener('keydown',closeFromKeyboard);
    window.addEventListener('resize',closeFromViewport);
    return ()=>{
      document.removeEventListener('pointerdown',closeFromOutside);
      document.removeEventListener('keydown',closeFromKeyboard);
      window.removeEventListener('resize',closeFromViewport);
    };
  },[memberProfilePopover]);

  useEffect(()=>{
    if(!accountPopover) return;
    const closeFromOutside=(event:PointerEvent)=>{
      const target=event.target as Element | null;
      if(target?.closest('.office-account-popover,.office-account-trigger')) return;
      setAccountPopover(null);
    };
    const closeFromKeyboard=(event:KeyboardEvent)=>{if(event.key==='Escape')setAccountPopover(null);};
    const closeFromViewport=()=>setAccountPopover(null);
    document.addEventListener('pointerdown',closeFromOutside);
    document.addEventListener('keydown',closeFromKeyboard);
    window.addEventListener('resize',closeFromViewport);
    return ()=>{
      document.removeEventListener('pointerdown',closeFromOutside);
      document.removeEventListener('keydown',closeFromKeyboard);
      window.removeEventListener('resize',closeFromViewport);
    };
  },[accountPopover]);

  useEffect(()=>{
    if(!notice) return;
    const timer=window.setTimeout(()=>setNotice(''),4200);
    return ()=>window.clearTimeout(timer);
  },[notice]);

  useEffect(()=>{
    if(!workCenterPreview) return;
    let disposed=false;
    const load=async()=>{
      const [notificationsResult,approvalsResult]=await Promise.allSettled([
        fetch('/api/notifications?limit=12',{cache:'no-store'}).then(async response=>({ok:response.ok,payload:await response.json().catch(()=>({}))})),
        fetch('/api/approvals',{cache:'no-store'}).then(async response=>({ok:response.ok,payload:await response.json().catch(()=>({}))})),
      ]);
      if(disposed) return;
      setWorkCenterFeed(previous=>{
        const notificationResponse=notificationsResult.status==='fulfilled'&&notificationsResult.value.ok?notificationsResult.value.payload:null;
        const approvalResponse=approvalsResult.status==='fulfilled'&&approvalsResult.value.ok?approvalsResult.value.payload:null;
        const notifications=Array.isArray(notificationResponse?.notifications)?notificationResponse.notifications:previous.notifications;
        const approvals=Array.isArray(approvalResponse?.requests)?approvalResponse.requests:previous.approvals;
        const unread=Number(notificationResponse?.unreadCount);
        return {
          notifications,
          approvals,
          unreadCount:Number.isFinite(unread)?unread:notifications.filter((item:WorkCenterNotification)=>!item.is_read).length,
          loading:false,
        };
      });
    };
    void load();
    const interval=window.setInterval(load,30_000);
    const refresh=()=>void load();
    window.addEventListener('focus',refresh);
    window.addEventListener('notifications-refresh',refresh);
    return()=>{disposed=true;window.clearInterval(interval);window.removeEventListener('focus',refresh);window.removeEventListener('notifications-refresh',refresh);};
  },[workCenterPreview]);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotion(!preference.matches);
    update(); preference.addEventListener('change', update);
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (demo) return;
    let disposed = false;
    let running = false;
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const load = async () => {
      if (disposed || document.hidden) return;
      if (running) { pending = true; return; }
      running = true;
      setRefreshing(true);
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 20_000);
      try {
        const response = await fetch('/api/spatial-office', { cache: 'no-store', signal: controller.signal });
        const payload = await response.json();
        if (!disposed && (response.status === 401 || response.status === 403)) {
          setData({ members: [], syncedAt: '', seats: new Map() });
          setAuthRequired(true);
        }
        if (!response.ok || !Array.isArray(payload.members)) throw new Error(payload.error || 'Data kantor belum tersedia.');
        if (!disposed) {
          setData(previous => {
            const space = normalizeSpace(previous.space && previous.space.revision > (payload.space?.revision ?? -1) ? previous.space : payload.space, payload.members);
            return { members: payload.members, viewerRole: payload.viewerRole, viewerId: payload.viewerId, avatarStorage: payload.avatarStorage, canEditOffice: payload.canEditOffice, spaceStorage: payload.spaceStorage, space, syncedAt: payload.syncedAt, seats: new Map(Object.entries(space.claims)) };
          });
          setError(''); setAuthRequired(false);
        }
      } catch (failure) {
        if (!disposed) setError(failure instanceof Error && failure.name !== 'AbortError' ? failure.message : 'Sinkronisasi tertunda. Data terakhir tetap ditampilkan.');
      } finally {
        clearTimeout(timeout);
        running = false;
        if (!disposed) {
          setRefreshing(false);
          if (pending) { pending = false; timer = setTimeout(load, 300); }
        }
      }
    };
    const schedule = () => { clearTimeout(timer); timer = setTimeout(load, 500); };
    const attendanceChanged = (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (['checkin', 'pause', 'resume', 'checkout'].includes(action || '')) {
        setData(previous => {
          if (!previous.viewerId) return previous;
          const status: OfficeMember['status'] = action === 'pause' ? 'paused' : action === 'checkout' ? 'offline' : 'working';
          let changed = false;
          const members = previous.members.map(member => {
            if (member.id !== previous.viewerId || (member.status === status && !member.presenceIdle)) return member;
            changed = true;
            return { ...member, status, presenceIdle: false };
          });
          return changed ? { ...previous, members } : previous;
        });
      }
      schedule();
    };
    const visibility = () => { if (!document.hidden) schedule(); };
    void load();
    const interval = setInterval(load, 10_000);
    const realtime = supabase.channel('spatial-office-presence')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_sessions' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_presence_state' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_user_roles' }, schedule)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, schedule)
      .subscribe(status => {
        if (disposed) return;
        setRealtimeConnected(status === 'SUBSCRIBED');
        // Recover changes missed while the channel was connecting or reconnecting.
        if (status === 'SUBSCRIBED') schedule();
      });
    const broadcast = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('bilik_attendance_channel') : null;
    if (broadcast) broadcast.onmessage = schedule;
    window.addEventListener('focus', schedule);
    window.addEventListener('bilik-attendance-changed', attendanceChanged);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true; clearInterval(interval); clearTimeout(timer); controller?.abort();
      broadcast?.close(); void supabase.removeChannel(realtime);
      window.removeEventListener('focus', schedule); window.removeEventListener('bilik-attendance-changed', attendanceChanged); document.removeEventListener('visibilitychange', visibility);
    };
  }, [demo, refresh]);

  useEffect(()=>{
    if(!demo||!workCenterPreview) return;
    let disposed=false;
    let controller:AbortController|undefined;
    const loadLivePreview=async()=>{
      controller?.abort();
      controller=new AbortController();
      const timeout=window.setTimeout(()=>controller?.abort(),15_000);
      try{
        const response=await fetch('/api/spatial-office',{cache:'no-store',signal:controller.signal});
        if(!response.ok) return;
        const payload=await response.json();
        if(disposed||!Array.isArray(payload.members)||!payload.members.length) return;
        setData(previous=>{
          const space=normalizeSpace(payload.space||previous.space,payload.members);
          return {...previous,...payload,space,seats:new Map(Object.entries(space.claims))};
        });
      }catch{/* The isolated local preview intentionally keeps its demo fallback. */}
      finally{window.clearTimeout(timeout);}
    };
    void loadLivePreview();
    const interval=window.setInterval(loadLivePreview,30_000);
    return()=>{disposed=true;controller?.abort();window.clearInterval(interval);};
  },[demo,workCenterPreview,refresh]);

  const space = useMemo(() => normalizeSpace(data.space || { claims: Object.fromEntries(data.seats) }, data.members), [data]);
  const rooms = spaceCapacity(space, data.members.length) / DESKS_PER_ROOM;
  const canEdit = demo ? demoAdmin : data.canEditOffice === true;
  const sharedReady = demo || data.spaceStorage === true;
  const currentRoom = Math.min(room, rooms - 1);
  const members = useMemo(() => data.members.flatMap(member => {
    const slot = data.seats.get(member.id)!;
    member = { ...member, activity: space.activities[member.id], chat:space.chats[member.id] };
    return Math.floor(slot / DESKS_PER_ROOM) === currentRoom ? [{ member: editing?.id === member.id ? { ...member, avatar: editing.avatar } : member, slot }] : [];
  }), [data, space.activities, space.chats, currentRoom, editing]);
  const dataReady = demo || Boolean(data.syncedAt);
  const active = data.members.filter(member => member.status !== 'offline').length;
  const paused = data.members.filter(member => member.status === 'paused').length;
  const selectedMember = data.members.find(member => member.id === selected);
  const workCenterMember = selectedMember ?? data.members.find(member => member.status === 'working') ?? data.members[0];
  const accountMember = data.members.find(member => member.id === data.viewerId);
  const viewerMember = accountMember ?? data.members.find(member => member.status !== 'offline');
  const rememberChatBubble=useCallback((event:OfficeBubbleEvent)=>{
    if(!workCenterPreview) return;
    const member=data.members.find(candidate=>candidate.id===event.memberId);
    if(!member||member.status==='offline'||(member.presenceIdle&&member.status!=='paused')) return;
    const key=`${event.memberId}:${event.key}`;
    setWorkCenterChatHistory(previous=>{
      if(previous.some(message=>message.key===key)) return previous;
      return [...previous,{key,memberId:member.id,name:member.name,text:event.text,seenAt:event.seenAt,profilePicture:member.profilePicture}].slice(-8);
    });
  },[data.members,workCenterPreview]);
  const visibleChatHistory=useMemo(()=>{
    const online=new Set(data.members.filter(member=>member.status!=='offline'&&(!member.presenceIdle||member.status==='paused')).map(member=>member.id));
    return workCenterChatHistory.filter(message=>online.has(message.memberId)).slice(-5);
  },[data.members,workCenterChatHistory]);
  const teamTasks = useMemo(()=>data.members.flatMap(member=>(member.tasks||[]).map((task,index)=>({
    id:`${member.id}-${index}-${task.name}`,
    name:task.name,
    status:task.status,
    member:member.name,
    project:member.project,
    done:['done','completed','closed'].includes(task.status.toLowerCase()),
  }))).sort((a,b)=>Number(a.done)-Number(b.done)||Number(b.status==='in_progress')-Number(a.status==='in_progress')||a.name.localeCompare(b.name,'id-ID')),[data.members]);
  const activeTasks=teamTasks.filter(task=>!task.done);
  const projectRollups=useMemo(()=>{
    const grouped=new Map<string,{name:string;trackedSeconds:number;taskCount:number;completedTasks:number;members:Set<string>}>();
    for(const member of data.members){
      for(const project of memberProjectSummaries(member,now)){
        const key=project.name.trim().toLocaleLowerCase('id-ID');
        if(!key) continue;
        const current=grouped.get(key)||{name:project.name,trackedSeconds:0,taskCount:0,completedTasks:0,members:new Set<string>()};
        current.trackedSeconds+=Math.max(0,project.trackedSeconds||0);
        current.taskCount+=Math.max(0,project.taskCount||0);
        current.completedTasks+=Math.max(0,project.completedTasks||0);
        current.members.add(member.name);
        grouped.set(key,current);
      }
    }
    return [...grouped.entries()].map(([key,project])=>{
      const tasks=teamTasks.filter(task=>normalizeProjectLookupName(task.project||'')===key);
      return {
        ...project,
        taskCount:Math.max(project.taskCount,tasks.length),
        completedTasks:Math.max(project.completedTasks,tasks.filter(task=>task.done).length),
        members:[...project.members],
        tasks,
      };
    }).sort((a,b)=>b.members.length-a.members.length||b.trackedSeconds-a.trackedSeconds||a.name.localeCompare(b.name,'id-ID'));
  },[data.members,now,teamTasks]);
  const rememberProjectFolder=(project:typeof projectRollups[number])=>{
    rememberWorkCenterProject({
      version:1,
      savedAt:new Date().toISOString(),
      name:project.name,
      trackedSeconds:project.trackedSeconds,
      taskCount:project.taskCount,
      completedTasks:project.completedTasks,
      members:project.members.map(name=>{
        const member=data.members.find(candidate=>candidate.name===name);
        return {name,role:roleLabel(member?.profile?.roleTitle||member?.role),status:member?.status||'offline'};
      }),
      tasks:project.tasks.map(task=>({id:task.id,name:task.name,status:task.status,member:task.member,done:task.done})),
    });
  };
  const pendingApprovals=workCenterFeed.approvals.filter(approval=>approval.status==='pending');
  const unreadNotifications=workCenterFeed.notifications.filter(notification=>!notification.is_read);
  const floatingProfileMember = memberProfilePopover ? data.members.find(member => member.id === memberProfilePopover.id) : undefined;
  const floatingProfileProjects = floatingProfileMember ? memberProjectSummaries(floatingProfileMember, now) : [];
  const currentWhiteboard = space.ornaments.find(ornament => ornament.room === currentRoom && ornament.asset === 'whiteboard');
  const currentRadio = space.ornaments.find(ornament => ornament.room === currentRoom && ornament.asset === 'team_radio');
  const selectMember = (id: string) => {
    if (draft) return;
    setSelected(id); setPanel(workCenterPreview ? null : 'member');
    setEditing(current => current?.id === id ? current : null);
    const slot = data.seats.get(id);
    if (slot !== undefined) setRoom(Math.floor(slot / DESKS_PER_ROOM));
  };
  const toggleMemberProfile = (member: OfficeMember, target: HTMLButtonElement) => {
    setAccountPopover(null);
    selectMember(member.id);
    if(memberProfilePopover?.id===member.id){setMemberProfilePopover(null);return;}
    const rect=target.getBoundingClientRect();
    const width=Math.min(410,window.innerWidth-24);
    setMemberProfilePopover({
      id:member.id,
      left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),
      bottom:Math.max(12,window.innerHeight-rect.top+10),
    });
  };
  const toggleAccountPopover = (target: HTMLButtonElement) => {
    if(accountPopover){setAccountPopover(null);return;}
    setMemberProfilePopover(null);
    const rect=target.getBoundingClientRect();
    const width=Math.min(270,window.innerWidth-24);
    setAccountPopover({
      left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12)),
      bottom:Math.max(12,window.innerHeight-rect.top+10),
    });
  };
  const openEditor = () => {
    const member = data.members.find(m => m.id === (demo ? selected : data.viewerId));
    if (!member) return;
    selectMember(member.id); setNotice(''); setEditing({ id: member.id, avatar: member.avatar || defaultAvatar(member.id) });
  };
  const saveAvatar = async () => {
    if (!editing) return;
    const { id, avatar } = editing;
    if (!demo) {
      const response = await fetch('/api/spatial-office', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Avatar belum tersimpan.');
    } else { try { localStorage.setItem(`office-demo-avatar:${id}`, JSON.stringify(avatar)); } catch { throw new Error('Browser tidak mengizinkan penyimpanan avatar simulasi.'); } }
    setData(previous => ({ ...previous, members: previous.members.map(m => m.id === id ? { ...m, avatar } : m) }));
    setEditing(null); setNotice(demo ? 'Avatar simulasi tersimpan di browser ini.' : 'Avatar Anda tersimpan.');
  };
  useEffect(() => {
    if (!demo) return;
    const members = DEMO_MEMBERS.map(member => {
      let avatar;
      try { avatar = parseAvatar(JSON.parse(localStorage.getItem(`office-demo-avatar:${member.id}`) || 'null')) || undefined; } catch { /* Retain the supplied asset style. */ }
      return { ...member, startedAt: Date.now(), accumulatedSeconds: 0, avatar, tasks: member.project ? [{ name: `Review ${member.project}`, status: 'in_progress' }, { name: `Susun draft ${member.project}`, status: 'to_do' }] : [] };
    });
    let restored: unknown = null;
    try { restored = JSON.parse(localStorage.getItem('office-demo-space-v3') || 'null'); } catch { /* Use the default office. */ }
    const space = normalizeSpace(restored, members);
    try { parseOrnaments(space.ornaments, spaceCapacity(space, members.length) / DESKS_PER_ROOM,space.desks); } catch { space.ornaments = normalizeSpace(null, members).ornaments; }
    queueMicrotask(() => setData(previous => ({ ...previous, members, space, seats: new Map(Object.entries(space.claims)) })));
  }, [demo]);
  const pantryDemo = () => {
    if (!demo || !selectedMember) return;
    setData(previous => ({ ...previous, members: previous.members.map(m => m.id === selected ? { ...m, status: 'working', startedAt: Date.now(), accumulatedSeconds: 900 } : m) }));
  };
  const changeDemo = (status: OfficeMember['status']) => {
    if (!demo || !selectedMember) return;
    setData(previous => ({ ...previous, members: previous.members.map(member => member.id === selected ? { ...member, status, startedAt: Date.now(), accumulatedSeconds: status === 'offline' ? 0 : workedSeconds(member, Date.now()), project: status === 'offline' ? '' : member.project || 'Project baru' } : member) }));
  };
  const addDemo = () => {
    if (!demo) return;
    const member: OfficeMember = { id: `demo-${demoCounter}`, name: `Anggota ${demoCounter}`, status: 'working', project: 'Project baru' };
    setData(previous => { const next = [...previous.members, member]; const space = normalizeSpace(previous.space || { claims: Object.fromEntries(previous.seats) }, next); return { ...previous, members: next, space, seats: new Map(Object.entries(space.claims)) }; });
    setDemoCounter(count => count + 1);
    setSelected(member.id);
    const seats = new Map(Object.entries(normalizeSpace(space, [...data.members, member]).claims));
    setRoom(Math.floor(seats.get(member.id)! / DESKS_PER_ROOM));
  };
  const removeDemo = () => {
    if (!demo || !selectedMember) return;
    setData(previous => { const next = previous.members.filter(member => member.id !== selected); const space = normalizeSpace(previous.space || { claims: Object.fromEntries(previous.seats) }, next); return { ...previous, members: next, space, seats: new Map(Object.entries(space.claims)) }; });
    setSelected(''); setEditing(null);
  };

  const viewerId = demo ? (selected || 'demo-1') : data.viewerId;
  const viewer=data.members.find(member=>member.id===viewerId);
  const viewerCheckedIn=Boolean(viewer&&viewer.status!=='offline'&&(!viewer.presenceIdle||viewer.status==='paused'));
  const checkedInCount=data.members.filter(member=>member.status!=='offline'&&(!member.presenceIdle||member.status==='paused')).length;
  const applySpace = (next: OfficeSpace) => {
    if (demo) localStorage.setItem('office-demo-space-v3', JSON.stringify(next));
    setData(previous => ({ ...previous, space: next, seats: new Map(Object.entries(next.claims)) }));
  };
  const saveSpace = async (action: SharedOfficeAction | { type: 'claim'; slot: number } | {type:'assign'; slot:number; memberId:string} | {type:'remove-desk';slot:number} | { type: 'activity'; zone: 'auto' | OfficeActivityZone } | { type: 'layout'; ornaments: Ornament[]; desks: DeskLayout[]; lightPositions:Record<string,RoomLightPosition>; layoutRevision: number }) => {
    setSpaceSaving(true); setSpaceError('');
    try {
      let next: OfficeSpace;
      if (demo) {
        if(action.type==='chat') {
          const viewer=data.members.find(m=>m.id===viewerId);
          if(viewer?.status==='offline'||viewer?.presenceIdle) throw new Error('Check-in dan aktifkan sesi sebelum mengirim pesan.');
          next=applySharedAction(space,action,viewerId||'',canEdit);
        }
        else if(action.type==='music-playback') {
          const viewer=data.members.find(m=>m.id===viewerId);
          if(viewer?.status==='offline'||(viewer?.presenceIdle&&viewer?.status!=='paused')) throw new Error('Check-in dan aktifkan sesi sebelum mengendalikan radio tim.');
          next=applySharedAction(space,action,viewerId||'',canEdit);
        }
        else if(action.type==='light'||action.type==='note'||action.type==='music'||action.type==='sign') next=applySharedAction(space,action,viewerId||'',canEdit);
        else if (action.type === 'activity') {
          const viewer=data.members.find(m=>m.id===viewerId);
          if(action.zone!=='auto'&&(viewer?.status!=='working'||viewer.presenceIdle)) throw new Error('Check-in dan aktifkan sesi sebelum memilih aktivitas.');
          next = setActivity(space, viewerId || '', action.zone);
        }
        else if (action.type === 'claim') next = claimDesk(space, viewerId || '', action.slot, data.members.length);
        else if(action.type==='assign'||action.type==='remove-desk') {
          if(!canEdit) throw new Error('Hanya admin yang dapat mengatur meja tim.');
          next=action.type==='assign'?assignDesk(space,action.memberId,action.slot,data.members.length):removeDesk(space,action.slot,data.members.length);
        }
        else {
          if (!canEdit) throw new Error('Hanya admin yang dapat mengatur kantor.');
          next = applyLayout(space,action,data.members.length);
        }
      } else {
        const response = await fetch('/api/spatial-office', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({...action,version:space.version}), signal: AbortSignal.timeout(20_000) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Perubahan belum tersimpan.');
        next = result.space;
      }
      applySpace(next);
      if (action.type === 'layout') { setDraft(null); setNotice('Denah kantor tersimpan.'); }
      else if (action.type === 'activity') { setNotice(action.zone === 'auto' ? 'Aktivitas otomatis dilanjutkan.' : `${OFFICE_ACTIONS.find(a=>a.zone===action.zone)?.label||'Aktivitas'} aktif selama ${action.zone==='meeting'?15:5} menit. Presensi tetap sesuai sesi Anda.`); }
      else if(action.type==='assign') setNotice('Pemilik meja berhasil diperbarui.');
      else if(action.type==='remove-desk') setNotice('Meja dihapus. Anda dapat memulihkannya melalui Edit ruangan.');
      else if(action.type==='music') setNotice(action.url.trim()?'Playlist kantor diperbarui.':'Playlist kantor dihapus.');
      else if(action.type==='sign') setNotice('Tulisan neon kantor diperbarui.');
      else if(action.type==='light'||action.type==='note'||action.type==='chat'||action.type==='music-playback') { /* Shared utility stays open. */ }
      else { setNotice(`${deskLabel(action.slot)} sekarang milik Anda.`); setRoom(Math.floor(action.slot / DESKS_PER_ROOM)); }
    return true;
    } catch (failure) { setSpaceError(failure instanceof Error && failure.name === 'TimeoutError' ? 'Koneksi penyimpanan melewati batas waktu. Posisi tetap ada di draft; coba Simpan denah lagi.' : failure instanceof Error ? failure.message : 'Perubahan belum tersimpan.'); return false; }
    finally { setSpaceSaving(false); }
  };
  const sendAvatarChat=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();
    const text=chatText.trim();
    if(!text||!viewerCheckedIn||spaceSaving) return;
    if(await saveSpace({type:'chat',text})) {setNow(Date.now());setChatText('');}
  };
  const selectDesk = (slot: number) => { setObjectMenu({id:`desk:${slot}`,x:45,y:45,room:currentRoom}); setSpaceError(''); };
  const openLayout = () => {
    if (!canEdit || !sharedReady) return;
    setObjectLibrary(false); setObjectMenu(null); setMusicOpen(false); setDraft({ ornaments: structuredClone(space.ornaments), desks: structuredClone(space.desks), lightPositions:structuredClone(space.lightPositions), layoutRevision: space.layoutRevision }); setSelectedOrnament(''); setPanel(null); setEditing(null); setSpaceError('');
  };
  const deskOwner = selectedDesk === null ? undefined : data.members.find(member => space.claims[member.id] === selectedDesk);
  const shownOrnaments = draft && canEdit ? draft.ornaments : space.ornaments;
  const menuSlot=objectMenu?.id.startsWith('desk:')?Number(objectMenu.id.slice(5)):null;
  const menuItem=shownOrnaments.find(item=>item.id===objectMenu?.id);
  const menuOwner=menuSlot===null?undefined:data.members.find(member=>space.claims[member.id]===menuSlot);
  const editMenuObject=()=>{
    if(!objectMenu||!canEdit||!draft) {setSpaceError('Masuk ke mode Edit ruangan sebelum mengubah komponen.');return;}
    setSelectedOrnament(objectMenu.id); closeObjectMenu();
  };
  const deleteMenuObject=async()=>{
    if(!objectMenu||!canEdit) return;
    if(!draft) {setSpaceError('Masuk ke mode Edit ruangan sebelum menghapus komponen.');return;}
    if(menuSlot!==null&&draft) { const p=deskPosition(menuSlot,draft.desks);setDraft({...draft,desks:[...draft.desks.filter(d=>d.slot!==menuSlot),{...p,slot:menuSlot,removed:true}]});setSelectedOrnament('');closeObjectMenu();return; }
    const id=objectMenu.id, prefix=id==='manager-desk'?'manager':id==='lead-desk'?'lead':'';
    const ornaments=shownOrnaments.filter(item=>item.id!==id&&!(prefix&&['chair','laptop','keyboard','lamp','pen'].some(part=>item.id===`${prefix}-${part}`)));
    setDraft({...draft,ornaments}); setSelectedOrnament(''); closeObjectMenu();
  };

  const blockHolidayInteraction = useCallback((event: SyntheticEvent) => {
    if (!holidayLocked) return;
    const target = event.target as Element | null;
    if (target?.closest('.office-holiday-lock')) return;
    if (holidayAccess?.isAdmin && target?.closest('.office-holiday-admin')) return;
    event.preventDefault();
    event.stopPropagation();
  }, [holidayAccess?.isAdmin, holidayLocked]);

  const holidayPreviewOnly = Boolean(
    holidayAccess?.isAdmin && holidayMessagePreview && !holidayAccess.isHoliday
  );
  const holidayOverlayVisible = holidayLocked || holidayPreviewOnly;
  const holidayOverlayMessage = holidayLocked
    ? holidayAccess?.message || 'Hari ini libur. Besok kita kembali lagi.'
    : holidayMessagePreview || '';

  return <section
    className={`spatial-office ${immersive ? 'office-game' : ''} ${workCenterPreview ? 'office-work-center' : ''} ${panel ? `office-panel-${panel}` : ''} ${editing ? 'office-avatar-editing' : ''} ${holidayLocked ? 'office-holiday-locked' : ''}`}
    aria-label="Kantor 3D"
    data-holiday-locked={holidayLocked || undefined}
    onClickCapture={blockHolidayInteraction}
    onSubmitCapture={blockHolidayInteraction}
    onKeyDownCapture={(event) => {
      if (event.key === 'Enter' || event.key === ' ') blockHolidayInteraction(event);
    }}
  >
    {immersive && <header className="office-game-hud">
      <div className="office-game-brand">{/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={OFFICE_BRAND.logo} alt="" /><div><strong>{OFFICE_BRAND.name}</strong><span>{workCenterPreview ? `WORK CENTER${demo ? ' PREVIEW' : ''} · ${active} ONLINE` : demo ? 'SIMULASI' : error ? 'KONEKSI TERPUTUS' : dataReady ? `${active} CHECK-IN · AREA ${currentRoom + 1}` : 'MENGHUBUNGKAN…'}</span></div></div>
      <div className="office-game-actions">
        <div className="office-clock" title={`Zona waktu ${clock.timezone}${schedule?.configured ? '' : ' · jadwal standar Sen–Jum 08:30–17:30'}`}>
          {clock.phase === 'Malam' ? <Moon size={14} /> : <Sun size={14} />}<div><time>{now ? clock.clock : '—:—:—'}</time><small>{clock.phase} · {clock.timezone.split('/').at(-1)}</small></div>
        </div>
        <OfficeWeather />
        {rooms > 1 && <select aria-label="Area kantor" value={currentRoom} onChange={event => { setRoom(Number(event.target.value)); setSelectedOrnament(''); }}>{Array.from({ length: rooms }, (_, i) => <option key={i} value={i}>Area {i + 1}</option>)}</select>}
        {onStatistics ? <button type="button" title="Kembali ke workspace" aria-label="Kembali ke workspace" onClick={onStatistics}><LayoutDashboard size={17} /><span className="office-back-copy">Workspace</span></button> : <Link className="office-back-dashboard" href="/dashboard" aria-label="Kembali ke workspace"><LayoutDashboard size={17} /><span className="office-back-copy">Workspace</span></Link>}
        <button type="button" aria-label="Sinkronkan data kantor" disabled={refreshing} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} /></button>
      </div>
    </header>}
    <header className="office-heading">
      <div><div className="office-eyebrow"><span className="office-tiny-square" /> SPATIAL WORKSPACE <span className="office-version">02</span></div>
        <h2>Satu tim. Satu ruang.</h2><p>Temui tim di meja mereka, dari mana saja.</p>
      </div>
      <div className="office-heading-actions">
        <span className={`office-sync ${error ? 'office-sync-warning' : ''}`} role="status"><span />{demo ? 'Data contoh · bukan presensi asli' : error ? 'Koneksi data bermasalah' : !dataReady ? 'Menghubungkan presensi…' : realtimeConnected ? 'Presensi live' : 'Sinkron berkala · 10 detik'}</span>
        {!demo && <button type="button" className="office-icon-button" aria-label="Sinkronkan kantor" title="Sinkronkan kantor" disabled={refreshing} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} /></button>}
      </div>
    </header>
    {demo && <div className="office-demo-note"><Box size={16} /><span><strong>Simulasi desain — tidak mengikuti check-in asli.</strong> Nama dan presensi di sini adalah contoh. Pilih anggota untuk mencoba check-in, istirahat, atau checkout.</span></div>}
    {error && <div className="office-error" role="alert">{error} {data.syncedAt && 'Tampilan menggunakan data terakhir yang berhasil diterima.'}{authRequired && <Link href="/login" className="office-login-link">Buka halaman login →</Link>}</div>}
    <div className="office-stats">
      <div><Users size={16} /><strong>{dataReady ? active : '—'}</strong><span>check-in</span></div>
      <div><Coffee size={16} /><strong>{dataReady ? paused : '—'}</strong><span>istirahat</span></div>
      <div><Box size={16} /><strong>{dataReady ? data.members.length : '—'}</strong><span>meja tim</span></div>
      <span className="office-stats-caption">Avatar hadir setelah check-in; checkout melalui pintu depan.</span>
    </div>
    <div className="office-stage">
      {embeddedAttendance && <FloatingAttendance placement="office-stage" />}
      <div className="office-stage-bar">
        <div className="office-room-name"><span className="office-room-icon"><Box size={17} /></span><div><strong>Meja komunal</strong><span>Area {currentRoom + 1} dari {rooms} · {members.length} anggota</span></div></div>
        <div className="office-stage-actions">
          {rooms > 1 && <div className="office-room-nav"><button type="button" aria-label="Area sebelumnya" disabled={currentRoom === 0} onClick={() => setRoom(currentRoom - 1)}><ChevronLeft size={17} /></button><span>{currentRoom + 1}/{rooms}</span><button type="button" aria-label="Area berikutnya" disabled={currentRoom >= rooms - 1} onClick={() => setRoom(currentRoom + 1)}><ChevronRight size={17} /></button></div>}
          <button type="button" className="office-motion" aria-label={motion ? 'Jeda animasi' : 'Aktifkan animasi'} aria-pressed={!motion} onClick={() => setMotion(value => !value)}>{motion ? <Pause size={14} /> : <Play size={14} />}<span>{motion ? 'Jeda animasi' : 'Aktifkan animasi'}</span></button>
        </div>
      </div>
      <OfficeCanvas workCenterPreview={workCenterPreview} showBubbles={!workCenterPreview||showSceneBubbles} onBubble={rememberChatBubble} officeTools={workCenterPreview?{onActivity:()=>{setActivityMenu(true);setUtility(null);setObjectMenu(null);setSpaceError('');},onLights:()=>{setUtility({boardId:null});setSpaceError('');},onWhiteboard:currentWhiteboard?()=>{setUtility({boardId:currentWhiteboard.id});setSpaceError('');}:undefined,onRadio:currentRadio?()=>{setMusicOpen(true);setUtility(null);setObjectMenu(null);setSpaceError('');}:undefined,bubblesVisible:showSceneBubbles,onBubbles:()=>setShowSceneBubbles(value=>!value),onEdit:canEdit?()=>{if(draft){setDraft(null);setSelectedOrnament('');setSpaceError('');}else openLayout();}:undefined,editing:Boolean(draft),editDisabled:!sharedReady||spaceSaving}:undefined} signText={space.signText||DEFAULT_SIGN_TEXT} lights={space.lights} lightPositions={draft&&canEdit?draft.lightPositions:space.lightPositions} schedule={schedule} desks={draft && canEdit ? draft.desks : space.desks} members={members} motion={motion} selected={workCenterPreview ? workCenterMember?.id || selected : selected} onSelect={id=>{if(draft)return;selectMember(id);if(!workCenterPreview&&(demo||id===data.viewerId)){setActivityMenu(true);setSpaceError('');setPanel(null);}}} room={currentRoom} ornaments={shownOrnaments} editing={Boolean(draft && canEdit && !spaceSaving)} selectedOrnament={selectedOrnament} onSelectOrnament={id=>{setSelectedOrnament(id);setSpaceError('');}} onSelectDesk={selectDesk} onObjectMenu={target=>{const asset=shownOrnaments.find(o=>o.id===target.id)?.asset;if(!draft&&asset==='whiteboard'){setUtility({boardId:target.id});setObjectMenu(null);}else if(!draft&&asset==='team_radio'){setMusicOpen(true);setObjectMenu(null);}else setObjectMenu({...target,room:currentRoom});setSpaceError('');}} onMoveOrnament={(id, x, z, y) => {
        if(!draft || !canEdit || spaceSaving) return;
        try {
          if(id.startsWith('desk:')) setDraft({...draft,desks:moveDesk(draft.desks,Number(id.slice(5)),{x,z},rooms,draft.ornaments)});
          else if(id.startsWith('light:')) setDraft({...draft,lightPositions:moveRoomLight(draft.lightPositions,currentRoom,id.slice(6) as RoomLightKey,{x,z},rooms)});
          else {
            const legacyItems=JSON.stringify(draft.desks)===JSON.stringify(space.desks)?space.ornaments:undefined;
            setDraft({...draft,ornaments:moveOrnament(draft.ornaments,id,{x,z,...(y===undefined?{}:{y})},rooms,draft.desks,false,legacyItems)});
          }
          setSpaceError('');
        } catch(failure) { setSpaceError(failure instanceof Error ? failure.message : 'Posisi belum valid.'); }
      }}>
        {objectMenu&&objectMenu.room===currentRoom&&(menuSlot!==null?!deskPosition(menuSlot,draft?.desks||space.desks).removed:Boolean(menuItem))&&<OfficeObjectMenu key={objectMenu.id} target={objectMenu} title={menuSlot!==null?deskLabel(menuSlot):menuItem?ORNAMENTS[menuItem.asset].label:'Objek kantor'} slot={menuSlot} owner={menuOwner} viewerId={viewerId} members={data.members} canEdit={canEdit} ready={sharedReady} busy={spaceSaving} hasDraft={Boolean(draft)} error={spaceError} onClose={closeObjectMenu} onEdit={editMenuObject} onClaim={async()=>{if(menuSlot!==null&&await saveSpace({type:'claim',slot:menuSlot})) closeObjectMenu();}} onAssign={async memberId=>{if(menuSlot!==null&&await saveSpace({type:'assign',slot:menuSlot,memberId})) closeObjectMenu();}} onDelete={()=>void deleteMenuObject()}/>}
      </OfficeCanvas>
      {!data.members.length && !refreshing && !error && <div className="office-empty">Tim belum memiliki anggota. Meja akan muncul mengikuti data tim.</div>}
      {holidayOverlayVisible && <div className="office-holiday-lock" data-preview={holidayPreviewOnly || undefined} role="dialog" aria-modal={holidayLocked} aria-labelledby="office-holiday-lock-title">
        <section>
          {holidayPreviewOnly && <button type="button" className="office-holiday-lock-close" onClick={() => setHolidayMessagePreview(null)} aria-label="Tutup pratinjau pesan libur"><X size={16} /></button>}
          <span className="office-holiday-lock-icon"><CalendarOff size={24} /></span>
          <p>{holidayPreviewOnly ? 'PRATINJAU MODE LIBUR' : 'WORKSPACE SEDANG LIBUR'}</p>
          <h2 id="office-holiday-lock-title">Hari ini libur</h2>
          <time>{holidayPreviewOnly ? 'Tampilan contoh untuk Admin' : holidayDateLabel(holidayAccess?.date)}</time>
          <strong>{holidayOverlayMessage}</strong>
          <div><Clock3 size={15} /><span><small>Workspace dibuka kembali</small>{holidayAccess?.nextWorkingLabel || 'sesuai jadwal kerja berikutnya'}</span></div>
          <footer><LockKeyhole size={13} /> {holidayPreviewOnly
            ? 'Ini hanya pratinjau. Workspace belum dikunci.'
            : holidayAccess?.isAdmin
              ? 'Semua navigasi dikunci. Kontrol Mode libur tetap tersedia agar Admin dapat membuka workspace kembali.'
              : 'Seluruh tombol, tools, dan halaman kerja sedang dikunci.'}</footer>
        </section>
      </div>}
      <div className="office-stage-footer"><span><i /> Sudah check-in</span><span>Jeda: lounge · Checkout: keluar kantor</span><p>Bubble: project & tugas · Pantry: animasi 1 menit setiap 15 menit kerja.</p></div>
    </div>
    {workCenterPreview && <aside className="office-work-center-panel" aria-label="Pusat operasional tim">
      <header className="office-work-center-header">
        <div><div className="office-work-center-kicker"><span /> WORK CENTER {demo && <small>PREVIEW</small>}</div><p>{active} online · {paused} istirahat · {projectRollups.length} project</p></div>
        <button className="office-work-center-presence-trigger" type="button" aria-label="Buka presensi live" title="Presensi live" onClick={()=>window.dispatchEvent(new Event('bilik-open-floating-attendance'))}><Clock3 size={16}/><i data-active={Boolean(viewerMember&&viewerMember.status!=='offline')}/></button>
      </header>
      <div className="office-work-center-tabs" role="tablist" aria-label="Pusat operasional tim">
        {([['today','Hari Ini'],['projects','Projects'],['inbox','Inbox']] as const).map(([tab,label])=><button id={`work-center-tab-${tab}`} aria-controls={`work-center-panel-${tab}`} key={tab} type="button" role="tab" aria-selected={workCenterTab===tab} onClick={()=>setWorkCenterTab(tab)}>{label}</button>)}
      </div>
      <div className="office-work-center-body" id={`work-center-panel-${workCenterTab}`} role="tabpanel" aria-labelledby={`work-center-tab-${workCenterTab}`}>
        {workCenterTab==='today'&&<>
          <section className="office-work-center-team-summary"><span>RINGKASAN TIM</span><strong>{active} dari {data.members.length} anggota hadir</strong><p>{activeTasks.length} task masih aktif di {projectRollups.length} project.</p></section>
          <div className="office-work-center-metrics office-work-center-metrics-team">
            <div><Users size={14}/><strong>{active}</strong><span>Online</span></div>
            <div><ListChecks size={14}/><strong>{activeTasks.length}</strong><span>Task aktif</span></div>
            <div><CircleAlert size={14}/><strong>{pendingApprovals.length}</strong><span>Approval</span></div>
            <div><Bell size={14}/><strong>{workCenterFeed.unreadCount}</strong><span>Belum dibaca</span></div>
          </div>
          <section className="office-work-center-team-tasks">
            <div className="office-work-center-section-title"><span>PRIORITAS AKTIF</span><Link href="/my-tasks">Lihat semua <ArrowUpRight size={10}/></Link></div>
            {activeTasks.length?activeTasks.slice(0,4).map((task,index)=><article key={task.id}><i data-active={task.status==='in_progress'}>{index+1}</i><div><strong>{task.name}</strong><span>{task.member}{task.project?` · ${task.project}`:''}</span></div><em>{task.status.replaceAll('_',' ')}</em></article>):<p className="office-work-center-empty"><CheckCircle2 size={16}/> Tidak ada task aktif yang perlu ditindaklanjuti.</p>}
          </section>
          <section className="office-work-center-quick-links" aria-label="Akses cepat">
            <Link href="/timeline"><Clock3 size={15}/><span><strong>Timeline tim</strong><small>Lihat jadwal & deadline</small></span><ArrowUpRight size={11}/></Link>
            <Link href="/approvals"><CheckCircle2 size={15}/><span><strong>Approval Center</strong><small>{pendingApprovals.length?`${pendingApprovals.length} menunggu tinjauan`:'Tidak ada yang tertunda'}</small></span><ArrowUpRight size={11}/></Link>
          </section>
        </>}
        {workCenterTab==='projects'&&<section className="office-work-center-projects">
          <div className="office-work-center-section-title"><span>PROJECT AKTIF</span><Link href="/projects">Buka hub <ArrowUpRight size={10}/></Link></div>
          {projectRollups.length?projectRollups.map(project=>{
            const progress=project.taskCount?Math.min(100,Math.round(project.completedTasks/project.taskCount*100)):0;
            return <Link href={workCenterProjectHref(project.name)} onClick={()=>rememberProjectFolder(project)} key={project.name} className="office-work-center-project-card" aria-label={`Buka folder project ${project.name}`}><div className="office-work-center-project-card-heading"><span><FolderKanban size={15}/></span><div><strong>{project.name}</strong><small>{project.members.join(', ')}</small></div><b>{progress}%</b></div><i><span style={{width:`${progress}%`}}/></i><footer><span>{project.taskCount} task</span><span>{formatWorkDuration(project.trackedSeconds)} tercatat</span></footer></Link>;
          }):<p className="office-work-center-empty">Belum ada project aktif dari data tim.</p>}
        </section>}
        {workCenterTab==='inbox'&&<section className="office-work-center-inbox">
          <div className="office-work-center-inbox-summary"><div><Bell size={15}/><span><strong>{workCenterFeed.unreadCount}</strong><small>Notifikasi baru</small></span></div><div><CircleAlert size={15}/><span><strong>{pendingApprovals.length}</strong><small>Approval tertunda</small></span></div></div>
          <div className="office-work-center-section-title"><span>NOTIFIKASI</span><Link href="/notifications">Lihat semua <ArrowUpRight size={10}/></Link></div>
          {unreadNotifications.length?unreadNotifications.slice(0,4).map(notification=><Link href={notification.entity_url||'/notifications'} key={notification.id} className="office-work-center-inbox-item"><i><Bell size={12}/></i><div><strong>{notification.title}</strong><span>{notification.message}</span><small>{compactDate(notification.created_at)}</small></div></Link>):<p className="office-work-center-empty">{workCenterFeed.loading?'Mengambil notifikasi…':'Semua notifikasi sudah dibaca.'}</p>}
          <div className="office-work-center-section-title office-work-center-approval-title"><span>MENUNGGU APPROVAL</span><Link href="/approvals">Buka center <ArrowUpRight size={10}/></Link></div>
          {pendingApprovals.length?pendingApprovals.slice(0,3).map(approval=><Link href="/approvals" key={approval.id} className="office-work-center-inbox-item"><i><CheckCircle2 size={12}/></i><div><strong>{approval.title}</strong><span>{approval.requested_by_name||'Permintaan tim'}</span><small>{compactDate(approval.submitted_at)}</small></div></Link>):<p className="office-work-center-empty">Tidak ada approval yang menunggu.</p>}
        </section>}
      </div>
      {!demo && <HolidayAdminControl key={holidayAccess?.control.updatedAt || 'holiday-control'} onPreview={setHolidayMessagePreview} />}
    </aside>}
    {workCenterPreview&&<div className="office-work-center-chat-stack">
      {visibleChatHistory.length>0&&<div className="office-work-center-chat-history" aria-label="Riwayat percakapan kantor" aria-live="polite">{visibleChatHistory.map(message=><article key={message.key}><span className="office-work-center-chat-avatar" style={message.profilePicture?{backgroundImage:`url(${JSON.stringify(message.profilePicture)})`}:undefined}>{message.profilePicture?'':message.name.slice(0,2).toUpperCase()}</span><div><strong>{message.name}</strong><p>{message.text}</p></div></article>)}</div>}
      <form className="office-work-center-chat" onSubmit={event=>void sendAvatarChat(event)}>
        <label htmlFor="work-center-chat">Tulis pesan untuk ruang 3D</label><input id="work-center-chat" value={chatText} onChange={event=>setChatText(event.target.value)} maxLength={150} disabled={!viewerCheckedIn||!sharedReady||spaceSaving||Boolean(draft)} placeholder={viewerCheckedIn?'Tulis pesan…':'Check-in untuk mengirim pesan'}/><small>{chatText.length}/150</small><button type="submit" disabled={!chatText.trim()||!viewerCheckedIn||!sharedReady||spaceSaving||Boolean(draft)} aria-label="Kirim pesan avatar"><Send size={14}/></button>
      </form>
    </div>}
    {immersive&&!workCenterPreview&&<form className="office-avatar-chat" onSubmit={event=>void sendAvatarChat(event)}>
      <input aria-label="Pesan bubble avatar" value={chatText} onChange={event=>setChatText(event.target.value)} maxLength={150} disabled={!viewerCheckedIn||!sharedReady||spaceSaving||Boolean(draft)} placeholder={viewerCheckedIn?'Ketik pesan avatar…':'Check-in untuk mengobrol'}/>
      <span>{chatText.length}/150</span>
      <button type="submit" disabled={!chatText.trim()||!viewerCheckedIn||!sharedReady||spaceSaving||Boolean(draft)} aria-label="Kirim pesan avatar"><Send size={15}/></button>
    </form>}
    <div className="office-game-dock" aria-label="Aksi kantor">
      <button type="button" disabled={Boolean(draft)} aria-pressed={panel === 'team'} onClick={() => { setPanel(panel === 'team' ? null : 'team'); }}><Users size={18} /><span>Tim</span></button>
      <button type="button" aria-label="Aktivitas avatar saya" disabled={!viewerId||Boolean(draft)} onClick={()=>{setActivityMenu(true);setUtility(null);setObjectMenu(null);setSpaceError('');}}><MapPin size={18}/><span>Aktivitas</span></button>
      <button type="button" aria-label="Lampu ruangan" onClick={()=>{setUtility({boardId:null});setSpaceError('');}}><Lightbulb size={18}/><span>Lampu</span></button>
      {space.ornaments.some(o=>o.room===currentRoom&&o.asset==='whiteboard')&&<button type="button" aria-label="Buka papan ide" disabled={Boolean(draft)} onClick={()=>{setUtility({boardId:space.ornaments.find(o=>o.room===currentRoom&&o.asset==='whiteboard')!.id});setSpaceError('');}}><StickyNote size={18}/><span>Papan ide</span></button>}
      {space.ornaments.some(o=>o.room===currentRoom&&o.asset==='team_radio')&&<button type="button" aria-label="Buka radio tim" disabled={Boolean(draft)} onClick={()=>{setMusicOpen(true);setUtility(null);setObjectMenu(null);setSpaceError('');}}><Radio size={18}/><span>Radio</span></button>}
      {canEdit&&<button type="button" aria-label="Ganti tulisan neon" disabled={Boolean(draft)||!sharedReady} onClick={()=>{setSignOpen(true);setSpaceError('');}}><Type size={18}/><span>Neon</span></button>}
      <Link href="/attendance"><Check size={18} /><span>Presensi</span></Link>
      <button type="button" disabled={!viewerId || Boolean(draft)} onClick={() => { if (viewerId) { selectMember(viewerId); setEditing({ id: viewerId, avatar: data.members.find(m => m.id === viewerId)?.avatar || defaultAvatar(viewerId) }); } }}><Users size={18} /><span>Avatar</span></button>
      {canEdit && <button type="button" aria-label="Tambah objek" disabled={!sharedReady||spaceSaving} onClick={()=>{if(!draft)openLayout();setObjectLibrary(true);setObjectMenu(null);}}><Plus size={18}/><span>Tambah objek</span></button>}
      {canEdit && <button className="office-edit-room" aria-label="Edit ruangan" title="Edit ruangan" type="button" disabled={!sharedReady || spaceSaving} onClick={draft ? () => setDraft(null) : openLayout} aria-pressed={Boolean(draft)}><PencilRuler size={18} /><span>Edit ruangan</span></button>}
      <button type="button" onClick={() => setMotion(value => !value)} aria-pressed={!motion}>{motion ? <Pause size={18} /> : <Play size={18} />}<span>{motion ? 'Jeda' : 'Gerak'}</span></button>
    </div>
    {activityMenu&&<OfficeActivityMenu member={data.members.find(m=>m.id===viewerId)} activity={space.activities[viewerId||'']} now={now} ready={sharedReady} busy={spaceSaving} error={spaceError} onClose={()=>setActivityMenu(false)} onPick={zone=>saveSpace({type:'activity',zone})}/>}
    {utility&&<OfficeUtilities key={utility.boardId||'lights'} space={space} room={currentRoom} night={clock.phase==='Malam'} boardId={utility.boardId} viewerId={viewerId||''} canEdit={canEdit} busy={spaceSaving} ready={sharedReady} error={spaceError} onSave={saveSpace} onClose={()=>setUtility(null)} names={Object.fromEntries(data.members.map(m=>[m.id,m.name]))} onEdit={()=>{const id=utility.boardId;setUtility(null);openLayout();if(id)setSelectedOrnament(id);}}/>}
    {signOpen&&<OfficeSignEditor value={space.signText||DEFAULT_SIGN_TEXT} ready={sharedReady} busy={spaceSaving} error={spaceError} onClose={()=>{setSignOpen(false);setSpaceError('');}} onSave={saveSpace}/>}
    <OfficeMusicPlayer open={musicOpen} music={space.music} playback={space.musicPlayback} checkedIn={viewerCheckedIn} onlineCount={checkedInCount} canEdit={canEdit} ready={sharedReady} busy={spaceSaving} error={spaceError} onOpen={()=>{setMusicOpen(true);setSpaceError('');}} onClose={()=>{setMusicOpen(false);setSpaceError('');}} onSave={saveSpace}/>
    {canEdit && !sharedReady && immersive && dataReady && <div className="office-game-toast is-persistent" role="status">Penyimpanan kantor belum terhubung. Klaim dan editor belum aktif.</div>}
    {notice && immersive && <div className="office-game-toast is-notice" role="status"><span className="office-toast-mark"><Check size={13}/></span><span>{notice}</span><button type="button" aria-label="Tutup pemberitahuan" onClick={() => setNotice('')}>×</button></div>}
    {panel === 'desks' && <aside className="office-desks-panel" aria-label="Kepemilikan meja">
      <div className="office-panel-title"><h3>Pilih meja Anda</h3><button type="button" onClick={() => setPanel(null)} aria-label="Tutup pilihan meja">×</button></div>
      <p>Meja terisi tetap milik penggunanya meski offline. Pindah ke meja kosong akan melepas meja lama Anda.</p>
      {demo && <p>Simulasi klaim sebagai <strong>{data.members.find(m => m.id === viewerId)?.name}</strong>. Pilih anggota untuk mengganti pengguna simulasi.</p>}
      <div className="office-desk-grid">{Array.from({ length: DESKS_PER_ROOM }, (_, index) => {
        const slot = currentRoom * DESKS_PER_ROOM + index, owner = data.members.find(member => space.claims[member.id] === slot);
        if(deskPosition(slot,space.desks).removed) return null;
        return <button type="button" key={slot} aria-pressed={slot === selectedDesk} className={owner?.id === viewerId ? 'is-mine' : ''} onClick={() => setSelectedDesk(slot)}><strong>{String(slot + 1).padStart(2, '0')}</strong><span>{owner?.name || 'Kosong'}</span></button>;
      })}</div>
      {selectedDesk !== null && <div className="office-desk-claim"><strong>{deskLabel(selectedDesk)}</strong><p>{deskOwner ? deskOwner.id === viewerId ? 'Meja Anda saat ini.' : `Dimiliki ${deskOwner.name}.` : 'Tersedia untuk diklaim.'}</p><button type="button" disabled={!viewerId || !sharedReady || spaceSaving || Boolean(deskOwner)} onClick={() => void saveSpace({ type: 'claim', slot: selectedDesk })}>{spaceSaving ? 'Menyimpan…' : 'Klaim & pindah ke meja ini'}</button></div>}
      {!sharedReady && <p role="status">Klaim meja tersedia setelah penyimpanan server terhubung.</p>}
      {spaceError && <p role="alert">{spaceError}</p>}
      {rooms > 1 && <div className="office-editor-rotate"><button type="button" disabled={!currentRoom} onClick={() => setRoom(currentRoom - 1)}>← Area sebelumnya</button><button type="button" disabled={currentRoom === rooms - 1} onClick={() => setRoom(currentRoom + 1)}>Area berikutnya →</button></div>}
    </aside>}
    {draft && canEdit && <OfficeEditor library={objectLibrary} onLibraryChange={setObjectLibrary} desks={draft.desks} baselineDesks={space.desks} onDesksChange={desks => { if (!spaceSaving) { setDraft({ ...draft, desks }); setSpaceError(''); } }} items={draft.ornaments} baselineItems={space.ornaments} lightPositions={draft.lightPositions} onLightPositionsChange={lightPositions=>{if(!spaceSaving){setDraft({...draft,lightPositions});setSpaceError('');}}} claims={space.claims} room={currentRoom} rooms={rooms} selected={selectedOrnament} onSelect={setSelectedOrnament} onChange={ornaments => { if (!spaceSaving) { setDraft({ ...draft, ornaments }); setSpaceError(''); } }} onSave={() => void saveSpace({ type: 'layout', ...draft })} onCancel={() => { setDraft(null); setSpaceError(''); }} onReload={openLayout} conflict={draft.layoutRevision !== space.layoutRevision} saving={spaceSaving} error={spaceError} />}
    <div className="office-bottom-grid">
      {immersive && <button type="button" className="office-close-drawer" onClick={() => { setPanel(null); setEditing(null); }} aria-label="Tutup panel tim">×</button>}
      <section className="office-team-panel">
        <div className="office-panel-title"><h3>Anggota tim <span>{data.members.length}</span></h3><input type="search" aria-label="Cari anggota kantor" placeholder="Cari anggota…" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div className="office-member-grid">
          {data.members.filter(member => member.name.toLowerCase().includes(query.toLowerCase())).map(member => <button key={member.id} type="button" className={`office-member ${selected === member.id ? 'is-selected' : ''}`} onClick={() => selectMember(member.id)} aria-pressed={selected === member.id}>
            <span className="office-initials">{member.name.slice(0, 2).toUpperCase()}<i className={`status-${member.status}`} /></span>
            <span className="office-member-copy"><strong>{member.name}</strong><span>{statusLabel(member)}</span></span>
            <span className="office-seat-number">{String((data.seats.get(member.id) ?? 0) + 1).padStart(2, '0')}</span>
          </button>)}
          {data.members.length > 0 && !data.members.some(member => member.name.toLowerCase().includes(query.toLowerCase())) && <p className="office-muted">Anggota tidak ditemukan.</p>}
        </div>
      </section>
      <aside className="office-detail-panel">
        <div className="office-panel-title"><h3>{selectedMember ? 'Meja anggota' : 'Ruang untuk terhubung'}</h3>{selectedMember && <button type="button" className="office-icon-button" aria-label="Tutup detail anggota" onClick={() => setSelected('')}><X size={15} /></button>}</div>
        {selectedMember ? <><h4>{selectedMember.name}</h4><p>{statusLabel(selectedMember)} · {deskLabel(data.seats.get(selectedMember.id) ?? 0)}</p><div className="office-project"><span>PROJECT PRESENSI</span><strong>{selectedMember.project || 'Belum ada project yang dipilih'}</strong></div></> : <p>Pilih karakter atau nama anggota untuk melihat status dan project yang sedang mereka kerjakan.</p>}
        {((demo && selectedMember) || (!demo && data.viewerId)) && !editing && <button type="button" className="office-edit-avatar" onClick={openEditor}>{demo ? 'Ubah avatar' : 'Ubah avatar saya'}</button>}
        {selectedMember && (demo || selectedMember.id === data.viewerId) && <div className="office-activity-controls">
          <button type="button" onClick={()=>{setActivityMenu(true);setSpaceError('');}}>Pilih aktivitas avatar</button>
          <small>{OFFICE_ACTIONS.find(a=>a.zone===(space.activities[selectedMember.id]?.until>now?space.activities[selectedMember.id].zone:'auto'))?.label} · Presensi tidak berubah.</small>
        </div>}
        {editing && <AvatarEditor value={editing.avatar} onChange={avatar => setEditing({ ...editing, avatar })} onSave={saveAvatar} onClose={() => setEditing(null)} demo={demo} storage={Boolean(data.avatarStorage)} />}
        {notice && <p role="status">{notice}</p>}
        {demo ? <div className="office-demo-controls">
          <button type="button" aria-pressed={demoAdmin} onClick={() => { setDemoAdmin(value => !value); setDraft(null); }}>Mode {demoAdmin ? 'admin' : 'anggota'}</button>
          {selectedMember && <><button type="button" onClick={() => changeDemo('working')}><LogIn size={14} /> Check-in</button><button type="button" onClick={() => changeDemo('paused')}><Coffee size={14} /> Istirahat</button><button type="button" onClick={() => changeDemo('offline')}><LogOut size={14} /> Checkout</button><button type="button" onClick={pantryDemo}><Coffee size={14} /> Simulasi 15 menit → pantry</button><button type="button" onClick={removeDemo}><X size={14} /> Hapus anggota</button></>}
          <button type="button" onClick={addDemo}><Plus size={14} /> Tambah anggota</button>
        </div> : <><Link href="/attendance" className="office-primary-link"><Check size={15} /> Buka presensi <ArrowUpRight size={15} /></Link><Link href="/office-preview" target="_blank" className="office-preview-link">Coba simulasi gerakan <ArrowUpRight size={13} /></Link></>}
      </aside>
    </div>
    {workCenterPreview && floatingProfileMember && memberProfilePopover && <aside
      id={`office-member-profile-${floatingProfileMember.id}`}
      className="office-member-profile-popover"
      role="dialog"
      aria-modal="false"
      aria-labelledby={`office-member-profile-title-${floatingProfileMember.id}`}
      style={{left:memberProfilePopover.left,bottom:memberProfilePopover.bottom}}
    >
      <header>
        <span className="office-member-profile-avatar" aria-hidden="true" data-photo={Boolean(floatingProfileMember.profilePicture)} style={floatingProfileMember.profilePicture?{backgroundImage:`url(${JSON.stringify(floatingProfileMember.profilePicture)})`}:undefined}>{floatingProfileMember.profilePicture?'':floatingProfileMember.name.slice(0,2).toUpperCase()}<i className={`status-${floatingProfileMember.status}`}/></span>
        <div><strong id={`office-member-profile-title-${floatingProfileMember.id}`}>{floatingProfileMember.name}</strong><span>{roleLabel(floatingProfileMember.profile?.roleTitle||floatingProfileMember.role)}{floatingProfileMember.profile?.division?` · ${floatingProfileMember.profile.division}`:''}</span></div>
        <button type="button" onClick={()=>setMemberProfilePopover(null)} aria-label={`Tutup profil ${floatingProfileMember.name}`}><X size={15}/></button>
      </header>
      <div className="office-member-profile-body">
        <div className="office-member-profile-status"><span><i className={`status-${floatingProfileMember.status}`}/>{statusLabel(floatingProfileMember)}</span><strong>{floatingProfileMember.project||'Belum ada project aktif'}</strong></div>
        <div className="office-member-profile-metrics">
          <div><Target size={14}/><span><strong>{floatingProfileMember.profile?.kpis.length||0}</strong>KPI aktif</span></div>
          <div><ListChecks size={14}/><span><strong>{floatingProfileMember.tasks?.length||0}</strong>Task berjalan</span></div>
          <div><BriefcaseBusiness size={14}/><span><strong>{floatingProfileProjects.length}</strong>Project</span></div>
        </div>

        <section className="office-member-profile-section">
          <h4><BriefcaseBusiness size={13}/> Jobdesk</h4>
          {floatingProfileMember.profile?.jobSummary&&<p>{floatingProfileMember.profile.jobSummary}</p>}
          {floatingProfileMember.profile?.jobDescriptions.length ? <ul>{floatingProfileMember.profile.jobDescriptions.slice(0,4).map((item,index)=><li key={`${item}-${index}`}>{item}</li>)}</ul> : !floatingProfileMember.profile?.jobSummary&&<p className="is-empty">Jobdesk belum diringkas di modul Performance.</p>}
        </section>

        <section className="office-member-profile-section">
          <div className="office-member-profile-heading"><h4><Target size={13}/> KPI &amp; OKR</h4>{floatingProfileMember.profile?.latestScore!==undefined&&<span>Nilai {Math.round(floatingProfileMember.profile.latestScore)}</span>}</div>
          {floatingProfileMember.profile?.kpis.length ? <div className="office-member-profile-kpis">{floatingProfileMember.profile.kpis.slice(0,4).map(kpi=><article key={kpi.id}>
            <div><strong>{kpi.title}</strong><span>{kpi.cadence.replaceAll('_',' ')||'Target'}{kpi.targetValue?` · target ${kpi.targetValue}${kpi.unit==='percent'?'%':` ${kpi.unit}`}`:''}</span></div>
            {kpi.progress!==undefined?<><b>{Math.round(kpi.progress)}%</b><i><span style={{width:`${Math.max(0,Math.min(100,kpi.progress))}%`}}/></i></>:<b title={floatingProfileMember.profile?.performanceRestricted?'Progres hanya terlihat oleh pemilik dan admin':'Belum ada update'}>—</b>}
          </article>)}</div> : <p className="is-empty">Belum ada KPI yang terhubung dengan profil ini.</p>}
          {floatingProfileMember.profile?.performanceRestricted&&<small className="office-member-profile-private">Progress KPI hanya terlihat oleh pemilik profil dan admin.</small>}
        </section>

        <section className="office-member-profile-section">
          <div className="office-member-profile-heading"><h4><ListChecks size={13}/> Task aktif</h4><span>{floatingProfileMember.tasks?.length||0}</span></div>
          {floatingProfileMember.tasks?.length?<div className="office-member-profile-tasks">{floatingProfileMember.tasks.slice(0,4).map((task,index)=><article key={`${task.name}-${index}`}><i>{index+1}</i><div><strong>{task.name}</strong><span>{task.status.replaceAll('_',' ')}</span></div></article>)}</div>:<p className="is-empty">Tidak ada task aktif yang terhubung.</p>}
        </section>

        <section className="office-member-profile-section">
          <div className="office-member-profile-heading"><h4><Timer size={13}/> Project &amp; waktu kerja</h4><span>{floatingProfileProjects.length}</span></div>
          {floatingProfileProjects.length?<div className="office-member-profile-projects">{floatingProfileProjects.slice(0,5).map(project=><article key={project.name}><div><strong>{project.name}</strong><span>{project.taskCount?`${project.completedTasks}/${project.taskCount} task selesai`:'Project presensi aktif'}</span></div><b>{formatWorkDuration(project.trackedSeconds)}</b></article>)}</div>:<p className="is-empty">Belum ada project atau waktu kerja yang tercatat.</p>}
        </section>
      </div>
      <footer><Link href="/performance">Performance <ArrowUpRight size={11}/></Link><Link href="/tasks">Tasks <ArrowUpRight size={11}/></Link><Link href="/projects">Projects <ArrowUpRight size={11}/></Link></footer>
    </aside>}
    {workCenterPreview && accountPopover && <aside
      id="office-account-menu"
      className="office-account-popover"
      role="dialog"
      aria-modal="false"
      aria-labelledby="office-account-menu-title"
      style={{left:accountPopover.left,bottom:accountPopover.bottom}}
    >
      <header>
        <span className="office-account-avatar" aria-hidden="true" data-photo={Boolean(accountMember?.profilePicture)} style={accountMember?.profilePicture?{backgroundImage:`url(${JSON.stringify(accountMember.profilePicture)})`}:undefined}>{accountMember?.profilePicture?'':(accountMember?.name||'AK').slice(0,2).toUpperCase()}</span>
        <div><strong id="office-account-menu-title">{accountMember?.name||'Akun saya'}</strong><span>{memberJobTitle(accountMember)}</span></div>
        <button type="button" onClick={()=>setAccountPopover(null)} aria-label="Tutup menu akun"><X size={15}/></button>
      </header>
      <div className="office-account-status" data-status={accountMember?.status||'offline'}>{accountMember&&(()=>{const {Icon}=memberStatusMeta(accountMember.status);return <Icon size={13}/>})()}<span>{accountMember?memberStatusMeta(accountMember.status).label:'Status belum tersedia'}</span></div>
      <nav aria-label="Menu akun">
        <Link href="/settings" onClick={()=>setAccountPopover(null)}><Settings size={15}/><span><strong>Pengaturan akun</strong><small>Profil, preferensi, dan workspace</small></span></Link>
        <Link href="/performance" onClick={()=>setAccountPopover(null)}><Target size={15}/><span><strong>Profil kinerja</strong><small>Jobdesk, KPI, dan perkembangan</small></span></Link>
        <Link href="/attendance" onClick={()=>setAccountPopover(null)}><Clock3 size={15}/><span><strong>Presensi saya</strong><small>Riwayat waktu kerja</small></span></Link>
        {/* Logout must stay a normal navigation so Next.js never prefetches this state-changing endpoint. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/auth/logout"><LogOut size={15}/><span><strong>Keluar</strong><small>Logout dari akun ini</small></span></a>
      </nav>
    </aside>}
    {workCenterPreview && <nav className="office-agent-strip" aria-label="Pilih anggota tim">
      <div className="office-account-control"><button type="button" className="office-account-trigger" aria-label={`Buka menu akun ${accountMember?.name||''}`.trim()} aria-haspopup="dialog" aria-expanded={Boolean(accountPopover)} aria-controls="office-account-menu" onClick={event=>toggleAccountPopover(event.currentTarget)}><span className="office-account-trigger-avatar" aria-hidden="true" data-photo={Boolean(accountMember?.profilePicture)} style={accountMember?.profilePicture?{backgroundImage:`url(${JSON.stringify(accountMember.profilePicture)})`}:undefined}>{accountMember?.profilePicture?'':(accountMember?.name||'AK').slice(0,2).toUpperCase()}</span><ChevronDown size={13}/></button></div>
      <div className="office-agent-strip-list">{data.members.map(member=>{const {label,Icon}=memberStatusMeta(member.status);return <button key={member.id} type="button" className="office-agent-card" aria-pressed={workCenterMember?.id===member.id} aria-expanded={memberProfilePopover?.id===member.id} aria-controls={`office-member-profile-${member.id}`} onClick={event=>toggleMemberProfile(member,event.currentTarget)}><span className="office-agent-status" data-status={member.status} title={label} aria-label={label}><Icon size={12}/></span><span className="office-agent-avatar" aria-hidden="true" data-photo={Boolean(member.profilePicture)} style={member.profilePicture?{backgroundImage:`url(${JSON.stringify(member.profilePicture)})`}:undefined}>{member.profilePicture?'':member.name.slice(0,2).toUpperCase()}</span><span className="office-agent-copy"><strong>{member.name}</strong><small>{memberJobTitle(member)}</small></span></button>})}</div>
    </nav>}
    <footer className="office-footnote"><span>Karakter bergerak sebagai ilustrasi suasana kerja; bukan pelacakan aktivitas.</span>{!demo && data.syncedAt && <span>Sinkron terakhir {new Date(data.syncedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} · {realtimeConnected ? 'Realtime + cadangan 10 detik' : 'Sinkron tiap 10 detik'}</span>}</footer>
  </section>;
}
