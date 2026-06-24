/* ===== 标记与交互 ===== */
let _dragging=false;
let noteMode=false;
function isTerminal(mode,i){
  if(mode===`trav`){const r=activeRoute();if(!r||r.closed)return false;return i===0||i===r.pts.length-1;}
  if(mode===`lev`){const r=activeLevRoute();if(!r||r.closed)return false;return i===0||i===r.pts.length-1;}
  return false;
}
function makeIcon(mode,i,opts){
  opts=opts||{};const M0=M[mode],nm=label(mode,i),p=M0.pts[i],kind=p?p.kind:`new`;const sel=opts.sel?` sel`:``;const inactive=opts.inactive?` inactive`:``;
  if(kind===`known`){const link=(p&&p.link)?` link`:``;return L.divIcon({className:``,html:`<div class="pt-known`+sel+link+inactive+`"><svg width="22" height="19" viewBox="0 0 22 19"><polygon points="11,1.5 20.5,17.5 1.5,17.5" fill="#ff5a3c" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><span class="known-nm">`+nm+`</span></div>`,iconSize:[60,34],iconAnchor:[30,11]});}
  const term=opts.term?` term`:``,sync=(p&&p.sync)?` sync`:``,anchor=opts.anchor?` anchor`:``;
  return L.divIcon({className:``,html:`<div class="pt-label `+M0.cls+term+sync+sel+inactive+anchor+`">`+nm+`</div>`,iconSize:[0,0],iconAnchor:[0,0]});
}
function refreshIcons(mode){
  if(_dragging)return;
  if(mode===`trav`){
    const savedId=M.trav.activeRouteId;
    M.trav.routes.forEach(route=>{
      M.trav.activeRouteId=route.id;
      route.pts.forEach((p,i)=>p.marker.setIcon(makeIcon(mode,i,{term:isTerminal(mode,i),anchor:!!route.parentId&&i===0})));
    });
    M.trav.activeRouteId=savedId;
  }else if(mode===`lev`){
    const savedId=M.lev.activeRouteId;
    M.lev.routes.forEach(route=>{
      M.lev.activeRouteId=route.id;
      route.pts.forEach((p,i)=>p.marker.setIcon(makeIcon(mode,i,{term:isTerminal(mode,i),anchor:!!route.parentId&&i===0})));
    });
    M.lev.activeRouteId=savedId;
  }else{
    M[mode].pts.forEach((p,i)=>p.marker.setIcon(makeIcon(mode,i,{term:isTerminal(mode,i)})));
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
  p.marker.on(`click`,()=>{
    if(calc.on)return;
    if(mode===`gnss`){
      const i=M.gnss.pts.indexOf(p);
      if(M.gnss.sub===`edge`){const g=M.gnss;if(!g.sel){g.sel=p;p.marker.setIcon(makeIcon(`gnss`,i,{sel:true}));}else if(g.sel===p){g.sel=null;refreshIcons(`gnss`);}else{pushUndo();toggleEdge(g.sel,p);g.sel=null;refresh();}return;}
      if(M.gnss.sub===`tri`){selectTriVertex(p);return;}
      return;
    }
    const getAr=mode===`trav`?activeRoute:activeLevRoute;
    const ar=getAr();
    if(!ar){toast(mode===`trav`?`请先创建或选中一条导线`:`请先创建或选中一条水准路线`);return;}
    if(ar.locked){toast(mode===`trav`?`导线已锁定`:`水准路线已锁定`);return;}
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
    const nameInp=document.createElement(`input`);nameInp.type=`text`;nameInp.value=p.name||lbl;
    nameInp.style.cssText=`width:100%;padding:4px 8px;border:1px solid var(--line);border-radius:4px;background:var(--panel2);color:var(--text);font-size:13px;text-align:center;font-weight:600;margin-bottom:6px;`;
    if(isLocked)nameInp.disabled=true;
    nameInp.onkeydown=ev=>{if(ev.key===`Enter`){ev.preventDefault();const v=nameInp.value.trim();if(v!==(p.name||lbl)){pushUndo();p.name=v||null;if(p.link)p.indepName=true;}map.closePopup();refresh();}};
    div.appendChild(nameInp);
    const typeText=p.link?`同步自GNSS`:(p.kind===`known`?`已知点`:`待测点`);
    const infoDiv=document.createElement(`div`);infoDiv.style.cssText=`font-size:12px;color:var(--dim);margin-bottom:6px;`;infoDiv.textContent=typeText;div.appendChild(infoDiv);
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
    if(mode===`trav`&&!p.link&&!isLocked){
      const spb=document.createElement(`button`);spb.className=`kind-popup-btn`;spb.textContent=`从此点创建支导线`;
      spb.onclick=async()=>{map.closePopup();const r=await showConfirm(`创建支导线`,`<div class="param"><span>支导线名称</span><input data-key="name" type="text" value="支导线`+(M.trav.routes.length+1)+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div><div class="param"><span>点名前缀</span><input data-key="prefix" type="text" placeholder="可选" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div>`,[{text:`取消`,value:`cancel`},{text:`创建`,value:`create`,cls:`go`}]);if(!r||r.action===`cancel`)return;const nm=r.inputs.name||`支导线`+(M.trav.routes.length+1);const pfx=r.inputs.prefix||``;pushUndo();const pr=ownerRoute();const route=createRoute(nm,pfx,pr?pr.id:null);const sp={id:++uid,kind:p.kind,name:p.name||lbl,wgs:{lat:p.wgs.lat,lng:p.wgs.lng},sync:false,link:null};sp.marker=L.marker(displayLL(sp.wgs),{draggable:true}).addTo(map);route.pts.push(sp);bindMarker(`trav`,sp);refresh();toast(`已创建支导线「`+nm+`」`);};
      div.appendChild(spb);
    }
    if(mode===`lev`&&!p.link&&!isLocked){
      const spb=document.createElement(`button`);spb.className=`kind-popup-btn`;spb.textContent=`从此点创建支水准路线`;
      spb.onclick=async()=>{map.closePopup();const r=await showConfirm(`创建支水准路线`,`<div class="param"><span>路线名称</span><input data-key="name" type="text" value="支水准`+(M.lev.routes.length+1)+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div><div class="param"><span>点名前缀</span><input data-key="prefix" type="text" placeholder="可选" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div>`,[{text:`取消`,value:`cancel`},{text:`创建`,value:`create`,cls:`go`}]);if(!r||r.action===`cancel`)return;const nm=r.inputs.name||`支水准`+(M.lev.routes.length+1);const pfx=r.inputs.prefix||``;pushUndo();const pr=ownerRoute();const route=createLevRoute(nm,pfx,pr?pr.id:null);const sp={id:++uid,kind:p.kind,name:p.name||lbl,wgs:{lat:p.wgs.lat,lng:p.wgs.lng},sync:false,link:null};sp.marker=L.marker(displayLL(sp.wgs),{draggable:true}).addTo(map);route.pts.push(sp);bindMarker(`lev`,sp);refresh();toast(`已创建支水准路线「`+nm+`」`);};
      div.appendChild(spb);
    }
    if(!isLocked){
      const lb=document.createElement(`button`);lb.className=`kind-popup-btn`;lb.innerHTML=`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="vertical-align:-2px;margin-right:3px"><circle cx="12" cy="12" r="8"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></svg>定位到当前位置`;lb.onclick=()=>{if(!navigator.geolocation){toast(`浏览器不支持定位`);return;}toast(`正在获取位置…`);navigator.geolocation.getCurrentPosition(pos=>{map.closePopup();pushUndo();p.wgs={lat:pos.coords.latitude,lng:pos.coords.longitude};p.marker.setLatLng(displayLL(p.wgs));map.panTo(displayLL(p.wgs));refresh();toast(`已定位（精度 `+Math.round(pos.coords.accuracy)+`m）`);},err=>{toast(`定位失败：`+(err.code===1?`权限被拒绝`:err.code===2?`位置不可用`:`超时`));},{enableHighAccuracy:true,maximumAge:0,timeout:10000});};div.appendChild(lb);
      const db=document.createElement(`button`);db.className=`del-popup-btn`;const da=delAction(mode,p);db.textContent=da.title;db.onclick=()=>{map.closePopup();da.fn();};div.appendChild(db);
    }
    L.popup({offset:[0,-12]}).setLatLng(p.marker.getLatLng()).setContent(div).openOn(map);
    setTimeout(()=>{if(!isLocked){nameInp.focus();nameInp.select();}},100);
  }
  p.marker.on(`contextmenu`,showEditPopup);
  let _lpTimer=null;
  p.marker.on(`touchstart`,()=>{_lpTimer=setTimeout(()=>{_lpTimer=null;showEditPopup();},600);});
  p.marker.on(`touchend`,()=>{if(_lpTimer){clearTimeout(_lpTimer);_lpTimer=null;}});
  p.marker.on(`touchmove`,()=>{if(_lpTimer){clearTimeout(_lpTimer);_lpTimer=null;}});
  p.marker.bindTooltip(`右键编辑`,{direction:`top`,offset:[0,-10]});
}
function newPoint(mode,latlng,kind){const p={id:++uid,kind:kind||`new`,name:null,wgs:trueLL(latlng),sync:false,link:null};p.marker=L.marker(latlng,{draggable:true}).addTo(map);bindMarker(mode,p);return p;}
async function addPoint(latlng){
  if(cur===`trav`){
    if(!activeRoute()){
      const r=await showConfirm(`创建导线`,`<div class="param"><span>导线名称</span><input data-key="name" type="text" value="导线`+(M.trav.routes.length+1)+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div><div class="param"><span>点名前缀</span><input data-key="prefix" type="text" placeholder="可选，如 K" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div>`,[{text:`取消`,value:`cancel`},{text:`创建`,value:`create`,cls:`go`}]);
      if(!r||r.action===`cancel`)return;
      const nm=r.inputs.name||`导线`+(M.trav.routes.length+1);const pfx=r.inputs.prefix||``;
      pushUndo();createRoute(nm,pfx);const p=newPoint(cur,latlng);M[cur].pts.push(p);refresh();toast(`已创建导线「`+nm+`」`);return;
    }
    if(activeRoute().locked){toast(`导线已锁定，无法编辑`);return;}
  }
  if(cur===`lev`){
    if(!activeLevRoute()){
      const r=await showConfirm(`创建水准路线`,`<div class="param"><span>路线名称</span><input data-key="name" type="text" value="水准`+(M.lev.routes.length+1)+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div><div class="param"><span>点名前缀</span><input data-key="prefix" type="text" placeholder="可选，如 S" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div>`,[{text:`取消`,value:`cancel`},{text:`创建`,value:`create`,cls:`go`}]);
      if(!r||r.action===`cancel`)return;
      const nm=r.inputs.name||`水准`+(M.lev.routes.length+1);const pfx=r.inputs.prefix||``;
      pushUndo();createLevRoute(nm,pfx);const p=newPoint(cur,latlng);M[cur].pts.push(p);refresh();toast(`已创建水准路线「`+nm+`」`);return;
    }
    if(activeLevRoute().locked){toast(`水准路线已锁定，无法编辑`);return;}
  }
  pushUndo();const p=newPoint(cur,latlng);M[cur].pts.push(p);refresh();
}
function nextAutoName(mode){
  const route=mode===`trav`?activeRoute():activeLevRoute();
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
  if(mode===`trav`&&activeRoute()&&activeRoute().locked){toast(`导线已锁定`);return;}
  if(mode===`lev`&&activeLevRoute()&&activeLevRoute().locked){toast(`水准路线已锁定`);return;}
  pushUndo();
  const route=mode===`trav`?activeRoute():activeLevRoute();
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
  }
  if(mode===`trav`){
    const btnKE=document.createElement(`button`);btnKE.textContent=isKE?`取消已知边`:`设为已知边`;btnKE.className=`btn sm`;
    btnKE.onclick=()=>{pushUndo();pts[segIdx].knownEdgeAfter=!isKE;map.closePopup();refresh();};
    div.appendChild(btnKE);
  }
  L.popup({closeButton:true,minWidth:120}).setLatLng(ev.latlng).setContent(div).openOn(map);
}
function removePoint(mode,p){map.removeLayer(p.marker);const M0=M[mode];M0.pts=M0.pts.filter(x=>x!==p);if(mode===`gnss`){M0.edges=M0.edges.filter(e=>e.a!==p&&e.b!==p);M0.triangles=M0.triangles.filter(t=>!t.pts.includes(p));if(M0.sel===p)M0.sel=null;M0.triSel=M0.triSel.filter(x=>x!==p);}refresh();}
function toggleEdge(a,b){const g=M.gnss;const idx=g.edges.findIndex(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a));if(idx>=0)g.edges.splice(idx,1);else g.edges.push({a,b});}
function ensureEdge(a,b){const g=M.gnss;if(!g.edges.some(e=>(e.a===a&&e.b===b)||(e.a===b&&e.b===a)))g.edges.push({a,b});}
function repositionAll(){
  M.gnss.pts.forEach(p=>p.marker.setLatLng(displayLL(p.wgs)));M.gnss.impGhosts.forEach(g=>g.marker.setLatLng(displayLL(g.wgs)));
  M.trav.routes.forEach(route=>{route.pts.forEach(p=>p.marker.setLatLng(displayLL(p.wgs)));});
  M.trav.impGhosts.forEach(g=>g.marker.setLatLng(displayLL(g.wgs)));
  M.lev.routes.forEach(route=>{route.pts.forEach(p=>p.marker.setLatLng(displayLL(p.wgs)));});
  M.lev.impGhosts.forEach(g=>g.marker.setLatLng(displayLL(g.wgs)));
  M.trav.ghosts.forEach(g=>{if(g._wgs)g.setLatLng(displayLL(g._wgs));});
}
function noteIcon(n){return L.divIcon({className:``,html:`<div class="note-pin"><svg width="20" height="28" viewBox="0 0 20 28"><path d="M10 0C4.5 0 0 4.5 0 10c0 7.5 10 18 10 18s10-10.5 10-18C20 4.5 15.5 0 10 0z" fill="#ffb454" stroke="#fff" stroke-width="1.5"/><circle cx="10" cy="10" r="4" fill="#fff"/></svg>`+(n.text?`<span class="note-text">`+n.text+`</span>`:``)+`</div>`,iconSize:[0,0],iconAnchor:[0,0]});}
function makeNoteMarker(n){const mk=L.marker(displayLL(n.wgs),{draggable:true,icon:noteIcon(n)});mk.on(`dragstart`,()=>{_dragging=true;pushUndo();});mk.on(`drag`,()=>{n.wgs=trueLL(mk.getLatLng());});mk.on(`dragend`,()=>{_dragging=false;});function showNotePopup(e){if(e){L.DomEvent.stopPropagation(e);L.DomEvent.preventDefault(e);}const div=document.createElement(`div`);div.style.textAlign=`center`;const inp=document.createElement(`input`);inp.type=`text`;inp.value=n.text||``;inp.placeholder=`备注文字（可选）`;inp.style.cssText=`width:100%;padding:4px 8px;border:1px solid var(--line);border-radius:4px;background:var(--panel2);color:var(--text);font-size:13px;text-align:center;margin-bottom:6px;`;inp.onkeydown=ev=>{if(ev.key===`Enter`){ev.preventDefault();n.text=inp.value.trim();mk.setIcon(noteIcon(n));map.closePopup();}};div.appendChild(inp);const db=document.createElement(`button`);db.className=`del-popup-btn`;db.textContent=`删除图记`;db.onclick=()=>{map.closePopup();pushUndo();map.removeLayer(mk);M.notes=M.notes.filter(x=>x!==n);};div.appendChild(db);L.popup({offset:[0,-12]}).setLatLng(mk.getLatLng()).setContent(div).openOn(map);setTimeout(()=>{inp.focus();inp.select();},100);}mk.on(`contextmenu`,showNotePopup);let _lp=null;mk.on(`touchstart`,()=>{_lp=setTimeout(()=>{_lp=null;showNotePopup();},600);});mk.on(`touchend`,()=>{if(_lp){clearTimeout(_lp);_lp=null;}});mk.on(`touchmove`,()=>{if(_lp){clearTimeout(_lp);_lp=null;}});mk.bindTooltip(`右键编辑`,{direction:`top`,offset:[0,-28]});return mk;}
map.on(`click`,e=>{if(noteMode){pushUndo();const n={id:++uid,text:``,wgs:trueLL(e.latlng)};n.marker=makeNoteMarker(n);n.marker.addTo(map);M.notes.push(n);return;}if(calc.on)return;if(cur===`gnss`){if(M.gnss.sub!==`point`)return;addPoint(e.latlng);return;}addPoint(e.latlng);});

/* ===== 三角形 ===== */
function selectTriVertex(p){const g=M.gnss;const idx=g.triSel.indexOf(p);if(idx>=0){g.triSel.splice(idx,1);}else{g.triSel.push(p);}g.pts.forEach((q,i)=>q.marker.setIcon(makeIcon(`gnss`,i,{sel:g.triSel.includes(q)})));if(g.triSel.length===3){const[a,b,c]=g.triSel;pushUndo();ensureEdge(a,b);ensureEdge(b,c);ensureEdge(c,a);g.triangles.push({pts:[a,b,c],note:``});g.triSel=[];refresh();toast(`已添加三角网 `+circ(g.triangles.length));}}
function removeTriangle(t){pushUndo();M.gnss.triangles=M.gnss.triangles.filter(x=>x!==t);refresh();}

/* ===== Delaunay 三角剖分 ===== */
function inCirc(a,b,c,p){const ax=a.x-p.x,ay=a.y-p.y,bx=b.x-p.x,by=b.y-p.y,cx=c.x-p.x,cy=c.y-p.y;const d=(ax*ax+ay*ay)*(bx*cy-cx*by)-(bx*bx+by*by)*(ax*cy-cx*ay)+(cx*cx+cy*cy)*(ax*by-bx*ay);const o=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);return o>0?d>0:d<0;}
function delaunay(nodes){const n=nodes.length;if(n<3){const es=[];for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)es.push([nodes[i],nodes[j]]);return es;}let minX=1/0,minY=1/0,maxX=-1/0,maxY=-1/0;nodes.forEach(p=>{minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x);maxY=Math.max(maxY,p.y);});const dx=(maxX-minX)||1,dy=(maxY-minY)||1,dm=Math.max(dx,dy),mx=(minX+maxX)/2,my=(minY+maxY)/2;const s1={id:`s1`,x:mx-20*dm,y:my-dm},s2={id:`s2`,x:mx,y:my+20*dm},s3={id:`s3`,x:mx+20*dm,y:my-dm};let tris=[[s1,s2,s3]];nodes.forEach(p=>{const bad=[];tris.forEach(t=>{if(inCirc(t[0],t[1],t[2],p))bad.push(t);});const cnt={},mp={};bad.forEach(t=>{[[t[0],t[1]],[t[1],t[2]],[t[2],t[0]]].forEach(([u,v])=>{const k=[u.id,v.id].sort().join(`|`);cnt[k]=(cnt[k]||0)+1;mp[k]=[u,v];});});tris=tris.filter(t=>!bad.includes(t));Object.keys(cnt).forEach(k=>{if(cnt[k]===1){const[u,v]=mp[k];tris.push([u,v,p]);}});});tris=tris.filter(t=>t.every(v=>v.id!==`s1`&&v.id!==`s2`&&v.id!==`s3`));const seen={},es=[];tris.forEach(t=>{[[t[0],t[1]],[t[1],t[2]],[t[2],t[0]]].forEach(([u,v])=>{const k=[u.id,v.id].sort().join(`|`);if(!seen[k]){seen[k]=1;es.push([u,v]);}});});return es;}
function autoTriangulate(){const g=M.gnss;if(g.pts.length<2){toast(`至少需要 2 个点`);return;}pushUndo();const lat0=g.pts.reduce((s,p)=>s+p.wgs.lat,0)/g.pts.length;const nodes=g.pts.map(p=>({id:p.id,x:p.wgs.lng*111320*Math.cos(lat0*Math.PI/180),y:p.wgs.lat*110540,p}));g.edges=delaunay(nodes).map(([u,v])=>({a:u.p,b:v.p}));refresh();toast(`已生成三角网：`+g.edges.length+` 条基线`);}
function gnssStats(){const g=M.gnss,pts=g.pts,edges=g.edges,adj={};pts.forEach(p=>adj[p.id]=new Set());edges.forEach(e=>{adj[e.a.id].add(e.b.id);adj[e.b.id].add(e.a.id);});let tri=0;for(let i=0;i<pts.length;i++)for(let j=i+1;j<pts.length;j++)for(let k=j+1;k<pts.length;k++){const a=pts[i].id,b=pts[j].id,c=pts[k].id;if(adj[a].has(b)&&adj[b].has(c)&&adj[a].has(c))tri++;}const seen=new Set();let comp=0;pts.forEach(p=>{if(!seen.has(p.id)){comp++;const st=[p.id];seen.add(p.id);while(st.length){const x=st.pop();adj[x].forEach(y=>{if(!seen.has(y)){seen.add(y);st.push(y);}});}}});return {tri,comp,loops:Math.max(0,edges.length-pts.length+comp)};}

