/* ===== 坐标显示转换（依赖 coords.js） ===== */
function displayLL(wgs){if(currentBase===`sat`){const g=wgs2gcj(wgs.lng,wgs.lat);return L.latLng(g.lat,g.lng);}return L.latLng(wgs.lat,wgs.lng);}
function trueLL(ll){return currentBase===`sat`?gcj2wgs(ll.lng,ll.lat):{lng:ll.lng,lat:ll.lat};}

/* ===== 地图初始化 ===== */
(function(){const orig=L.GridLayer.prototype._getTiledPixelBounds;L.GridLayer.prototype._getTiledPixelBounds=function(center){const pb=orig.call(this,center);const n=this.options.edgeBufferTiles||0;if(n<=0)return pb;const ts=this.getTileSize(),buf=L.point(ts.x*n,ts.y*n);return new L.Bounds(pb.min.subtract(buf),pb.max.add(buf));};})();
const PRE={edgeBufferTiles:2,keepBuffer:2,updateWhenIdle:false,updateWhenZooming:false};
const map=L.map(`map`,{zoomControl:true,preferCanvas:false}).setView([32.07,119.126],14);
const satLayer=L.tileLayer(`https://webst0{s}.is.autonavi.com/appmaptile?style=6&x={x}&y={y}&z={z}`,{maxNativeZoom:18,maxZoom:20,subdomains:[`1`,`2`,`3`,`4`],...PRE});
const satLabel=L.tileLayer(`https://webst0{s}.is.autonavi.com/appmaptile?style=8&x={x}&y={y}&z={z}`,{maxNativeZoom:18,maxZoom:20,subdomains:[`1`,`2`,`3`,`4`],...PRE});
const streetLayer=L.tileLayer(`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`,{maxNativeZoom:19,maxZoom:20,...PRE});
let currentBase=`sat`;satLayer.addTo(map);satLabel.addTo(map);
const XIASHU={lat:32.1238,lng:119.2129};
const btnSat=document.getElementById(`btnSat`),btnStreet=document.getElementById(`btnStreet`);
function switchBase(to){if(to===`sat`){map.removeLayer(streetLayer);satLayer.addTo(map);satLabel.addTo(map);btnSat.classList.add(`active`);btnStreet.classList.remove(`active`);}else{map.removeLayer(satLayer);map.removeLayer(satLabel);streetLayer.addTo(map);btnStreet.classList.add(`active`);btnSat.classList.remove(`active`);}currentBase=to;repositionAll();refresh();updateDatumNote();}
btnSat.onclick=()=>switchBase(`sat`);btnStreet.onclick=()=>switchBase(`street`);
document.getElementById(`btnLocate`).onclick=()=>{if(!navigator.geolocation){toast(`浏览器不支持定位`);return;}toast(`正在获取位置…`);navigator.geolocation.getCurrentPosition(pos=>{const wgs={lat:pos.coords.latitude,lng:pos.coords.longitude};map.setView(displayLL(wgs),15);toast(`已定位（精度 `+Math.round(pos.coords.accuracy)+`m）`);},err=>{toast(`定位失败：`+(err.code===1?`权限被拒绝`:`无法获取位置`));},{enableHighAccuracy:true,maximumAge:0,timeout:10000});};
const searchResults=document.getElementById(`searchResults`);
function closeSearch(){searchResults.innerHTML=``;searchResults.classList.remove(`open`);}
async function doSearch(){const q=document.getElementById(`searchInput`).value.trim();if(!q)return;closeSearch();try{const r=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=cn&q=`+encodeURIComponent(q));const j=await r.json();if(!j.length){toast(`未找到该地名`);return;}if(j.length===1){map.setView([+j[0].lat,+j[0].lon],15);return;}searchResults.innerHTML=``;j.forEach(item=>{const d=document.createElement(`div`);d.className=`sr-item`;d.textContent=item.display_name;d.onclick=()=>{map.setView([+item.lat,+item.lon],15);closeSearch();};searchResults.appendChild(d);});searchResults.classList.add(`open`);}catch(e){toast(`搜索服务暂不可用`);}}
document.getElementById(`searchBtn`).onclick=doSearch;
document.getElementById(`searchInput`).addEventListener(`keydown`,e=>{if(e.key===`Enter`)doSearch();});
document.addEventListener(`click`,e=>{if(!e.target.closest(`.map-search`))closeSearch();});

/* ===== 右键菜单 ===== */
let ctxMenu=null;
function showCtx(x,y,items){if(!ctxMenu){ctxMenu=document.createElement(`div`);ctxMenu.className=`ctx-menu`;document.body.appendChild(ctxMenu);}ctxMenu.innerHTML=``;items.forEach(item=>{const d=document.createElement(`div`);d.className=`ctx-menu-item`;d.textContent=item.label;d.onclick=()=>{hideCtx();item.action();};ctxMenu.appendChild(d);});ctxMenu.style.display=`block`;ctxMenu.style.left=Math.min(x,window.innerWidth-120)+`px`;ctxMenu.style.top=Math.min(y,window.innerHeight-40)+`px`;}
function hideCtx(){if(ctxMenu)ctxMenu.style.display=`none`;}
document.addEventListener(`click`,e=>{if(ctxMenu&&!e.target.closest(`.ctx-menu`))hideCtx();});

/* ===== 快捷定位书签 ===== */
const BM_KEY=`cs_bookmarks_v1`;let bookmarks=[];
function loadBm(){try{bookmarks=JSON.parse(localStorage.getItem(BM_KEY)||`[]`);}catch(e){bookmarks=[];}}
function saveBm(){try{localStorage.setItem(BM_KEY,JSON.stringify(bookmarks));}catch(e){}}
function renderBm(){
  const box=document.getElementById(`quickBtns`);box.querySelectorAll(`.bm-btn`).forEach(b=>b.remove());
  const addBtn=document.getElementById(`btnAddBm`);
  bookmarks.forEach((bm,i)=>{
    const btn=document.createElement(`button`);btn.className=`minor-btn bm-btn`;btn.textContent=bm.name;
    btn.onclick=()=>map.setView(displayLL({lat:bm.lat,lng:bm.lng}),bm.zoom||14);
    btn.oncontextmenu=e=>{e.preventDefault();e.stopPropagation();showCtx(e.clientX,e.clientY,[{label:`删除书签`,action:()=>{pushUndo();bookmarks.splice(i,1);saveBm();renderBm();toast(`已删除书签「`+bm.name+`」`);}}]);};
    let lpt;btn.ontouchstart=e=>{const tc=e.touches[0];lpt=setTimeout(()=>{showCtx(tc.clientX,tc.clientY,[{label:`删除书签`,action:()=>{pushUndo();bookmarks.splice(i,1);saveBm();renderBm();toast(`已删除书签「`+bm.name+`」`);}}]);},600);};btn.ontouchend=()=>clearTimeout(lpt);
    box.insertBefore(btn,addBtn);
  });
}
document.getElementById(`btnAddBm`).onclick=()=>{
  const box=document.getElementById(`quickBtns`),addBtn=document.getElementById(`btnAddBm`);
  const inp=document.createElement(`input`);inp.className=`bm-input`;inp.placeholder=`书签名`;
  box.insertBefore(inp,addBtn);addBtn.style.display=`none`;inp.focus();
  const commit=()=>{const nm=inp.value.trim();if(nm){pushUndo();const c=map.getCenter(),w=trueLL(c);bookmarks.push({name:nm,lat:w.lat,lng:w.lng,zoom:map.getZoom()});saveBm();}inp.remove();addBtn.style.display=``;renderBm();};
  inp.onkeydown=e=>{if(e.key===`Enter`)commit();else if(e.key===`Escape`){inp.remove();addBtn.style.display=``;}};
  inp.onblur=commit;
};
loadBm();renderBm();
