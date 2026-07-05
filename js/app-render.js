/* ===== 列表渲染与批量编号 ===== */
const _turnExpanded=new Set();
function kindCounts(pts){const k=pts.filter(p=>p.kind===`known`||p.kind===`turn`).length;return {known:pts.filter(p=>p.kind===`known`).length,nw:pts.filter(p=>p.kind===`new`).length,turn:pts.filter(p=>p.kind===`turn`).length};}

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

function clearGnssEdges(){
  const g=M.gnss;
  if(!g.edges.length&&!g.triangles.length){toast(`当前没有基线或三角网`);return;}
  pushUndo();
  g.edges=[];g.triangles=[];g.sel=null;g.triSel=[];
  refresh();
  toast(`已清空 GNSS 基线和三角网`);
}
function clearGnssTriangles(){
  const g=M.gnss;
  if(!g.triangles.length){toast(`当前没有三角网`);return;}
  pushUndo();
  g.triangles=[];g.triSel=[];
  refresh();
  toast(`已清空三角网，基线已保留`);
}
function renderGnssDesignTools(box){
  const wrap=document.createElement(`div`);
  wrap.className=`gnss-design-tools`;
  wrap.innerHTML=`<div class="btn-row" style="margin-top:0"><button id="subPoint">加点</button><button id="subEdge">连边</button><button id="subTri">选三角</button><button id="autoTri">自动生成三角网</button><button id="clearGnssEdges" class="danger-lite">清空边</button></div>`;
  box.appendChild(wrap);
  subActive(`sub`+(M.gnss.sub===`edge`?`Edge`:M.gnss.sub===`tri`?`Tri`:`Point`));
  document.getElementById(`subPoint`).onclick=()=>{M.gnss.sub=`point`;M.gnss.sel=null;M.gnss.triSel=[];refreshIcons(`gnss`);subActive(`subPoint`);};
  document.getElementById(`subEdge`).onclick=()=>{M.gnss.sub=`edge`;M.gnss.triSel=[];refreshIcons(`gnss`);subActive(`subEdge`);toast(`连边：依次点两个点`);};
  document.getElementById(`subTri`).onclick=()=>{M.gnss.sub=`tri`;M.gnss.sel=null;refreshIcons(`gnss`);subActive(`subTri`);toast(`选三角：依次点三个点`);};
  document.getElementById(`autoTri`).onclick=autoTriangulate;
  document.getElementById(`clearGnssEdges`).onclick=clearGnssEdges;
}
function renderGnssTriangleList(box){
  const g=M.gnss;
  const sec=document.createElement(`div`);
  sec.className=`gnss-tri-section`;
  const h=document.createElement(`div`);
  h.className=`sub-h`;
  const hText=document.createElement(`span`);
  hText.textContent=`三角网 / 同步图形`;
  h.appendChild(hText);
  const clearBtn=document.createElement(`button`);
  clearBtn.className=`tri-clear-btn`;
  clearBtn.title=`清空全部三角网（保留基线）`;
  clearBtn.innerHTML=`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v5"/><path d="M14 11v5"/></svg>`;
  clearBtn.onclick=clearGnssTriangles;
  h.appendChild(clearBtn);
  sec.appendChild(h);
  const list=document.createElement(`div`);
  list.id=`triList`;
  sec.appendChild(list);
  if(!g.triangles.length){
    const empty=document.createElement(`div`);
    empty.className=`note`;
    empty.textContent=`暂无已编号三角网。可用“选三角”或 Ctrl 对象选择生成。`;
    list.appendChild(empty);
  }else{
    g.triangles.forEach((t,k)=>{
      const row=document.createElement(`div`);
      row.className=`tri-row`;
      row.innerHTML=`<span class="no">`+circ(k+1)+`</span><span class="vx">`+t.pts.map(p=>label(`gnss`,g.pts.indexOf(p))).join(`-`)+`</span><span class="pm">周长 `+triPerimeter(t).toFixed(0)+`m</span>`;
      const inp=document.createElement(`input`);
      inp.placeholder=`时段/备注`;
      inp.value=t.note||``;
      inp.onchange=()=>{t.note=inp.value;};
      const del=document.createElement(`button`);
      del.className=`ic del`;
      del.textContent=`删`;
      del.onclick=()=>removeTriangle(t);
      row.appendChild(inp);row.appendChild(del);list.appendChild(row);
    });
  }
  box.appendChild(sec);
}
function renderPtList(){
  const mode=cur,box=document.getElementById(`ptList`);
  const body=box.parentElement;
  const bs=document.getElementById(`batchSection`);
  const impBtnRow=document.getElementById(`impBtn`).parentElement;
  const fileIn=document.getElementById(`fileIn`);
  const legend=document.querySelector(`.legend`);
  if(impBtnRow&&impBtnRow.parentElement!==body)body.insertBefore(impBtnRow,fileIn);
  if(legend&&legend.parentElement!==body)body.appendChild(legend);
  if(bs&&bs.parentElement)bs.remove();
  if(mode===`trav`||mode===`lev`){impBtnRow.style.display=`none`;renderRouteList(box,mode,bs);return;}
  const M0=M[mode],kc=kindCounts(M0.pts);
  document.getElementById(`ptTitleText`).textContent=`控制点（已知 `+kc.known+` · 待测 `+kc.nw+`）`;
  box.innerHTML=``;
  if(bs){bs.dataset.mode=mode;bs.dataset.routeId=``;}
  renderGnssDesignTools(box);
  impBtnRow.style.display=``;
  box.appendChild(impBtnRow);
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
  if(bs){bs.style.display=``;box.appendChild(bs);}
  renderGnssTriangleList(box);
  if(legend)box.appendChild(legend);
  const sc=document.getElementById(`selCount`);if(sc)sc.textContent=selectedPtIds.size?`已选 `+selectedPtIds.size+` 个`:``;
}