/* ===== 绘制与渲染 ===== */
function clearLines(mode){M[mode].lines.forEach(l=>map.removeLayer(l));M[mode].lines=[];}
function clearTriLayers(){M.gnss.triLayers.forEach(l=>map.removeLayer(l));M.gnss.triLayers=[];}
function drawSeg(mode,A,B,opts){opts=opts||{};const w=opts.weight||3;let pl;if(opts.knownEdge){const outer=L.polyline([A,B],{color:opts.color,weight:w+4,opacity:opts.opacity||.9,interactive:!!opts.onClick});outer.addTo(map);M[mode].lines.push(outer);const inner=L.polyline([A,B],{color:`#080c12`,weight:w,opacity:1,interactive:false});inner.addTo(map);M[mode].lines.push(inner);pl=outer;}else{pl=L.polyline([A,B],{color:opts.color,weight:w,dashArray:opts.dash||null,opacity:opts.opacity||.9,interactive:!!opts.onClick});pl.addTo(map);M[mode].lines.push(pl);}if(opts.onClick)pl.on(`click`,ev=>{L.DomEvent.stopPropagation(ev);opts.onClick(ev);});if(opts.dist!==undefined){const mid=L.latLng((A.lat+B.lat)/2,(A.lng+B.lng)/2);M[mode].lines.push(L.marker(mid,{icon:L.divIcon({className:``,html:`<div class="dist-label`+(opts.bad?` bad`:``)+`">`+opts.dist.toFixed(1)+` m</div>`,iconSize:[0,0]}),interactive:false}).addTo(map));}return pl;}
function kindCounts(pts){const k=pts.filter(p=>p.kind===`known`).length;return {known:k,nw:pts.length-k};}
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
    if(mode!==cur)clearLines(mode);
  });
  clearLines(`gnss`);clearLines(`trav`);clearLines(`lev`);clearTriLayers();buildGhosts();
  M.notes.forEach(n=>{if(!map.hasLayer(n.marker))n.marker.addTo(map);});
  renderPtList();renderCalc();
  if(cur===`gnss`)refreshGnss();else if(cur===`trav`)refreshTrav();else refreshLev();
  updateUndoButtons();
}

