/* ===== GPS 定位功能（卡尔曼滤波） ===== */

map.createPane('gpsPane');
map.getPane('gpsPane').style.zIndex = 660;

/* ---- ENU 坐标转换 ---- */
const _DEG2M=111320;
function _lngDeg2M(lat){return 111320*Math.cos(lat*Math.PI/180);}
function _toENU(ll,ref){return{e:(ll.lng-ref.lng)*_lngDeg2M(ref.lat),n:(ll.lat-ref.lat)*_DEG2M};}
function _fromENU(en,ref){return{lat:ref.lat+en.n/_DEG2M,lng:ref.lng+en.e/_lngDeg2M(ref.lat)};}

/* ---- 卡尔曼滤波：4D [东m, 北m, v东m/s, v北m/s] ---- */
function _kfNew(){return{x:[0,0,0,0],P:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],lastT:0,n:0};}

function _kfReset(kf,e,n,acc){
  kf.x=[e,n,0,0];
  kf.P=[acc*acc,0,0,0, 0,acc*acc,0,0, 0,0,0.5,0, 0,0,0,0.5];
  kf.lastT=Date.now();kf.n=0;
}

function _kfPredict(kf){
  const now=Date.now();let dt=(now-kf.lastT)/1000;kf.lastT=now;
  if(dt<=0)return;if(dt>5)dt=5;
  const x=kf.x,p=kf.P;
  kf.x=[x[0]+dt*x[2],x[1]+dt*x[3],x[2],x[3]];
  const d2=dt*dt,qa=0.25,q00=d2*d2/4*qa,q02=d2*dt/2*qa,q22=d2*qa;
  kf.P=[
    p[0]+dt*(p[2]+p[8])+d2*p[10]+q00, p[1]+dt*(p[3]+p[9])+d2*p[11],
    p[2]+dt*p[10]+q02, p[3]+dt*p[11],
    p[1]+dt*(p[3]+p[9])+d2*p[11], p[5]+dt*(p[7]+p[13])+d2*p[15]+q00,
    p[6]+dt*p[14], p[7]+dt*p[15]+q02,
    p[2]+dt*p[10]+q02, p[6]+dt*p[14],
    p[10]+q22, p[11],
    p[3]+dt*p[11], p[7]+dt*p[15]+q02,
    p[11], p[15]+q22
  ];
}

function _kfUpdate(kf,e,n,acc){
  const R=acc*acc;
  const y0=e-kf.x[0],y1=n-kf.x[1];
  const s00=kf.P[0]+R,s01=kf.P[1],s10=kf.P[4],s11=kf.P[5]+R;
  const det=s00*s11-s01*s10;
  if(det<=1e-20)return false;
  const i00=s11/det,i01=-s01/det,i10=-s10/det,i11=s00/det;
  const d2=y0*(i00*y0+i01*y1)+y1*(i10*y0+i11*y1);
  if(kf.n>=5&&d2>12)return false;
  const K00=kf.P[0]*i00+kf.P[1]*i10,K01=kf.P[0]*i01+kf.P[1]*i11;
  const K10=kf.P[4]*i00+kf.P[5]*i10,K11=kf.P[4]*i01+kf.P[5]*i11;
  const K20=kf.P[8]*i00+kf.P[9]*i10,K21=kf.P[8]*i01+kf.P[9]*i11;
  const K30=kf.P[12]*i00+kf.P[13]*i10,K31=kf.P[12]*i01+kf.P[13]*i11;
  kf.x[0]+=K00*y0+K01*y1;kf.x[1]+=K10*y0+K11*y1;
  kf.x[2]+=K20*y0+K21*y1;kf.x[3]+=K30*y0+K31*y1;
  const p=kf.P;
  kf.P=[
    p[0]-(K00*p[0]+K01*p[4]),p[1]-(K00*p[1]+K01*p[5]),
    p[2]-(K00*p[2]+K01*p[6]),p[3]-(K00*p[3]+K01*p[7]),
    p[4]-(K10*p[0]+K11*p[4]),p[5]-(K10*p[1]+K11*p[5]),
    p[6]-(K10*p[2]+K11*p[6]),p[7]-(K10*p[3]+K11*p[7]),
    p[8]-(K20*p[0]+K21*p[4]),p[9]-(K20*p[1]+K21*p[5]),
    p[10]-(K20*p[2]+K21*p[6]),p[11]-(K20*p[3]+K21*p[7]),
    p[12]-(K30*p[0]+K31*p[4]),p[13]-(K30*p[1]+K31*p[5]),
    p[14]-(K30*p[2]+K31*p[6]),p[15]-(K30*p[3]+K31*p[7])
  ];
  kf.n++;return true;
}