/* ===== 路线列表（导线/水准共用） ===== */
function renderRouteList(box,mode,bs){
  const mData=M[mode];
  const ar=activeRouteOf(mode);
  const mLabel=ROUTE_LABEL[mode];
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
    pushUndo();createRouteOf(mode,nm,pfx);refresh();toast(`已创建`+mLabel+`「`+nm+`」`);
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
    hdr.onclick=e=>{if(e.target.closest(`input,button,.ic,.route-arrow,.route-name`))return;pushUndo();setActiveRouteIdOf(mode,isActive?null:route.id);refresh();};
    const arrow=document.createElement(`span`);arrow.className=`route-arrow`;arrow.textContent=route.expanded?`▼`:`▶`;
    arrow.onclick=e=>{e.stopPropagation();route.expanded=!route.expanded;refresh();};
    hdr.appendChild(arrow);
    const nm=document.createElement(`span`);nm.className=`route-name`;nm.textContent=route.name;nm.title=`双击改名`;
    let nmTimer=null;
    nm.onclick=e=>{e.stopPropagation();if(nmTimer){clearTimeout(nmTimer);nmTimer=null;
      const inp=document.createElement(`input`);inp.className=`nameinput`;inp.value=route.name;inp.style.width=`100px`;nm.replaceWith(inp);inp.focus();inp.select();
      let done=false;const commit=()=>{if(done)return;done=true;const v=inp.value.trim();if(v)route.name=v;refresh();};
      inp.onkeydown=ev=>{if(ev.key===`Enter`){ev.preventDefault();inp.blur();}else if(ev.key===`Escape`)refresh();};inp.onblur=commit;return;}
      nmTimer=setTimeout(()=>{nmTimer=null;pushUndo();setActiveRouteIdOf(mode,isActive?null:route.id);refresh();},280);};
    hdr.appendChild(nm);
    const zoomBtn=document.createElement(`span`);zoomBtn.className=`route-zoom`;zoomBtn.title=`缩放到此路线`;zoomBtn.innerHTML=`<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 5V1h4"/><path d="M11 1h4v4"/><path d="M15 11v4h-4"/><path d="M5 15H1v-4"/></svg>`;
    zoomBtn.onclick=e=>{e.stopPropagation();zoomToRoute(route);};
    hdr.appendChild(zoomBtn);
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
    delBtn.onclick=async e=>{e.stopPropagation();const r=await showConfirm(`删除`+mLabel,`<p>确定删除`+mLabel+`「`+route.name+`」及其全部 `+route.pts.length+` 个控制点？`+(childCount?`<br>同时删除 `+childCount+` 条子路线。`:``)+`</p>`,[{text:`取消`,value:`cancel`},{text:`删除`,value:`del`,cls:`go`}]);if(!r||r.action!==`del`)return;pushUndo();deleteRouteOf(mode,route.id);refresh();toast(`已删除`+mLabel+`「`+route.name+`」`);};
    hdr.appendChild(delBtn);item.appendChild(hdr);
    if(route.expanded){
      const body=document.createElement(`div`);body.className=`route-body`;
      const savedId=mData.activeRouteId;mData.activeRouteId=route.id;
      let pi=0;
      while(pi<route.pts.length){
        const p=route.pts[pi],i=pi;
        if(p.kind===`turn`){pi++;continue;}
        const w=p.wgs,term=isTerminal(mode,i)?(i===0?`·起`:`·终`):``;
        const row=document.createElement(`div`);row.className=`pt-row`+(selectedPtIds.has(p.id)?` selected`:``);row.dataset.idx=i;
        row.addEventListener(`click`,e=>{if(e.target.closest(`.ic,.drag-handle,.nameinput,b,.turn-toggle,.turn-row`))return;if(e.ctrlKey||e.metaKey){if(selectedPtIds.has(p.id))selectedPtIds.delete(p.id);else selectedPtIds.add(p.id);}else{if(selectedPtIds.has(p.id)&&selectedPtIds.size===1)selectedPtIds.clear();else{selectedPtIds.clear();selectedPtIds.add(p.id);}}updateSelUI();});
        const isLevLinked=mode===`lev`&&p.link&&route.linkedRouteId;
        const b=document.createElement(`b`);b.className=p.link?`link`:(p.kind===`known`?`k`:`n`);b.textContent=label(mode,i)+term;b.title=p.link?(isLevLinked?`同步自导线（点击独立改名）`:`同步自GNSS（点击独立改名）`):`点击改名`;
        if(!route.locked)b.onclick=()=>startRename(mode,p,b);
        const co=document.createElement(`span`);co.className=`co`;co.textContent=w.lat.toFixed(6)+`, `+w.lng.toFixed(6);
        row.appendChild(b);row.appendChild(co);
        if(!p.link&&!route.locked){
          const kb=document.createElement(`button`);kb.className=`ic`+(p.kind===`known`?` k`:``);kb.textContent=p.kind===`known`?`已`:`待`;kb.title=`切换已知/待测`;kb.onclick=()=>{pushUndo();p.kind=p.kind===`known`?`new`:`known`;refresh();};row.appendChild(kb);
        }
        if(!route.locked&&!isLevLinked){const del=document.createElement(`button`);del.className=`ic del`;const da=delAction(mode,p);del.textContent=da.text;del.title=da.title;del.onclick=da.fn;row.appendChild(del);}
        if(route.pts.length>1&&!route.locked&&!isLevLinked){const handle=document.createElement(`span`);handle.className=`drag-handle`;handle.textContent=`⠿`;row.insertBefore(handle,row.firstChild);row.draggable=true;row.ondragstart=e=>{e.dataTransfer.effectAllowed=`move`;setTimeout(()=>row.classList.add(`dragging`),0);body._dragFrom=i;};row.ondragend=()=>{row.classList.remove(`dragging`);body.querySelectorAll(`.pt-row`).forEach(r=>r.classList.remove(`drag-above`,`drag-below`));delete body._dragFrom;};row.ondragover=e=>{e.preventDefault();if(body._dragFrom===undefined||body._dragFrom===i)return;body.querySelectorAll(`.pt-row`).forEach(r=>r.classList.remove(`drag-above`,`drag-below`));const rect=row.getBoundingClientRect();row.classList.add(e.clientY>rect.top+rect.height/2?`drag-below`:`drag-above`);};row.ondrop=e=>{e.preventDefault();const from=body._dragFrom;if(from===undefined)return;let to=i;if(e.clientY>row.getBoundingClientRect().top+row.getBoundingClientRect().height/2)to++;if(from<to)to--;if(from!==to){pushUndo();const[pt]=route.pts.splice(from,1);route.pts.splice(to,0,pt);refresh();}};}
        body.appendChild(row);
        /* collect consecutive turn points after this control point */
        const turns=[];
        let ti=i+1;
        while(ti<route.pts.length&&route.pts[ti].kind===`turn`){turns.push({pt:route.pts[ti],idx:ti});ti++;}
        if(turns.length>0){
          const expanded=_turnExpanded.has(p.id);
          const stationCount=turns.length+1;
          const isEven=stationCount%2===0;
          const maxTurnDist=2*M.lev.maxSight;
          const turnWarns=[];
          if(!isEven)turnWarns.push(`测站数 `+stationCount+`（奇数，应为偶数）`);
          for(let j=0;j<turns.length;j++){const prev=j===0?p:turns[j-1].pt;if(vincenty(prev.wgs,turns[j].pt.wgs)>maxTurnDist){turnWarns.push(`存在超过 `+maxTurnDist+` m 的转点间距`);break;}}
          if(!turnWarns.some(w=>w.includes(`间距`))){const nextCtrl=ti<route.pts.length?route.pts[ti]:null;if(nextCtrl&&vincenty(turns[turns.length-1].pt.wgs,nextCtrl.wgs)>maxTurnDist)turnWarns.push(`存在超过 `+maxTurnDist+` m 的转点间距`);}
          const toggleRow=document.createElement(`div`);toggleRow.className=`turn-toggle`;
          const arrowSpan=document.createElement(`span`);arrowSpan.textContent=expanded?`▼`:`▶`;arrowSpan.style.cssText=`cursor:pointer;margin-right:4px;font-size:10px;`;
          toggleRow.appendChild(arrowSpan);
          const infoSpan=document.createElement(`span`);infoSpan.textContent=turns.length+` 个转点`;infoSpan.style.cssText=`margin-right:6px;font-size:12px;`;
          toggleRow.appendChild(infoSpan);
          if(turnWarns.length){const warn=document.createElement(`span`);warn.innerHTML=SVG_WARN_ICON.replace(`mk-icon`,`turn-warn-icon`);warn.title=turnWarns.join(`；`);toggleRow.appendChild(warn);}
          toggleRow.onclick=e=>{e.stopPropagation();if(_turnExpanded.has(p.id))_turnExpanded.delete(p.id);else _turnExpanded.add(p.id);refresh();};
          body.appendChild(toggleRow);
          if(expanded){
            turns.forEach((t,ti2)=>{
              const tp=t.pt;
              const prevPt=ti2===0?p:turns[ti2-1].pt;
              const dist=vincenty(prevPt.wgs,tp.wgs);
              const tr=document.createElement(`div`);tr.className=`turn-row`;
              const nm2=document.createElement(`span`);nm2.className=`turn-nm`;nm2.textContent=tp.name;
              tr.appendChild(nm2);
              const ds=document.createElement(`span`);ds.className=`turn-dist`+(dist>100?` bad`:``);ds.textContent=dist.toFixed(1)+` m`;
              tr.appendChild(ds);
              if(!route.locked){
                const tdel=document.createElement(`button`);tdel.className=`ic del`;tdel.textContent=`删`;tdel.title=`删除转点`;
                tdel.onclick=e=>{e.stopPropagation();pushUndo();map.removeLayer(tp.marker);route.pts.splice(t.idx,1);refresh();};
                tr.appendChild(tdel);
              }
              body.appendChild(tr);
            });
            /* distance from last turn to next control point */
            const nextCtrl=ti<route.pts.length?route.pts[ti]:null;
            if(nextCtrl){
              const lastTurn=turns[turns.length-1].pt;
              const distLast=vincenty(lastTurn.wgs,nextCtrl.wgs);
              const lr=document.createElement(`div`);lr.className=`turn-row`;lr.style.opacity=`0.6`;
              const lnm=document.createElement(`span`);lnm.className=`turn-nm`;lnm.textContent=`→ `+(nextCtrl.name||label(mode,ti));
              lr.appendChild(lnm);
              const lds=document.createElement(`span`);lds.className=`turn-dist`+(distLast>100?` bad`:``);lds.textContent=distLast.toFixed(1)+` m`;
              lr.appendChild(lds);
              body.appendChild(lr);
            }
          }
        }
        pi=ti>i+1?ti:i+1;
      }
      mData.activeRouteId=savedId;
      item.appendChild(body);
      if(isActive&&!route.locked&&bs){bs.style.display=``;bs.dataset.mode=mode;bs.dataset.routeId=route.id;item.appendChild(bs);bsPlaced=true;}
    }
    box.appendChild(item);
    const children=mData.routes.filter(r=>r.parentId===route.id);
    children.forEach(child=>renderItem(child,depth+1));
  }
  topRoutes.forEach(route=>renderItem(route,0));
  if(!bsPlaced&&bs){bs.style.display=`none`;bs.dataset.mode=mode;bs.dataset.routeId=``;box.appendChild(bs);}
}

