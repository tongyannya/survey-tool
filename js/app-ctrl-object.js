/* ===== Ctrl / 手机对象捕捉 ===== */
const ctrlObj={active:false,items:[],mode:null,suppress:false,snap:null,marker:null,commitMarker:null,commitLatLng:null};
const CTRL_SNAP_SHOW=18,CTRL_SNAP_HIT=8,EDGE_TOUCH_HIT=22;
function isMobileLayout(){return window.matchMedia&&window.matchMedia(`(max-width:760px)`).matches;}
function edgeTouchEnabled(){return isMobileLayout()&&(ctrlObj.active||calc.on);}
function ctrlObjectStatus(text){
  const el=document.getElementById(`ctrlObjectHint`);
  const label=el&&el.querySelector(`span`);
  if(label)label.textContent=text||`按住 Ctrl 选择对象`;
  if(el)el.classList.toggle(`active`,!!text);
  const sw=document.getElementById(`mobileCtrlSwitch`);
  if(sw)sw.checked=!!text;
}
function ctrlObjectPointSelected(p){return ctrlObj.active&&ctrlObj.items.some(x=>x.type===`point`&&x.point===p);}
function ctrlObjectEdgeSelected(mode,route,segIdx,a,b){
  if(!ctrlObj.active)return false;
  return ctrlObj.items.some(x=>{
    if(x.type!==`edge`||x.mode!==mode)return false;
    if(mode===`gnss`)return (x.a===a&&x.b===b)||(x.a===b&&x.b===a);
    return x.route===route&&x.segIdx===segIdx;
  });
}
function ctrlObjectBegin(){
  if(ctrlObj.active)return;
  if(typeof hideHelp===`function`)hideHelp();
  if(map&&map._popup){map.closePopup(map._popup);document.querySelectorAll(`.leaflet-popup`).forEach(p=>p.remove());}
  if(typeof ctxMenu!==`undefined`&&ctxMenu&&ctxMenu.style.display===`block`&&typeof hideCtx===`function`)hideCtx();
  if(typeof floatOpen!==`undefined`&&floatOpen){floatOpen=null;document.querySelectorAll(`.float-popup`).forEach(p=>p.classList.remove(`open`));}
  ctrlObjectHideCommitMarker();
  ctrlObj.active=true;ctrlObj.items=[];ctrlObj.mode=cur;ctrlObj.suppress=false;
  ctrlObjectStatus(`Ctrl 选择对象中`);
  refresh();
}
function ctrlObjectHideSnap(){
  ctrlObj.snap=null;
  if(ctrlObj.marker){map.removeLayer(ctrlObj.marker);ctrlObj.marker=null;}
}
function ctrlObjectHideCommitMarker(){
  ctrlObj.commitLatLng=null;
  if(ctrlObj.commitMarker){map.removeLayer(ctrlObj.commitMarker);ctrlObj.commitMarker=null;}
}
function ctrlObjectItemLatLng(item){
  if(!item)return null;
  if(item.type===`point`)return item.point.marker.getLatLng();
  if(item.latlng)return item.latlng;
  if(item.type===`edge`&&item.a&&item.b){
    const A=item.a.marker.getLatLng(),B=item.b.marker.getLatLng();
    return L.latLng((A.lat+B.lat)/2,(A.lng+B.lng)/2);
  }
  return null;
}
function ctrlObjectUpdateCommitMarker(){
  if(!isMobileLayout()||!ctrlObj.active||!ctrlObj.items.length){ctrlObjectHideCommitMarker();return;}
  const ll=ctrlObjectItemLatLng(ctrlObj.items[ctrlObj.items.length-1]);
  if(!ll){ctrlObjectHideCommitMarker();return;}
  ctrlObj.commitLatLng=ll;
  const icon=L.divIcon({className:``,html:`<div class="ctrl-commit-marker">✓</div>`,iconSize:[18,18],iconAnchor:[-6,21]});
  if(!ctrlObj.commitMarker){
    ctrlObj.commitMarker=L.marker(ll,{icon,zIndexOffset:2400,interactive:true,bubblingMouseEvents:false}).addTo(map);
    ctrlObj.commitMarker.on(`click`,ev=>{if(ev)L.DomEvent.stopPropagation(ev);ctrlObjectCommitAndRestart();});
  }else{
    ctrlObj.commitMarker.setLatLng(ll);ctrlObj.commitMarker.setIcon(icon);
  }
}
function ctrlObjectCancel(){
  if(!ctrlObj.active)return;
  ctrlObj.active=false;ctrlObj.items=[];ctrlObj.mode=null;ctrlObj.suppress=false;ctrlObjectHideSnap();ctrlObjectHideCommitMarker();
  ctrlObjectStatus();
  refresh();
}
function ctrlObjectAddPoint(mode,p,route){
  if(!ctrlObj.active||ctrlObj.mode!==cur)return false;
  if(mode!==cur)return false;
  const hit=ctrlObj.items.find(x=>x.type===`point`&&x.point===p);
  if(hit)ctrlObj.items=ctrlObj.items.filter(x=>x!==hit);
  else ctrlObj.items.push({type:`point`,mode,point:p,route:route||null});
  ctrlObjectStatus(`已选 `+ctrlObj.items.length+` 个对象`);
  ctrlObjectUpdateCommitMarker();
  refreshIcons(mode);
  return true;
}
function ctrlObjectAddEdge(mode,route,segIdx,a,b,latlng){
  if(!ctrlObj.active||ctrlObj.mode!==cur)return false;
  if(mode!==cur)return false;
  const hit=ctrlObj.items.find(x=>{
    if(x.type!==`edge`||x.mode!==mode)return false;
    if(mode===`gnss`)return (x.a===a&&x.b===b)||(x.a===b&&x.b===a);
    return x.route===route&&x.segIdx===segIdx;
  });
  if(hit)ctrlObj.items=ctrlObj.items.filter(x=>x!==hit);
  else ctrlObj.items.push({type:`edge`,mode,route:route||null,segIdx,a,b,latlng:latlng||null});
  ctrlObjectStatus(`已选 `+ctrlObj.items.length+` 个对象`);
  ctrlObjectUpdateCommitMarker();
  refresh();
  return true;
}
function edgeLabel(e){
  if(e.mode===`gnss`)return `GNSS 基线 `+label(`gnss`,M.gnss.pts.indexOf(e.a))+`-`+label(`gnss`,M.gnss.pts.indexOf(e.b));
  const saved=M[e.mode].activeRouteId;
  if(e.route)M[e.mode].activeRouteId=e.route.id;
  const ia=e.route?e.route.pts.indexOf(e.a):-1,ib=e.route?e.route.pts.indexOf(e.b):-1;
  const text=ROUTE_LABEL[e.mode]+` `+(e.route?e.route.name+` · `:``)+label(e.mode,ia)+`-`+label(e.mode,ib);
  M[e.mode].activeRouteId=saved;
  return text;
}
function samePointSet(a,b){
  if(a.length!==b.length)return false;
  const s=new Set(a.map(p=>p.id));
  return b.every(p=>s.has(p.id));
}
function triangleIndex(pts){
  return M.gnss.triangles.findIndex(t=>samePointSet(t.pts,pts));
}
function toggleGnssTriangle(pts){
  const g=M.gnss;
  if(pts.length!==3)return false;
  const idx=triangleIndex(pts);
  pushUndo();
  if(idx>=0){g.triangles.splice(idx,1);refresh();toast(`已取消三角网`);return true;}
  ensureEdge(pts[0],pts[1]);ensureEdge(pts[1],pts[2]);ensureEdge(pts[2],pts[0]);
  g.triangles.push({pts:[pts[0],pts[1],pts[2]],note:``});
  refresh();toast(`已添加三角网 `+circ(g.triangles.length));
  return true;
}
function commitCtrlGnss(items){
  const pts=items.filter(x=>x.type===`point`).map(x=>x.point);
  const edges=items.filter(x=>x.type===`edge`);
  if(items.length===2&&pts.length===2){pushUndo();const existed=M.gnss.edges.some(e=>(e.a===pts[0]&&e.b===pts[1])||(e.a===pts[1]&&e.b===pts[0]));toggleEdge(pts[0],pts[1]);refresh();toast(existed?`已取消基线`:`已连边`);return;}
  if(items.length===3&&pts.length===3){toggleGnssTriangle(pts);return;}
  if(items.length===3&&edges.length===3){
    const ep=[];edges.forEach(e=>{ep.push(e.a,e.b);});
    const uniq=[...new Map(ep.map(p=>[p.id,p])).values()];
    if(uniq.length===3){toggleGnssTriangle(uniq);return;}
  }
  if(items.length===2&&edges.length===1&&pts.length===1){
    const e=edges[0],p=pts[0];
    if(p!==e.a&&p!==e.b){toggleGnssTriangle([e.a,e.b,p]);return;}
  }
  toast(`GNSS：请选择两点连边，三点/三边/一边一点切换三角网`);
}
function commitCtrlRoute(mode,items){
  const pts=items.filter(x=>x.type===`point`);
  if(!pts.length)return;
  const route=pts[0].route;
  if(!route||route.locked){toast(ROUTE_LABEL[mode]+`已锁定或未选中路线`);return;}
  if(pts.some(x=>x.route!==route)){toast(`请选择同一条`+ROUTE_LABEL[mode]+`上的点`);return;}
  if(pts.length<2)return;
  const ordered=pts.map(x=>x.point);
  const firstIdx=route.pts.indexOf(ordered[0]);
  if(firstIdx<0)return;
  const selected=new Set(ordered);
  const base=route.pts.filter(p=>!selected.has(p));
  const insertAt=route.pts.slice(0,firstIdx).filter(p=>!selected.has(p)).length;
  pushUndo();
  route.pts=[...base.slice(0,insertAt),...ordered,...base.slice(insertAt)];
  refresh();
  toast(`已按选择顺序重连 `+ordered.length+` 个点`);
}
function ctrlObjectCommit(){
  if(!ctrlObj.active)return;
  const items=ctrlObj.items.slice(),mode=ctrlObj.mode,suppress=ctrlObj.suppress;
  ctrlObj.active=false;ctrlObj.items=[];ctrlObj.mode=null;ctrlObj.suppress=false;ctrlObjectHideSnap();ctrlObjectHideCommitMarker();ctrlObjectStatus();
  refresh();
  if(suppress||!items.length)return;
  if(mode===`gnss`)commitCtrlGnss(items);
  else if(mode===`trav`||mode===`lev`)commitCtrlRoute(mode,items);
}
function ctrlObjectCommitAndRestart(){
  if(!ctrlObj.active)return;
  const hadItems=ctrlObj.items.length>0;
  ctrlObjectCommit();
  if(hadItems&&isMobileLayout())ctrlObjectBegin();
}
function projectPointToSegment(P,A,B){
  const ax=A.x,ay=A.y,bx=B.x,by=B.y,px=P.x,py=P.y;
  const dx=bx-ax,dy=by-ay,len2=dx*dx+dy*dy;
  if(!len2)return {x:ax,y:ay,d:Math.hypot(px-ax,py-ay),t:0};
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/len2));
  const x=ax+t*dx,y=ay+t*dy;
  return {x,y,d:Math.hypot(px-x,py-y),t};
}
function ctrlObjectEdges(){
  const edges=[];
  if(cur===`gnss`){
    M.gnss.edges.forEach(e=>edges.push({mode:`gnss`,route:null,segIdx:null,a:e.a,b:e.b,action:null}));
  }else if(cur===`trav`||cur===`lev`){
    const route=activeRouteOf(cur);
    if(route&&!route.hidden&&!route.locked){
      for(let i=0;i<route.pts.length-1;i++)edges.push({mode:cur,route,segIdx:i,a:route.pts[i],b:route.pts[i+1]});
      if(route.closed&&route.pts.length>=3)edges.push({mode:cur,route,segIdx:route.pts.length-1,a:route.pts[route.pts.length-1],b:route.pts[0]});
    }
  }
  return edges;
}
function edgeCandidatesAtLatLng(latlng,radius){
  const p=map.latLngToLayerPoint(latlng),hits=[];
  ctrlObjectEdges().forEach(e=>{
    if(!map.hasLayer(e.a.marker)||!map.hasLayer(e.b.marker))return;
    const A=map.latLngToLayerPoint(e.a.marker.getLatLng()),B=map.latLngToLayerPoint(e.b.marker.getLatLng());
    const pr=projectPointToSegment(p,A,B);
    if(pr.d<=radius)hits.push({...e,d:pr.d,latlng:map.layerPointToLatLng(L.point(pr.x,pr.y))});
  });
  hits.sort((a,b)=>a.d-b.d);
  return hits;
}
function ctrlObjectUpdateSnap(latlng){
  if(!ctrlObj.active||ctrlObj.mode!==cur){ctrlObjectHideSnap();return;}
  const p=map.latLngToLayerPoint(latlng);
  const nearPoint=(()=>{
    const pts=cur===`gnss`?M.gnss.pts:(activeRouteOf(cur)?activeRouteOf(cur).pts:[]);
    return pts.some(pt=>map.hasLayer(pt.marker)&&p.distanceTo(map.latLngToLayerPoint(pt.marker.getLatLng()))<=16);
  })();
  if(nearPoint){ctrlObjectHideSnap();return;}
  const best=edgeCandidatesAtLatLng(latlng,CTRL_SNAP_SHOW)[0]||null;
  if(best)best.hit=best.d<=CTRL_SNAP_HIT;
  if(!best){ctrlObjectHideSnap();return;}
  ctrlObj.snap=best;
  const html=`<div class="ctrl-snap-marker`+(best.hit?` hit`:``)+`"></div>`;
  const icon=L.divIcon({className:``,html,iconSize:[18,18],iconAnchor:[9,9]});
  if(!ctrlObj.marker){
    ctrlObj.marker=L.marker(best.latlng,{icon,interactive:false}).addTo(map);
  }else{
    ctrlObj.marker.setLatLng(best.latlng);ctrlObj.marker.setIcon(icon);
  }
}
function ctrlObjectUseSnap(){
  const s=ctrlObj.snap;
  if(!ctrlObj.active||!s||!s.hit)return false;
  if(s.mode===`gnss`)return ctrlObjectAddEdge(`gnss`,null,null,s.a,s.b,s.latlng);
  ctrlObj.suppress=true;
  const ev={latlng:s.latlng};
  if(calc.on){toggleCalc(s.mode,s.a.id,s.b.id);return true;}
  if(s.mode===`trav`){showSegPopup(`trav`,s.segIdx,ev,s.route);return true;}
  if(s.mode===`lev`){
    if(s.a.knownEdgeAfter){toast(`水准已知边不可编辑`);return true;}
    if(s.route.linkedRouteId)showTurnPopup(s.route,s.segIdx,ev);
    else showSegPopup(`lev`,s.segIdx,ev,s.route);
    return true;
  }
  return false;
}
function useEdgeCandidate(s){
  if(!s)return false;
  if(ctrlObj.active){
    if(s.mode===`gnss`)return ctrlObjectAddEdge(`gnss`,null,null,s.a,s.b,s.latlng);
    ctrlObj.suppress=true;
    const ev={latlng:s.latlng};
    if(calc.on){toggleCalc(s.mode,s.a.id,s.b.id);return true;}
    if(s.mode===`trav`){showSegPopup(`trav`,s.segIdx,ev,s.route);return true;}
    if(s.mode===`lev`){
      if(s.a.knownEdgeAfter){toast(`水准已知边不可编辑`);return true;}
      if(s.route.linkedRouteId)showTurnPopup(s.route,s.segIdx,ev);
      else showSegPopup(`lev`,s.segIdx,ev,s.route);
      return true;
    }
  }else if(calc.on){
    toggleCalc(s.mode,s.a.id,s.b.id);
    return true;
  }
  return false;
}
async function chooseEdgeCandidate(hits){
  if(!hits.length)return null;
  if(hits.length===1)return hits[0];
  const shown=hits.slice(0,5);
  const rows=shown.map((h,i)=>`<div class="row"><span class="lab">`+(i+1)+`. `+edgeLabel(h)+`</span><span class="val">距触点 `+h.d.toFixed(0)+` px</span></div>`).join(``);
  const buttons=[{text:`取消`,value:`cancel`}].concat(shown.map((h,i)=>({text:String(i+1),value:String(i),cls:i===0?`go`:``})));
  const r=await showConfirm(`选择要操作的边`,`<p class="note" style="margin-top:0">点击范围内有多个要素，请选择一个。</p>`+rows,buttons);
  if(!r||r.action===`cancel`)return null;
  return shown[parseInt(r.action,10)]||null;
}
async function handleExpandedEdgeClick(latlng){
  if(!edgeTouchEnabled())return false;
  const hits=edgeCandidatesAtLatLng(latlng,EDGE_TOUCH_HIT);
  if(!hits.length)return false;
  const picked=await chooseEdgeCandidate(hits);
  if(picked)useEdgeCandidate(picked);
  return true;
}
