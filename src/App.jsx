import { useState, useEffect, useRef, useCallback } from "react";

const T = {
  sand:"#F7F3EE",sandMid:"#EDE6DB",sandDark:"#D9CDBF",
  stone:"#9E9287",ink:"#1C1917",inkSoft:"#44403C",inkMute:"#78716C",
  ember:"#C05C28",emberLt:"#E8824A",emberXlt:"#FBE9DA",
  pine:"#3A6B4A",pineLt:"#EAF3EC",sky:"#3B6FA0",skyLt:"#E5EEF7",
  gold:"#B5871A",goldLt:"#FDF3DC",mauve:"#8B5E8A",mauveLt:"#F3EAF3",
  white:"#FFFFFF",shadow:"rgba(28,25,23,0.08)",shadowMd:"rgba(28,25,23,0.14)",
};

// ── Haversine distance (miles) ──────────────────────────────────
function haversine(lat1,lon1,lat2,lon2){
  const R=3958.8,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function fmt(mi){if(mi===null)return"—";if(mi<0.1)return"<0.1 mi";return`${mi.toFixed(1)} mi`;}

// ── Supabase client stub ────────────────────────────────────────
// Replace these two values with your real Supabase project credentials.
// Everything else is already wired — the app will use Supabase automatically
// when SUPABASE_URL doesn't start with "YOUR_".
const SUPABASE_URL  = "https://lknoxozdbkikysxoarzu.supabase.co";
const SUPABASE_ANON = "sb_publishable_myANV71Ao-e3TRTqM5UuOA_mTobfrdH";
const SUPABASE_READY = !SUPABASE_URL.startsWith("YOUR_");

async function sbFetch(path,opts={}){
  const res=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    headers:{apikey:SUPABASE_ANON,Authorization:`Bearer ${SUPABASE_ANON}`,"Content-Type":"application/json",Prefer:"return=representation",...opts.headers},
    ...opts,
  });
  if(!res.ok)throw new Error(await res.text());
  return res.json();
}
async function fetchEventsFromDb({timeBucket,category}){
  let q="events?select=*&order=starts_at.asc";
  if(timeBucket&&timeBucket!=="Trending")q+=`&time_bucket=eq.${timeBucket}`;
  if(timeBucket==="Trending")q+="&is_trending=eq.true";
  if(category&&category!=="all")q+=`&category=eq.${category}`;
  return sbFetch(q);
}
async function toggleSavedDb(userId,eventId,wasSaved){
  if(wasSaved)return sbFetch(`saved_events?user_id=eq.${userId}&event_id=eq.${eventId}`,{method:"DELETE"});
  return sbFetch("saved_events",{method:"POST",body:JSON.stringify({user_id:userId,event_id:eventId})});
}
async function toggleIntDb(userId,eventId,wasInt){
  if(wasInt)return sbFetch(`interested?user_id=eq.${userId}&event_id=eq.${eventId}`,{method:"DELETE"});
  return sbFetch("interested",{method:"POST",body:JSON.stringify({user_id:userId,event_id:eventId})});
}

// ── Static data ─────────────────────────────────────────────────
const CATEGORIES=[
  {id:"all",label:"All",icon:"✦"},{id:"music",label:"Live Music",icon:"♪"},
  {id:"sports",label:"Sports & Pickup",icon:"◎"},{id:"outdoor",label:"Outdoor Activities",icon:"△"},
  {id:"wellness",label:"Wellness / Fitness",icon:"◇"},{id:"food",label:"Food & Social",icon:"○"},
  {id:"community",label:"Community",icon:"⬡"},
];
const CAT_META={
  music:{color:T.mauve,bg:T.mauveLt,label:"Live Music"},
  sports:{color:T.sky,bg:T.skyLt,label:"Sports & Pickup"},
  outdoor:{color:T.pine,bg:T.pineLt,label:"Outdoor Activities"},
  wellness:{color:T.gold,bg:T.goldLt,label:"Wellness / Fitness"},
  food:{color:T.ember,bg:T.emberXlt,label:"Food & Social"},
  community:{color:T.stone,bg:T.sandMid,label:"Community"},
};
const FILTERS=["Now","Tonight","This Weekend","Trending"];

