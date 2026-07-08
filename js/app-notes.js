/* ===== 图记/标注 ===== */
let noteMode=false;
let noteListExpanded=false;

function noteIcon(n){return L.divIcon({className:``,html:`<div class="note-pin`+((ctrlObj.active||n.dim)?` inactive`:``)+`"><svg width="20" height="28" viewBox="0 0 20 28"><path d="M10 0C4.5 0 0 4.5 0 10c0 7.5 10 18 10 18s10-10.5 10-18C20 4.5 15.5 0 10 0z" fill="#ffb454" stroke="#fff" stroke-width="1.5"/><circle cx="10" cy="10" r="4" fill="#fff"/></svg>`+(n.text?`<span class="note-text">`+n.text+`</span>`:``)+`</div>`,iconSize:[0,0],iconAnchor:[0,0]});}

function makeNoteMarker(n){
  const mk=L.marker(displayLL(n.wgs),{draggable:!n.dim,icon:noteIcon(n)});
  mk.on(`dragstart`,()=>{if(ctrlObj.active||n.dim)return;_dragging=true;pushUndo();});
  mk.on(`drag`,()=>{if(ctrlObj.active||n.dim)return;n.wgs=trueLL(mk.getLatLng());});
  mk.on(`dragend`,()=>{if(ctrlObj.active||n.dim)return;_dragging=false;});
  function showNotePopup(e){
    if(e){L.DomEvent.stopPropagation(e);L.DomEvent.preventDefault(e);}
    if(ctrlObj.active||n.dim)return;
    const div=document.createElement(`div`);div.style.textAlign=`center`;
    const originalText=n.text||``;
    const inp=document.createElement(`input`);
    inp.type=`text`;inp.value=originalText;inp.placeholder=`备注文字`;
    inp.style.cssText=`width:100%;padding:4px 8px;border:1px solid var(--line);border-radius:4px;background:var(--panel2);color:var(--text);font-size:13px;text-align:center;margin-bottom:6px;`;
    let skipCommit=false;
    function commitNote(){if(skipCommit)return;const v=inp.value.trim();if(v!==originalText){pushUndo();n.text=v;mk.setIcon(noteIcon(n));refresh();}}
    inp.onkeydown=ev=>{
      if(ev.key===`Enter`){ev.preventDefault();commitNote();skipCommit=true;map.closePopup();}
      else if(ev.key===`Escape`){ev.preventDefault();ev.stopPropagation();if(inp.value!==originalText)inp.value=originalText;else{skipCommit=true;map.closePopup();}}
    };
    div.appendChild(inp);
    const db=document.createElement(`button`);db.className=`del-popup-btn`;db.textContent=`删除`;
    db.onclick=()=>{skipCommit=true;map.closePopup();pushUndo();map.removeLayer(mk);M.notes=M.notes.filter(x=>x!==n);refresh();};
    div.appendChild(db);
    const dim=document.createElement(`button`);dim.className=`kind-popup-btn`;dim.textContent=`虚化`;
    dim.onclick=()=>{skipCommit=true;pushUndo();n.text=inp.value.trim();n.dim=true;map.closePopup();refresh();toast(`图记已虚化`);};
    div.appendChild(dim);
    const pop=L.popup({offset:[0,-12]}).setLatLng(mk.getLatLng()).setContent(div).openOn(map);pop.on(`remove`,commitNote);
  }
  mk.on(`contextmenu`,showNotePopup);
  let _lp=null;
  mk.on(`touchstart`,()=>{if(ctrlObj.active||n.dim)return;_lp=setTimeout(()=>{_lp=null;showNotePopup();},600);});
  mk.on(`touchend`,()=>{if(_lp){clearTimeout(_lp);_lp=null;}});
  mk.on(`touchmove`,()=>{if(_lp){clearTimeout(_lp);_lp=null;}});
  if(!isMobileLayout())mk.bindTooltip(`右键编辑`,{direction:`top`,offset:[0,-28]});
  return mk;
}

function addNoteAtLatLng(latlng){
  pushUndo();
  const n={id:++uid,text:``,wgs:trueLL(latlng)};
  n.marker=makeNoteMarker(n);
  n.marker.addTo(map);
  M.notes.push(n);
  refresh();
}

function handleNoteMapClick(latlng){
  if(!noteMode)return false;
  addNoteAtLatLng(latlng);
  return true;
}

