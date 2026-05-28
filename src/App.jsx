import { useState, useEffect, useCallback } from "react";

const T = {
  fog:"#F5F3EF",stone:"#D9D6CF",stoneDark:"#B8B4AC",
  charcoal:"#1F2320",charcoalSoft:"#3D4240",charcoalMute:"#6B706C",
  pine:"#2F5D50",pineLt:"#E8F0EC",
  sky:"#4F86A6",skyLt:"#E5EEF3",
  amber:"#D9A441",amberLt:"#FDF3DC",
  sage:"#8FAF9A",sageLt:"#F0F5EC",
  white:"#FFFFFF",
  shadow:"rgba(31,35,32,0.09)",shadowMd:"rgba(31,35,32,0.15)",
};

function haversine(lat1,lon1,lat2,lon2){
  const R=3958.8,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function fmt(mi){if(mi===null)return"—";if(mi<0.1)return"<0.1 mi";return`${mi.toFixed(1)} mi`;}

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || "https://lknoxozdbkikysxoarzu.supabase.co";
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON || "sb_publishable_myANV71Ao-e3TRTqM5UuOA_mTobfrdH";
const SUPABASE_READY = SUPABASE_URL.includes("supabase.co");

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

const CATEGORIES=[
  {id:"all",label:"All",icon:"✦"},{id:"music",label:"Live Music",icon:"♪"},
  {id:"sports",label:"Sports & Pickup",icon:"◎"},{id:"outdoor",label:"Outdoor Activities",icon:"△"},
  {id:"wellness",label:"Wellness / Fitness",icon:"◇"},{id:"food",label:"Food & Social",icon:"○"},
  {id:"community",label:"Community",icon:"⬡"},
];

const CAT_META={
  music:{color:"#6B4FA0",bg:"#F0EDF8",label:"Live Music",gradBg:"linear-gradient(160deg,#3A2060,#0D0520)",gradAccent:"rgba(217,164,65,0.35)"},
  sports:{color:T.sky,bg:T.skyLt,label:"Sports & Pickup",gradBg:"linear-gradient(160deg,#1A3A5C,#0D2040)",gradAccent:"rgba(79,134,166,0.4)"},
  outdoor:{color:T.pine,bg:T.pineLt,label:"Outdoor Activities",gradBg:"linear-gradient(160deg,#2A4A3A,#0F1F18)",gradAccent:"rgba(143,175,154,0.25)"},
  wellness:{color:"#8B7A3A",bg:"#F5F0DC",label:"Wellness / Fitness",gradBg:"linear-gradient(160deg,#5C4A1A,#3D2E0A)",gradAccent:"rgba(217,164,65,0.4)"},
  food:{color:T.amber,bg:T.amberLt,label:"Food & Social",gradBg:"linear-gradient(160deg,#5C3A1A,#3D2008)",gradAccent:"rgba(217,164,65,0.3)"},
  community:{color:T.sage,bg:T.sageLt,label:"Community",gradBg:"linear-gradient(160deg,#2A3D30,#151F18)",gradAccent:"rgba(143,175,154,0.3)"},
};

const FILTERS=["Now","Tonight","Tomorrow","This Weekend","Coming Up","Trending"];

const MOCK_EVENTS=[
  {id:1,cat:"music",time:"Now",is_trending:true,title:"Leftover Salmon — Acoustic Set",location:"The Sink · The Hill",vibe:"Bluegrass jam · Outdoor patio",lat:40.0090,lng:-105.2711},
  {id:2,cat:"outdoor",time:"Now",is_trending:false,title:"Sunset Hike — Royal Arch Trail",location:"Chautauqua Park · S Boulder",vibe:"Moderate · Golden hour views",lat:39.9995,lng:-105.2811},
  {id:3,cat:"food",time:"Tonight",is_trending:true,title:"Tap Release Night",location:"Avery Brewing Co. · Gunbarrel",vibe:"Limited IPA drop · Patio open",lat:40.0374,lng:-105.2518},
  {id:4,cat:"wellness",time:"Tonight",is_trending:false,title:"Flow Yoga Under the Stars",location:"Boulder Creek Path · Downtown",vibe:"All levels · BYO mat",lat:40.0143,lng:-105.2766},
  {id:5,cat:"sports",time:"Now",is_trending:true,title:"Pickup Ultimate Frisbee",location:"Scott Carpenter Park · E Boulder",vibe:"All levels · Free to join",lat:40.0142,lng:-105.2487},
  {id:6,cat:"community",time:"Tonight",is_trending:false,title:"Farmers Market Wind-Down",location:"13th & Canyon · Downtown",vibe:"Local vendors · Pet friendly",lat:40.0165,lng:-105.2795},
  {id:7,cat:"music",time:"Tonight",is_trending:false,title:"Jazz on the Creek",location:"Foolish Craig's · The Hill",vibe:"Live jazz trio · Outdoor seating",lat:40.0093,lng:-105.2723},
  {id:8,cat:"outdoor",time:"This Weekend",is_trending:true,title:"Dawn Paddle — Boulder Reservoir",location:"Boulder Reservoir · N Boulder",vibe:"Kayak rental available · Calm water",lat:40.0603,lng:-105.2257},
  {id:9,cat:"wellness",time:"This Weekend",is_trending:false,title:"Forest Bathing Walk",location:"Betasso Preserve · Boulder Canyon",vibe:"Guided · Meditative · 2 hrs",lat:40.0031,lng:-105.3437},
  {id:10,cat:"sports",time:"This Weekend",is_trending:true,title:"Saturday Soccer — Open Run",location:"Valmont Sports Park",vibe:"Co-ed · All skill levels",lat:40.0208,lng:-105.2366},
];

const BB={minLat:39.985,maxLat:40.075,minLng:-105.360,maxLng:-105.210};
function toXY(lat,lng){return{x:((lng-BB.minLng)/(BB.maxLng-BB.minLng))*100,y:((BB.maxLat-lat)/(BB.maxLat-BB.minLat))*100};}

const USER={name:"Jordan Rivera",handle:"@jrivera",location:"Boulder, CO",bio:"Always chasing sunsets and live music 🎸🏔️",interests:["Live Music","Outdoor Activities","Food & Social","Wellness"],avatar:"JR"};

function LivePip(){return(<span style={{position:"relative",display:"inline-flex",width:7,height:7,flexShrink:0}}><span style={{position:"absolute",inset:0,borderRadius:"50%",background:T.amber,opacity:0.4,animation:"pipPing 1.6s cubic-bezier(0,0,.2,1) infinite"}}/><span style={{position:"relative",width:7,height:7,borderRadius:"50%",background:T.amber}}/></span>);}

function TimeBadge({time}){
  const s={Now:{bg:T.amber,color:T.charcoal},Tonight:{bg:T.skyLt,color:T.sky},"This Weekend":{bg:T.pineLt,color:T.pine},Trending:{bg:T.amberLt,color:T.amber}}[time]||{bg:T.stone,color:T.charcoalMute};
  return(<span style={{display:"inline-flex",alignItems:"center",gap:4,background:s.bg,color:s.color,padding:"1px 7px",fontFamily:"'DM Sans',sans-serif",fontSize:9,fontWeight:700,letterSpacing:"0.05em",textTransform:"uppercase"}}>{time==="Now"&&<LivePip/>}{time}</span>);
}

function SaveBtn({saved,onToggle}){
  return(<button onClick={e=>{e.stopPropagation();onToggle();}} style={{width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(31,35,32,0.5)",border:"none",cursor:"pointer",fontSize:11,flexShrink:0}}>🔖</button>);
}

function EventCard({event,saved,interested,onSave,onInterest,index,distMiles}){
  const meta=CAT_META[event.cat]||CAT_META.community;
  return(
    <div style={{background:T.white,boxShadow:`0 2px 12px ${T.shadow}`,overflow:"hidden",animation:`cardUp .35s ease both`,animationDelay:`${index*45}ms`}}>
      {/* Short photo header */}
      <div style={{height:80,position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:meta.gradBg}}/>
        <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 40% 20%,${meta.gradAccent} 0%,transparent 60%)`}}/>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(to top,rgba(31,35,32,0.92) 0%,rgba(31,35,32,0.1) 65%,transparent 100%)"}}/>
        <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"8px 14px",display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
          <div style={{minWidth:0,flex:1,marginRight:8}}>
            <div style={{display:"flex",gap:5,marginBottom:4,flexWrap:"wrap"}}>
              <span style={{background:`rgba(${meta.color==="#6B4FA0"?"107,79,160":"143,175,154"},0.25)`,color:meta.color==="#6B4FA0"?"#C4A8F0":T.sage,padding:"1px 6px",fontFamily:"'DM Sans',sans-serif",fontSize:9,fontWeight:700,letterSpacing:"0.06em",textTransform:"uppercase",border:`0.5px solid rgba(${meta.color==="#6B4FA0"?"107,79,160":"143,175,154"},0.35)`}}>{meta.label}</span>
              <TimeBadge time={event.time}/>
              {event.is_trending&&<span style={{background:"rgba(217,164,65,0.2)",color:T.amber,padding:"1px 6px",fontFamily:"'DM Sans',sans-serif",fontSize:9,fontWeight:700,border:`0.5px solid rgba(217,164,65,0.35)`}}>↑ Trending</span>}
            </div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:800,color:T.fog,letterSpacing:"-0.01em",lineHeight:1.2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{event.title}</div>
          </div>
          <SaveBtn saved={saved} onToggle={onSave}/>
        </div>
      </div>
      {/* Compact footer */}
      <div style={{padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{minWidth:0,flex:1}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.sage,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>📍 {event.location}{distMiles!=null?` · ${fmt(distMiles)}`:""}</div>
          {event.vibe&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:T.stone,fontStyle:"italic",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{event.vibe}</div>}
        </div>
        <button onClick={e=>{e.stopPropagation();onInterest();}} style={{background:interested?T.amber:T.fog,color:interested?T.charcoal:T.sage,border:`0.5px solid ${interested?T.amber:T.stone}`,padding:"5px 10px",fontFamily:"'DM Sans',sans-serif",fontSize:10,fontWeight:700,cursor:"pointer",flexShrink:0,marginLeft:8,whiteSpace:"nowrap"}}>
          {interested?"✦ Interested":"✦ Going?"}
        </button>
      </div>
    </div>
  );
}

function MapView({events,saved,interested,onSave,onInterest,userLat,userLng}){
  const[selected,setSelected]=useState(null);
  const sel=selected?events.find(e=>e.id===selected):null;
  const userXY=userLat!=null?toXY(userLat,userLng):null;
  return(
    <div style={{flex:1,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(160deg,#C8D8B8 0%,#B8C8A8 40%,#A8B898 100%)"}}>
        <svg width="100%" height="100%" viewBox="0 0 400 600" preserveAspectRatio="xMidYMid slice">
          <line x1="200" y1="0" x2="200" y2="600" stroke="white" strokeWidth="5" opacity="0.6"/>
          <line x1="0" y1="300" x2="400" y2="300" stroke="white" strokeWidth="5" opacity="0.6"/>
          <line x1="150" y1="0" x2="150" y2="600" stroke="white" strokeWidth="3" opacity="0.4"/>
          <line x1="250" y1="0" x2="250" y2="600" stroke="white" strokeWidth="3" opacity="0.4"/>
          <line x1="0" y1="200" x2="400" y2="200" stroke="white" strokeWidth="3" opacity="0.4"/>
          <line x1="0" y1="400" x2="400" y2="400" stroke="white" strokeWidth="3" opacity="0.4"/>
          <path d="M0,320 Q80,315 160,325 Q240,335 320,318 Q360,310 400,315" fill="none" stroke="#6BAACC" strokeWidth="4" opacity="0.5"/>
          <path d="M0,480 L30,440 L60,460 L90,410 L120,390 L140,420 L160,380 L180,400 L200,370 L220,395 L240,375 L260,405 L280,385 L310,430 L340,415 L370,445 L400,430 L400,600 L0,600 Z" fill="#98B888" opacity="0.4"/>
        </svg>
        {userXY&&(<div style={{position:"absolute",left:`${userXY.x}%`,top:`${userXY.y}%`,transform:"translate(-50%,-50%)",zIndex:20}}><div style={{width:14,height:14,borderRadius:"50%",background:T.sky,border:"3px solid white",boxShadow:`0 0 0 4px ${T.sky}44`}}/></div>)}
        <div style={{position:"absolute",top:16,left:16,background:"rgba(245,243,239,0.95)",padding:"8px 14px",boxShadow:`0 2px 12px ${T.shadow}`}}>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:800,color:T.charcoal}}>Boulder, CO</div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:T.sage,marginTop:1}}>{userLat!=null?"📍 Using your location":`${events.length} events`}</div>
        </div>
        {events.map(evt=>{
          const{x,y}=toXY(evt.lat||40.0150,evt.lng||-105.2705);
          const meta=CAT_META[evt.cat]||CAT_META.community;
          const isSel=selected===evt.id;
          return(<button key={evt.id} onClick={()=>setSelected(isSel?null:evt.id)} style={{position:"absolute",left:`${x}%`,top:`${y}%`,transform:`translate(-50%,-100%) scale(${isSel?1.15:1})`,background:"none",border:"none",cursor:"pointer",transition:"transform .2s",zIndex:isSel?10:5}}>
            <div style={{background:isSel?meta.color:T.white,color:isSel?T.white:meta.color,padding:isSel?"5px 10px":"4px 9px",fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:800,boxShadow:isSel?`0 4px 16px ${meta.color}55`:`0 2px 8px ${T.shadow}`,border:`1.5px solid ${meta.color}`,display:"flex",alignItems:"center",gap:4,whiteSpace:"nowrap"}}>
              {isSel&&evt.title.split(" ").slice(0,3).join(" ")}
              {!isSel&&"●"}
            </div>
            <div style={{width:0,height:0,borderLeft:"5px solid transparent",borderRight:"5px solid transparent",borderTop:`7px solid ${isSel?meta.color:T.white}`,margin:"0 auto"}}/>
          </button>);
        })}
      </div>
      {sel&&(
        <div style={{position:"absolute",bottom:0,left:0,right:0,background:T.white,padding:"18px 20px 80px",boxShadow:`0 -4px 32px ${T.shadowMd}`,animation:"slideUp .25s ease",zIndex:20}}>
          <div style={{width:36,height:3,background:T.stone,margin:"0 auto 14px"}}/>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <h3 style={{fontFamily:"'DM Sans',sans-serif",fontSize:15,fontWeight:800,color:T.charcoal,margin:"0 0 4px"}}>{sel.title}</h3>
              <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:T.sage,margin:"0 0 3px"}}>📍 {sel.location}</p>
              {sel.vibe&&<p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.stone,fontStyle:"italic",margin:0}}>{sel.vibe}</p>}
            </div>
            <SaveBtn saved={saved.has(sel.id)} onToggle={()=>onSave(sel.id)}/>
          </div>
          <div style={{display:"flex",gap:8,marginTop:12,alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <TimeBadge time={sel.time}/>
              {sel.distMiles!=null&&<span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.amber,fontWeight:600}}>{fmt(sel.distMiles)} away</span>}
            </div>
            <button onClick={()=>onInterest(sel.id)} style={{background:interested.has(sel.id)?T.amber:T.fog,color:interested.has(sel.id)?T.charcoal:T.sage,border:`0.5px solid ${interested.has(sel.id)?T.amber:T.stone}`,padding:"6px 14px",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,cursor:"pointer"}}>
              {interested.has(sel.id)?"✦ Interested":"✦ Going?"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SavedView({events,saved,interested,onSave,onInterest,userCoords}){
  const sv=events.filter(e=>saved.has(e.id));
  return(
    <div style={{flex:1,overflowY:"auto",padding:"24px 16px 100px"}}>
      <h2 style={{fontFamily:"'DM Sans',sans-serif",fontSize:22,fontWeight:800,color:T.charcoal,margin:"0 0 4px"}}>Saved</h2>
      <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.sage,margin:"0 0 20px"}}>{sv.length} {sv.length===1?"event":"events"} bookmarked</p>
      {sv.length===0?(
        <div style={{textAlign:"center",padding:"60px 20px"}}>
          <div style={{fontSize:40,marginBottom:14}}>🔖</div>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:17,color:T.charcoalMute}}>Nothing saved yet</p>
          <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.sage,marginTop:6}}>Tap 🔖 on any event</p>
        </div>
      ):(
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {sv.map((e,i)=>(<EventCard key={e.id} event={e} index={i} saved={saved.has(e.id)} interested={interested.has(e.id)} onSave={()=>onSave(e.id)} onInterest={()=>onInterest(e.id)} distMiles={userCoords&&e.lat?haversine(userCoords.lat,userCoords.lng,e.lat,e.lng):null}/>))}
        </div>
      )}
    </div>
  );
}

function ProfileView({saved,events,userCoords,geoState}){
  const sv=events.filter(e=>saved.has(e.id));
  return(
    <div style={{flex:1,overflowY:"auto",padding:"0 0 100px"}}>
      <div style={{background:`linear-gradient(160deg,${T.pine} 0%,#1A3830 100%)`,padding:"40px 20px 28px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:160,height:160,borderRadius:"50%",background:"rgba(245,243,239,0.05)"}}/>
        <div style={{width:68,height:68,borderRadius:2,background:"rgba(245,243,239,0.15)",border:"2px solid rgba(245,243,239,0.4)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'DM Sans',sans-serif",fontSize:24,fontWeight:800,color:T.fog,marginBottom:14}}>{USER.avatar}</div>
        <h2 style={{fontFamily:"'DM Sans',sans-serif",fontSize:20,fontWeight:800,color:T.fog,margin:"0 0 2px"}}>{USER.name}</h2>
        <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(245,243,239,0.55)",margin:"0 0 8px",letterSpacing:"0.06em"}}>{USER.handle}</p>
        <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"rgba(245,243,239,0.75)",margin:"0 0 2px"}}>
          {geoState==="granted"&&userCoords?`📍 ${userCoords.lat.toFixed(4)}°N · ${Math.abs(userCoords.lng).toFixed(4)}°W`:`📍 ${USER.location}`}
        </p>
        <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"rgba(245,243,239,0.65)",margin:0,fontStyle:"italic"}}>{USER.bio}</p>
      </div>
      <div style={{padding:"20px 16px"}}>
        <div style={{display:"flex",background:T.white,boxShadow:`0 2px 12px ${T.shadow}`,marginBottom:20,overflow:"hidden"}}>
          {[{label:"Saved",value:saved.size},{label:"Interests",value:USER.interests.length},{label:"Member",value:"'24"}].map((s,i)=>(
            <div key={i} style={{flex:1,textAlign:"center",padding:"14px 8px",borderRight:i<2?`0.5px solid ${T.stone}`:"none"}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:20,fontWeight:800,color:T.charcoal}}>{s.value}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:T.sage,textTransform:"uppercase",letterSpacing:"0.08em",marginTop:2}}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{background:T.white,padding:"12px 14px",boxShadow:`0 1px 6px ${T.shadow}`,marginBottom:20,display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:18}}>📍</span>
          <div style={{flex:1}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,color:T.charcoal}}>Location: {geoState==="granted"?"Active ✓":geoState==="denied"?"Denied":geoState==="loading"?"Requesting…":"Not enabled"}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:geoState==="granted"?T.pine:T.sage,marginTop:1}}>{geoState==="granted"&&userCoords?"Real GPS · distances are live":"Enable in feed for real distances"}</div>
          </div>
          <div style={{width:8,height:8,borderRadius:"50%",background:geoState==="granted"?T.pine:geoState==="denied"?T.amber:T.stone,flexShrink:0}}/>
        </div>
        <h3 style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:800,color:T.charcoal,marginBottom:10,textTransform:"uppercase",letterSpacing:"0.06em"}}>My Interests</h3>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:24}}>
          {USER.interests.map(int=>{const cat=Object.values(CAT_META).find(m=>m.label.includes(int.split(" ")[0]));return(<span key={int} style={{background:cat?.bg||T.fog,color:cat?.color||T.sage,padding:"5px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700}}>{int}</span>);})}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <h3 style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:800,color:T.charcoal,margin:0,textTransform:"uppercase",letterSpacing:"0.06em"}}>Saved Events</h3>
          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:T.sage}}>{saved.size} saved</span>
        </div>
        {sv.length===0?(
          <div style={{background:T.fog,padding:"18px",textAlign:"center"}}><p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.charcoalMute}}>Bookmark events from the feed</p></div>
        ):(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {sv.map(e=>(<div key={e.id} style={{background:T.white,padding:"11px 14px",boxShadow:`0 1px 6px ${T.shadow}`,display:"flex",gap:10,alignItems:"center"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,color:T.charcoal,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.title}</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.sage,marginTop:2}}>{e.location}</div>
              </div>
              <TimeBadge time={e.time}/>
            </div>))}
          </div>
        )}
      </div>
    </div>
  );
}