function startRename(mode,p,el){
  const i=M[mode].pts.indexOf(p);const curName=label(mode,i);
  const inp=document.createElement(`input`);inp.className=`nameinput`;inp.value=curName;
  el.replaceWith(inp);inp.focus();inp.select();
  let committed=false;
  const commit=async()=>{
    if(committed)return;committed=true;
    const v=inp.value.trim();pushUndo();p.name=v?v:null;
    if(p.link)p.indepName=true;
    if(mode===`gnss`&&p.sync){
      const linked=M.trav.routes.flatMap(r=>r.pts).filter(tp=>tp.link===p.id);
      if(linked.length){
        const r=await showConfirm(`重命名同步`,`<p>该点已同步至导线。是否将新名称应用到导线？</p>`,[{text:`否，导线保持原名`,value:`no`},{text:`是，同步改名`,value:`yes`,cls:`go`}]);
        if(!r||r.action===`no`){linked.forEach(tp=>{tp.indepName=true;});}
        else{linked.forEach(tp=>{tp.indepName=false;});}
      }
    }
    refresh();
  };
  inp.addEventListener(`keydown`,ev=>{if(ev.key===`Enter`){ev.preventDefault();inp.blur();}else if(ev.key===`Escape`)refresh();});
  inp.addEventListener(`blur`,commit);
}
function movePoint(mode,i,dir){const pts=M[mode].pts,j=i+dir;if(j<0||j>=pts.length)return;pushUndo();[pts[i],pts[j]]=[pts[j],pts[i]];refresh();}
function updateSelUI(){document.querySelectorAll(`.pt-row`).forEach(r=>{const idx=parseInt(r.dataset.idx);const p=M[cur].pts[idx];if(p)r.classList.toggle(`selected`,selectedPtIds.has(p.id));});const sc=document.getElementById(`selCount`);if(sc)sc.textContent=selectedPtIds.size?`已选 `+selectedPtIds.size+` 个`:``;}

