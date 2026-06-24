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
