/* ===== GNSS 模式分析 ===== */
function triPerimeter(t){let s=0;for(let i=0;i<3;i++)s+=vincenty(t.pts[i].wgs,t.pts[(i+1)%3].wgs);return s;}
function refreshGnss(){
  const g=M.gnss,box=document.getElementById(`analysis`);
  g.triangles.forEach((t,k)=>{const poly=L.polygon(t.pts.map(p=>p.marker.getLatLng()),{color:`#ffc145`,weight:1,fillColor:`#ffc145`,fillOpacity:.12,interactive:false}).addTo(map);g.triLayers.push(poly);const c=t.pts.reduce((a,p)=>{const ll=p.marker.getLatLng();return {lat:a.lat+ll.lat/3,lng:a.lng+ll.lng/3};},{lat:0,lng:0});g.triLayers.push(L.marker([c.lat,c.lng],{icon:L.divIcon({className:``,html:`<div class="tri-label">`+circ(k+1)+`</div>`,iconSize:[20,20],iconAnchor:[10,10]}),interactive:false}).addTo(map));});
  let lens=[];
  g.edges.forEach(e=>{const A=e.a.marker.getLatLng(),B=e.b.marker.getLatLng(),d=vincenty(e.a.wgs,e.b.wgs);lens.push(d);const key=keyOf(e.a.id,e.b.id),sel=calc.on&&calcHas(key);drawSeg(`gnss`,A,B,{color:sel?`#ffffff`:(d>=g.minEdge?`#ffc145`:`#ff6b6b`),weight:sel?5:2.5,dist:d,bad:d<g.minEdge&&!sel,onClick:calc.on?()=>toggleCalc(`gnss`,e.a.id,e.b.id):null});});
  if(g.pts.length<3){box.innerHTML=`<div class="note">布点后自动计算。</div>`;return;}
  const st=gnssStats(),kc=kindCounts(g.pts),min=lens.length?Math.min(...lens):0,max=lens.length?Math.max(...lens):0;
  let html=`<div class="summary"><div class="stat"><div class="k">点数(已知/待测)</div><div class="v">`+kc.known+` / `+kc.nw+`</div></div><div class="stat"><div class="k">基线数</div><div class="v">`+g.edges.length+`</div></div><div class="stat"><div class="k">三角形(自动)</div><div class="v">`+st.tri+`</div></div><div class="stat"><div class="k">已编号三角网</div><div class="v">`+g.triangles.length+`</div></div><div class="stat"><div class="k">最短边</div><div class="v">`+(min?min.toFixed(0):`—`)+` m</div></div><div class="stat"><div class="k">最长边</div><div class="v">`+(max?max.toFixed(0):`—`)+` m</div></div></div>`;
  if(g.triangles.length){html+=`<div class="sub-h">三角网 / 同步图形</div><div id="triList"></div>`;}
  if(g.edges.length){html+=`<div class="sub-h">基线边长（限 ≥ `+g.minEdge+` m）</div>`;g.edges.forEach(e=>{const d=vincenty(e.a.wgs,e.b.wgs),ok=d>=g.minEdge;html+=`<div class="row `+(ok?`ok`:`bad`)+`"><span class="lab">`+label(`gnss`,g.pts.indexOf(e.a))+`–`+label(`gnss`,g.pts.indexOf(e.b))+`</span><span class="val">`+d.toFixed(1)+` m</span><span class="mk">`+(ok?`✓`:`✗`)+`</span></div>`;});}
  const shortN=lens.filter(d=>d<g.minEdge).length;let vc,vt;
  if(st.comp>1){vc=`verdict fail`;vt=`✗ 网形未连通（`+st.comp+` 个独立部分）`;}else if(st.tri===0){vc=`verdict fail`;vt=`✗ 尚未构成闭合三角形`;}else if(shortN){vc=`verdict fail`;vt=`✗ 有 `+shortN+` 条基线 < `+g.minEdge+` m`;}else if(kc.known===0){vc=`verdict`;vt=`⚠ 网中尚无已知点（平差需 ≥1 起算点）`;}else{vc=`verdict pass`;vt=`✓ 连通、含 `+st.tri+` 个三角形、`+kc.known+` 个起算点`;}
  box.innerHTML=html+`<div class="`+vc+`">`+vt+`</div>`;
  const tl=document.getElementById(`triList`);
  if(tl){g.triangles.forEach((t,k)=>{const row=document.createElement(`div`);row.className=`tri-row`;row.innerHTML=`<span class="no">`+circ(k+1)+`</span><span class="vx">`+t.pts.map(p=>label(`gnss`,g.pts.indexOf(p))).join(`-`)+`</span><span class="pm">周长 `+triPerimeter(t).toFixed(0)+`m</span>`;const inp=document.createElement(`input`);inp.placeholder=`时段/备注`;inp.value=t.note||``;inp.onchange=()=>{t.note=inp.value;};const del=document.createElement(`button`);del.className=`ic del`;del.textContent=`删`;del.onclick=()=>removeTriangle(t);row.appendChild(inp);row.appendChild(del);tl.appendChild(row);});}
}