function _kfPos(kf,ref){
  if(!ref)return null;
  const ll=_fromENU({e:kf.x[0],n:kf.x[1]},ref);
  const acc=Math.sqrt((Math.abs(kf.P[0])+Math.abs(kf.P[5]))/2);
  return{lat:ll.lat,lng:ll.lng,accuracy:Math.max(acc,0.3)};
}

/* ---- 多次采样定位 ---- */
function gpsMultiSample(onDone,onProgress){
  if(!navigator.geolocation){toast('浏览器不支持定位');return null;}
  const N=5,TM=20000;
  const kf=_kfNew();let ref=null,wid=null,tid=null,fin=false,cnt=0;
  function done(){
    if(fin)return;fin=true;
    if(wid!==null){navigator.geolocation.clearWatch(wid);wid=null;}
    if(tid){clearTimeout(tid);tid=null;}
    if(kf.n<2){toast('采样不足，定位失败');onDone(null);return;}
    const pos=_kfPos(kf,ref);
    onDone({lat:pos.lat,lng:pos.lng,accuracy:pos.accuracy,n:cnt,used:kf.n});
  }
  wid=navigator.geolocation.watchPosition(pos=>{
    const lat=pos.coords.latitude,lng=pos.coords.longitude,acc=pos.coords.accuracy||10;
    cnt++;
    if(!ref){ref={lat:lat,lng:lng};_kfReset(kf,0,0,acc);}
    const en=_toENU({lat:lat,lng:lng},ref);
    _kfPredict(kf);
    const ok=_kfUpdate(kf,en.e,en.n,acc);
    if(!ok&&kf.n<3)_kfReset(kf,en.e,en.n,acc);
    if(onProgress)onProgress(cnt,N);
    if(cnt>=N)done();
  },()=>{},{enableHighAccuracy:true,maximumAge:0,timeout:10000});
  tid=setTimeout(done,TM);
  return function(){fin=true;if(wid!==null){navigator.geolocation.clearWatch(wid);wid=null;}if(tid){clearTimeout(tid);tid=null;}};
}

/* ---- 位置追踪 ---- */
const gpsTracker={active:false,watchId:null,accCircle:null,hdMarker:null,heading:null,lastPos:null,_oh:null,kf:_kfNew(),_ref:null};

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
  gpsTracker._ref=null;
  _kfReset(gpsTracker.kf,0,0,10);
  gpsTracker.watchId=navigator.geolocation.watchPosition(pos=>{
    const lat=pos.coords.latitude,lng=pos.coords.longitude,acc=pos.coords.accuracy||10;
    if(!gpsTracker._ref){gpsTracker._ref={lat:lat,lng:lng};_kfReset(gpsTracker.kf,0,0,acc);}
    const en=_toENU({lat:lat,lng:lng},gpsTracker._ref);
    _kfPredict(gpsTracker.kf);
    const ok=_kfUpdate(gpsTracker.kf,en.e,en.n,acc);
    if(!ok){
      if(gpsTracker.kf.n<3)_kfReset(gpsTracker.kf,en.e,en.n,acc);
      else return;
    }
    const filtered=_kfPos(gpsTracker.kf,gpsTracker._ref);
    gpsTracker.lastPos=filtered;
    const d=displayLL(filtered);
    if(!gpsTracker.accCircle){
      gpsTracker.accCircle=L.circle(d,{radius:filtered.accuracy,fillColor:'#4285F4',fillOpacity:0.08,color:'#4285F4',opacity:0.25,weight:1,interactive:false,pane:'gpsPane'}).addTo(map);
    }else{
      gpsTracker.accCircle.setLatLng(d).setRadius(filtered.accuracy);
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
  gpsTracker._ref=null;_kfReset(gpsTracker.kf,0,0,10);
  document.getElementById('gpsTrackToggle').checked=false;
}

function locateMe(){
  if(gpsTracker.active&&gpsTracker.lastPos){map.setView(displayLL(gpsTracker.lastPos),Math.max(map.getZoom(),15));toast('已定位（精度 '+gpsTracker.lastPos.accuracy.toFixed(1)+'m）');return;}
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
