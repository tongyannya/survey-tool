/* ===== GNSS↔导线同步 ===== */
function reconcileLinks(){
  M.trav.routes.forEach(route=>{
    const rm=[];
    route.pts.forEach(p=>{if(p.link){const src=pointById(`gnss`,p.link);if(!src||!src.sync)rm.push(p);else{p.wgs={lat:src.wgs.lat,lng:src.wgs.lng};if(!p.indepName)p.name=src.name;p.kind=`known`;p.marker.setLatLng(displayLL(p.wgs));}}});
    rm.forEach(p=>{map.removeLayer(p.marker);route.pts=route.pts.filter(x=>x!==p);});
  });
  const used=new Set();
  M.trav.routes.forEach(r=>r.pts.filter(p=>p.link).forEach(p=>used.add(p.link)));
  M.gnss.pts.forEach(src=>{if(src.sync&&!used.has(src.id)){
    for(const route of M.trav.routes){
      const match=route.pts.find(p=>!p.link&&Math.abs(p.wgs.lat-src.wgs.lat)<1e-6&&Math.abs(p.wgs.lng-src.wgs.lng)<1e-6);
      if(match){match.link=src.id;match.kind=`known`;if(!match.indepName)match.name=src.name;match.marker.dragging.disable();used.add(src.id);break;}
    }
  }});
  M.lev.routes.forEach(route=>{
    if(!route.linkedRouteId)return;
    const srcRoute=M.trav.routes.find(r=>r.id===route.linkedRouteId);
    if(!srcRoute){route.linkedRouteId=null;route.pts.forEach(p=>{p.link=null;});return;}
    const rm=[];
    route.pts.forEach(p=>{if(!p.link)return;const src=allTravPts().find(tp=>tp.id===p.link);if(!src){rm.push(p);return;}p.wgs={lat:src.wgs.lat,lng:src.wgs.lng};if(!p.indepName)p.name=src.name;p.kind=src.kind;p.knownEdgeAfter=!!src.knownEdgeAfter;p.marker.setLatLng(displayLL(p.wgs));});
    rm.forEach(p=>{map.removeLayer(p.marker);route.pts=route.pts.filter(x=>x!==p);});
  });
}
function clearGhosts(){M.trav.ghosts.forEach(g=>map.removeLayer(g));M.trav.ghosts=[];}
function buildGhosts(){
  clearGhosts();if(cur!==`trav`)return;
  const used=new Set();
  M.trav.routes.forEach(r=>r.pts.filter(p=>p.link).forEach(p=>used.add(p.link)));
  M.gnss.pts.forEach(src=>{if(src.sync&&!used.has(src.id)){
    const gm=L.marker(displayLL(src.wgs),{icon:L.divIcon({className:``,html:`<div class="pt-known ghost"><svg width="22" height="19" viewBox="0 0 22 19"><polygon points="11,1.5 20.5,17.5 1.5,17.5" fill="#ff5a3c" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><span class="known-nm">`+(src.name||`A`+String(M.gnss.pts.indexOf(src)+1).padStart(2,`0`))+`</span></div>`,iconSize:[60,34],iconAnchor:[30,11]})}).addTo(map);
    gm._wgs={lat:src.wgs.lat,lng:src.wgs.lng};
    gm.on(`click`,()=>{if(calc.on)return;if(!activeRoute()){toast(`请先创建或选中一条导线`);return;}if(activeRoute().locked){toast(`导线已锁定`);return;}pushUndo();addLinkedTrav(src);});
    M.trav.ghosts.push(gm);
  }});
}
function addLinkedTrav(src){const p={id:++uid,kind:`known`,name:src.name,wgs:{lat:src.wgs.lat,lng:src.wgs.lng},sync:false,link:src.id};p.marker=L.marker(displayLL(p.wgs),{draggable:false}).addTo(map);M.trav.pts.push(p);bindMarker(`trav`,p);refresh();toast(`已加入导线：`+(src.name||`控制点`));}
function revertToGhost(mode,p){const nm=p.name,wgs={lat:p.wgs.lat,lng:p.wgs.lng};removePoint(mode,p);const g={id:++uid,name:nm,wgs};g.marker=makeImpGhostMarker(mode,g);M[mode].impGhosts.push(g);refresh();}
function makeImpGhostMarker(mode,g){const mk=L.marker(displayLL(g.wgs),{icon:L.divIcon({className:``,html:`<div class="pt-known ghost"><svg width="22" height="19" viewBox="0 0 22 19"><polygon points="11,1.5 20.5,17.5 1.5,17.5" fill="#ff5a3c" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg><span class="known-nm">`+g.name+`</span></div>`,iconSize:[60,34],iconAnchor:[30,11]})});mk.on(`click`,()=>{if(calc.on)return;if(mode===`trav`){if(!activeRoute()){toast(`请先创建或选中一条导线`);return;}if(activeRoute().locked){toast(`导线已锁定`);return;}}if(mode===`lev`){if(!activeLevRoute()){toast(`请先创建或选中一条水准路线`);return;}if(activeLevRoute().locked){toast(`水准路线已锁定`);return;}}const THRESH=1e-6;const dup=M[mode].pts.some(p=>Math.abs(p.wgs.lat-g.wgs.lat)<THRESH&&Math.abs(p.wgs.lng-g.wgs.lng)<THRESH);if(dup){toast(`当前路线已包含该点`);return;}pushUndo();const p={id:++uid,kind:`known`,name:g.name,wgs:{lat:g.wgs.lat,lng:g.wgs.lng},sync:false,link:null,fromImpGhost:true};p.marker=L.marker(displayLL(p.wgs),{draggable:true}).addTo(map);M[mode].pts.push(p);bindMarker(mode,p);map.removeLayer(mk);M[mode].impGhosts=M[mode].impGhosts.filter(x=>x!==g);refresh();toast(`已加入：`+g.name);});mk.on(`contextmenu`,e=>{L.DomEvent.stopPropagation(e);L.DomEvent.preventDefault(e);const div=document.createElement(`div`);div.style.textAlign=`center`;const db=document.createElement(`button`);db.className=`del-popup-btn`;db.textContent=`删除该控制点`;db.onclick=()=>{map.closePopup();pushUndo();map.removeLayer(mk);M[mode].impGhosts=M[mode].impGhosts.filter(x=>x!==g);refresh();};div.appendChild(db);L.popup({offset:[0,-12]}).setLatLng(mk.getLatLng()).setContent(div).openOn(map);});let _lp=null;mk.on(`touchstart`,()=>{_lp=setTimeout(()=>{_lp=null;mk.fire(`contextmenu`);},600);});mk.on(`touchend`,()=>{if(_lp){clearTimeout(_lp);_lp=null;}});mk.on(`touchmove`,()=>{if(_lp){clearTimeout(_lp);_lp=null;}});return mk;}