/* ===== 导线模式分析 ===== */
function refreshTrav(){
  const box=document.getElementById(`analysis`);
  const savedId=M.trav.activeRouteId;
  M.trav.routes.forEach(route=>{
    if(route.hidden)return;
    const isAct=route.id===savedId;
    const pts=route.pts;
    M.trav.activeRouteId=route.id;
    for(let i=0;i<pts.length-1;i++){
      const A=pts[i].marker.getLatLng(),B=pts[i+1].marker.getLatLng(),d=vincenty(pts[i].wgs,pts[i+1].wgs);
      const key=keyOf(pts[i].id,pts[i+1].id),sel=calc.on&&calcHas(key);
      drawSeg(`trav`,A,B,{color:sel?`#ffffff`:`#5ab0ff`,weight:sel?5:3,dist:isAct?d:undefined,knownEdge:!!pts[i].knownEdgeAfter,onClick:isAct?(calc.on?()=>toggleCalc(`trav`,pts[i].id,pts[i+1].id):(ev)=>showSegPopup(`trav`,i,ev,route)):null});
    }
    if(route.closed&&pts.length>=3){
      const last=pts[pts.length-1],first=pts[0];
      const A=last.marker.getLatLng(),B=first.marker.getLatLng(),d=vincenty(last.wgs,first.wgs);
      const key=keyOf(last.id,first.id),sel=calc.on&&calcHas(key);
      drawSeg(`trav`,A,B,{color:sel?`#ffffff`:`#5ab0ff`,weight:sel?5:3,dist:isAct?d:undefined,knownEdge:!!pts[pts.length-1].knownEdgeAfter,onClick:isAct?(calc.on?()=>toggleCalc(`trav`,last.id,first.id):(ev)=>showSegPopup(`trav`,pts.length-1,ev,route)):null});
    }
    if(isAct){
      for(let i=1;i<pts.length-1;i++){const ang=angleAt(pts[i-1].wgs,pts[i].wgs,pts[i+1].wgs);if(ang<M.trav.minAng)M.trav.lines.push(L.marker(pts[i].marker.getLatLng(),{icon:L.divIcon({className:``,html:`<div class="ang-label" style="margin-top:-26px;">`+ang.toFixed(0)+`°</div>`,iconSize:[0,0]}),interactive:false}).addTo(map));}
      if(route.closed&&pts.length>=3){
        const a0=angleAt(pts[pts.length-1].wgs,pts[0].wgs,pts[1].wgs);
        if(a0<M.trav.minAng)M.trav.lines.push(L.marker(pts[0].marker.getLatLng(),{icon:L.divIcon({className:``,html:`<div class="ang-label" style="margin-top:-26px;">`+a0.toFixed(0)+`°</div>`,iconSize:[0,0]}),interactive:false}).addTo(map));
        const aN=angleAt(pts[pts.length-2].wgs,pts[pts.length-1].wgs,pts[0].wgs);
        if(aN<M.trav.minAng)M.trav.lines.push(L.marker(pts[pts.length-1].marker.getLatLng(),{icon:L.divIcon({className:``,html:`<div class="ang-label" style="margin-top:-26px;">`+aN.toFixed(0)+`°</div>`,iconSize:[0,0]}),interactive:false}).addTo(map));
      }
    }
  });
  M.trav.activeRouteId=savedId;
  const ar=activeRoute();
  if(!ar){box.innerHTML=`<div class="note">创建导线后自动分析。</div>`;return;}
  const pts=ar.pts;
  if(pts.length<2){box.innerHTML=`<div class="note">布点后自动计算。</div>`;return;}
  let segs=[],keFlags=[];
  for(let i=0;i<pts.length-1;i++){segs.push(vincenty(pts[i].wgs,pts[i+1].wgs));keFlags.push(!!pts[i].knownEdgeAfter);}
  if(ar.closed&&pts.length>=3){segs.push(vincenty(pts[pts.length-1].wgs,pts[0].wgs));keFlags.push(!!pts[pts.length-1].knownEdgeAfter);}
  const keCount=keFlags.filter(Boolean).length;
  const unknownSegs=segs.filter((_,i)=>!keFlags[i]);
  const total=unknownSegs.length?unknownSegs.reduce((a,b)=>a+b,0):0;
  const allTotal=segs.reduce((a,b)=>a+b,0);
  const avg=unknownSegs.length?total/unknownSegs.length:0,min=unknownSegs.length?Math.min(...unknownSegs):0,max=unknownSegs.length?Math.max(...unknownSegs):0,kc=kindCounts(pts);
  let html=`<div class="summary"><div class="stat"><div class="k">导线</div><div class="v">`+ar.name+(ar.closed?`（闭合）`:`（附合）`)+`</div></div><div class="stat"><div class="k">点数(已知/待测)</div><div class="v">`+kc.known+` / `+kc.nw+`</div></div><div class="stat"><div class="k">导线全长</div><div class="v">`+(total<1000?total.toFixed(0)+` m`:(total/1000).toFixed(2)+` km`)+(keCount?` <span style="font-size:11px;opacity:.7">（不含 `+keCount+` 条已知边）</span>`:``)+`</div></div><div class="stat"><div class="k">平均边长</div><div class="v">`+(unknownSegs.length?avg.toFixed(0):0)+` m</div></div><div class="stat"><div class="k">最短/最长</div><div class="v">`+(unknownSegs.length?min.toFixed(0)+`/`+max.toFixed(0):`—`)+`</div></div></div>`;
  html+=`<div class="sub-h">边长 · 相邻边长比（限 ≤ 1:`+M.trav.maxRatio+`）</div>`;
  const nSeg=ar.closed&&pts.length>=3?segs.length:segs.length;
  const savedIdA=M.trav.activeRouteId;M.trav.activeRouteId=ar.id;
  for(let i=0;i<segs.length;i++){
    const isKE=keFlags[i];
    let rt=``,bad=false;
    if(!isKE&&(i>0||(ar.closed&&segs.length>1))){
      const prev=i>0?i-1:segs.length-1;
      if(!keFlags[prev]){const r=Math.max(segs[i],segs[prev])/Math.min(segs[i],segs[prev]);bad=r>M.trav.maxRatio;rt=`  比 `+r.toFixed(2);}
    }
    let labA,labB;
    if(i<pts.length-1){labA=label(`trav`,i);labB=label(`trav`,i+1);}
    else{labA=label(`trav`,pts.length-1);labB=label(`trav`,0);}
    html+=`<div class="row `+(isKE?`ke`:(bad?`warn`:``))+ `"><span class="lab">`+labA+`–`+labB+(isKE?` <span class="ke-tag">已知</span>`:``)+`</span><span class="val">`+segs[i].toFixed(1)+` m`+rt+`</span><span class="mk">`+(bad?`!`:``)+`</span></div>`;
  }
  const allAngPts=ar.closed?pts.length:pts.length-2;
  if(allAngPts>=1){
    html+=`<div class="sub-h">转折角（提示 < `+M.trav.minAng+`°）</div>`;
    if(ar.closed){
      for(let i=0;i<pts.length;i++){
        const prev=(i-1+pts.length)%pts.length,next=(i+1)%pts.length;
        const ang=angleAt(pts[prev].wgs,pts[i].wgs,pts[next].wgs),bad=ang<M.trav.minAng;
        html+=`<div class="row `+(bad?`warn`:``)+`"><span class="lab">@ `+label(`trav`,i)+`</span><span class="val">`+ang.toFixed(1)+`°</span><span class="mk">`+(bad?`!`:``)+`</span></div>`;
      }
    }else{
      for(let i=1;i<pts.length-1;i++){
        const ang=angleAt(pts[i-1].wgs,pts[i].wgs,pts[i+1].wgs),bad=ang<M.trav.minAng;
        html+=`<div class="row `+(bad?`warn`:``)+`"><span class="lab">@ `+label(`trav`,i)+`</span><span class="val">`+ang.toFixed(1)+`°</span><span class="mk">`+(bad?`!`:``)+`</span></div>`;
      }
    }
  }
  M.trav.activeRouteId=savedIdA;
  const ratios=[];
  if(ar.closed){for(let i=0;i<segs.length;i++){const prev=(i-1+segs.length)%segs.length;ratios.push(Math.max(segs[i],segs[prev])/Math.min(segs[i],segs[prev]));}}
  else{for(let i=1;i<segs.length;i++)ratios.push(Math.max(segs[i],segs[i-1])/Math.min(segs[i],segs[i-1]));}
  const ratioBad=ratios.some(r=>r>M.trav.maxRatio),overLen=total>M.trav.totLen;
  const unkCount=segs.length-keCount;
  let vc=`verdict pass`,vt=`✓ 共 `+unkCount+` 条边`+(keCount?`（+`+keCount+` 已知）`:``)+`，全长 `+total.toFixed(0)+` m`;if(overLen||ratioBad){vc=`verdict fail`;vt=`✗ `;if(overLen)vt+=`全长超 `+M.trav.totLen+` m；`;if(ratioBad)vt+=`相邻边长比超 1:`+M.trav.maxRatio+`；`;}
  box.innerHTML=html+`<div class="`+vc+`">`+vt+`</div><div class="note">全长相对闭合差、方位角闭合差需外业实测后计算，此处仅作选点几何校核。</div>`;
}

