/* ===== 开屏通知 / 开发日志 ===== */
const ANNOUNCEMENT_SEEN_KEY=`cs_announcement_seen_v1`;
const ANNOUNCEMENT_PAGE_SIZE=3;
const introEl=document.getElementById(`intro`);
const introBody=document.getElementById(`introBody`);
const introList=document.getElementById(`announcementList`);
const introCount=document.getElementById(`introCount`);
const introDismiss=document.getElementById(`introDismiss`);
const introDismissWrap=document.getElementById(`introDismissWrap`);
const introPrev=document.getElementById(`introPrev`);
const introNext=document.getElementById(`introNext`);
let announcementIndex=0;
let announcementPage=0;
let announcementMode=`latest`;

function announcements(){
  return Array.isArray(window.ANNOUNCEMENTS)?window.ANNOUNCEMENTS:[];
}
function announcementTitle(item,i){
  return item&&item.title?item.title:`未填写通知 `+(i+1);
}
function announcementDate(item){
  return item&&item.date?item.date:``;
}
function setAnnouncementSeen(id){
  try{localStorage.setItem(ANNOUNCEMENT_SEEN_KEY,id||``);}catch(e){}
}
function getAnnouncementSeen(){
  try{return localStorage.getItem(ANNOUNCEMENT_SEEN_KEY)||``;}catch(e){return ``;}
}
function announcementDisplayOrder(items){
  return items.map((_,i)=>i).reverse();
}
function announcementPageCount(items){
  return Math.max(1,Math.ceil(items.length/ANNOUNCEMENT_PAGE_SIZE));
}
function pageOfAnnouncement(items,index){
  const order=announcementDisplayOrder(items);
  const pos=order.indexOf(index);
  return pos<0?announcementPageCount(items)-1:Math.floor(pos/ANNOUNCEMENT_PAGE_SIZE);
}
function renderAnnouncement(){
  const items=announcements();
  if(!items.length)return;
  announcementIndex=Math.max(0,Math.min(announcementIndex,items.length-1));
  const pageCount=announcementPageCount(items);
  announcementPage=Math.max(0,Math.min(announcementPage,pageCount-1));
  const item=items[announcementIndex];
  introEl.classList.toggle(`announcement-history`,announcementMode===`history`);
  introBody.innerHTML=``;
  if(item&&item.html){
    introBody.innerHTML=item.html;
  }else{
    const body=item&&Array.isArray(item.body)?item.body:[];
    const filled=body.filter(s=>String(s||``).trim());
    if(filled.length){
      filled.forEach(s=>{const p=document.createElement(`p`);p.textContent=s;introBody.appendChild(p);});
    }else{
      const empty=document.createElement(`div`);
      empty.className=`announcement-empty`;
      empty.textContent=`这条通知内容还没有填写。`;
      introBody.appendChild(empty);
    }
  }
  introCount.textContent=(announcementPage+1)+` / `+pageCount;
  introPrev.disabled=announcementPage<=0;
  introNext.disabled=announcementPage>=pageCount-1;
  introDismiss.checked=false;
  introDismissWrap.style.display=announcementMode===`latest`?`flex`:`none`;
  introList.innerHTML=``;
  const order=announcementDisplayOrder(items);
  const pageItems=order.slice(announcementPage*ANNOUNCEMENT_PAGE_SIZE,(announcementPage+1)*ANNOUNCEMENT_PAGE_SIZE);
  pageItems.forEach(i=>{
    const it=items[i];
    const btn=document.createElement(`button`);
    btn.className=i===announcementIndex?`active`:``;
    const title=document.createElement(`span`);
    title.className=`announcement-item-title`;
    title.textContent=announcementTitle(it,i);
    const date=document.createElement(`span`);
    date.className=`announcement-item-date`;
    date.textContent=announcementDate(it)||`未填写日期`;
    btn.appendChild(title);
    btn.appendChild(date);
    btn.onclick=()=>{announcementIndex=i;renderAnnouncement();};
    introList.appendChild(btn);
  });
}
function showAnnouncement(index,mode){
  const items=announcements();
  if(!items.length)return;
  announcementIndex=typeof index===`number`?index:0;
  announcementMode=mode||`latest`;
  announcementPage=announcementMode===`history`?pageOfAnnouncement(items,announcementIndex):0;
  renderAnnouncement();
  introEl.classList.add(`show`);
}
function closeAnnouncement(){
  const items=announcements();
  if(introDismiss&&introDismiss.checked&&items[announcementIndex]){
    setAnnouncementSeen(items[announcementIndex].id);
  }
  introEl.classList.remove(`show`);
}
function showLatestAnnouncementIfNeeded(){
  const items=announcements();
  if(!items.length||!items[0].id)return;
  if(getAnnouncementSeen()!==items[0].id)showAnnouncement(0);
}

document.getElementById(`announcementBadge`).onclick=e=>{e.stopPropagation();hideHelp();showAnnouncement(0,`history`);};
document.getElementById(`introClose`).onclick=closeAnnouncement;
introEl.onclick=e=>{if(e.target===introEl)closeAnnouncement();};
introPrev.onclick=()=>{announcementPage--;renderAnnouncement();};
introNext.onclick=()=>{announcementPage++;renderAnnouncement();};