function renderPtList(){
  const mode=cur,box=document.getElementById(`ptList`);
  const bs=document.getElementById(`batchSection`);
  const impBtnRow=document.getElementById(`impBtn`).parentElement;
  if(bs&&bs.parentElement)bs.remove();
  if(mode===`trav`||mode===`lev`){impBtnRow.style.display=`none`;renderRouteList(box,mode,bs);return;}
  impBtnRow.style.display=``;
  if(bs){bs.style.display=``;box.parentElement.insertBefore(bs,impBtnRow);}
  const M0=M[mode],kc=kindCounts(M0.pts);
  document.getElementById(`ptTitleText`).textContent=`控制点（已知 `+kc.known+` · 待测 `+kc.nw+`）`;
  if(M0.pts.length===0){box.innerHTML=``;return;}
  box.innerHTML=``;
  M0.pts.forEach((p,i)=>{
    const w=p.wgs,term=isTerminal(mode,i)?(i===0?`·起`:`·终`):``;
    const row=document.createElement(`div`);row.className=`pt-row`+(selectedPtIds.has(p.id)?` selected`:``);row.dataset.idx=i;row.addEventListener(`click`,e=>{if(e.target.closest(`.ic,.drag-handle,.nameinput,b`))return;if(e.ctrlKey||e.metaKey){if(selectedPtIds.has(p.id))selectedPtIds.delete(p.id);else selectedPtIds.add(p.id);}else{if(selectedPtIds.has(p.id)&&selectedPtIds.size===1)selectedPtIds.clear();else{selectedPtIds.clear();selectedPtIds.add(p.id);}}updateSelUI();});
    const b=document.createElement(`b`);b.className=p.link?`link`:(p.kind===`known`?`k`:`n`);b.textContent=label(mode,i)+term;b.title=p.link?`同步自GNSS（点击独立改名）`:`点击改名`;
    b.onclick=()=>startRename(mode,p,b);
    const co=document.createElement(`span`);co.className=`co`;co.textContent=w.lat.toFixed(6)+`, `+w.lng.toFixed(6);
    row.appendChild(b);row.appendChild(co);
    if(!p.link){
      const kb=document.createElement(`button`);kb.className=`ic`+(p.kind===`known`?` k`:``);kb.textContent=p.kind===`known`?`已`:`待`;kb.title=`切换已知/待测`;kb.onclick=()=>{pushUndo();p.kind=p.kind===`known`?`new`:`known`;refresh();};row.appendChild(kb);
      if(mode===`gnss`){const sb=document.createElement(`button`);sb.className=`ic`+(p.sync?` s`:``);sb.textContent=`导`;sb.title=`供导线使用（同步）`;sb.onclick=()=>{pushUndo();p.sync=!p.sync;refresh();};row.appendChild(sb);}
    }
    const del=document.createElement(`button`);del.className=`ic del`;
    const da=delAction(mode,p);del.textContent=da.text;del.title=da.title;del.onclick=da.fn;row.appendChild(del);
    if(M0.pts.length>1){const handle=document.createElement(`span`);handle.className=`drag-handle`;handle.textContent=`⠿`;row.insertBefore(handle,row.firstChild);row.draggable=true;row.ondragstart=e=>{e.dataTransfer.effectAllowed=`move`;setTimeout(()=>row.classList.add(`dragging`),0);box._dragFrom=i;};row.ondragend=()=>{row.classList.remove(`dragging`);box.querySelectorAll(`.pt-row`).forEach(r=>r.classList.remove(`drag-above`,`drag-below`));delete box._dragFrom;};row.ondragover=e=>{e.preventDefault();if(box._dragFrom===undefined||box._dragFrom===i)return;box.querySelectorAll(`.pt-row`).forEach(r=>r.classList.remove(`drag-above`,`drag-below`));const rect=row.getBoundingClientRect();row.classList.add(e.clientY>rect.top+rect.height/2?`drag-below`:`drag-above`);};row.ondrop=e=>{e.preventDefault();const from=box._dragFrom;if(from===undefined)return;let to=i;if(e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2)to++;if(from<to)to--;if(from!==to){pushUndo();const[pt]=M0.pts.splice(from,1);M0.pts.splice(to,0,pt);refresh();}};}
    box.appendChild(row);
  });
  const sc=document.getElementById(`selCount`);if(sc)sc.textContent=selectedPtIds.size?`已选 `+selectedPtIds.size+` 个`:``;
}