function GeoBanner({geoState,onRequest}){
  if(geoState==="granted"||geoState==="loading")return null;
  return(
    <div style={{margin:"0 0 12px",background:T.white,border:`0.5px solid ${T.stone}`,padding:"10px 14px",display:"flex",alignItems:"center",gap:10,boxShadow:`0 1px 6px ${T.shadow}`}}>
      <span style={{fontSize:18,flexShrink:0}}>📍</span>
      <div style={{flex:1}}>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:700,color:T.charcoal}}>{geoState==="denied"?"Location access denied":"See real distances from you"}</div>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.sage,marginTop:1}}>{geoState==="denied"?"Update browser settings to allow":"Events sort by how close they are"}</div>
      </div>
      {geoState!=="denied"&&<button onClick={onRequest} style={{background:T.charcoal,color:T.fog,border:"none",padding:"6px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:11,fontWeight:700,cursor:"pointer",flexShrink:0}}>Allow</button>}
    </div>
  );
}

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
      pos=>{setUserCoords({lat:pos.coords.latitude,lng:pos.coords.longitude});setGeoState("granted");},
      err=>{setGeoState(err.code===1?"denied":"idle");},
      {enableHighAccuracy:true,timeout:10000}
    );
  },[]);

  useEffect(()=>{requestGeo();},[]);

  useEffect(()=>{
    if(!SUPABASE_READY)return;
    setLoading(true);setDbError(null);
    fetchEventsFromDb({timeBucket:activeFilter,category:activeCat})
      .then(rows=>{setEvents(rows.length?rows:MOCK_EVENTS);setLoading(false);})
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
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800&family=Caveat:wght@700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent}
        html,body,#root{height:100%}
        body{background:#E8E4DF;display:flex;justify-content:center}
        @keyframes cardUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pipPing{75%,100%{transform:scale(2.5);opacity:0}}
        @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{display:none}
        *{scrollbar-width:none}
        input:focus{outline:none}
        button{user-select:none}
      `}</style>
      <div style={{width:"100%",maxWidth:430,minHeight:"100vh",height:"100%",display:"flex",flexDirection:"column",background:T.fog,fontFamily:"'DM Sans',sans-serif"}}>

        {screen==="feed"&&(
          <header style={{position:"sticky",top:0,zIndex:40,background:T.pine,borderBottom:`0.5px solid rgba(245,243,239,0.15)`}}>
            {/* Top row */}
            <div style={{padding:"16px 20px 12px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:24,fontWeight:800,color:T.fog,letterSpacing:"-0.04em",lineHeight:1}}>
                  <span style={{fontFamily:"'Caveat',cursive",fontSize:30,fontWeight:700,letterSpacing:"-0.01em",lineHeight:1}}>go </span><span style={{letterSpacing:"-0.04em"}}>janey<span style={{color:T.amber}}>.</span></span>
                </div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(245,243,239,0.5)",letterSpacing:"0.12em",textTransform:"uppercase",marginTop:3}}>
                  {geoState==="granted"&&userCoords?`📍 ${userCoords.lat.toFixed(3)}°N · ${Math.abs(userCoords.lng).toFixed(3)}°W`:"Boulder, CO"}
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,background:"rgba(245,243,239,0.1)",border:"0.5px solid rgba(245,243,239,0.2)",padding:"5px 11px"}}>
                <LivePip/>
                <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:T.fog,fontWeight:500}}>{liveCount} out now</span>
              </div>
            </div>

            {/* Time filters */}
            <div style={{padding:"0 20px 12px",display:"flex",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch"}}>
              {FILTERS.map(f=>(<button key={f} onClick={()=>setFilter(f)} style={{padding:"5px 12px",background:activeFilter===f?T.amber:"rgba(245,243,239,0.1)",color:activeFilter===f?T.charcoal:"rgba(245,243,239,0.6)",border:"none",fontFamily:"'DM Sans',sans-serif",fontSize:10,fontWeight:700,letterSpacing:"0.04em",textTransform:"uppercase",cursor:"pointer",transition:"all .18s"}}>{f}</button>))}
            </div>

            {/* Search */}
            <div style={{padding:"0 16px 12px"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(245,243,239,0.1)",border:"0.5px solid rgba(245,243,239,0.2)",padding:"8px 14px"}}>
                <span style={{color:T.sage,fontSize:13}}>🔍</span>
                <input placeholder="Search events, venues, vibes…" value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1,background:"none",border:"none",fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.fog}}/>
                {search&&<button onClick={()=>setSearch("")} style={{background:"none",border:"none",color:T.sage,cursor:"pointer",fontSize:16,lineHeight:1}}>×</button>}
              </div>
            </div>

            {/* Categories */}
            <div style={{display:"flex",gap:6,overflowX:"auto",padding:"0 16px 14px",WebkitOverflowScrolling:"touch"}}>
              {CATEGORIES.map(c=>{const isA=activeCat===c.id;const meta=c.id!=="all"?CAT_META[c.id]:null;return(<button key={c.id} onClick={()=>setCat(c.id)} style={{flexShrink:0,padding:"5px 12px",background:isA?(meta?.bg||"rgba(245,243,239,0.9)"):"rgba(245,243,239,0.1)",color:isA?(meta?.color||T.charcoal):"rgba(245,243,239,0.6)",border:`0.5px solid ${isA?(meta?.color||T.fog):"rgba(245,243,239,0.2)"}`,fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:isA?700:500,cursor:"pointer",transition:"all .18s",whiteSpace:"nowrap"}}>{c.icon} {c.label}</button>);})}
            </div>
          </header>
        )}

        {screen==="feed"&&(
          <main style={{flex:1,overflowY:"auto",padding:"16px 16px 100px"}}>
            <GeoBanner geoState={geoState} onRequest={requestGeo}/>
            {dbError&&<div style={{background:"#FEF0E0",padding:"8px 14px",marginBottom:12}}><span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:T.amber}}>Connection issue — showing demo events</span></div>}
            {!search&&(
              <div style={{marginBottom:14}}>
                <h2 style={{fontFamily:"'DM Sans',sans-serif",fontSize:19,fontWeight:800,color:T.charcoal,lineHeight:1.2,letterSpacing:"-0.02em"}}>
                  {activeFilter==="Now"&&"Happening right now"}
                  {activeFilter==="Tonight"&&"Going on tonight"}
                  {activeFilter==="Tomorrow"&&"Tomorrow in Boulder"}
                  {activeFilter==="This Weekend"&&"This weekend in Boulder"}
                  {activeFilter==="Coming Up"&&"Coming up soon"}
                  {activeFilter==="Trending"&&"Trending around town"}
                </h2>
                <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:T.sage,marginTop:3}}>
                  {filtered.length} {filtered.length===1?"experience":"experiences"}{userCoords?" · sorted by distance":""}
                </p>
              </div>
            )}
            {loading?(
              <div style={{display:"flex",justifyContent:"center",padding:"48px 0"}}><div style={{width:24,height:24,border:`2px solid ${T.stone}`,borderTop:`2px solid ${T.pine}`,borderRadius:"50%",animation:"spin .8s linear infinite"}}/></div>
            ):filtered.length>0?(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {filtered.map((e,i)=>(<EventCard key={e.id} event={e} index={i} saved={saved.has(e.id)} interested={interested.has(e.id)} onSave={()=>toggleSave(e.id)} onInterest={()=>toggleInt(e.id)} distMiles={e.distMiles}/>))}
              </div>
            ):(
              <div style={{textAlign:"center",padding:"60px 20px",animation:"fadeIn .4s ease"}}>
                <div style={{fontSize:40,marginBottom:14}}>🏔️</div>
                <h3 style={{fontFamily:"'DM Sans',sans-serif",fontSize:18,color:T.charcoalMute,marginBottom:8}}>Nothing here right now</h3>
                <p style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,color:T.sage}}>Try a different filter or category</p>
              </div>
            )}
          </main>
        )}

        {screen==="map"&&<MapView events={withDist} saved={saved} interested={interested} onSave={toggleSave} onInterest={toggleInt} userLat={userCoords?.lat} userLng={userCoords?.lng}/>}
        {screen==="saved"&&<SavedView events={withDist} saved={saved} interested={interested} onSave={toggleSave} onInterest={toggleInt} userCoords={userCoords}/>}
        {screen==="profile"&&<ProfileView saved={saved} events={events} userCoords={userCoords} geoState={geoState}/>}

        <nav style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,background:"rgba(245,243,239,0.97)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`0.5px solid ${T.stone}`,display:"flex",zIndex:50,padding:"10px 0 max(16px,env(safe-area-inset-bottom))"}}>
          {NAV.map(n=>{const a=screen===n.id;return(<button key={n.id} onClick={()=>setScreen(n.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"4px 0"}}>
            <span style={{fontSize:19,lineHeight:1,filter:a?`drop-shadow(0 0 4px ${T.pine}88)`:"none",transform:a?"scale(1.1)":"scale(1)",transition:"all .18s"}}>{n.icon}</span>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,letterSpacing:"0.06em",textTransform:"uppercase",color:a?T.pine:T.sage,fontWeight:a?700:400,transition:"color .18s"}}>{n.label}</span>
          </button>);})}
        </nav>
      </div>
    </>
  );
}
