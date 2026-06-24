/* ===== 已知点导入 ===== */
const impEl=document.getElementById(`imp`);let IMP={rows:[],nameCol:-1,c1:0,c2:1};
function isNum(v){return v!==``&&v!=null&&!isNaN(parseFloat(v))&&isFinite(v);}
document.getElementById(`impBtn`).onclick=()=>document.getElementById(`fileIn`).click();
document.getElementById(`fileIn`).onchange=async e=>{const f=e.target.files[0];if(!f)return;const ext=f.name.split(`.`).pop().toLowerCase();let rows;try{if(ext===`xlsx`||ext===`xls`){if(typeof XLSX===`undefined`){toast(`Excel 库未加载，请改用 CSV/TXT`);e.target.value=``;return;}const buf=await f.arrayBuffer();const wb=XLSX.read(buf,{type:`array`});const ws=wb.Sheets[wb.SheetNames[0]];rows=XLSX.utils.sheet_to_json(ws,{header:1,blankrows:false}).map(r=>r.map(c=>c===undefined?``:String(c)));}else{const txt=await f.text();rows=txt.split(/\r?\n/).map(l=>l.trim()).filter(l=>l).map(l=>l.indexOf(`,`)>=0?l.split(`,`).map(s=>s.trim()):l.split(/\s+/));}}catch(err){toast(`文件读取失败`);e.target.value=``;return;}e.target.value=``;if(!rows||!rows.length){toast(`无可解析数据`);return;}detectColumns(rows);openImport();};
function detectColumns(rows){const data=rows.filter(r=>r.filter(isNum).length>=2);if(!data.length){IMP={rows:[],nameCol:-1,c1:0,c2:1};return;}const ncol=Math.max(...data.map(r=>r.length));const nf=[];for(let c=0;c<ncol;c++){let n=0;data.forEach(r=>{if(isNum(r[c]))n++;});nf[c]=n/data.length;}let nameCol=-1;for(let c=0;c<ncol;c++){if(nf[c]<0.4){nameCol=c;break;}}const nc=[];for(let c=0;c<ncol;c++){if(c!==nameCol&&nf[c]>0.6)nc.push(c);}const c1=nc[0]!==undefined?nc[0]:0,c2=nc[1]!==undefined?nc[1]:1;IMP={rows:data,nameCol,c1,c2};const v1=data.map(r=>Math.abs(parseFloat(r[c1]))).filter(isFinite),v2=data.map(r=>Math.abs(parseFloat(r[c2]))).filter(isFinite);const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]||0;};const big=Math.max(med(v1),med(v2));document.getElementById(`impType`).value=big>1000?`plane`:`geo`;buildOrderOptions();if(big>1000)document.getElementById(`impOrder`).value=med(v1)>=med(v2)?`xy`:`yx`;else document.getElementById(`impOrder`).value=med(v1)<=med(v2)?`bl`:`lb`;}
function buildOrderOptions(){const t=document.getElementById(`impType`).value,sel=document.getElementById(`impOrder`);sel.innerHTML=t===`plane`?`<option value="xy">列① X北, 列② Y东</option><option value="yx">列① Y东, 列② X北</option>`:`<option value="bl">列① 纬度B, 列② 经度L</option><option value="lb">列① 经度L, 列② 纬度B</option>`;}
function rowToWgs(r){const t=document.getElementById(`impType`).value,ord=document.getElementById(`impOrder`).value;let a=parseFloat(r[IMP.c1]),b=parseFloat(r[IMP.c2]);if(!isFinite(a)||!isFinite(b))return null;if(t===`geo`){let lat,lng;if(ord===`bl`){lat=a;lng=b;}else{lat=b;lng=a;}if(Math.abs(lat)>90||Math.abs(lng)>180)return null;const datum=document.getElementById(`impDatum`).value;if(datum===`gcj02`){return gcj2wgs(lng,lat);}return {lat,lng};}const cm=parseFloat(document.getElementById(`impCM`).value)||120,strip=document.getElementById(`impStrip`).value===`1`;let X,Y;if(ord===`xy`){X=a;Y=b;}else{X=b;Y=a;}const r2=invGauss(X,Y,cm,strip);if(!isFinite(r2.lat)||!isFinite(r2.lng))return null;return r2;}
function rowName(r,i){return IMP.nameCol>=0&&r[IMP.nameCol]?String(r[IMP.nameCol]):`JZ`+String(i+1).padStart(2,`0`);}
function renderPreview(){const isPlane=document.getElementById(`impType`).value===`plane`;document.querySelectorAll(`.planeOnly`).forEach(el=>el.style.display=isPlane?`flex`:`none`);document.querySelectorAll(`.geoOnly`).forEach(el=>el.style.display=isPlane?`none`:`flex`);const box=document.getElementById(`impPrev`),n=Math.min(5,IMP.rows.length);let h=`<table><tr><th>点名</th><th>纬度B</th><th>经度L</th></tr>`;for(let i=0;i<n;i++){const w=rowToWgs(IMP.rows[i]);h+=`<tr><td>`+rowName(IMP.rows[i],i)+`</td><td>`+(w?w.lat.toFixed(6):`—`)+`</td><td>`+(w?w.lng.toFixed(6):`—`)+`</td></tr>`;}h+=`</table>`;box.innerHTML=h;document.getElementById(`impInfo`).textContent=`识别到 `+IMP.rows.length+` 行有效数据`+(IMP.nameCol>=0?`，含点名列`:`，无点名列将自动编号`)+`。请核对经纬度是否落在测区附近。`;}
function openImport(){if(!IMP.rows.length){toast(`未识别到坐标`);return;}buildOrderOptions();renderPreview();impEl.classList.add(`show`);}
document.getElementById(`impType`).onchange=()=>{buildOrderOptions();renderPreview();};
document.getElementById(`impOrder`).onchange=renderPreview;document.getElementById(`impDatum`).onchange=renderPreview;document.getElementById(`impCM`).onchange=renderPreview;document.getElementById(`impStrip`).onchange=renderPreview;
document.getElementById(`impCancel`).onclick=()=>impEl.classList.remove(`show`);
impEl.onclick=e=>{if(e.target===impEl)impEl.classList.remove(`show`);};
document.getElementById(`impGo`).onclick=()=>doImportGhost([cur]);