// Real Boulder lat/lng coordinates for each event
const MOCK_EVENTS=[
  {id:1,cat:"music",time:"Now",is_trending:true,title:"Leftover Salmon — Acoustic Set",location:"The Sink · The Hill",vibe:"Bluegrass jam · Outdoor patio",gradient:"linear-gradient(145deg,#6B3FA0,#3B1F6B)",emoji:"🎸",lat:40.0090,lng:-105.2711},
  {id:2,cat:"outdoor",time:"Now",is_trending:false,title:"Sunset Hike — Royal Arch Trail",location:"Chautauqua Park · S Boulder",vibe:"Moderate · Golden hour views",gradient:"linear-gradient(145deg,#3A6B4A,#1F3D2A)",emoji:"🏔️",lat:39.9995,lng:-105.2811},
  {id:3,cat:"food",time:"Tonight",is_trending:true,title:"Tap Release Night",location:"Avery Brewing Co. · Gunbarrel",vibe:"Limited IPA drop · Patio open",gradient:"linear-gradient(145deg,#C05C28,#7A3010)",emoji:"🍺",lat:40.0374,lng:-105.2518},
  {id:4,cat:"wellness",time:"Tonight",is_trending:false,title:"Flow Yoga Under the Stars",location:"Boulder Creek Path · Downtown",vibe:"All levels · BYO mat",gradient:"linear-gradient(145deg,#B5871A,#7A5610)",emoji:"🧘",lat:40.0143,lng:-105.2766},
  {id:5,cat:"sports",time:"Now",is_trending:true,title:"Pickup Ultimate Frisbee",location:"Scott Carpenter Park · E Boulder",vibe:"All levels · Free to join",gradient:"linear-gradient(145deg,#3B6FA0,#1F3D62)",emoji:"🥏",lat:40.0142,lng:-105.2487},
  {id:6,cat:"community",time:"Tonight",is_trending:false,title:"Farmers Market Wind-Down",location:"13th & Canyon · Downtown",vibe:"Local vendors · Pet friendly",gradient:"linear-gradient(145deg,#7A6A5A,#4A3D30)",emoji:"🌿",lat:40.0165,lng:-105.2795},
  {id:7,cat:"music",time:"Tonight",is_trending:false,title:"Jazz on the Creek",location:"Foolish Craig's · The Hill",vibe:"Live jazz trio · Outdoor seating",gradient:"linear-gradient(145deg,#8B5E8A,#4A2F4A)",emoji:"🎷",lat:40.0093,lng:-105.2723},
  {id:8,cat:"outdoor",time:"This Weekend",is_trending:true,title:"Dawn Paddle — Boulder Reservoir",location:"Boulder Reservoir · N Boulder",vibe:"Kayak rental available · Calm water",gradient:"linear-gradient(145deg,#3B6FA0,#1F3D62)",emoji:"🚣",lat:40.0603,lng:-105.2257},
  {id:9,cat:"wellness",time:"This Weekend",is_trending:false,title:"Forest Bathing Walk",location:"Betasso Preserve · Boulder Canyon",vibe:"Guided · Meditative · 2 hrs",gradient:"linear-gradient(145deg,#3A6B4A,#1F3D2A)",emoji:"🌲",lat:40.0031,lng:-105.3437},
  {id:10,cat:"sports",time:"This Weekend",is_trending:true,title:"Saturday Soccer — Open Run",location:"Valmont Sports Park",vibe:"Co-ed · All skill levels",gradient:"linear-gradient(145deg,#3B6FA0,#1F3D62)",emoji:"⚽",lat:40.0208,lng:-105.2366},
];

// Boulder bounding box → SVG %
const BB={minLat:39.985,maxLat:40.075,minLng:-105.360,maxLng:-105.210};
function toXY(lat,lng){
  return{x:((lng-BB.minLng)/(BB.maxLng-BB.minLng))*100,y:((BB.maxLat-lat)/(BB.maxLat-BB.minLat))*100};
}

const USER={name:"Jordan Rivera",handle:"@jrivera",location:"Boulder, CO",bio:"Always chasing sunsets and live music 🎸🏔️",interests:["Live Music","Outdoor Activities","Food & Social","Wellness"],avatar:"JR"};

const tcol=t=>({Now:{bg:"#FEE9E0",color:T.ember},Tonight:{bg:T.skyLt,color:T.sky},"This Weekend":{bg:T.pineLt,color:T.pine},Trending:{bg:T.goldLt,color:T.gold}}[t]||{bg:T.sandMid,color:T.inkMute});

// ── Atoms ───────────────────────────────────────────────────────
function LivePip(){return(<span style={{position:"relative",display:"inline-flex",width:8,height:8,flexShrink:0}}><span style={{position:"absolute",inset:0,borderRadius:"50%",background:T.ember,opacity:0.35,animation:"pipPing 1.6s cubic-bezier(0,0,.2,1) infinite"}}/><span style={{position:"relative",width:8,height:8,borderRadius:"50%",background:T.ember}}/></span>);}
function TimeBadge({time}){const s=tcol(time);return(<span style={{display:"inline-flex",alignItems:"center",gap:5,background:s.bg,color:s.color,borderRadius:20,padding:"3px 9px",fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:600,letterSpacing:"0.05em",textTransform:"uppercase"}}>{time==="Now"&&<LivePip/>}{time}</span>);}
function SaveBtn({saved,onToggle}){return(<button onClick={e=>{e.stopPropagation();onToggle();}} style={{width:34,height:34,display:"flex",alignItems:"center",justifyContent:"center",background:saved?T.emberXlt:T.sandMid,border:`1.5px solid ${saved?T.emberLt:T.sandDark}`,borderRadius:"50%",cursor:"pointer",fontSize:14,transition:"all .18s",flexShrink:0}}>🔖</button>);}

