"use strict";

/* =========================
   Backoffice SPA (Front-Only, Upgraded)
   - Employees + front-user accounts
   - Payslips / Announcements / Attendance
   - Admin users (backoffice) + Employee users (frontend)
   - All data in localStorage for demo
   ========================= */

// ---------- DOM helpers ----------
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([k, v]) => {
    if (k === "class") el.className = v;
    else if (k === "style") el.style.cssText = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v);
  });
  kids.flat().forEach((k) => el.append(k?.nodeType ? k : document.createTextNode(k ?? "")));
  return el;
};

// ---------- Storage (mock DB) ----------
const DB = {
  get(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); },
};

// ---------- Utils ----------
const uid = () => Math.floor(Math.random() * 1e9);
const genPass = (n = 8) => Array.from(crypto.getRandomValues(new Uint8Array(n)))
  .map(x => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"[x % 56]).join("");
function calcAge(birth) {
  if (!birth) return null; const b = new Date(birth); if (isNaN(b)) return null;
  const now = new Date(); let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--; return age;
}
const toDataUrl = (file) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
const ymStr = (y, m) => `${y}-${String(m).padStart(2,"0")}`;
const sortBy = (arr, key, dir="desc") => arr.slice().sort((a,b)=> dir==="desc" ? (a[key]>b[key]?-1:a[key]<b[key]?1:0) : (a[key]>b[key]?1:a[key]<b[key]?-1:0));
const copy = async (txt) => { try { await navigator.clipboard.writeText(txt); alert("คัดลอกแล้ว"); } catch { alert(txt); } };

// ---------- Seeds ----------
(function seed() {
  if (!DB.get("admin_users")) {
    DB.set("admin_users", [
      { id: 1, username: "owner", role: "Owner", created_at: new Date().toISOString() },
      { id: 2, username: "admin", role: "Admin", created_at: new Date().toISOString() },
    ]);
  }
  if (!DB.get("employees")) {
    DB.set("employees", [
      { id: 1, code: "E0001", first_name: "สมชาย", last_name: "ดี", nick_name: "ชาย",
        email: "somchai@example.com", phone: "0890000000", birth_date: "1995-03-12",
        age: calcAge("1995-03-12"), gender: "M", position: "Developer", department: "IT",
        avatar_path: null, status: "active", created_at: new Date().toISOString() }
    ]);
  }
  if (!DB.get("emp_users")) {
    const emps = DB.get("employees", []);
    DB.set("emp_users", emps.map(e => ({
      id: uid(), employee_id: e.id, username: (e.code || `emp${e.id}`).toLowerCase(),
      password: genPass(), active: true, created_at: new Date().toISOString()
    })));
  }
  if (!DB.get("payslips")) DB.set("payslips", []);
  if (!DB.get("announcements")) DB.set("announcements",
    Array.from({length:10}, (_,i)=>({slot:i+1,title:"",content:"",image_path:null,updated_at:null}))
  );
  if (!DB.get("attendance")) DB.set("attendance", []);
})();

// ---------- App Shell ----------
function bootShell() {
  console.log("[Backoffice] bootShell()");
  if (!$("header")) document.body.prepend(h("header", {}, h("h1", {}, "ระบบจัดการองค์การ")));
  let app = $("#app");
  if (!app) { app = h("main", { id:"app" }); document.body.append(app); }
  renderApp();
}
function renderApp(){
  const root = $("#app"); root.innerHTML = "";
  const nav = h("nav", {}, h("ul", {},
    h("li",{}, h("a",{href:"#","data-tab":"dashboard",class:"active"},"ภาพรวม")),
    h("li",{}, h("a",{href:"#","data-tab":"employees"},"จัดการพนักงาน")),
    h("li",{}, h("a",{href:"#","data-tab":"payslips"},"อัพสลิปเงินเดือน")),
    h("li",{}, h("a",{href:"#","data-tab":"announcements"},"แจ้งข่าวสาร")),
    h("li",{}, h("a",{href:"#","data-tab":"attendance"},"ตรวจสอบการทำงาน")),
    h("li",{}, h("a",{href:"#","data-tab":"users"},"ผู้ใช้หลังบ้าน")),
  ));
  const page = h("div",{class:"container"});
  root.append(nav,page);

  function goto(tab){
    $$("nav a").forEach(a=>a.classList.toggle("active", a.dataset.tab===tab));
    page.innerHTML="";
    if(tab==="dashboard") viewDashboard(page);
    if(tab==="employees") viewEmployees(page);
    if(tab==="payslips") viewPayslips(page);
    if(tab==="announcements") viewAnn(page);
    if(tab==="attendance") viewAttendance(page);
    if(tab==="users") viewUsers(page);
  }
  nav.addEventListener("click", e=>{
    const a=e.target.closest("a[data-tab]");
    if(a){ e.preventDefault(); goto(a.dataset.tab); }
  });
  goto("dashboard");
}

// ---------- Views ----------
function viewDashboard(root){
  const emps = DB.get("employees",[]), slips = DB.get("payslips",[]), eus = DB.get("emp_users",[]);
  root.append(h("div",{class:"grid cols-3"},
    statCard("พนักงาน", emps.length),
    statCard("สลิป", slips.length),
    statCard("ยูสหน้าบ้าน (Active)", eus.filter(u=>u.active).length),
  ));
  function statCard(label,val){ return h("div",{class:"widget",style:"text-align:center;padding:16px"},
    h("div",{style:"font-size:26px;font-weight:700"},val), h("div",{style:"opacity:.85"},label)); }
}

function viewEmployees(root){
  const wrap = h("div",{class:"card",style:"padding:16px"}); root.append(wrap);
  wrap.append(h("h2",{},"จัดการพนักงาน"));

  const form = h("div",{},
    row4(input("รหัส","e_code"), input("ชื่อ","e_fname"), input("สกุล","e_lname"), input("ชื่อเล่น","e_nick")),
    row4(input("อีเมล","e_email"), input("โทรศัพท์","e_phone"),
         input("วันเกิด YYYY-MM-DD","e_birth",{oninput:()=>$("#e_age").value=calcAge($("#e_birth").value)||""}),
         input("อายุ (auto)","e_age",{disabled:true})),
    row4(input("ตำแหน่ง","e_pos"), input("แผนก","e_dept"),
         select("เพศ","e_gender",[["","เลือก"],["M","ชาย"],["F","หญิง"]]),
         select("สถานะ","e_status",[["active","active"],["inactive","inactive"]])),
    h("hr"),
    h("h3",{},"บัญชีผู้ใช้หน้าบ้าน (พนักงาน)"),
    row4(input("Front Username","e_fu_user"), input("Front Password","e_fu_pass"),
         h("label",{class:"button secondary"}, "อัพรูปโปรไฟล์", h("input",{id:"e_avatar",type:"file",style:"display:none"})),
         h("button",{class:"button",onclick:saveNewEmployee},"บันทึกใหม่")),
  );
  wrap.append(form);

  const table = h("table",{class:"table",style:"margin-top:12px"});
  table.append(trh("#","รหัส","ชื่อ-สกุล","อีเมล","โทร","อายุ","สถานะ","รูป","จัดการ"));
  const list = sortBy(DB.get("employees",[]),"id","desc");
  const eus = DB.get("emp_users",[]);
  list.forEach(e=>{
    const eu = eus.find(u=>u.employee_id===e.id);
    table.append(h("tr",{},
      tdc(e.id), tdc(e.code||"-"), tdc(`${e.first_name||""} ${e.last_name||""}`),
      tdc(e.email||"-"), tdc(e.phone||"-"), tdc(e.age??"-"),
      tdc(e.status||"-"),
      tdc(e.avatar_path? h("img",{src:e.avatar_path,style:"height:40px;border-radius:8px"}):"-"),
      tdc(
        h("button",{class:"button secondary",onclick:()=>editEmp(e,eu)},"แก้ไข"), " ",
        h("button",{class:"button danger",onclick:()=>delEmp(e.id)},"ลบ"), " ",
        eu ? h("button",{class:"button",onclick:()=>showEmpUser(e,eu)},"ยูสพนักงาน") :
             h("button",{class:"button",onclick:()=>createEmpUserFor(e)},"สร้างยูส")
      )
    ));
  });
  wrap.append(table);

  // helpers UI
  function row4(...els){ return h("div",{class:"grid cols-4",style:"margin:8px 0"},...els); }
  function input(ph,id,extra={}){ return h("input",{id,class:"input",placeholder:ph,...extra}); }
  function select(label,id,opts){ return h("select",{id,class:"input"}, ...opts.map(([v,t])=>h("option",{value:v},t))); }
  function trh(...heads){ const tr=h("tr",{}); heads.forEach(t=>tr.append(h("th",{},t))); return tr; }
  function tdc(...children){ return h("td",{}, ...children); }

  async function saveNewEmployee(){
    const file = $("#e_avatar").files?.[0]; let avatar=null; if(file) avatar=await toDataUrl(file);
    const rec = {
      id: uid(),
      code: v("#e_code"), first_name: v("#e_fname"), last_name: v("#e_lname"), nick_name: v("#e_nick"),
      email: v("#e_email"), phone: v("#e_phone"), birth_date: v("#e_birth"), age: calcAge(v("#e_birth")),
      gender: $("#e_gender").value, position: v("#e_pos"), department: v("#e_dept"),
      avatar_path: avatar, status: $("#e_status").value || "active", created_at: new Date().toISOString()
    };
    const emps = DB.get("employees",[]); emps.push(rec); DB.set("employees", emps);

    const fu_user = v("#e_fu_user"), fu_pass = v("#e_fu_pass");
    if (fu_user && fu_pass) {
      const eus = DB.get("emp_users",[]);
      eus.push({ id: uid(), employee_id: rec.id, username: fu_user, password: fu_pass, active: true, created_at: new Date().toISOString() });
      DB.set("emp_users", eus);
    }
    alert("บันทึกพนักงานเรียบร้อย"); location.reload();
  }
  function v(sel){ return $(sel)?.value?.trim() || ""; }

  function editEmp(e, eu){
    $("#e_code").value=e.code||""; $("#e_fname").value=e.first_name||""; $("#e_lname").value=e.last_name||"";
    $("#e_nick").value=e.nick_name||""; $("#e_email").value=e.email||""; $("#e_phone").value=e.phone||"";
    $("#e_birth").value=e.birth_date||""; $("#e_age").value=e.age??""; $("#e_pos").value=e.position||"";
    $("#e_dept").value=e.department||""; $("#e_gender").value=e.gender||""; $("#e_status").value=e.status||"active";
    $("#e_fu_user").value=eu?.username||""; $("#e_fu_pass").value="";

    const btn = $$(".button").find(b=>b.textContent==="บันทึกใหม่");
    btn.textContent="บันทึกการแก้ไข";
    btn.onclick = async ()=>{
      const file=$("#e_avatar").files?.[0]; let avatar=e.avatar_path; if(file) avatar=await toDataUrl(file);
      const emps=DB.get("employees",[]); const idx=emps.findIndex(x=>x.id===e.id);
      emps[idx]={ ...e, code:v("#e_code"), first_name:v("#e_fname"), last_name:v("#e_lname"), nick_name:v("#e_nick"),
        email:v("#e_email"), phone:v("#e_phone"), birth_date:v("#e_birth"), age:calcAge(v("#e_birth")),
        gender:$("#e_gender").value, position:v("#e_pos"), department:v("#e_dept"), avatar_path:avatar, status:$("#e_status").value||"active" };
      DB.set("employees", emps);

      const eus=DB.get("emp_users",[]); const i=eus.findIndex(u=>u.employee_id===e.id);
      const fu_user=v("#e_fu_user"), fu_pass=v("#e_fu_pass");
      if (fu_user) {
        if (i>=0){ eus[i].username=fu_user; if(fu_pass) eus[i].password=fu_pass; }
        else eus.push({ id: uid(), employee_id:e.id, username: fu_user, password: fu_pass || genPass(), active:true, created_at:new Date().toISOString() });
        DB.set("emp_users", eus);
      }
      alert("อัปเดตแล้ว"); location.reload();
    };
  }

  function delEmp(empId){
    if(!confirm("ลบพนักงานคนนี้? ยูสหน้าบ้านจะถูกปิดการใช้งานด้วย")) return;
    const emps = DB.get("employees",[]).filter(x=>x.id!==empId); DB.set("employees", emps);
    const eus = DB.get("emp_users",[]); const i=eus.findIndex(u=>u.employee_id===empId);
    if(i>=0){ eus[i].active=false; DB.set("emp_users", eus); }
    alert("ลบพนักงานแล้ว และปิดยูสหน้าบ้านแล้ว"); location.reload();
  }

  function showEmpUser(e, eu){
    alert(`ยูสพนักงาน:\nพนักงาน: ${e.code} ${e.first_name} ${e.last_name}\nusername: ${eu.username}\nสถานะ: ${eu.active?'เปิดใช้งาน':'ปิดใช้งาน'}`);
  }
  function createEmpUserFor(e){
    const username = (e.code || `${e.first_name}`).toLowerCase();
    const password = genPass();
    const eus = DB.get("emp_users",[]);
    if (eus.some(u=>u.employee_id===e.id)) return alert("มียูสอยู่แล้ว");
    eus.push({ id: uid(), employee_id:e.id, username, password, active:true, created_at:new Date().toISOString() });
    DB.set("emp_users", eus);
    copy(`username: ${username}  |  password: ${password}`);
  }
}

function viewPayslips(root){
  const wrap=h("div",{class:"card",style:"padding:16px"}); root.append(wrap);
  wrap.append(h("h2",{},"อัพสลิปเงินเดือน"));
  const employees=DB.get("employees",[]), payslips=DB.get("payslips",[]);
  const uploader=h("div",{},
    h("div",{class:"grid cols-4",style:"margin:8px 0"},
      selectEmp(), input("ปี YYYY","ps_year"), input("เดือน MM","ps_month"), input("หมายเหตุ","ps_note")),
    h("input",{id:"ps_file",type:"file",class:"input"}), h("div",{style:"height:10px"}),
    h("button",{class:"button",onclick:saveSlip},"อัพโหลด/แทนที่")
  );
  wrap.append(uploader);

  const table=h("table",{class:"table",style:"margin-top:12px"});
  table.append(trh("#","Emp","ชื่อ","งวด","สลิป","หมายเหตุ","จัดการ"));
  sortBy(payslips,"uploaded_at","desc").forEach(p=>{
    const emp=employees.find(e=>e.id===p.employee_id);
    table.append(h("tr",{},
      tdc(p.id), tdc(emp?.code||"-"), tdc(emp?`${emp.first_name} ${emp.last_name}`:"-"),
      tdc(`${p.year}-${String(p.month).padStart(2,"0")}`),
      tdc(p.file_path? h("a",{href:p.file_path,target:"_blank"},"เปิด"):"-"),
      tdc(p.note||"-"),
      tdc(h("button",{class:"button danger",onclick:()=>delSlip(p.id)},"ลบ"))
    ));
  });
  wrap.append(table);

  function selectEmp(){
    const s=h("select",{id:"ps_emp",class:"input"},
      h("option",{value:""},"เลือกพนักงาน"),
      ...employees.map(e=>h("option",{value:e.id},`${e.code||"-"} | ${e.first_name} ${e.last_name}`)));
    return s;
  }
  function input(ph,id){ return h("input",{id,class:"input",placeholder:ph}); }
  function trh(...heads){ const tr=h("tr",{}); heads.forEach(t=>tr.append(h("th",{},t))); return tr; }
  function tdc(...children){ return h("td",{}, ...children); }

  async function saveSlip(){
    const employee_id=Number($("#ps_emp").value), year=Number($("#ps_year").value),
          month=Number($("#ps_month").value), note=$("#ps_note").value,
          file=$("#ps_file").files?.[0];
    if(!employee_id||!year||!month||!file) return alert("กรอกข้อมูลให้ครบและเลือกไฟล์");
    const dataUrl=await toDataUrl(file);
    const all=DB.get("payslips",[]);
    const idx=all.findIndex(x=>x.employee_id===employee_id&&x.year===year&&x.month===month);
    if(idx>=0){ all[idx].file_path=dataUrl; all[idx].note=note; all[idx].uploaded_at=new Date().toISOString(); }
    else all.push({ id:uid(), employee_id, year, month, file_path:dataUrl, note, uploaded_at:new Date().toISOString() });
    DB.set("payslips",all); alert("บันทึกสลิปแล้ว"); location.reload();
  }
  function delSlip(id){ if(!confirm("ลบสลิปนี้?"))return; DB.set("payslips", DB.get("payslips",[]).filter(x=>x.id!==id)); alert("ลบแล้ว"); location.reload(); }
}

function viewAnn(root){
  const wrap=h("div",{class:"card",style:"padding:16px"}); root.append(wrap);
  wrap.append(h("h2",{},"ประกาศ/อัพเดต (สูงสุด 10 ช่อง)"));
  const list=DB.get("announcements",[]), grid=h("div",{class:"grid cols-2",style:"margin-top:12px"}); wrap.append(grid);
  for(let i=1;i<=10;i++){
    const exist=list.find(x=>x.slot===i)||{slot:i}; const card=h("div",{class:"card",style:"padding:12px"});
    const title=h("input",{class:"input",placeholder:"หัวข้อ",value:exist.title||""});
    const content=h("textarea",{class:"input",style:"min-height:90px",placeholder:"เนื้อหา"}, exist.content||"");
    const imgPrev=h("div",{}, exist.image_path? h("img",{src:exist.image_path,style:"max-width:100%;border-radius:8px"}): h("div",{class:"tag"},"ไม่มีรูป"));
    const file=h("input",{type:"file",class:"input"});
    const save=h("button",{class:"button",onclick:()=>saveAnn(i,title.value,content.value,file.files?.[0])},"บันทึก");
    card.append(h("div",{class:"header"},h("b",{},"ช่องที่ "+i)), title, spacer(), content, spacer(), imgPrev, spacer(), file, spacer(), save);
    grid.append(card);
  }
  function spacer(){ return h("div",{style:"height:6px"}); }
  async function saveAnn(slot,title,content,file){
    let image_path=list.find(x=>x.slot===slot)?.image_path||null; if(file) image_path=await toDataUrl(file);
    const updated=list.map(x=>x.slot===slot? {slot,title,content,image_path,updated_at:new Date().toISOString()} : x);
    DB.set("announcements",updated); alert("บันทึกประกาศแล้ว"); location.reload();
  }
}

function viewAttendance(root){
  const wrap=h("div",{class:"card",style:"padding:16px"}); root.append(wrap);
  wrap.append(h("h2",{},"ตรวจสอบการทำงาน (ปฏิทิน)"));
  const now=new Date(), y=now.getFullYear(), m=now.getMonth()+1;

  const ctrl=h("div",{class:"header"});
  const year=h("input",{class:"input",value:y});
  const month=h("input",{class:"input",value:String(m).padStart(2,"0")});
  const reload=h("button",{class:"button",onclick:load},"โหลด");
  ctrl.append(h("div",{},"เดือน/ปี"),month,year,reload); wrap.append(ctrl);

  const table=h("table",{class:"table"}); wrap.append(table);
  const cal=h("div",{style:"display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-top:12px"}); wrap.append(cal);

  const form=h("div",{class:"card",style:"padding:12px;margin-top:12px"});
  const employees=DB.get("employees",[]);
  form.append(h("h3",{},"บันทึกเข้า-ออก (จำลอง)"),
    h("div",{class:"grid cols-4",style:"margin-top:8px"},
      (()=>{ const s=h("select",{id:"at_emp",class:"input"}, h("option",{value:""},"เลือกพนักงาน"),
        ...employees.map(e=>h("option",{value:e.id},`${e.code||"-"} | ${e.first_name} ${e.last_name}`))); return s; })(),
      h("input",{id:"at_date",class:"input",placeholder:"YYYY-MM-DD"}),
      h("input",{id:"at_in",class:"input",placeholder:"เข้างาน HH:mm"}),
      h("input",{id:"at_out",class:"input",placeholder:"ออกงาน HH:mm"})
    ),
    h("input",{id:"at_note",class:"input",placeholder:"หมายเหตุ"}),
    h("div",{style:"height:8px"}),
    h("button",{class:"button",onclick:saveAtt},"บันทึก")
  );
  wrap.append(form);

  load();

  function load(){
    const ym=ymStr(Number(year.value),Number(month.value));
    const attendance=DB.get("attendance",[]).filter(a=>a.date.startsWith(ym));
    table.innerHTML=""; table.append(trh("Emp","ชื่อ","วันที่","เข้า","ออก","หมายเหตุ"));
    attendance.forEach(a=>{ const emp=employees.find(e=>e.id===a.employee_id);
      table.append(h("tr",{}, tdc(emp?.code||"-"), tdc(emp?`${emp.first_name} ${emp.last_name}`:"-"),
        tdc(a.date), tdc(a.check_in||"-"), tdc(a.check_out||"-"), tdc(a.note||"-"))); });
    cal.innerHTML=""; const firstDay=new Date(Number(year.value),Number(month.value)-1,1);
    const start=firstDay.getDay(), days=new Date(Number(year.value),Number(month.value),0).getDate();
    for(let i=0;i<start;i++) cal.append(h("div",{},""));
    const set=new Set(attendance.map(a=>a.date));
    for(let d=1; d<=days; d++){ const ds=`${year.value}-${String(month.value).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      cal.append(h("div",{class:"card",style:"padding:8px;text-align:center"}, h("div",{},d), h("div",{style:"color:#67f4b2"}, set.has(ds)?"●":""))); }
  }
  function trh(...heads){ const tr=h("tr",{}); heads.forEach(t=>tr.append(h("th",{},t))); return tr; }
  function tdc(...children){ return h("td",{}, ...children); }
  function saveAtt(){
    const employee_id=Number($("#at_emp").value), date=$("#at_date").value,
          check_in=$("#at_in").value, check_out=$("#at_out").value, note=$("#at_note").value;
    if(!employee_id||!date) return alert("เลือกพนักงานและวันที่ก่อน");
    const all=DB.get("attendance",[]); const idx=all.findIndex(x=>x.employee_id===employee_id&&x.date===date);
    if(idx>=0) all[idx]={...all[idx],check_in,check_out,note};
    else all.push({id:uid(),employee_id,date,check_in,check_out,note,created_at:new Date().toISOString()});
    DB.set("attendance",all); alert("บันทึกแล้ว"); load();
  }
}

function viewUsers(root){
  const wrap=h("div",{class:"card",style:"padding:16px"}); root.append(wrap);
  wrap.append(h("h2",{},"ผู้ใช้หลังบ้าน"));
  const adminList=DB.get("admin_users",[]);
  const creator=h("div",{}, h("div",{class:"grid cols-4"},
    h("input",{id:"u_user",class:"input",placeholder:"username"}),
    (()=>{ const s=h("select",{id:"u_role",class:"input"}, ...["Owner","Admin","Manager","Employee","Auditor"].map(r=>h("option",{value:r},r))); return s;})(),
    h("button",{class:"button",onclick:saveAdmin},"สร้างยูส"),
    h("button",{class:"button secondary",onclick:resetAll},"รีเซ็ตระบบ (ล้าง LocalStorage)")
  ));
  wrap.append(creator);

  const table=h("table",{class:"table",style:"margin-top:12px"});
  table.append(trh("#","username","role","สร้างเมื่อ","จัดการ"));
  adminList.forEach(u=>{
    table.append(h("tr",{}, tdc(u.id), tdc(u.username), tdc(u.role), tdc(u.created_at?.split("T")[0]||"-"),
      tdc(
        (()=>{ const s=h("select",{class:"input",onchange:(ev)=>{ const all=DB.get("admin_users",[]); const i=all.findIndex(x=>x.id===u.id); all[i].role=ev.target.value; DB.set("admin_users",all); alert("เปลี่ยน role แล้ว"); }},
          ...["Owner","Admin","Manager","Employee","Auditor"].map(r=>h("option",{value:r,selected:u.role===r},r))); return s;})(),
        " ", h("button",{class:"button danger",onclick:()=>delAdmin(u.id)},"ลบ")
      )
    ));
  });
  wrap.append(table);

  // หน้าบัญชีพนักงาน (หน้าบ้าน)
  wrap.append(h("h2",{style:"margin-top:18px"},"บัญชีพนักงาน (หน้าบ้าน)"));
  const eus=DB.get("emp_users",[]), emps=DB.get("employees",[]);
  const etable=h("table",{class:"table",style:"margin-top:8px"});
  etable.append(trh("#","Emp","ชื่อ","username","สถานะ","จัดการ"));
  eus.forEach(u=>{
    const e=emps.find(x=>x.id===u.employee_id);
    etable.append(h("tr",{},
      tdc(u.id), tdc(e?.code||"-"), tdc(e?`${e.first_name} ${e.last_name}`:"-"),
      tdc(u.username),
      tdc(u.active? "เปิดใช้งาน":"ปิดการใช้งาน"),
      tdc(
        h("button",{class:"button secondary",onclick:()=>resetEmpPass(u.id)},"รีเซ็ตรหัส"),
        " ",
        h("button",{class:"button",onclick:()=>toggleEmpActive(u.id)}, u.active?"ปิดการใช้งาน":"เปิดการใช้งาน")
      )
    ));
  });
  wrap.append(etable);

  function trh(...heads){ const tr=h("tr",{}); heads.forEach(t=>tr.append(h("th",{},t))); return tr; }
  function tdc(...children){ return h("td",{}, ...children); }
  function saveAdmin(){
    const username=$("#u_user").value.trim(), role=$("#u_role").value;
    if(!username) return alert("กรอก username");
    const all=DB.get("admin_users",[]); if(all.some(x=>x.username===username)) return alert("มี username นี้แล้ว");
    all.push({id:uid(),username,role,created_at:new Date().toISOString()}); DB.set("admin_users",all); alert("สร้างผู้ใช้แล้ว"); location.reload();
  }
  function delAdmin(id){ if(!confirm("ลบผู้ใช้คนนี้?")) return; DB.set("admin_users", DB.get("admin_users",[]).filter(x=>x.id!==id)); alert("ลบแล้ว"); location.reload(); }
  function resetAll(){ if(!confirm("ล้างข้อมูลจำลองทั้งหมด?")) return; localStorage.clear(); alert("ล้างแล้ว"); location.reload(); }

  function resetEmpPass(id){
    const pw=genPass(); const all=DB.get("emp_users",[]); const i=all.findIndex(x=>x.id===id); all[i].password=pw; DB.set("emp_users",all);
    copy(`username: ${all[i].username}  |  password: ${pw}`);
  }
  function toggleEmpActive(id){
    const all=DB.get("emp_users",[]); const i=all.findIndex(x=>x.id===id);
    all[i].active=!all[i].active; DB.set("emp_users",all);
    alert(all[i].active? "เปิดใช้งานแล้ว":"ปิดการใช้งานแล้ว"); location.reload();
  }
}

// ---------- Init ----------
(function init(){
  // ถ้าไม่ใส่ defer ใน index.html ก็ยังทำงานเพราะเรารอ DOMContentLoaded
  window.addEventListener("DOMContentLoaded", () => {
    try { bootShell(); }
    catch (err) {
      console.error("Boot error:", err);
      alert("มีข้อผิดพลาดตอนเริ่มระบบ ดู Console (F12) -> Tab Console");
    }
  });
})();