function renderCalc(){
  const box=document.getElementById(`calcBox`),btn=document.getElementById(`calcToggle`);
  btn.textContent=calc.on?`关闭累加器`:`开启累加器`;btn.classList.toggle(`calcon`,calc.on);
  if(!calc.on){box.innerHTML=`关闭状态。开启后点击地图上的边/导线段即可累加长度。`;box.className=`note`;return;}
  const r=calcSum();box.className=``;
  box.innerHTML=`<div class="row ok"><span class="lab">已选 `+r.n+` 条</span><span class="val">合计 `+r.sum.toFixed(2)+` m（`+(r.sum/1000).toFixed(3)+` km）</span></div><div class="note">点击边可加入/移除。仅累加当前模式的边。</div>`;
}

/* ===== 批量编号 (F4) ===== */
function batchScopePts(){
  if(cur===`gnss`)return M.gnss.pts;
  const bs=document.getElementById(`batchSection`);
  const routeId=bs&&bs.dataset.mode===cur?bs.dataset.routeId:``;
  const route=routeId?M[cur].routes.find(r=>String(r.id)===String(routeId)):activeRouteOf(cur);
  return route?route.pts.filter(p=>p.kind!==`turn`):[];
}
document.getElementById(`batchApply`).onclick=async()=>{if(!selectedPtIds.size){toast(`请先选择要编号的点`);return;}const prefix=document.getElementById(`batchPrefix`).value.trim();const startStr=document.getElementById(`batchStart`).value.trim()||`1`;const start=parseInt(startStr)||1;const pts=batchScopePts().filter(p=>selectedPtIds.has(p.id));if(!pts.length){toast(`请先选择要编号的点`);return;}pushUndo();const maxNum=start+pts.length-1;const pad=Math.max(startStr.length,String(maxNum).length);pts.forEach((p,i)=>{p.name=prefix+String(start+i).padStart(pad,`0`);if(p.link)p.indepName=true;});
  if(cur===`gnss`){const syncPts=pts.filter(p=>p.sync&&allTravPts().some(tp=>tp.link===p.id));if(syncPts.length){const names=syncPts.map(p=>p.name).join(`、`);const r=await showConfirm(`批量编号同步`,`<p>选中的 `+syncPts.length+` 个点已同步至导线（`+names+`）。是否将新名称应用到导线？</p>`,[{text:`否，导线保持原名`,value:`no`},{text:`是，同步改名`,value:`yes`,cls:`go`}]);if(r&&r.action===`yes`){syncPts.forEach(p=>{allTravPts().filter(tp=>tp.link===p.id).forEach(tp=>{tp.indepName=false;});});}else{syncPts.forEach(p=>{allTravPts().filter(tp=>tp.link===p.id).forEach(tp=>{tp.indepName=true;});});}}}
  selectedPtIds.clear();refresh();toast(`已编号 `+pts.length+` 个点`);};
document.getElementById(`selKnown`).onclick=()=>{const ids=batchScopePts().filter(p=>p.kind===`known`).map(p=>p.id);const allSel=ids.length>0&&ids.every(id=>selectedPtIds.has(id));selectedPtIds.clear();if(!allSel)ids.forEach(id=>selectedPtIds.add(id));updateSelUI();};
document.getElementById(`selNew`).onclick=()=>{const ids=batchScopePts().filter(p=>p.kind!==`known`&&!p.link).map(p=>p.id);const allSel=ids.length>0&&ids.every(id=>selectedPtIds.has(id));selectedPtIds.clear();if(!allSel)ids.forEach(id=>selectedPtIds.add(id));updateSelUI();};
document.getElementById(`selNone`).onclick=()=>{selectedPtIds.clear();updateSelUI();};
(function(){const el=document.getElementById(`batchStart`);function fit(){el.style.width=Math.max(4,(el.value||``).length+1)+`ch`;}el.addEventListener(`input`,fit);fit();})();