/* ===== 水准模式分析 ===== */
function refreshLev(){
  const box=document.getElementById(`analysis`);
  const savedId=M.lev.activeRouteId;
  M.lev.routes.forEach(route=>{
    if(route.hidden)return;
    const isAct=route.id===savedId;
    const pts=route.pts;
    M.lev.activeRouteId=route.id;
    for(let i=0;i<pts.length-1;i++){
      const A=pts[i].marker.getLatLng(),B=pts[i+1].marker.getLatLng(),d=vincenty(pts[i].wgs,pts[i+1].wgs);
      const key=keyOf(pts[i].id,pts[i+1].id),sel=calc.on&&calcHas(key);
      drawSeg(`lev`,A,B,{color:sel?`#ffffff`:`#b388ff`,weight:sel?5:3,dist:isAct?d:undefined,knownEdge:!!pts[i].knownEdgeAfter,onClick:isAct?(calc.on?()=>toggleCalc(`lev`,pts[i].id,pts[i+1].id):(pts[i].knownEdgeAfter?null:(route.linkedRouteId?(ev)=>showTurnPopup(route,i,ev):(ev)=>showSegPopup(`lev`,i,ev,route)))):null});
    }
    if(route.closed&&pts.length>=3){
      const last=pts[pts.length-1],first=pts[0];
      const A=last.marker.getLatLng(),B=first.marker.getLatLng(),d=vincenty(last.wgs,first.wgs);
      const key=keyOf(last.id,first.id),sel=calc.on&&calcHas(key);
      drawSeg(`lev`,A,B,{color:sel?`#ffffff`:`#b388ff`,weight:sel?5:3,dist:isAct?d:undefined,knownEdge:!!pts[pts.length-1].knownEdgeAfter,onClick:isAct?(calc.on?()=>toggleCalc(`lev`,last.id,first.id):(pts[pts.length-1].knownEdgeAfter?null:(route.linkedRouteId?(ev)=>showTurnPopup(route,pts.length-1,ev):(ev)=>showSegPopup(`lev`,pts.length-1,ev,route)))):null});
    }
  });
  M.lev.activeRouteId=savedId;
  const alr=activeLevRoute();
  let html=``;
  if(!alr){box.innerHTML=html+`<div class="note">创建水准路线后自动分析。</div>`;wireLev();return;}
  const pts=alr.pts;
  if(pts.length<2){box.innerHTML=html+`<div class="note">布点后自动计算。</div>`;wireLev();return;}
  let segs=[];
  for(let i=0;i<pts.length-1;i++)segs.push(vincenty(pts[i].wgs,pts[i+1].wgs));
  if(alr.closed&&pts.length>=3)segs.push(vincenty(pts[pts.length-1].wgs,pts[0].wgs));
  const total=segs.reduce((a,b)=>a+b,0),stations=Math.ceil(total/(2*M.lev.maxSight)),kc=kindCounts(pts),Lkm=total/1000;
  html+=`<div class="summary"><div class="stat"><div class="k">水准路线</div><div class="v">`+alr.name+(alr.closed?`（闭合）`:``)+`</div></div><div class="stat"><div class="k">点数(已知/待测)</div><div class="v">`+kc.known+` / `+kc.nw+`</div></div><div class="stat"><div class="k">路线长`+(alr.closed?``:`(单程)`)+`</div><div class="v">`+(total<1000?total.toFixed(0)+` m`:(total/1000).toFixed(2)+` km`)+`</div></div>`+(alr.closed?``:`<div class="stat"><div class="k">往返总长</div><div class="v">`+((2*total)/1000).toFixed(2)+` km</div></div>`)+`<div class="stat"><div class="k">估算测站`+(alr.closed?``:`(单程)`)+`</div><div class="v">≥ `+stations+`</div></div></div><div class="sub-h">各测段长度</div>`;
  const savedIdA=M.lev.activeRouteId;M.lev.activeRouteId=alr.id;
  for(let i=0;i<segs.length;i++){let lA,lB;if(i<pts.length-1){lA=label(`lev`,i);lB=label(`lev`,i+1);}else{lA=label(`lev`,pts.length-1);lB=label(`lev`,0);}html+=`<div class="row"><span class="lab">`+lA+`–`+lB+`</span><span class="val">`+segs[i].toFixed(1)+` m</span></div>`;}
  M.lev.activeRouteId=savedIdA;
  html+=`<div class="note">二等限差参考：`+(alr.closed?`环闭合差 ≤ ±4√L = ±`+(4*Math.sqrt(Lkm)).toFixed(1)+` mm`:`往返不符值 ≤ ±4√L = ±`+(4*Math.sqrt(Lkm)).toFixed(1)+` mm`)+`（L=`+Lkm.toFixed(2)+` km）；视线长 ≤ `+M.lev.maxSight+` m。</div>`;
  box.innerHTML=html;wireLev();
}
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
