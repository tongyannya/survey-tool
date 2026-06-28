/* ===== GPS 定位功能 ===== */

map.createPane('gpsPane');
map.getPane('gpsPane').style.zIndex = 660;

/* ---- 多次采样定位 ---- */
function _gpsMed(arr){const s=arr.slice().sort((a,b)=>a-b),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2;}

function gpsMultiSample(onDone,onProgress){
  if(!navigator.geolocation){toast('浏览器不支持定位');return null;}
  const smp=[];const N=5;const TM=20000;
  let wid=null,tid=null,fin=false;
  function done(){
    if(fin)return;fin=true;
    if(wid!==null){navigator.geolocation.clearWatch(wid);wid=null;}
    if(tid){clearTimeout(tid);tid=null;}
    if(smp.length<3){toast('采样不足，定位失败');onDone(null);return;}
    const la=smp.map(s=>s.lat),lo=smp.map(s=>s.lng);
    const ml=_gpsMed(la),mg=_gpsMed(lo);
    const dl=_gpsMed(la.map(v=>Math.abs(v-ml)))*1.4826;
    const dg=_gpsMed(lo.map(v=>Math.abs(v-mg)))*1.4826;
    const tl=Math.max(dl*3,1e-6),tg=Math.max(dg*3,1e-6);
    const g=smp.filter(s=>Math.abs(s.lat-ml)<=tl&&Math.abs(s.lng-mg)<=tg);
    if(g.length<2){onDone({lat:ml,lng:mg,n:smp.length,used:1});return;}
    onDone({lat:g.reduce((s,v)=>s+v.lat,0)/g.length,lng:g.reduce((s,v)=>s+v.lng,0)/g.length,n:smp.length,used:g.length});
  }
  wid=navigator.geolocation.watchPosition(pos=>{
    smp.push({lat:pos.coords.latitude,lng:pos.coords.longitude});
    if(onProgress)onProgress(smp.length,N);
    if(smp.length>=N)done();
  },()=>{},{enableHighAccuracy:true,maximumAge:0,timeout:10000});
  tid=setTimeout(done,TM);
  return function(){fin=true;if(wid!==null){navigator.geolocation.clearWatch(wid);wid=null;}if(tid){clearTimeout(tid);tid=null;}};
}

/* ---- 位置追踪 ---- */
const gpsTracker={active:false,watchId:null,accCircle:null,hdMarker:null,heading:null,lastPos:null,_oh:null};

function _gpsHdIcon(deg){
  return L.divIcon({className:'',html:'<div class="gps-heading" style="transform:rotate('+deg+'deg)"><svg width="28" height="28" viewBox="0 0 28 28"><path d="M14 2L20 14L14 10L8 14Z" fill="#4285F4" opacity="0.85"/><circle cx="14" cy="12" r="4" fill="#4285F4" stroke="#fff" stroke-width="1.5"/></svg></div>',iconSize:[28,28],iconAnchor:[14,14]});
}

function _gpsHd(ll){
  const deg=gpsTracker.heading!==null?gpsTracker.heading:0;
  if(!gpsTracker.hdMarker)gpsTracker.hdMarker=L.marker(ll,{icon:_gpsHdIcon(deg),interactive:false,pane:'gpsPane'}).addTo(map);
  else gpsTracker.hdMarker.setLatLng(ll).setIcon(_gpsHdIcon(deg));
}

function startTracking(){
  if(!navigator.geolocation){toast('浏览器不支持定位');return;}
  if(gpsTracker.active)return;
  gpsTracker.active=true;
  gpsTracker.watchId=navigator.geolocation.watchPosition(pos=>{
    const w={lat:pos.coords.latitude,lng:pos.coords.longitude};
    const a=pos.coords.accuracy||10;
    gpsTracker.lastPos={lat:w.lat,lng:w.lng,accuracy:a};
    const d=displayLL(w);
    if(!gpsTracker.accCircle){
      gpsTracker.accCircle=L.circle(d,{radius:a,fillColor:'#4285F4',fillOpacity:0.08,color:'#4285F4',opacity:0.25,weight:1,interactive:false,pane:'gpsPane'}).addTo(map);
    }else{
      gpsTracker.accCircle.setLatLng(d).setRadius(a);
    }
    _gpsHd(d);
  },()=>{},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  if(typeof DeviceOrientationEvent!=='undefined'&&typeof DeviceOrientationEvent.requestPermission==='function'){
    DeviceOrientationEvent.requestPermission().then(s=>{if(s==='granted')_gpsOri();}).catch(()=>{});
  }else _gpsOri();
}

function _gpsOri(){
  if(gpsTracker._oh)return;
  gpsTracker._oh=function(e){
    let h=null;
    if(e.webkitCompassHeading!==undefined)h=e.webkitCompassHeading;
    else if(e.alpha!==null)h=(360-e.alpha)%360;
    if(h!==null){gpsTracker.heading=h;if(gpsTracker.hdMarker)_gpsHd(gpsTracker.hdMarker.getLatLng());}
  };
  window.addEventListener('deviceorientation',gpsTracker._oh,true);
}

function stopTracking(){
  if(gpsTracker.watchId!==null){navigator.geolocation.clearWatch(gpsTracker.watchId);gpsTracker.watchId=null;}
  if(gpsTracker.accCircle){map.removeLayer(gpsTracker.accCircle);gpsTracker.accCircle=null;}
  if(gpsTracker.hdMarker){map.removeLayer(gpsTracker.hdMarker);gpsTracker.hdMarker=null;}
  if(gpsTracker._oh){window.removeEventListener('deviceorientation',gpsTracker._oh,true);gpsTracker._oh=null;}
  gpsTracker.active=false;gpsTracker.lastPos=null;gpsTracker.heading=null;
  document.getElementById('gpsTrackToggle').checked=false;
}

function locateMe(){
  if(gpsTracker.active&&gpsTracker.lastPos){map.setView(displayLL(gpsTracker.lastPos),Math.max(map.getZoom(),15));toast('已定位（精度 '+Math.round(gpsTracker.lastPos.accuracy)+'m）');return;}
  if(!navigator.geolocation){toast('浏览器不支持定位');return;}
  toast('正在获取位置…');
  navigator.geolocation.getCurrentPosition(pos=>{
    map.setView(displayLL({lat:pos.coords.latitude,lng:pos.coords.longitude}),15);
    toast('已定位（精度 '+Math.round(pos.coords.accuracy)+'m）');
  },err=>{
    toast('定位失败：'+(err.code===1?'权限被拒绝':'无法获取位置'));
  },{enableHighAccuracy:true,maximumAge:0,timeout:10000});
}

function repositionGPSMarker(){
  if(!gpsTracker.active||!gpsTracker.lastPos)return;
  const d=displayLL(gpsTracker.lastPos);
  if(gpsTracker.accCircle)gpsTracker.accCircle.setLatLng(d);
  if(gpsTracker.hdMarker)gpsTracker.hdMarker.setLatLng(d);
}

/* ---- 初始化 ---- */
document.getElementById('btnLocate').onclick=locateMe;
document.getElementById('gpsTrackToggle').onchange=function(){
  if(this.checked)startTracking();else stopTracking();
};