// ── Geo Banner ──────────────────────────────────────────────────
function GeoBanner({geoState,onRequest}){
  if(geoState==="granted"||geoState==="loading")return null;
  return(
    <div style={{margin:"0 0 12px",background:T.white,border:`1.5px solid ${T.sandDark}`,borderRadius:14,padding:"11px 14px",display:"flex",alignItems:"center",gap:10,boxShadow:`0 1px 6px ${T.shadow}`}}>
      <span style={{fontSize:20,flexShrink:0}}>📍</span>
      <div style={{flex:1}}>
        <div style={{fontFamily:"'Nunito',sans-serif",fontSize:13,fontWeight:700,color:T.ink}}>{geoState==="denied"?"Location access denied":"See real distances from you"}</div>
        <div style={{fontFamily:"'Nunito',sans-serif",fontSize:11,color:T.stone,marginTop:1}}>{geoState==="denied"?"Update browser settings to allow location":"Events sort by how close they are"}</div>
      </div>
      {geoState!=="denied"&&<button onClick={onRequest} style={{background:T.ink,color:T.white,border:"none",borderRadius:10,padding:"7px 13px",fontFamily:"'Nunito',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>Allow</button>}
    </div>
  );
}

// ── Event Card ──────────────────────────────────────────────────
function EventCard({event,saved,interested,onSave,onInterest,index,distMiles}){
  const meta=CAT_META[event.cat];
  return(
    <div style={{background:T.white,borderRadius:16,boxShadow:`0 1px 6px ${T.shadow}`,animation:`cardUp .35s ease both`,animationDelay:`${index*45}ms`,cursor:"pointer",display:"flex",alignItems:"center",overflow:"hidden",transition:"box-shadow .15s"}}
      onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 4px 18px ${T.shadowMd}`}
      onMouseLeave={e=>e.currentTarget.style.boxShadow=`0 1px 6px ${T.shadow}`}>
      <div style={{width:60,flexShrink:0,background:event.gradient,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,alignSelf:"stretch"}}>{event.emoji}</div>
      <div style={{flex:1,padding:"11px 12px 11px 14px",minWidth:0}}>
        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:4,flexWrap:"wrap"}}>
          <span style={{background:meta.bg,color:meta.color,borderRadius:4,padding:"1px 6px",fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:600,letterSpacing:"0.08em",textTransform:"uppercase"}}>{meta.label}</span>
          <TimeBadge time={event.time}/>
          {event.is_trending&&<span style={{background:T.goldLt,color:T.gold,borderRadius:4,padding:"1px 6px",fontFamily:"'JetBrains Mono',monospace",fontSize:9,fontWeight:600}}>↑ Trending</span>}
        </div>
        <h3 style={{fontFamily:"'Fraunces',Georgia,serif",fontSize:15,fontWeight:700,lineHeight:1.3,color:T.ink,margin:"0 0 3px",letterSpacing:"-0.015em",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{event.title}</h3>
        <p style={{fontFamily:"'Nunito',sans-serif",fontSize:12,color:T.inkMute,margin:"0 0 2px",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>📍 {event.location}</p>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {event.vibe&&<p style={{fontFamily:"'Nunito',sans-serif",fontSize:11,color:T.stone,margin:0,fontStyle:"italic",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1}}>{event.vibe}</p>}
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:distMiles!=null?T.ember:T.stone,fontWeight:distMiles!=null?600:400,flexShrink:0}}>{fmt(distMiles)}</span>
        </div>
      </div>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:7,padding:"11px 13px 11px 4px",flexShrink:0}}>
        <SaveBtn saved={saved} onToggle={onSave}/>
        <button onClick={e=>{e.stopPropagation();onInterest();}} style={{background:interested?T.emberXlt:T.sandMid,color:interested?T.ember:T.stone,border:`1.5px solid ${interested?T.emberLt:T.sandDark}`,borderRadius:20,padding:"4px 9px",fontFamily:"'Nunito',sans-serif",fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .18s",whiteSpace:"nowrap"}}>
          {interested?"✦ Yes!":"✦ Going?"}
        </button>
      </div>
    </div>
  );
}

// ── Map View ────────────────────────────────────────────────────
function MapView({events,saved,interested,onSave,onInterest,userLat,userLng}){
  const[selected,setSelected]=useState(null);
  const sel=selected?events.find(e=>e.id===selected):null;
  const userXY=userLat!=null?toXY(userLat,userLng):null;
  return(
    <div style={{flex:1,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(160deg,#E8F0E0 0%,#D6E4C8 30%,#C8D8B8 60%,#B8C8A8 100%)"}}>
        <svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
          <line x1="200" y1="0" x2="200" y2="600" stroke="white" strokeWidth="5" opacity="0.7"/>
          <line x1="0" y1="300" x2="400" y2="300" stroke="white" strokeWidth="5" opacity="0.7"/>
          <line x1="150" y1="0" x2="150" y2="600" stroke="white" strokeWidth="3" opacity="0.5"/>
          <line x1="250" y1="0" x2="250" y2="600" stroke="white" strokeWidth="3" opacity="0.5"/>
          <line x1="0" y1="200" x2="400" y2="200" stroke="white" strokeWidth="3" opacity="0.5"/>
          <line x1="0" y1="400" x2="400" y2="400" stroke="white" strokeWidth="3" opacity="0.5"/>
          <path d="M0,320 Q80,315 160,325 Q240,335 320,318 Q360,310 400,315" fill="none" stroke="#6BAACC" strokeWidth="4" opacity="0.6"/>
          <path d="M0,480 L30,440 L60,460 L90,410 L120,390 L140,420 L160,380 L180,400 L200,370 L220,395 L240,375 L260,405 L280,385 L310,430 L340,415 L370,445 L400,430 L400,600 L0,600 Z" fill="#B8C8A0" opacity="0.5"/>
          <ellipse cx="100" cy="400" rx="45" ry="35" fill="#A8C890" opacity="0.5"/>
          <ellipse cx="320" cy="200" rx="40" ry="30" fill="#A8C890" opacity="0.45"/>
        </svg>
        {userXY&&(<div style={{position:"absolute",left:`${userXY.x}%`,top:`${userXY.y}%`,transform:"translate(-50%,-50%)",zIndex:20}}><div style={{width:16,height:16,borderRadius:"50%",background:T.sky,border:"3px solid white",boxShadow:`0 0 0 4px ${T.sky}44`}}/></div>)}
        <div style={{position:"absolute",top:16,left:16,background:"rgba(255,255,255,0.92)",backdropFilter:"blur(12px)",borderRadius:12,padding:"8px 14px",boxShadow:`0 2px 12px ${T.shadow}`}}>
          <div style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:T.ink}}>Boulder, CO</div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:T.stone,marginTop:1}}>{userLat!=null?"📍 Using your location":`${events.length} events`}</div>
        </div>
        {events.map(evt=>{
          const{x,y}=toXY(evt.lat,evt.lng);
          const meta=CAT_META[evt.cat];const isSel=selected===evt.id;
          return(<button key={evt.id} onClick={()=>setSelected(isSel?null:evt.id)} style={{position:"absolute",left:`${x}%`,top:`${y}%`,transform:`translate(-50%,-100%) scale(${isSel?1.15:1})`,background:"none",border:"none",cursor:"pointer",transition:"transform .2s",zIndex:isSel?10:5}}>
            <div style={{background:isSel?meta.color:T.white,color:isSel?T.white:meta.color,borderRadius:20,padding:isSel?"5px 10px":"4px 9px",fontFamily:"'Nunito',sans-serif",fontSize:11,fontWeight:800,boxShadow:isSel?`0 4px 16px ${meta.color}55`:`0 2px 8px ${T.shadow}`,border:`2px solid ${meta.color}`,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
              <span style={{fontSize:12}}>{evt.emoji}</span>{isSel&&evt.title.split(" ").slice(0,3).join(" ")}
            </div>
            <div style={{width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:`7px solid ${isSel?meta.color:T.white}`,margin:"0 auto"}}/>
          </button>);
        })}
      </div>
      {sel&&(
        <div style={{position:"absolute",bottom:0,left:0,right:0,background:T.white,borderRadius:"24px 24px 0 0",padding:"20px 20px 80px",boxShadow:`0 -4px 32px ${T.shadowMd}`,animation:"slideUp .25s ease",zIndex:20}}>
          <div style={{width:36,height:4,background:T.sandDark,borderRadius:2,margin:"0 auto 16px"}}/>
          <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
            <span style={{fontSize:32}}>{sel.emoji}</span>
            <div style={{flex:1}}>
              <h3 style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:700,color:T.ink,margin:"0 0 4px"}}>{sel.title}</h3>
              <p style={{fontFamily:"'Nunito',sans-serif",fontSize:13,color:T.inkMute,margin:"0 0 3px"}}>📍 {sel.location}</p>
              {sel.vibe&&<p style={{fontFamily:"'Nunito',sans-serif",fontSize:12,color:T.stone,fontStyle:"italic",margin:0}}>{sel.vibe}</p>}
            </div>
            <SaveBtn saved={saved.has(sel.id)} onToggle={()=>onSave(sel.id)}/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:14,alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <TimeBadge time={sel.time}/>
              {sel.distMiles!=null&&<span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.ember,fontWeight:600}}>{fmt(sel.distMiles)} away</span>}
            </div>
            <button onClick={()=>onInterest(sel.id)} style={{background:interested.has(sel.id)?T.emberXlt:T.sandMid,color:interested.has(sel.id)?T.ember:T.stone,border:`1.5px solid ${interested.has(sel.id)?T.emberLt:T.sandDark}`,borderRadius:20,padding:"6px 14px",fontFamily:"'Nunito',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              {interested.has(sel.id)?"✦ Interested":"✦ I'm interested"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Saved View ──────────────────────────────────────────────────
function SavedView({events,saved,interested,onSave,onInterest,userCoords}){
  const sv=events.filter(e=>saved.has(e.id));
  return(
    <div style={{flex:1,overflowY:"auto",padding:"24px 16px 100px"}}>
      <h2 style={{fontFamily:"'Fraunces',serif",fontSize:24,fontWeight:700,color:T.ink,margin:"0 0 4px"}}>Saved</h2>
      <p style={{fontFamily:"'Nunito',sans-serif",fontSize:14,color:T.inkMute,margin:"0 0 20px"}}>{sv.length} {sv.length===1?"event":"events"} bookmarked</p>
      {sv.length===0?(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:48,marginBottom:16}}>🔖</div>
          <p style={{fontFamily:"'Fraunces',serif",fontSize:18,color:T.inkMute}}>Nothing saved yet</p>
          <p style={{fontFamily:"'Nunito',sans-serif",fontSize:14,color:T.stone,marginTop:6}}>Tap 🔖 on any event</p>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {sv.map((e,i)=>(
            <EventCard key={e.id} event={e} index={i} saved={saved.has(e.id)} interested={interested.has(e.id)}
              onSave={()=>onSave(e.id)} onInterest={()=>onInterest(e.id)}
              distMiles={userCoords&&e.lat?haversine(userCoords.lat,userCoords.lng,e.lat,e.lng):null}/>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Profile View ────────────────────────────────────────────────
function ProfileView({saved,events,userCoords,geoState}){
  const sv=events.filter(e=>saved.has(e.id));
  return(
    <div style={{flex:1,overflowY:"auto",padding:"0 0 100px"}}>
      <div style={{background:`linear-gradient(160deg,${T.ember} 0%,#7A3010 100%)`,padding:"40px 20px 28px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,borderRadius:"50%",background:"rgba(255,255,255,0.06)"}}/>
        <div style={{width:72,height:72,borderRadius:"50%",background:"rgba(255,255,255,0.2)",border:"3px solid rgba(255,255,255,0.5)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Fraunces',serif",fontSize:26,fontWeight:700,color:T.white,marginBottom:14}}>{USER.avatar}</div>
        <h2 style={{fontFamily:"'Fraunces',serif",fontSize:22,fontWeight:700,color:T.white,margin:"0 0 2px"}}>{USER.name}</h2>
        <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:"rgba(255,255,255,0.65)",margin:"0 0 8px"}}>{USER.handle}</p>
        <p style={{fontFamily:"'Nunito',sans-serif",fontSize:13,color:"rgba(255,255,255,0.8)",margin:"0 0 2px"}}>
          {geoState==="granted"&&userCoords?`📍 ${userCoords.lat.toFixed(4)}°N · ${Math.abs(userCoords.lng).toFixed(4)}°W`:`📍 ${USER.location}`}
        </p>
        <p style={{fontFamily:"'Nunito',sans-serif",fontSize:13,color:"rgba(255,255,255,0.7)",margin:0,fontStyle:"italic"}}>{USER.bio}</p>
      </div>
      <div style={{padding:"24px 20px"}}>
        {/* Location card */}
        <div style={{background:T.white,borderRadius:14,padding:"13px 16px",marginBottom:20,boxShadow:`0 1px 6px ${T.shadow}`,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:22}}>📍</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Nunito',sans-serif",fontSize:13,fontWeight:700,color:T.ink}}>
              Location: {geoState==="granted"?"Active ✓":geoState==="denied"?"Denied":geoState==="loading"?"Requesting…":"Not enabled"}
            </div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:geoState==="granted"?T.pine:T.stone,marginTop:2}}>
              {geoState==="granted"&&userCoords?"Real GPS · distances are live":"Enable in feed for real distances"}
            </div>
          </div>
          <div style={{width:10,height:10,borderRadius:"50%",background:geoState==="granted"?T.pine:geoState==="denied"?T.ember:T.sandDark,flexShrink:0}}/>
        </div>
        {/* Supabase card */}
        <div style={{background:T.white,borderRadius:14,padding:"13px 16px",marginBottom:20,boxShadow:`0 1px 6px ${T.shadow}`,display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:22}}>🗄️</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'Nunito',sans-serif",fontSize:13,fontWeight:700,color:T.ink}}>
              Database: {SUPABASE_READY?"Supabase connected":"Demo mode"}
            </div>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:SUPABASE_READY?T.pine:T.stone,marginTop:2}}>
              {SUPABASE_READY?"Live data · saves persist":"Add credentials to go live"}
            </div>
          </div>
          <div style={{width:10,height:10,borderRadius:"50%",background:SUPABASE_READY?T.pine:T.sandDark,flexShrink:0}}/>
        </div>
        {/* Stats */}
        <div style={{display:"flex",background:T.white,borderRadius:16,boxShadow:`0 2px 12px ${T.shadow}`,marginBottom:24,overflow:"hidden"}}>
          {[{label:"Saved",value:saved.size},{label:"Interests",value:USER.interests.length},{label:"Member",value:"'24"}].map((s,i)=>(
            <div key={i} style={{flex:1,textAlign:"center",padding:"16px 8px",borderRight:i<2?`1px solid ${T.sandMid}`:"none"}}>
              <div style={{fontFamily:"'Fraunces',serif",fontSize:20,fontWeight:700,color:T.ink}}>{s.value}</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:T.stone,textTransform:"uppercase",letterSpacing:"0.08em",marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* Interests */}
        <h3 style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:700,color:T.ink,marginBottom:10}}>My Interests</h3>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:24}}>
          {USER.interests.map(int=>{const cat=Object.values(CAT_META).find(m=>m.label.includes(int.split(" ")[0]));return(<span key={int} style={{background:cat?.bg||T.sandMid,color:cat?.color||T.stone,borderRadius:20,padding:"6px 14px",fontFamily:"'Nunito',sans-serif",fontSize:13,fontWeight:700}}>{int}</span>);})}
        </div>
        {/* Saved list */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h3 style={{fontFamily:"'Fraunces',serif",fontSize:16,fontWeight:700,color:T.ink,margin:0}}>Saved Events</h3>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:T.stone}}>{saved.size} saved</span>
        </div>
        {sv.length===0?(
          <div style={{background:T.sandMid,borderRadius:12,padding:"18px",textAlign:"center"}}><p style={{fontFamily:"'Nunito',sans-serif",fontSize:14,color:T.inkMute}}>Bookmark events from the feed</p></div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {sv.map(e=>(<div key={e.id} style={{background:T.white,borderRadius:12,padding:"12px 14px",boxShadow:`0 1px 6px ${T.shadow}`,display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:22}}>{e.emoji}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:14,fontWeight:700,color:T.ink,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.title}</div>
                <div style={{fontFamily:"'Nunito',sans-serif",fontSize:11,color:T.inkMute,marginTop:2}}>{e.location}</div>
              </div>
              <TimeBadge time={e.time}/>
            </div>))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root App ────────────────────────────────────────────────────
export default function App(){
  const[screen,setScreen]=useState("feed");
  const[activeFilter,setFilter]=useState("Now");
  const[activeCat,setCat]=useState("all");
  const[saved,setSaved]=useState(new Set());
  const[interested,setInterested]=useState(new Set());
  const[search,setSearch]=useState("");
  const[liveCount,setLiveCount]=useState(214);
  const[geoState,setGeoState]=useState("idle");
  const[userCoords,setUserCoords]=useState(null);
  const[events,setEvents]=useState(MOCK_EVENTS);
  const[loading,setLoading]=useState(false);
  const[dbError,setDbError]=useState(null);

  useEffect(()=>{const id=setInterval(()=>setLiveCount(c=>c+Math.floor(Math.random()*3)-1),2800);return()=>clearInterval(id);},[]);

  const requestGeo=useCallback(()=>{
    if(!navigator.geolocation){setGeoState("denied");return;}
    setGeoState("loading");
    navigator.geolocation.getCurrentPosition(
      pos=>{setUserCoords({lat:pos.coords.latitude,lng:pos.coords.longitude,accuracy:pos.coords.accuracy});setGeoState("granted");},
      err=>{setGeoState(err.code===1?"denied":"idle");},
      {enableHighAccuracy:true,timeout:10000}
    );
  },[]);

  useEffect(()=>{requestGeo();},[]);

  useEffect(()=>{
    if(!SUPABASE_READY)return;
    setLoading(true);setDbError(null);
    fetchEventsFromDb({timeBucket:activeFilter,category:activeCat})
      .then(rows=>{setEvents(rows);setLoading(false);})
      .catch(err=>{setDbError(err.message);setLoading(false);});
  },[activeFilter,activeCat]);

  const withDist=events.map(e=>({...e,distMiles:userCoords&&e.lat?haversine(userCoords.lat,userCoords.lng,e.lat,e.lng):null}));

  const toggleSave=async id=>{const was=saved.has(id);setSaved(s=>{const n=new Set(s);was?n.delete(id):n.add(id);return n;});if(SUPABASE_READY)await toggleSavedDb("demo-user",id,was).catch(console.error);};
  const toggleInt=async id=>{const was=interested.has(id);setInterested(s=>{const n=new Set(s);was?n.delete(id):n.add(id);return n;});if(SUPABASE_READY)await toggleIntDb("demo-user",id,was).catch(console.error);};

  const filtered=withDist.filter(e=>{
    if(activeCat!=="all"&&e.cat!==activeCat)return false;
    if(activeFilter==="Trending"&&!e.is_trending)return false;
    if(activeFilter!=="Trending"&&e.time!==activeFilter)return false;
    if(search&&!e.title.toLowerCase().includes(search.toLowerCase())&&!e.location.toLowerCase().includes(search.toLowerCase())&&!(e.vibe||"").toLowerCase().includes(search.toLowerCase()))return false;
    return true;
  }).sort((a,b)=>a.distMiles!=null&&b.distMiles!=null?a.distMiles-b.distMiles:0);

  const NAV=[{id:"feed",icon:"⚡",label:"Discover"},{id:"map",icon:"◎",label:"Map"},{id:"saved",icon:"🔖",label:"Saved"},{id:"profile",icon:"◈",label:"Profile"}];

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,700;0,9..144,900;1,9..144,700&family=Nunito:wght@300;400;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
        html,body,#root{height:100%}
        body{background:#E8E0D8;display:flex;justify-content:center}
        @keyframes cardUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pipPing{75%,100%{transform:scale(2.5);opacity:0}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{display:none}
        *{scrollbar-width:none}
        input:focus{outline:none}
        button{user-select:none}
      `}</style>
      <div style={{width:"100%",maxWidth:430,minHeight:"100vh",height:"100%",display:"flex",flexDirection:"column",background:T.sand,fontFamily:"'Nunito',sans-serif"}}>

        {screen==="feed"&&(
          <header style={{position:"sticky",top:0,zIndex:40,background:"rgba(247,243,238,0.94)",backdropFilter:"blur(20px) saturate(1.5)",WebkitBackdropFilter:"blur(20px) saturate(1.5)",borderBottom:`1px solid ${T.sandDark}`,padding:"16px 18px 0"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div>
                <div style={{fontFamily:"'Fraunces',serif",fontSize:26,fontWeight:900,fontStyle:"italic",color:T.ink,letterSpacing:"-0.03em",lineHeight:1}}>
                  drift<span style={{color:T.ember}}>.</span>
                </div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:T.stone,letterSpacing:"0.1em",textTransform:"uppercase",marginTop:1}}>
                  {geoState==="granted"&&userCoords?`📍 ${userCoords.lat.toFixed(3)}°N · ${Math.abs(userCoords.lng).toFixed(3)}°W`:"Boulder, CO"}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,background:T.white,border:`1.5px solid ${T.sandDark}`,borderRadius:20,padding:"6px 12px",boxShadow:`0 1px 6px ${T.shadow}`}}>
                <LivePip/><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:T.inkSoft,fontWeight:600}}>{liveCount} out now</span>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:10,background:T.white,borderRadius:14,border:`1.5px solid ${T.sandDark}`,padding:"10px 14px",marginBottom:14,boxShadow:`0 1px 4px ${T.shadow}`}}>
              <span style={{color:T.stone,fontSize:15}}>🔍</span>
              <input placeholder="Search events, venues, vibes…" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,background:"none",border:"none",fontFamily:"'Nunito',sans-serif",fontSize:14,color:T.ink}}/>
              {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",color:T.stone,cursor:"pointer",fontSize:18,lineHeight:1}}>×</button>}
            </div>
            <div style={{display:"flex",gap:6,marginBottom:14}}>
              {FILTERS.map(f=>(<button key={f} onClick={()=>setFilter(f)} style={{flex:1,padding:"7px 2px",borderRadius:10,border:"none",background:activeFilter===f?T.ink:T.sandMid,color:activeFilter===f?T.white:T.inkMute,fontFamily:"'JetBrains Mono',monospace",fontSize:10,fontWeight:600,letterSpacing:"0.04em",textTransform:"uppercase",cursor:"pointer",transition:"all .18s"}}>{f}</button>))}
            </div>
            <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:14,WebkitOverflowScrolling:"touch"}}>
              {CATEGORIES.map(c=>{const isA=activeCat===c.id;const meta=c.id!=="all"?CAT_META[c.id]:null;return(<button key={c.id} onClick={()=>setCat(c.id)} style={{flexShrink:0,padding:"6px 13px",borderRadius:20,border:`1.5px solid ${isA?(meta?.color||T.ink):T.sandDark}`,background:isA?(meta?.bg||T.ink):T.white,color:isA?(meta?.color||T.ink):T.inkMute,fontFamily:"'Nunito',sans-serif",fontSize:13,fontWeight:isA?700:600,cursor:"pointer",transition:"all .18s",whiteSpace:"nowrap",boxShadow:isA?`0 2px 8px ${meta?.color||T.ink}33`:"none"}}>{c.icon} {c.label}</button>);})}
            </div>
          </header>
        )}

        {screen==="feed"&&(
          <main style={{flex:1,overflowY:"auto",padding:"16px 16px 100px"}}>
            <GeoBanner geoState={geoState} onRequest={requestGeo}/>
            {!SUPABASE_READY&&(
              <div style={{display:"flex",alignItems:"center",gap:8,background:T.goldLt,borderRadius:10,padding:"8px 14px",marginBottom:12}}>
                <span style={{fontSize:13}}>⚡</span>
                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:T.gold,fontWeight:600}}>Demo mode — add Supabase credentials to go live</span>
              </div>
            )}
            {dbError&&<div style={{background:"#FEE9E0",borderRadius:10,padding:"8px 14px",marginBottom:12}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:T.ember}}>DB: {dbError}</span></div>}
            {!search&&(
              <div style={{marginBottom:16}}>
                <h2 style={{fontFamily:"'Fraunces',serif",fontSize:21,fontWeight:700,color:T.ink,lineHeight:1.2,letterSpacing:"-0.02em"}}>
                  {activeFilter==="Now"&&"Happening right now"}{activeFilter==="Tonight"&&"Going on tonight"}{activeFilter==="This Weekend"&&"This weekend in Boulder"}{activeFilter==="Trending"&&"Trending around town"}
                </h2>
                <p style={{fontFamily:"'Nunito',sans-serif",fontSize:13,color:T.stone,marginTop:3}}>
                  {filtered.length} {filtered.length===1?"experience":"experiences"}{userCoords?" · sorted by distance":""}
                </p>
              </div>
            )}
            {loading?(
              <div style={{display:"flex",justifyContent:"center",padding:"48px 0"}}><div style={{width:28,height:28,border:`3px solid ${T.sandDark}`,borderTop:`3px solid ${T.ember}`,borderRadius:"50%",animation:"spin .8s linear infinite"}}/></div>
            ):filtered.length>0?(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {filtered.map((e,i)=>(<EventCard key={e.id} event={e} index={i} saved={saved.has(e.id)} interested={interested.has(e.id)} onSave={()=>toggleSave(e.id)} onInterest={()=>toggleInt(e.id)} distMiles={e.distMiles}/>))}
              </div>
            ):(
              <div style={{textAlign:"center",padding:"60px 20px",animation:"fadeIn .4s ease"}}>
                <div style={{fontSize:48,marginBottom:16}}>🏔️</div>
                <h3 style={{fontFamily:"'Fraunces',serif",fontSize:20,color:T.inkMute,marginBottom:8}}>Nothing here right now</h3>
                <p style={{fontFamily:"'Nunito',sans-serif",fontSize:14,color:T.stone}}>Try a different filter or category</p>
              </div>
            )}
          </main>
        )}

        {screen==="map"&&<MapView events={withDist} saved={saved} interested={interested} onSave={toggleSave} onInterest={toggleInt} userLat={userCoords?.lat} userLng={userCoords?.lng}/>}
        {screen==="saved"&&<SavedView events={withDist} saved={saved} interested={interested} onSave={toggleSave} onInterest={toggleInt} userCoords={userCoords}/>}
        {screen==="profile"&&<ProfileView saved={saved} events={events} userCoords={userCoords} geoState={geoState}/>}

        <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"rgba(247,243,238,0.96)",backdropFilter:"blur(24px) saturate(1.4)",WebkitBackdropFilter:"blur(24px) saturate(1.4)",borderTop:`1px solid ${T.sandDark}`,display:"flex",zIndex:50,padding:"10px 0 max(18px,env(safe-area-inset-bottom))"}}>
          {NAV.map(n=>{const a=screen===n.id;return(<button key={n.id} onClick={()=>setScreen(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"4px 0",transition:"all .18s"}}>
            <span style={{fontSize:21,lineHeight:1,filter:a?`drop-shadow(0 0 5px ${T.ember}88)`:"none",transform:a?"scale(1.12)":"scale(1)",transition:"all .18s"}}>{n.icon}</span>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:"0.06em",textTransform:"uppercase",color:a?T.ember:T.stone,fontWeight:a?600:400,transition:"color .18s"}}>{n.label}</span>
          </button>);})}
        </nav>
      </div>
    </>
  );
}