function setNoteMode(on){
  noteMode=!!on;
  const btn=document.getElementById(`noteToggle`);
  if(btn){
    btn.classList.toggle(`active`,noteMode);
    btn.textContent=noteMode?`停止添加`:`添加图记`;
  }
}

function closeNoteMode(){
  if(!noteMode)return false;
  setNoteMode(false);
  toast(`图记模式已关闭`);
  return true;
}

function clearAllNotes(){
  M.notes.forEach(n=>map.removeLayer(n.marker));
  M.notes=[];
}

function refreshNotes(){
  M.notes.forEach(n=>{
    n.marker.setIcon(noteIcon(n));
    if(n.marker.dragging){
      if(ctrlObj.active||n.dim)n.marker.dragging.disable();
      else n.marker.dragging.enable();
    }
    if(!map.hasLayer(n.marker))n.marker.addTo(map);
  });
  renderNoteList();
}

function renderNoteList(){
  const box=document.getElementById(`noteList`);
  if(!box)return;
  box.innerHTML=``;
  const toggle=document.createElement(`div`);
  toggle.className=`note-toggle`;
  const arrow=document.createElement(`span`);
  arrow.textContent=noteListExpanded?`▼`:`▶`;
  arrow.className=`note-toggle-arrow`;
  toggle.appendChild(arrow);
  const info=document.createElement(`span`);
  info.textContent=M.notes.length+` 个图记`;
  toggle.appendChild(info);
  toggle.onclick=e=>{e.stopPropagation();noteListExpanded=!noteListExpanded;renderNoteList();};
  box.appendChild(toggle);
  if(!noteListExpanded)return;
  if(!M.notes.length){const empty=document.createElement(`div`);empty.className=`note-list-empty`;empty.textContent=`暂无图记。`;box.appendChild(empty);return;}
  M.notes.forEach((n,i)=>{
    const row=document.createElement(`div`);
    row.className=`note-row`+(n.dim?` dim`:``);
    const no=document.createElement(`span`);
    no.className=`note-no`;
    no.textContent=`#`+(i+1);
    row.appendChild(no);
    const inp=document.createElement(`input`);
    inp.type=`text`;
    inp.value=n.text||``;
    inp.placeholder=`备注文字`;
    inp.onkeydown=e=>{if(e.key===`Enter`){e.preventDefault();inp.blur();}};
    inp.onchange=()=>{const v=inp.value.trim();if(v===(n.text||``))return;pushUndo();n.text=v;n.marker.setIcon(noteIcon(n));refresh();};
    row.appendChild(inp);
    const dim=document.createElement(`button`);
    dim.className=`ic`+(n.dim?` active`:``);
    dim.textContent=`虚`;
    dim.title=n.dim?`恢复图记`:`虚化图记`;
    dim.onclick=()=>{pushUndo();n.dim=!n.dim;refresh();toast(n.dim?`图记已虚化`:`图记已恢复`);};
    row.appendChild(dim);
    const zoom=document.createElement(`button`);
    zoom.className=`ic`;
    zoom.title=`缩放到图记`;
    zoom.innerHTML=`<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 5V1h4"/><path d="M11 1h4v4"/><path d="M15 11v4h-4"/><path d="M5 15H1v-4"/></svg>`;
    zoom.onclick=()=>map.setView(displayLL(n.wgs),map.getZoom(),{animate:false});
    row.appendChild(zoom);
    box.appendChild(row);
  });
}

function bindNoteTools(){
  const noteToggle=document.getElementById(`noteToggle`);
  if(noteToggle)noteToggle.onclick=()=>{
    setNoteMode(!noteMode);
    if(noteMode)toast(`图记模式：点击地图放置标注`);
  };
  const noteClear=document.getElementById(`noteClear`);
  if(noteClear)noteClear.onclick=async()=>{
    if(!M.notes.length){toast(`没有图记`);return;}
    const r=await showConfirm(`清空图记`,`<p>确定删除全部 `+M.notes.length+` 个图记？</p>`,[{text:`取消`,value:`cancel`},{text:`清空`,value:`del`,cls:`go`}]);
    if(!r||r.action!==`del`)return;
    pushUndo();
    clearAllNotes();
    refresh();
    toast(`已清空全部图记`);
  };
}

bindNoteTools();
