/* ===== 标记与交互 ===== */
let _dragging=false;
function isTerminal(mode,i){
  if(mode===`trav`||mode===`lev`){const r=activeRouteOf(mode);if(!r||r.closed)return false;return i===0||i===r.pts.length-1;}
  return false;
}
function makeIcon(mode,i,opts){
  opts=opts||{};const M0=M[mode],nm=label(mode,i),p=M0.pts[i],kind=p?p.kind:`new`;const sel=opts.sel?` sel`:``;const inactive=opts.inactive?` inactive`:``;
  if(kind===`known`){const link=(p&&p.link)?` link`:``;return L.divIcon({className:``,html:`<div class="pt-known`+sel+link+inactive+`"><svg width="22" height="19" viewBox="0 0 22 19"><polygon points="11,1.5 20.5,17.5 1.5,17.5" fill="#ff5a3c" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><span class="known-nm">`+nm+`</span></div>`,iconSize:[60,34],iconAnchor:[30,11]});}
  if(kind===`turn`){return L.divIcon({className:``,html:`<div class="pt-turn`+sel+inactive+`">`+nm+`</div>`,iconSize:[0,0],iconAnchor:[0,0]});}
  const term=opts.term?` term`:``,sync=(p&&p.sync)?` sync`:``,anchor=opts.anchor?` anchor`:``;
  return L.divIcon({className:``,html:`<div class="pt-label `+M0.cls+term+sync+sel+inactive+anchor+`">`+nm+`</div>`,iconSize:[0,0],iconAnchor:[0,0]});
}
function refreshIcons(mode){
  if(_dragging)return;
  if(mode===`trav`||mode===`lev`){
    const savedId=M[mode].activeRouteId;
    M[mode].routes.forEach(route=>{
      M[mode].activeRouteId=route.id;
      route.pts.forEach((p,i)=>p.marker.setIcon(makeIcon(mode,i,{term:isTerminal(mode,i),anchor:!!route.parentId&&i===0,sel:ctrlObjectPointSelected(p)})));
    });
    M[mode].activeRouteId=savedId;
  }else{
    M[mode].pts.forEach((p,i)=>p.marker.setIcon(makeIcon(mode,i,{term:isTerminal(mode,i),sel:ctrlObjectPointSelected(p)||M.gnss.triSel.includes(p)})));
  }
}
function delAction(mode,p){
  if(p.fromImpGhost&&!p.link)return{text:`退`,title:`退回可用控制点`,fn(){pushUndo();revertToGhost(mode,p);toast(`已退回可用控制点`);}};
  return{text:p.link?`移`:`删`,title:p.link?`从导线移除`:`删除`,fn(){pushUndo();removePoint(mode,p);}};
}
function bindMarker(mode,p){
  p.marker.off();
  if(p.marker._tooltip)p.marker.unbindTooltip();
  function ownerRoute(){
    if(mode===`trav`)return M.trav.routes.find(r=>r.pts.includes(p));
    if(mode===`lev`)return M.lev.routes.find(r=>r.pts.includes(p));
    return null;
  }
  if(!p.link){p.marker.on(`dragstart`,()=>{_dragging=true;pushUndo();});p.marker.on(`drag`,()=>{p.wgs=trueLL(p.marker.getLatLng());refresh();});p.marker.on(`dragend`,()=>{_dragging=false;refreshIcons(mode);});}
  p.marker.on(`click`,ev=>{
    if(ev)L.DomEvent.stopPropagation(ev);
    if(calc.on)return;
    if(ctrlObj.active&&ctrlObjectAddPoint(mode,p,ownerRoute()))return;
    if(mode===`gnss`){
      const i=M.gnss.pts.indexOf(p);
      if(M.gnss.sub===`edge`){const g=M.gnss;if(!g.sel){g.sel=p;p.marker.setIcon(makeIcon(`gnss`,i,{sel:true}));}else if(g.sel===p){g.sel=null;refreshIcons(`gnss`);}else{pushUndo();toggleEdge(g.sel,p);g.sel=null;refresh();}return;}
      if(M.gnss.sub===`tri`){selectTriVertex(p);return;}
      return;
    }
    const ar=activeRouteOf(mode);
    if(!ar){toast(`请先创建或选中一条`+ROUTE_LABEL[mode]);return;}
    if(ar.locked){toast(ROUTE_LABEL[mode]+`已锁定`);return;}
    if(ar.pts.includes(p))return;
    const THRESH=1e-6;
    if(ar.pts.some(q=>Math.abs(q.wgs.lat-p.wgs.lat)<THRESH&&Math.abs(q.wgs.lng-p.wgs.lng)<THRESH)){toast(`当前路线已包含该点`);return;}
    pushUndo();
    const np={id:++uid,kind:p.kind,name:p.name,wgs:{lat:p.wgs.lat,lng:p.wgs.lng},sync:false,link:p.link||null};
    if(p.link)np.indepName=!!p.indepName;
    np.marker=L.marker(displayLL(np.wgs),{draggable:!ar.locked}).addTo(map);
    ar.pts.push(np);bindMarker(mode,np);refresh();
    toast(`已加入：`+(p.name||`控制点`));
  });
  function showEditPopup(e){
    if(e){L.DomEvent.stopPropagation(e);L.DomEvent.preventDefault(e);}
    if(calc.on)return;
    const or=ownerRoute();
    let idx,lbl;
    if(mode===`gnss`){idx=M.gnss.pts.indexOf(p);lbl=label(`gnss`,idx>=0?idx:0);}
    else{idx=or?or.pts.indexOf(p):0;const sid=M[mode].activeRouteId;if(or)M[mode].activeRouteId=or.id;lbl=label(mode,idx>=0?idx:0);M[mode].activeRouteId=sid;}
    const isLocked=or&&or.locked;
    const div=document.createElement(`div`);div.style.textAlign=`center`;
    const originalName=p.name||``;
    const originalDisplay=p.name||lbl;
    const nameInp=document.createElement(`input`);nameInp.type=`text`;nameInp.value=originalDisplay;
    nameInp.style.cssText=`width:100%;padding:4px 8px;border:1px solid var(--line);border-radius:4px;background:var(--panel2);color:var(--text);font-size:13px;text-align:center;font-weight:600;margin-bottom:6px;`;
    if(isLocked)nameInp.disabled=true;
    let skipNameCommit=false;
    function commitName(){
      if(skipNameCommit||isLocked)return;
      const v=nameInp.value.trim();
      if(!v)return;
      if(!originalName&&v===originalDisplay)return;
      if(v!==originalName){
        const conflict=pointNameConflict(v,p);
        if(conflict){toast(`点名「`+v+`」已被占用`);nameInp.value=originalDisplay;return;}
        pushUndo();p.name=v;if(p.link)p.indepName=true;refresh();
      }
    }
    nameInp.onkeydown=ev=>{
      if(ev.key===`Enter`){ev.preventDefault();commitName();skipNameCommit=true;map.closePopup();}
      else if(ev.key===`Escape`){ev.preventDefault();ev.stopPropagation();if(nameInp.value!==originalDisplay)nameInp.value=originalDisplay;else{skipNameCommit=true;map.closePopup();}}
    };
    div.appendChild(nameInp);
    if(p.kind===`turn`){
      const infoT=document.createElement(`div`);infoT.style.cssText=`font-size:12px;color:var(--muted);margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px;`;infoT.textContent=`转点`;
      if(!isLocked){const li=document.createElement(`span`);li.className=`gps-locate-icon`;li.title=`GPS采样定位`;li.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`;li.onclick=function(ev){ev.stopPropagation();if(li.classList.contains(`sampling`))return;li.classList.add(`sampling`);map.closePopup();toast(`采样中 0/5…`);gpsMultiSample(function(r){if(!r)return;pushUndo();p.wgs={lat:r.lat,lng:r.lng};p.marker.setLatLng(displayLL(p.wgs));map.panTo(displayLL(p.wgs));refresh();toast(`已定位（精度 `+r.accuracy.toFixed(1)+`m，采样`+r.n+`次，有效`+r.used+`次）`);},function(n,t){toast(`采样中 `+n+`/`+t+`…`);});};infoT.appendChild(li);}
      div.appendChild(infoT);
      if(!isLocked){const db=document.createElement(`button`);db.className=`del-popup-btn`;db.textContent=`删除转点`;db.onclick=()=>{map.closePopup();pushUndo();removePoint(`lev`,p);};div.appendChild(db);}
      const pop=L.popup({offset:[0,-8]}).setLatLng(p.marker.getLatLng()).setContent(div).openOn(map);
      pop.on(`remove`,commitName);
      return;
    }
    const isLevLinked=mode===`lev`&&p.link&&or&&or.linkedRouteId;
    const typeText=p.link?(isLevLinked?`同步自导线`:`同步自GNSS`):(p.kind===`known`?`已知点`:`待测点`);
    const infoDiv=document.createElement(`div`);infoDiv.style.cssText=`font-size:12px;color:var(--muted);margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px;`;infoDiv.textContent=typeText;
    if(!p.link&&!isLocked){const li=document.createElement(`span`);li.className=`gps-locate-icon`;li.title=`GPS采样定位`;li.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>`;li.onclick=function(ev){ev.stopPropagation();if(li.classList.contains(`sampling`))return;li.classList.add(`sampling`);map.closePopup();toast(`采样中 0/5…`);gpsMultiSample(function(r){if(!r)return;pushUndo();p.wgs={lat:r.lat,lng:r.lng};p.marker.setLatLng(displayLL(p.wgs));map.panTo(displayLL(p.wgs));refresh();toast(`已定位（精度 `+r.accuracy.toFixed(1)+`m，采样`+r.n+`次，有效`+r.used+`次）`);},function(n,t){toast(`采样中 `+n+`/`+t+`…`);});};infoDiv.appendChild(li);}
    div.appendChild(infoDiv);
    if(!p.link&&!isLocked){
      const kb=document.createElement(`button`);kb.className=`kind-popup-btn`;kb.textContent=p.kind===`known`?`改为待测点`:`改为已知点`;kb.onclick=()=>{map.closePopup();pushUndo();p.kind=p.kind===`known`?`new`:`known`;refresh();};div.appendChild(kb);
      if(mode===`gnss`){const sb=document.createElement(`button`);sb.className=`kind-popup-btn`;sb.textContent=p.sync?`取消供导线使用`:`供导线使用`;sb.onclick=()=>{map.closePopup();pushUndo();p.sync=!p.sync;refresh();};div.appendChild(sb);}
    }
    if((mode===`trav`||mode===`lev`)&&or&&!isLocked){
      if(or.pts.indexOf(p)===0&&or.pts.length>=3){
        const cb=document.createElement(`button`);cb.className=`kind-popup-btn`;cb.textContent=or.closed?`取消闭合`:`闭合路线`;
        cb.onclick=()=>{map.closePopup();pushUndo();or.closed=!or.closed;refresh();};div.appendChild(cb);
      }
    }
    if((mode===`trav`||mode===`lev`)&&!p.link&&!isLocked){
      const ml=ROUTE_LABEL[mode],sml=`支`+ml;
      const spb=document.createElement(`button`);spb.className=`kind-popup-btn`;spb.textContent=`从此点创建`+sml;
      spb.onclick=async()=>{map.closePopup();const r=await showConfirm(`创建`+sml,`<div class="param"><span>`+sml+`名称</span><input data-key="name" type="text" value="`+sml+(M[mode].routes.length+1)+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div><div class="param"><span>点名前缀</span><input data-key="prefix" type="text" placeholder="可选" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div>`,[{text:`取消`,value:`cancel`},{text:`创建`,value:`create`,cls:`go`}]);if(!r||r.action===`cancel`)return;const nm=r.inputs.name||sml+(M[mode].routes.length+1);const pfx=r.inputs.prefix||``;pushUndo();const pr=ownerRoute();const route=createRouteOf(mode,nm,pfx,pr?pr.id:null);const sp={id:++uid,kind:p.kind,name:p.name||lbl,wgs:{lat:p.wgs.lat,lng:p.wgs.lng},sync:false,link:null};sp.marker=L.marker(displayLL(sp.wgs),{draggable:true}).addTo(map);route.pts.push(sp);bindMarker(mode,sp);refresh();toast(`已创建`+sml+`「`+nm+`」`);};
      div.appendChild(spb);
    }
    if(!isLocked&&!isLevLinked){
      const db=document.createElement(`button`);db.className=`del-popup-btn`;const da=delAction(mode,p);db.textContent=da.title;db.onclick=()=>{skipNameCommit=true;map.closePopup();da.fn();};div.appendChild(db);
    }
    const pop=L.popup({offset:[0,-12]}).setLatLng(p.marker.getLatLng()).setContent(div).openOn(map);
    pop.on(`remove`,commitName);
  }
  p.marker.on(`contextmenu`,showEditPopup);
  let _lpTimer=null;
  p.marker.on(`touchstart`,()=>{_lpTimer=setTimeout(()=>{_lpTimer=null;showEditPopup();},600);});
  p.marker.on(`touchend`,()=>{if(_lpTimer){clearTimeout(_lpTimer);_lpTimer=null;}});
  p.marker.on(`touchmove`,()=>{if(_lpTimer){clearTimeout(_lpTimer);_lpTimer=null;}});
  if(!isMobileLayout())p.marker.bindTooltip(`右键编辑`,{direction:`top`,offset:[0,-10]});
}
function newPoint(mode,latlng,kind){const p={id:++uid,kind:kind||`new`,name:null,wgs:trueLL(latlng),sync:false,link:null};p.marker=L.marker(latlng,{draggable:true}).addTo(map);bindMarker(mode,p);return p;}
async function addPoint(latlng){
  if(cur===`trav`||cur===`lev`){
    const ml=ROUTE_LABEL[cur],pfxHint=cur===`trav`?`可选，如 K`:`可选，如 S`;
    if(!activeRouteOf(cur)){
      const r=await showConfirm(`创建`+ml,`<div class="param"><span>`+ml+`名称</span><input data-key="name" type="text" value="`+ml+(M[cur].routes.length+1)+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div><div class="param"><span>点名前缀</span><input data-key="prefix" type="text" placeholder="`+pfxHint+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div>`,[{text:`取消`,value:`cancel`},{text:`创建`,value:`create`,cls:`go`}]);
      if(!r||r.action===`cancel`)return;
      const nm=r.inputs.name||ml+(M[cur].routes.length+1);const pfx=r.inputs.prefix||``;
      pushUndo();createRouteOf(cur,nm,pfx);const p=newPoint(cur,latlng);M[cur].pts.push(p);refresh();toast(`已创建`+ml+`「`+nm+`」`);return;
    }
    if(activeRouteOf(cur).locked){toast(ml+`已锁定，无法编辑`);return;}
  }
  pushUndo();const p=newPoint(cur,latlng);M[cur].pts.push(p);refresh();
}
function nextAutoName(mode){
  const route=activeRouteOf(mode);
  if(!route)return null;
  const pfx=route.prefix||M[mode].prefix;
  if(!pfx)return null;
  const used=new Set();
  route.pts.forEach((p,i)=>{
    if(p.name&&p.name.startsWith(pfx)){const n=parseInt(p.name.slice(pfx.length),10);if(!isNaN(n))used.add(n);}
    else if(!p.name)used.add(i+1);
  });
  let n=1;while(used.has(n))n++;
  return pfx+String(n).padStart(2,`0`);
}
function insertOnSegment(mode,i,latlng){
  const route=activeRouteOf(mode);
  if(route&&route.locked){toast(ROUTE_LABEL[mode]+`已锁定`);return;}
  pushUndo();
  const sid=M[mode].activeRouteId;if(route)M[mode].activeRouteId=route.id;
  route.pts.forEach((pt,j)=>{if(!pt.name)pt.name=label(mode,j);});
  M[mode].activeRouteId=sid;
  const p=newPoint(mode,latlng);p.name=nextAutoName(mode);M[mode].pts.splice(i+1,0,p);refresh();
}
function showSegPopup(mode,segIdx,ev,route){
  const pts=route.pts;const isKE=!!pts[segIdx].knownEdgeAfter;
  const div=document.createElement(`div`);div.style.cssText=`display:flex;flex-direction:column;gap:6px;`;
  if(!isKE){
    const btnIns=document.createElement(`button`);btnIns.textContent=`在此处插入新点`;btnIns.className=`btn sm`;
    btnIns.onclick=()=>{map.closePopup();insertOnSegment(mode,segIdx,ev.latlng);};
    div.appendChild(btnIns);
    if(mode===`lev`){
      const btnTurn=document.createElement(`button`);btnTurn.textContent=`插入转点`;btnTurn.className=`btn sm`;
      btnTurn.onclick=()=>{map.closePopup();insertTurnPoint(route,segIdx,ev.latlng);};
      div.appendChild(btnTurn);
    }
  }
  if(mode===`trav`){
    const btnKE=document.createElement(`button`);btnKE.textContent=isKE?`取消已知边`:`设为已知边`;btnKE.className=`btn sm`;
    btnKE.onclick=()=>{pushUndo();pts[segIdx].knownEdgeAfter=!isKE;map.closePopup();refresh();};
    div.appendChild(btnKE);
  }
  L.popup({closeButton:true,minWidth:120}).setLatLng(ev.latlng).setContent(div).openOn(map);
}
function nextTurnName(route){
  const used=new Set();
  route.pts.forEach(p=>{if(p.kind===`turn`&&p.name&&p.name.startsWith(`Z`)){const n=parseInt(p.name.slice(1),10);if(!isNaN(n))used.add(n);}});
  let n=1;while(used.has(n))n++;return`Z`+String(n).padStart(2,`0`);
}
function insertTurnPoint(route,segIdx,latlng){
  if(route.locked){toast(`水准路线已锁定`);return;}
  pushUndo();
  const p={id:++uid,kind:`turn`,name:nextTurnName(route),wgs:trueLL(latlng),sync:false,link:null,knownEdgeAfter:false};
  p.marker=L.marker(displayLL(p.wgs),{draggable:true}).addTo(map);
  route.pts.splice(segIdx+1,0,p);bindMarker(`lev`,p);refresh();
}
function showTurnPopup(route,segIdx,ev){
  const div=document.createElement(`div`);div.style.cssText=`display:flex;flex-direction:column;gap:6px;`;
  const btnIns=document.createElement(`button`);btnIns.textContent=`插入转点`;btnIns.className=`btn sm`;
  btnIns.onclick=()=>{map.closePopup();insertTurnPoint(route,segIdx,ev.latlng);};
  div.appendChild(btnIns);
  L.popup({closeButton:true,minWidth:100}).setLatLng(ev.latlng).setContent(div).openOn(map);
}
function removePoint(mode,p){map.removeLayer(p.marker);const M0=M[mode];M0.pts=M0.pts.filter(x=>x!==p);if(mode===`gnss`){M0.edges=M0.edges.filter(e=>e.a!==p&&e.b!==p);M0.triangles=M0.triangles.filter(t=>!t.pts.includes(p));if(M0.sel===p)M0.sel=null;M0.triSel=M0.triSel.filter(x=>x!==p);}refresh();}
function toggleEdge(a,b){
  const g=M.gnss;
  const idx=g.edges.findIndex(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));
  if(idx>=0){
    g.edges.splice(idx,1);
    g.triangles=g.triangles.filter(t=>!(t.pts.includes(a)&&t.pts.includes(b)));
  }else g.edges.push({a,b});
}
function repositionAll(){
  M.gnss.pts.forEach(p=>p.marker.setLatLng(displayLL(p.wgs)));M.gnss.impGhosts.forEach(g=>g.marker.setLatLng(displayLL(g.wgs)));
  M.trav.routes.forEach(route=>{route.pts.forEach(p=>p.marker.setLatLng(displayLL(p.wgs)));});
  M.trav.impGhosts.forEach(g=>g.marker.setLatLng(displayLL(g.wgs)));
  M.lev.routes.forEach(route=>{route.pts.forEach(p=>p.marker.setLatLng(displayLL(p.wgs)));});
  M.lev.impGhosts.forEach(g=>g.marker.setLatLng(displayLL(g.wgs)));
  M.trav.ghosts.forEach(g=>{if(g._wgs)g.setLatLng(displayLL(g._wgs));});
  if(typeof repositionGPSMarker==='function')repositionGPSMarker();
  ctrlObjectUpdateCommitMarker();
}
map.on(`mousemove`,e=>ctrlObjectUpdateSnap(e.latlng));
map.on(`click`,async e=>{
  if(_popupJustClosed){_popupJustClosed=false;return;}
  if(ctrlObj.active){
    if(await handleExpandedEdgeClick(e.latlng))return;
    ctrlObjectUseSnap();
    return;
  }
  if(calc.on){
    await handleExpandedEdgeClick(e.latlng);
    return;
  }
  if(handleNoteMapClick(e.latlng))return;
  if(cur===`gnss`){if(M.gnss.sub!==`point`)return;addPoint(e.latlng);return;}
  addPoint(e.latlng);
});


/* ===== 绘制与渲染 ===== */
function clearLines(mode){M[mode].lines.forEach(l=>map.removeLayer(l));M[mode].lines=[];}
function clearTriLayers(){M.gnss.triLayers.forEach(l=>map.removeLayer(l));M.gnss.triLayers=[];}
function drawSeg(mode,A,B,opts){
  opts=opts||{};
  const w=opts.weight||3;
  let pl;
  if(opts.knownEdge){
    const outer=L.polyline([A,B],{color:opts.color,weight:w+4,opacity:opts.opacity||.9,interactive:!!opts.onClick});
    outer.addTo(map);M[mode].lines.push(outer);
    const inner=L.polyline([A,B],{color:`#080c12`,weight:w,opacity:1,interactive:false});
    inner.addTo(map);M[mode].lines.push(inner);pl=outer;
  }else{
    pl=L.polyline([A,B],{color:opts.color,weight:w,dashArray:opts.dash||null,opacity:opts.opacity||.9,interactive:!!opts.onClick});
    pl.addTo(map);M[mode].lines.push(pl);
  }
  if(opts.onClick)pl.on(`click`,ev=>{L.DomEvent.stopPropagation(ev);opts.onClick(ev);});
  if(opts.onClick&&edgeTouchEnabled()){
    const hit=L.polyline([A,B],{color:`#ffffff`,weight:EDGE_TOUCH_HIT*2,opacity:0,interactive:true});
    hit.addTo(map);
    hit.on(`click`,async ev=>{L.DomEvent.stopPropagation(ev);await handleExpandedEdgeClick(ev.latlng);});
    M[mode].lines.push(hit);
  }
  if(opts.dist!==undefined){
    const mid=L.latLng((A.lat+B.lat)/2,(A.lng+B.lng)/2);
    M[mode].lines.push(L.marker(mid,{icon:L.divIcon({className:``,html:`<div class="dist-label`+(opts.bad?` bad`:``)+`">`+opts.dist.toFixed(1)+` m</div>`,iconSize:[0,0]}),interactive:false}).addTo(map));
  }
  return pl;
}
function calcHas(key){return calc.set.some(x=>x.key===key);}
function toggleCalc(mode,aId,bId){const key=keyOf(aId,bId);const idx=calc.set.findIndex(x=>x.key===key);if(idx>=0)calc.set.splice(idx,1);else calc.set.push({key,mode,aId,bId});refresh();}
function calcSum(){let sum=0,n=0;const keep=[];calc.set.forEach(x=>{const a=pointById(x.mode,x.aId),b=pointById(x.mode,x.bId);if(a&&b&&x.mode===cur){sum+=vincenty(a.wgs,b.wgs);n++;keep.push(x);}else if(a&&b){keep.push(x);}});return {sum,n};}

function refresh(){
  reconcileLinks();
  [`gnss`,`trav`,`lev`].forEach(mode=>{
    refreshIcons(mode);
    if(mode===`trav`||mode===`lev`){
      M[mode].routes.forEach(route=>{
        route.pts.forEach(p=>{
          const sd=!p.link&&!route.locked;if(sd){if(p.marker.dragging)p.marker.dragging.enable();}else{if(p.marker.dragging)p.marker.dragging.disable();}
          if(mode===cur&&!route.hidden){if(!map.hasLayer(p.marker))p.marker.addTo(map);}
          else{if(map.hasLayer(p.marker))map.removeLayer(p.marker);}
        });
      });
    }else{
      M[mode].pts.forEach(p=>{if(mode===cur){if(!map.hasLayer(p.marker))p.marker.addTo(map);}else if(map.hasLayer(p.marker))map.removeLayer(p.marker);});
    }
    M[mode].impGhosts.forEach(g=>{if(mode===cur){if(!map.hasLayer(g.marker))g.marker.addTo(map);}else if(map.hasLayer(g.marker))map.removeLayer(g.marker);});
  });
  clearLines(`gnss`);clearLines(`trav`);clearLines(`lev`);clearTriLayers();buildGhosts();
  refreshNotes();
  renderPtList();renderCalc();
  if(cur===`gnss`)refreshGnss();else if(cur===`trav`)refreshTrav();else refreshLev();
  ctrlObjectUpdateCommitMarker();
  updateUndoButtons();
}