/* ===== 导入为可用控制点 (F5) ===== */
async function doImportGhost(targetModes){
  const parsed=[];IMP.rows.forEach((r,i)=>{const w=rowToWgs(r);if(w)parsed.push({name:rowName(r,i),wgs:w});});
  if(!parsed.length){toast(`没有成功解析的点，请检查类型/顺序`);return;}
  const THRESH=1e-6;
  const allExisting=[];targetModes.forEach(mode=>{if(mode===`trav`||mode===`lev`){M[mode].routes.forEach(r=>{r.pts.forEach(p=>allExisting.push({name:p.name,wgs:p.wgs,pt:p}));});}else{M[mode].pts.forEach((p,i)=>allExisting.push({name:p.name||label(mode,i),wgs:p.wgs,pt:p}));}M[mode].impGhosts.forEach(g=>allExisting.push({name:g.name,wgs:g.wgs,pt:null}));});
  const coordConflicts=[];parsed.forEach(p=>{const match=allExisting.find(e=>Math.abs(e.wgs.lat-p.wgs.lat)<THRESH&&Math.abs(e.wgs.lng-p.wgs.lng)<THRESH);if(match&&!coordConflicts.some(c=>c.imported===p))coordConflicts.push({imported:p,existing:match});});
  let coordAction=null;
  if(coordConflicts.length){
    const msg=coordConflicts.slice(0,10).map(c=>c.imported.name+` ↔ `+c.existing.name).join(`、`)+(coordConflicts.length>10?`…`:``);
    const r=await showConfirm(`坐标重复`,`<p>以下导入点与已有点坐标重复：<b>`+msg+`</b></p>`,[{text:`取消`,value:`cancel`},{text:`跳过重复点`,value:`skip`},{text:`覆盖已有点名`,value:`overwrite`,cls:`go`}]);
    if(!r||r.action===`cancel`)return;
    coordAction=r.action;
  }
  const perModeNew={};
  targetModes.forEach(mode=>{
    const mEx=[];if(mode===`trav`||mode===`lev`){M[mode].routes.forEach(r=>{r.pts.forEach(p=>mEx.push({wgs:p.wgs,pt:p}));});}else{M[mode].pts.forEach((p,i)=>mEx.push({wgs:p.wgs,pt:p}));}M[mode].impGhosts.forEach(g=>mEx.push({wgs:g.wgs,pt:null}));
    perModeNew[mode]=[];
    parsed.forEach(p=>{
      const match=mEx.find(e=>Math.abs(e.wgs.lat-p.wgs.lat)<THRESH&&Math.abs(e.wgs.lng-p.wgs.lng)<THRESH);
      if(match){if(coordAction===`overwrite`&&match.pt)match.pt.name=p.name;}
      else{perModeNew[mode].push(p);}
    });
  });
  const newSet=new Set();targetModes.forEach(mode=>perModeNew[mode].forEach(p=>newSet.add(p)));
  const toImport=[...newSet];
  if(toImport.length){
    const existingNames=new Set();targetModes.forEach(mode=>{if(!perModeNew[mode].length)return;M[mode].pts.forEach((p,i)=>existingNames.add(p.name||label(mode,i)));M[mode].impGhosts.forEach(g=>existingNames.add(g.name));});
    const nameConflicts=toImport.filter(p=>existingNames.has(p.name));
    if(nameConflicts.length){
      const names=nameConflicts.slice(0,10).map(c=>c.name).join(`、`)+(nameConflicts.length>10?`…等`+nameConflicts.length+`个`:``);
      const r=await showConfirm(`点名冲突`,`<p>以下导入点与已有点重名：<b>`+names+`</b></p><div class="param" style="margin-top:10px"><span>为导入点添加前缀</span><input data-key="prefix" type="text" value="IMP_" style="width:100px;padding:5px 8px;border:1px solid var(--line);border-radius:6px;background:var(--panel2);color:var(--text);font-size:13px;"></div>`,[{text:`取消`,value:`cancel`},{text:`应用前缀`,value:`ok`,cls:`go`}]);
      if(!r||r.action===`cancel`)return;
      const pfx=r.inputs.prefix||``;toImport.forEach(p=>p.name=pfx+p.name);
    }
  }
  const hasNew=targetModes.some(mode=>perModeNew[mode].length>0);
  if(!hasNew&&coordAction!==`overwrite`){toast(`所有导入点坐标重复已跳过`);return;}
  pushUndo();
  const bounds=[];targetModes.forEach(mode=>{perModeNew[mode].forEach(p=>{const g={id:++uid,name:p.name,wgs:{lat:p.wgs.lat,lng:p.wgs.lng}};g.marker=makeImpGhostMarker(mode,g);M[mode].impGhosts.push(g);if(mode===cur)bounds.push([displayLL(g.wgs).lat,displayLL(g.wgs).lng]);});});
  impEl.classList.remove(`show`);refresh();
  if(toImport.length){toast(`已导入 `+toImport.length+` 个可用控制点`);if(bounds.length)map.fitBounds(bounds,{padding:[50,50],maxZoom:16});}
  else{toast(`坐标重复的点已处理`);}
}
document.getElementById(`impGoAll`).onclick=()=>doImportGhost([`gnss`,`trav`,`lev`]);