let _linkLev=true;
function wireLev(){
  const b=document.getElementById(`copyFromTrav`);if(!b)return;
  const wrap=b.parentElement||b.parentNode;
  if(!document.getElementById(`linkLevCb`)){
    const lbl=document.createElement(`label`);lbl.style.cssText=`display:flex;align-items:center;gap:4px;font-size:12px;color:var(--muted);margin-top:2px;margin-bottom:4px;cursor:pointer;`;
    const cb=document.createElement(`input`);cb.type=`checkbox`;cb.id=`linkLevCb`;cb.checked=_linkLev;cb.onchange=()=>{_linkLev=cb.checked;};
    lbl.appendChild(cb);lbl.appendChild(document.createTextNode(`联动（导线点移动/删除时同步）`));
    if(wrap&&b.nextSibling)wrap.insertBefore(lbl,b.nextSibling);else if(wrap)wrap.appendChild(lbl);
  }
  b.onclick=async()=>{if(!M.trav.routes.length){toast(`没有导线可以复制`);return;}if(M.lev.routes.length){const r=await showConfirm(`覆盖水准路线`,`<p>当前已有 `+M.lev.routes.length+` 条水准路线，复制将全部替换。确定继续？</p>`,[{text:`取消`,value:`cancel`},{text:`确定复制`,value:`ok`,cls:`go`}]);if(!r||r.action===`cancel`)return;}const linked=_linkLev;pushUndo();M.lev.routes.forEach(r=>{r.pts.forEach(p=>map.removeLayer(p.marker));});M.lev.routes=[];const idMap={};M.trav.routes.forEach(tr=>{const lr={id:++uid,name:tr.name,prefix:tr.prefix||``,closed:!!tr.closed,hidden:!!tr.hidden,locked:false,expanded:!!tr.expanded,parentId:null,linkedRouteId:linked?tr.id:null,pts:[]};idMap[tr.id]=lr.id;M.lev.routes.push(lr);tr.pts.forEach(sp=>{const p={id:++uid,kind:sp.kind,name:sp.name,wgs:{lat:sp.wgs.lat,lng:sp.wgs.lng},sync:false,link:linked?sp.id:null,knownEdgeAfter:!!sp.knownEdgeAfter};p.marker=L.marker(displayLL(p.wgs),{draggable:!linked}).addTo(map);lr.pts.push(p);bindMarker(`lev`,p);});});M.lev.routes.forEach((lr,i)=>{const tr=M.trav.routes[i];if(tr.parentId&&idMap[tr.parentId])lr.parentId=idMap[tr.parentId];});M.lev.activeRouteId=M.lev.routes.length?M.lev.routes[0].id:null;refresh();toast(`已从导线复制 `+M.lev.routes.length+` 条路线到水准`+(linked?`（联动）`:``));};
}