/* ===== 路线列表（导线/水准共用） ===== */
function renderRouteList(box,mode,bs){
  const mData=M[mode];
  const getAr=mode===`trav`?activeRoute:activeLevRoute;
  const setAr=mode===`trav`?setActiveRouteId:setActiveLevRouteId;
  const createFn=mode===`trav`?createRoute:createLevRoute;
  const deleteFn=mode===`trav`?deleteRoute:deleteLevRoute;
  const ar=getAr();
  const mLabel=mode===`trav`?`导线`:`水准路线`;
  const totalKc={known:0,nw:0};
  mData.routes.forEach(r=>{const kc=kindCounts(r.pts);totalKc.known+=kc.known;totalKc.nw+=kc.nw;});
  document.getElementById(`ptTitleText`).textContent=mLabel+`（`+mData.routes.length+`条 · 已知 `+totalKc.known+` · 待测 `+totalKc.nw+`）`;
  box.innerHTML=``;
  const addBtn=document.createElement(`button`);addBtn.className=`wide`;addBtn.style.marginBottom=`4px`;addBtn.textContent=`+ 创建`+mLabel;
  addBtn.onclick=async()=>{
    const dh=`<div class="param"><span>`+mLabel+`名称</span><input data-key="name" type="text" value="`+mLabel+(mData.routes.length+1)+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div><div class="param"><span>点名前缀</span><input data-key="prefix" type="text" placeholder="可选，如 K、S" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div>`;
    const r=await showConfirm(`创建`+mLabel,dh,[{text:`取消`,value:`cancel`},{text:`创建`,value:`create`,cls:`go`}]);
    if(!r||r.action===`cancel`)return;
    const nm=r.inputs.name||mLabel+(mData.routes.length+1);const pfx=r.inputs.prefix||``;
    pushUndo();createFn(nm,pfx);refresh();toast(`已创建`+mLabel+`「`+nm+`」`);
  };
  box.appendChild(addBtn);
  if(mode===`lev`){const copyBtn=document.createElement(`button`);copyBtn.className=`wide`;copyBtn.id=`copyFromTrav`;copyBtn.textContent=`从导线复制全部路线`;copyBtn.style.marginBottom=`4px`;box.appendChild(copyBtn);}
  const impBtn2=document.createElement(`button`);impBtn2.className=`wide`;impBtn2.textContent=`导入已知点（CSV / TXT / Excel）`;
  impBtn2.onclick=()=>document.getElementById(`fileIn`).click();
  const impRow2=document.createElement(`div`);impRow2.className=`btn-row`;impRow2.style.marginTop=`0`;impRow2.style.marginBottom=`8px`;
  impRow2.appendChild(impBtn2);box.appendChild(impRow2);
  let bsPlaced=false;
  const topRoutes=mData.routes.filter(r=>!r.parentId||!mData.routes.some(x=>x.id===r.parentId));
  function renderItem(route,depth){
    const isActive=ar&&route.id===ar.id;
    const item=document.createElement(`div`);item.className=`route-item`+(isActive?` active`:``)+(route.hidden?` hidden-route`:``)+(route.locked?` locked-route`:``);
    if(depth>0)item.style.marginLeft=(depth*16)+`px`;
    const hdr=document.createElement(`div`);hdr.className=`route-header`;
    hdr.onclick=e=>{if(e.target.closest(`input,button,.ic,.route-arrow,.route-name`))return;pushUndo();setAr(isActive?null:route.id);refresh();};
    const arrow=document.createElement(`span`);arrow.className=`route-arrow`;arrow.textContent=route.expanded?`▼`:`▶`;
    arrow.onclick=e=>{e.stopPropagation();route.expanded=!route.expanded;refresh();};
    hdr.appendChild(arrow);
    const nm=document.createElement(`span`);nm.className=`route-name`;nm.textContent=route.name;nm.title=`双击改名`;
    let nmTimer=null;
    nm.onclick=e=>{e.stopPropagation();if(nmTimer){clearTimeout(nmTimer);nmTimer=null;
      const inp=document.createElement(`input`);inp.className=`nameinput`;inp.value=route.name;inp.style.width=`100px`;nm.replaceWith(inp);inp.focus();inp.select();
      let done=false;const commit=()=>{if(done)return;done=true;const v=inp.value.trim();if(v)route.name=v;refresh();};
      inp.onkeydown=ev=>{if(ev.key===`Enter`){ev.preventDefault();inp.blur();}else if(ev.key===`Escape`)refresh();};inp.onblur=commit;return;}
      nmTimer=setTimeout(()=>{nmTimer=null;pushUndo();setAr(isActive?null:route.id);refresh();},280);};
    hdr.appendChild(nm);
    const closedLabel=document.createElement(`label`);closedLabel.className=`route-closed-wrap`;closedLabel.onclick=e=>e.stopPropagation();
    const closedCb=document.createElement(`input`);closedCb.type=`checkbox`;closedCb.checked=!!route.closed;
    closedCb.onchange=()=>{pushUndo();route.closed=closedCb.checked;refresh();};
    closedLabel.appendChild(closedCb);closedLabel.appendChild(document.createTextNode(` 闭合`));
    hdr.appendChild(closedLabel);
    const hideBtn=document.createElement(`button`);hideBtn.className=`ic`+(route.hidden?` active`:``);hideBtn.textContent=`隐`;hideBtn.title=route.hidden?`取消隐藏`:`隐藏`;
    hideBtn.onclick=e=>{e.stopPropagation();pushUndo();route.hidden=!route.hidden;refresh();};hdr.appendChild(hideBtn);
    const lockBtn=document.createElement(`button`);lockBtn.className=`ic`+(route.locked?` active`:``);lockBtn.textContent=`锁`;lockBtn.title=route.locked?`解除锁定`:`锁定`;
    lockBtn.onclick=e=>{e.stopPropagation();pushUndo();route.locked=!route.locked;refresh();};hdr.appendChild(lockBtn);
    const childCount=mData.routes.filter(x=>x.parentId===route.id).length;
    const delBtn=document.createElement(`button`);delBtn.className=`ic del`;delBtn.textContent=`删`;delBtn.title=`删除`+mLabel;
    delBtn.onclick=async e=>{e.stopPropagation();const r=await showConfirm(`删除`+mLabel,`<p>确定删除`+mLabel+`「`+route.name+`」及其全部 `+route.pts.length+` 个控制点？`+(childCount?`<br>同时删除 `+childCount+` 条子路线。`:``)+`</p>`,[{text:`取消`,value:`cancel`},{text:`删除`,value:`del`,cls:`go`}]);if(!r||r.action!==`del`)return;pushUndo();deleteFn(route.id);refresh();toast(`已删除`+mLabel+`「`+route.name+`」`);};
    hdr.appendChild(delBtn);item.appendChild(hdr);
    if(route.expanded){
      const body=document.createElement(`div`);body.className=`route-body`;
      const savedId=mData.activeRouteId;mData.activeRouteId=route.id;
      route.pts.forEach((p,i)=>{
        const w=p.wgs,term=isTerminal(mode,i)?(i===0?`·起`:`·终`):``;
        const row=document.createElement(`div`);row.className=`pt-row`+(selectedPtIds.has(p.id)?` selected`:``);row.dataset.idx=i;
        row.addEventListener(`click`,e=>{if(e.target.closest(`.ic,.drag-handle,.nameinput,b`))return;if(e.ctrlKey||e.metaKey){if(selectedPtIds.has(p.id))selectedPtIds.delete(p.id);else selectedPtIds.add(p.id);}else{if(selectedPtIds.has(p.id)&&selectedPtIds.size===1)selectedPtIds.clear();else{selectedPtIds.clear();selectedPtIds.add(p.id);}}updateSelUI();});
        const b=document.createElement(`b`);b.className=p.link?`link`:(p.kind===`known`?`k`:`n`);b.textContent=label(mode,i)+term;b.title=p.link?`同步自GNSS（点击独立改名）`:`点击改名`;
        if(!route.locked)b.onclick=()=>startRename(mode,p,b);
        const co=document.createElement(`span`);co.className=`co`;co.textContent=w.lat.toFixed(6)+`, `+w.lng.toFixed(6);
        row.appendChild(b);row.appendChild(co);
        if(!p.link&&!route.locked){
          const kb=document.createElement(`button`);kb.className=`ic`+(p.kind===`known`?` k`:``);kb.textContent=p.kind===`known`?`已`:`待`;kb.title=`切换已知/待测`;kb.onclick=()=>{pushUndo();p.kind=p.kind===`known`?`new`:`known`;refresh();};row.appendChild(kb);
        }
        if(!route.locked){const del=document.createElement(`button`);del.className=`ic del`;const da=delAction(mode,p);del.textContent=da.text;del.title=da.title;del.onclick=da.fn;row.appendChild(del);}
        if(route.pts.length>1&&!route.locked){const handle=document.createElement(`span`);handle.className=`drag-handle`;handle.textContent=`⠿`;row.insertBefore(handle,row.firstChild);row.draggable=true;row.ondragstart=e=>{e.dataTransfer.effectAllowed=`move`;setTimeout(()=>row.classList.add(`dragging`),0);body._dragFrom=i;};row.ondragend=()=>{row.classList.remove(`dragging`);body.querySelectorAll(`.pt-row`).forEach(r=>r.classList.remove(`drag-above`,`drag-below`));delete body._dragFrom;};row.ondragover=e=>{e.preventDefault();if(body._dragFrom===undefined||body._dragFrom===i)return;body.querySelectorAll(`.pt-row`).forEach(r=>r.classList.remove(`drag-above`,`drag-below`));const rect=row.getBoundingClientRect();row.classList.add(e.clientY>rect.top+rect.height/2?`drag-below`:`drag-above`);};row.ondrop=e=>{e.preventDefault();const from=body._dragFrom;if(from===undefined)return;let to=i;if(e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2)to++;if(from<to)to--;if(from!==to){pushUndo();const[pt]=route.pts.splice(from,1);route.pts.splice(to,0,pt);refresh();}};}
        body.appendChild(row);
      });
      mData.activeRouteId=savedId;
      item.appendChild(body);
      if(isActive&&!route.locked&&bs){bs.style.display=``;item.appendChild(bs);bsPlaced=true;}
    }
    box.appendChild(item);
    const children=mData.routes.filter(r=>r.parentId===route.id);
    children.forEach(child=>renderItem(child,depth+1));
  }
  topRoutes.forEach(route=>renderItem(route,0));
  if(!bsPlaced&&bs){bs.style.display=`none`;box.appendChild(bs);}
}

/* ===== 导线路线列表（已废弃，由 renderRouteList 替代） ===== */
function renderTravRouteList(box){
  const ar=activeRoute();
  const totalKc={known:0,nw:0};
  M.trav.routes.forEach(r=>{const kc=kindCounts(r.pts);totalKc.known+=kc.known;totalKc.nw+=kc.nw;});
  document.getElementById(`ptTitleText`).textContent=`导线（`+M.trav.routes.length+`条 · 已知 `+totalKc.known+` · 待测 `+totalKc.nw+`）`;
  box.innerHTML=``;
  const addBtn=document.createElement(`button`);addBtn.className=`wide`;addBtn.style.marginBottom=`8px`;addBtn.textContent=`+ 创建导线`;
  addBtn.onclick=async()=>{const r=await showConfirm(`创建导线`,`<div class="param"><span>导线名称</span><input data-key="name" type="text" value="导线`+(M.trav.routes.length+1)+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div>`,[{text:`取消`,value:`cancel`},{text:`创建`,value:`create`,cls:`go`}]);if(!r||r.action===`cancel`)return;const nm=r.inputs.name||`导线`+(M.trav.routes.length+1);pushUndo();createRoute(nm);refresh();toast(`已创建导线「`+nm+`」`);};
  box.appendChild(addBtn);

  M.trav.routes.forEach(route=>{
    const isActive=ar&&route.id===ar.id;
    const item=document.createElement(`div`);item.className=`route-item`+(isActive?` active`:``)+(route.hidden?` hidden-route`:``)+(route.locked?` locked-route`:``);

    const hdr=document.createElement(`div`);hdr.className=`route-header`;
    hdr.onclick=e=>{if(e.target.closest(`input,button,.ic`))return;pushUndo();setActiveRouteId(isActive?null:route.id);refresh();};

    const arrow=document.createElement(`span`);arrow.className=`route-arrow`;arrow.textContent=isActive?`▼`:`▶`;hdr.appendChild(arrow);

    const nm=document.createElement(`span`);nm.className=`route-name`;nm.textContent=route.name;nm.title=`点击改名`;
    nm.onclick=e=>{e.stopPropagation();const inp=document.createElement(`input`);inp.className=`nameinput`;inp.value=route.name;inp.style.width=`100px`;nm.replaceWith(inp);inp.focus();inp.select();let done=false;const commit=()=>{if(done)return;done=true;const v=inp.value.trim();if(v)route.name=v;refresh();};inp.onkeydown=ev=>{if(ev.key===`Enter`){ev.preventDefault();inp.blur();}else if(ev.key===`Escape`)refresh();};inp.onblur=commit;};
    hdr.appendChild(nm);

    const closedLabel=document.createElement(`label`);closedLabel.className=`route-closed-wrap`;closedLabel.onclick=e=>e.stopPropagation();
    const closedCb=document.createElement(`input`);closedCb.type=`checkbox`;closedCb.checked=!!route.closed;closedCb.onchange=()=>{pushUndo();route.closed=closedCb.checked;refresh();};
    closedLabel.appendChild(closedCb);closedLabel.appendChild(document.createTextNode(` 闭合`));
    hdr.appendChild(closedLabel);

    const hideBtn=document.createElement(`button`);hideBtn.className=`ic`+(route.hidden?` active`:``);hideBtn.textContent=`隐`;hideBtn.title=route.hidden?`取消隐藏`:`隐藏`;
    hideBtn.onclick=e=>{e.stopPropagation();pushUndo();route.hidden=!route.hidden;refresh();};hdr.appendChild(hideBtn);

    const lockBtn=document.createElement(`button`);lockBtn.className=`ic`+(route.locked?` active`:``);lockBtn.textContent=`锁`;lockBtn.title=route.locked?`解除锁定`:`锁定`;
    lockBtn.onclick=e=>{e.stopPropagation();pushUndo();route.locked=!route.locked;refresh();};hdr.appendChild(lockBtn);

    const delBtn=document.createElement(`button`);delBtn.className=`ic del`;delBtn.textContent=`删`;delBtn.title=`删除导线`;
    delBtn.onclick=async e=>{e.stopPropagation();const r=await showConfirm(`删除导线`,`<p>确定删除导线「`+route.name+`」及其全部 `+route.pts.length+` 个控制点？</p>`,[{text:`取消`,value:`cancel`},{text:`删除`,value:`del`,cls:`go`}]);if(!r||r.action!==`del`)return;pushUndo();deleteRoute(route.id);refresh();toast(`已删除导线「`+route.name+`」`);};hdr.appendChild(delBtn);

    item.appendChild(hdr);

    if(isActive){
      const body=document.createElement(`div`);body.className=`route-body`;
      const savedId=M.trav.activeRouteId;M.trav.activeRouteId=route.id;
      route.pts.forEach((p,i)=>{
        const w=p.wgs,term=isTerminal(`trav`,i)?(i===0?`·起`:`·终`):``;
        const row=document.createElement(`div`);row.className=`pt-row`+(selectedPtIds.has(p.id)?` selected`:``);row.dataset.idx=i;
        row.addEventListener(`click`,e=>{if(e.target.closest(`.ic,.drag-handle,.nameinput,b`))return;if(e.ctrlKey||e.metaKey){if(selectedPtIds.has(p.id))selectedPtIds.delete(p.id);else selectedPtIds.add(p.id);}else{if(selectedPtIds.has(p.id)&&selectedPtIds.size===1)selectedPtIds.clear();else{selectedPtIds.clear();selectedPtIds.add(p.id);}}updateSelUI();});
        const b=document.createElement(`b`);b.className=p.link?`link`:(p.kind===`known`?`k`:`n`);b.textContent=label(`trav`,i)+term;b.title=p.link?`同步自GNSS（点击独立改名）`:`点击改名`;
        if(!route.locked)b.onclick=()=>startRename(`trav`,p,b);
        const co=document.createElement(`span`);co.className=`co`;co.textContent=w.lat.toFixed(6)+`, `+w.lng.toFixed(6);
        row.appendChild(b);row.appendChild(co);
        if(!p.link&&!route.locked){
          const kb=document.createElement(`button`);kb.className=`ic`+(p.kind===`known`?` k`:``);kb.textContent=p.kind===`known`?`已`:`待`;kb.title=`切换已知/待测`;kb.onclick=()=>{pushUndo();p.kind=p.kind===`known`?`new`:`known`;refresh();};row.appendChild(kb);
        }
        if(!route.locked){
          const del=document.createElement(`button`);del.className=`ic del`;
          const da=delAction(`trav`,p);del.textContent=da.text;del.title=da.title;del.onclick=da.fn;row.appendChild(del);
        }
        if(route.pts.length>1&&!route.locked){const handle=document.createElement(`span`);handle.className=`drag-handle`;handle.textContent=`⠿`;row.insertBefore(handle,row.firstChild);row.draggable=true;row.ondragstart=e=>{e.dataTransfer.effectAllowed=`move`;setTimeout(()=>row.classList.add(`dragging`),0);body._dragFrom=i;};row.ondragend=()=>{row.classList.remove(`dragging`);body.querySelectorAll(`.pt-row`).forEach(r=>r.classList.remove(`drag-above`,`drag-below`));delete body._dragFrom;};row.ondragover=e=>{e.preventDefault();if(body._dragFrom===undefined||body._dragFrom===i)return;body.querySelectorAll(`.pt-row`).forEach(r=>r.classList.remove(`drag-above`,`drag-below`));const rect=row.getBoundingClientRect();row.classList.add(e.clientY>rect.top+rect.height/2?`drag-below`:`drag-above`);};row.ondrop=e=>{e.preventDefault();const from=body._dragFrom;if(from===undefined)return;let to=i;if(e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2)to++;if(from<to)to--;if(from!==to){pushUndo();const[pt]=route.pts.splice(from,1);route.pts.splice(to,0,pt);refresh();}};}
        body.appendChild(row);
      });
      M.trav.activeRouteId=savedId;
      item.appendChild(body);
    }
    box.appendChild(item);
  });
  const batchSection=document.getElementById(`batchSection`);
  if(batchSection)batchSection.style.display=(ar&&!ar.locked)?``:`none`;
}

/* ===== 水准路线列表 ===== */
function renderLevRouteList(box){
  const ar=activeLevRoute();
  const totalKc={known:0,nw:0};
  M.lev.routes.forEach(r=>{const kc=kindCounts(r.pts);totalKc.known+=kc.known;totalKc.nw+=kc.nw;});
  document.getElementById(`ptTitleText`).textContent=`水准路线（`+M.lev.routes.length+`条 · 已知 `+totalKc.known+` · 待测 `+totalKc.nw+`）`;
  box.innerHTML=``;
  const addBtn=document.createElement(`button`);addBtn.className=`wide`;addBtn.style.marginBottom=`8px`;addBtn.textContent=`+ 创建水准路线`;
  addBtn.onclick=async()=>{const r=await showConfirm(`创建水准路线`,`<div class="param"><span>路线名称</span><input data-key="name" type="text" value="水准`+(M.lev.routes.length+1)+`" style="width:140px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div>`,[{text:`取消`,value:`cancel`},{text:`创建`,value:`create`,cls:`go`}]);if(!r||r.action===`cancel`)return;const nm=r.inputs.name||`水准`+(M.lev.routes.length+1);pushUndo();createLevRoute(nm);refresh();toast(`已创建水准路线「`+nm+`」`);};
  box.appendChild(addBtn);

  M.lev.routes.forEach(route=>{
    const isActive=ar&&route.id===ar.id;
    const item=document.createElement(`div`);item.className=`route-item`+(isActive?` active`:``)+(route.hidden?` hidden-route`:``)+(route.locked?` locked-route`:``);

    const hdr=document.createElement(`div`);hdr.className=`route-header`;
    hdr.onclick=e=>{if(e.target.closest(`input,button,.ic`))return;pushUndo();setActiveLevRouteId(isActive?null:route.id);refresh();};

    const arrow=document.createElement(`span`);arrow.className=`route-arrow`;arrow.textContent=isActive?`▼`:`▶`;hdr.appendChild(arrow);

    const nm=document.createElement(`span`);nm.className=`route-name`;nm.textContent=route.name;nm.title=`点击改名`;
    nm.onclick=e=>{e.stopPropagation();const inp=document.createElement(`input`);inp.className=`nameinput`;inp.value=route.name;inp.style.width=`100px`;nm.replaceWith(inp);inp.focus();inp.select();let done=false;const commit=()=>{if(done)return;done=true;const v=inp.value.trim();if(v)route.name=v;refresh();};inp.onkeydown=ev=>{if(ev.key===`Enter`){ev.preventDefault();inp.blur();}else if(ev.key===`Escape`)refresh();};inp.onblur=commit;};
    hdr.appendChild(nm);

    const hideBtn=document.createElement(`button`);hideBtn.className=`ic`+(route.hidden?` active`:``);hideBtn.textContent=`隐`;hideBtn.title=route.hidden?`取消隐藏`:`隐藏`;
    hideBtn.onclick=e=>{e.stopPropagation();pushUndo();route.hidden=!route.hidden;refresh();};hdr.appendChild(hideBtn);

    const lockBtn=document.createElement(`button`);lockBtn.className=`ic`+(route.locked?` active`:``);lockBtn.textContent=`锁`;lockBtn.title=route.locked?`解除锁定`:`锁定`;
    lockBtn.onclick=e=>{e.stopPropagation();pushUndo();route.locked=!route.locked;refresh();};hdr.appendChild(lockBtn);

    const delBtn=document.createElement(`button`);delBtn.className=`ic del`;delBtn.textContent=`删`;delBtn.title=`删除水准路线`;
    delBtn.onclick=async e=>{e.stopPropagation();const r=await showConfirm(`删除水准路线`,`<p>确定删除水准路线「`+route.name+`」及其全部 `+route.pts.length+` 个点？</p>`,[{text:`取消`,value:`cancel`},{text:`删除`,value:`del`,cls:`go`}]);if(!r||r.action!==`del`)return;pushUndo();deleteLevRoute(route.id);refresh();toast(`已删除水准路线「`+route.name+`」`);};hdr.appendChild(delBtn);

    item.appendChild(hdr);

    if(isActive){
      const body=document.createElement(`div`);body.className=`route-body`;
      const savedId=M.lev.activeRouteId;M.lev.activeRouteId=route.id;
      route.pts.forEach((p,i)=>{
        const w=p.wgs,term=isTerminal(`lev`,i)?(i===0?`·起`:`·终`):``;
        const row=document.createElement(`div`);row.className=`pt-row`+(selectedPtIds.has(p.id)?` selected`:``);row.dataset.idx=i;
        row.addEventListener(`click`,e=>{if(e.target.closest(`.ic,.drag-handle,.nameinput,b`))return;if(e.ctrlKey||e.metaKey){if(selectedPtIds.has(p.id))selectedPtIds.delete(p.id);else selectedPtIds.add(p.id);}else{if(selectedPtIds.has(p.id)&&selectedPtIds.size===1)selectedPtIds.clear();else{selectedPtIds.clear();selectedPtIds.add(p.id);}}updateSelUI();});
        const b=document.createElement(`b`);b.className=p.kind===`known`?`k`:`n`;b.textContent=label(`lev`,i)+term;b.title=`点击改名`;
        if(!route.locked)b.onclick=()=>startRename(`lev`,p,b);
        const co=document.createElement(`span`);co.className=`co`;co.textContent=w.lat.toFixed(6)+`, `+w.lng.toFixed(6);
        row.appendChild(b);row.appendChild(co);
        if(!route.locked){
          const kb=document.createElement(`button`);kb.className=`ic`+(p.kind===`known`?` k`:``);kb.textContent=p.kind===`known`?`已`:`待`;kb.title=`切换已知/待测`;kb.onclick=()=>{pushUndo();p.kind=p.kind===`known`?`new`:`known`;refresh();};row.appendChild(kb);
          const del=document.createElement(`button`);del.className=`ic del`;
          const da=delAction(`lev`,p);del.textContent=da.text;del.title=da.title;del.onclick=da.fn;row.appendChild(del);
        }
        if(route.pts.length>1&&!route.locked){const handle=document.createElement(`span`);handle.className=`drag-handle`;handle.textContent=`⠿`;row.insertBefore(handle,row.firstChild);row.draggable=true;row.ondragstart=e=>{e.dataTransfer.effectAllowed=`move`;setTimeout(()=>row.classList.add(`dragging`),0);body._dragFrom=i;};row.ondragend=()=>{row.classList.remove(`dragging`);body.querySelectorAll(`.pt-row`).forEach(r=>r.classList.remove(`drag-above`,`drag-below`));delete body._dragFrom;};row.ondragover=e=>{e.preventDefault();if(body._dragFrom===undefined||body._dragFrom===i)return;body.querySelectorAll(`.pt-row`).forEach(r=>r.classList.remove(`drag-above`,`drag-below`));const rect=row.getBoundingClientRect();row.classList.add(e.clientY>rect.top+rect.height/2?`drag-below`:`drag-above`);};row.ondrop=e=>{e.preventDefault();const from=body._dragFrom;if(from===undefined)return;let to=i;if(e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2)to++;if(from<to)to--;if(from!==to){pushUndo();const[pt]=route.pts.splice(from,1);route.pts.splice(to,0,pt);refresh();}};}
        body.appendChild(row);
      });
      M.lev.activeRouteId=savedId;
      item.appendChild(body);
    }
    box.appendChild(item);
  });
  const batchSection=document.getElementById(`batchSection`);
  if(batchSection)batchSection.style.display=(ar&&!ar.locked)?``:`none`;
}

function renderCalc(){
  const box=document.getElementById(`calcBox`),btn=document.getElementById(`calcToggle`);
  btn.textContent=calc.on?`关闭累加器`:`开启累加器`;btn.classList.toggle(`calcon`,calc.on);
  if(!calc.on){box.innerHTML=`关闭状态。开启后点击地图上的边/导线段即可累加长度。`;box.className=`note`;return;}
  const r=calcSum();box.className=``;
  box.innerHTML=`<div class="row ok"><span class="lab">已选 `+r.n+` 条</span><span class="val">合计 `+r.sum.toFixed(2)+` m（`+(r.sum/1000).toFixed(3)+` km）</span></div><div class="note">点击边可加入/移除。仅累加当前模式的边。</div>`;
}

/* ===== 批量编号 (F4) ===== */
document.getElementById(`batchApply`).onclick=async()=>{if(!selectedPtIds.size){toast(`请先选择要编号的点`);return;}const prefix=document.getElementById(`batchPrefix`).value.trim();const startStr=document.getElementById(`batchStart`).value.trim()||`1`;const start=parseInt(startStr)||1;const pts=M[cur].pts.filter(p=>selectedPtIds.has(p.id));if(!pts.length){toast(`请先选择要编号的点`);return;}pushUndo();const maxNum=start+pts.length-1;const pad=Math.max(startStr.length,String(maxNum).length);pts.forEach((p,i)=>{p.name=prefix+String(start+i).padStart(pad,`0`);if(p.link)p.indepName=true;});
  if(cur===`gnss`){const syncPts=pts.filter(p=>p.sync&&allTravPts().some(tp=>tp.link===p.id));if(syncPts.length){const names=syncPts.map(p=>p.name).join(`、`);const r=await showConfirm(`批量编号同步`,`<p>选中的 `+syncPts.length+` 个点已同步至导线（`+names+`）。是否将新名称应用到导线？</p>`,[{text:`否，导线保持原名`,value:`no`},{text:`是，同步改名`,value:`yes`,cls:`go`}]);if(r&&r.action===`yes`){syncPts.forEach(p=>{allTravPts().filter(tp=>tp.link===p.id).forEach(tp=>{tp.indepName=false;});});}else{syncPts.forEach(p=>{allTravPts().filter(tp=>tp.link===p.id).forEach(tp=>{tp.indepName=true;});});}}}
  selectedPtIds.clear();refresh();toast(`已编号 `+pts.length+` 个点`);};
document.getElementById(`selKnown`).onclick=()=>{const ids=M[cur].pts.filter(p=>p.kind===`known`).map(p=>p.id);const allSel=ids.length>0&&ids.every(id=>selectedPtIds.has(id));if(allSel)ids.forEach(id=>selectedPtIds.delete(id));else ids.forEach(id=>selectedPtIds.add(id));updateSelUI();};
document.getElementById(`selNew`).onclick=()=>{const ids=M[cur].pts.filter(p=>p.kind!==`known`&&!p.link).map(p=>p.id);const allSel=ids.length>0&&ids.every(id=>selectedPtIds.has(id));if(allSel)ids.forEach(id=>selectedPtIds.delete(id));else ids.forEach(id=>selectedPtIds.add(id));updateSelUI();};
document.getElementById(`selNone`).onclick=()=>{selectedPtIds.clear();updateSelUI();};
(function(){const el=document.getElementById(`batchStart`);function fit(){el.style.width=Math.max(4,(el.value||``).length+1)+`ch`;}el.addEventListener(`input`,fit);fit();})();
