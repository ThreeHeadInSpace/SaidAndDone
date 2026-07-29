const $ = (s) => document.querySelector(s);
const icon = { close: "×" };
const state = JSON.parse(localStorage.getItem("said-done-tasks")) || {
  selected: new Date().toISOString().slice(0,10),
  tasks: [
    { id:1, title:"Call Mom", time:"10:00 AM", done:false, tag:"Today" },
    { id:2, title:"Order a gift for Anna", time:"", done:false, tag:"Urgent" },
    { id:3, title:"Morning run", time:"7:30 AM", done:true, tag:"Planned" },
    { id:4, title:"Read 20 pages", time:"", done:false, tag:"Calm" }
  ]
};
const save = () => localStorage.setItem("said-done-tasks", JSON.stringify(state));
const startOfWeek = (date) => { const d = new Date(date); const diff = (d.getDay()+6)%7; d.setDate(d.getDate()-diff); d.setHours(0,0,0,0); return d; };
const dayName = new Intl.DateTimeFormat("en-US", {weekday:"narrow"});
const longDate = new Intl.DateTimeFormat("en-US", {weekday:"long",month:"long",day:"numeric"});
function renderDays() { const selected = new Date(`${state.selected}T12:00:00`); const start = startOfWeek(selected); $("#days").innerHTML = Array.from({length:7}, (_,i) => { const d = new Date(start); d.setDate(d.getDate()+i); const id=d.toISOString().slice(0,10); return `<button class="day ${id===state.selected?"active":""}" data-day="${id}" aria-pressed="${id===state.selected}"><small>${dayName.format(d)}</small><strong>${d.getDate()}</strong></button>`; }).join(""); $("#today-label").textContent = longDate.format(selected).toUpperCase(); }
function renderTasks() { const tasks=state.tasks; $("#task-list").innerHTML = tasks.length ? tasks.map(t => `<button class="task ${t.done?"done":""}" data-task="${t.id}" aria-label="${t.title}, ${t.done?"completed":"not completed"}"><span class="check"></span><span class="task-copy"><span class="task-title">${escapeHTML(t.title)}</span>${t.time?`<span class="task-time">${escapeHTML(t.time)}</span>`:""}</span><span class="task-tag ${t.tag==='Urgent'?'urgent':''}">${t.tag}</span></button>`).join("") : `<p class="empty">No tasks yet. Add the first one.</p>`; $("#task-count").textContent=`${tasks.filter(t=>!t.done).length} planned`; }
function renderChart() { const values=[2,4,3,5,6,3, state.tasks.filter(t=>t.done).length+2]; const labels=["M","T","W","T","F","S","S"]; const max=Math.max(...values); $("#chart").innerHTML=values.map((v,i)=>`<div class="bar-wrap"><div class="bar" style="height:${Math.round(v/max*100)}%"></div><span>${labels[i]}</span></div>`).join(""); $("#week-total").textContent=`${values.reduce((a,b)=>a+b,0)} this week`; }
function escapeHTML(value) { const el=document.createElement("div"); el.textContent=value; return el.innerHTML; }
function render() { renderDays(); renderTasks(); renderChart(); }
function openDialog(kind) { const content=$("#dialog-content"); const panels={
  add:`<div class="dialog-inner"><button class="dialog-close" aria-label="Close">${icon.close}</button><h2>Add a task</h2><p>Type it now — voice capture will come next.</p><form class="task-form" id="task-form"><label for="task-name">What do you need to do?</label><input id="task-name" required maxlength="120" autofocus placeholder="e.g. Book dentist appointment"><button class="primary-action">Add task</button></form></div>`,
  events:`<div class="dialog-inner"><button class="dialog-close" aria-label="Close">${icon.close}</button><h2>Events</h2><p>Birthdays, holidays and important dates will live here.</p></div>`,
  notes:`<div class="dialog-inner"><button class="dialog-close" aria-label="Close">${icon.close}</button><h2>Notes</h2><p>Your visual board for loose thoughts and voice notes.</p><div class="sticky-board"><div class="sticky">Gift ideas for Anna</div><div class="sticky">Plan a weekend walk</div><div class="sticky">Read: Atomic Habits</div></div></div>`,
  summary:`<div class="dialog-inner"><button class="dialog-close" aria-label="Close">${icon.close}</button><h2>Summary</h2><p>This week you completed ${state.tasks.filter(t=>t.done).length} tasks. Your personal weekly recap will appear here.</p></div>`
 }; content.innerHTML=panels[kind]; const dialog=$("#dialog"); dialog.showModal(); $(".dialog-close").onclick=()=>dialog.close(); if(kind==='add') $("#task-form").onsubmit=(e)=>{e.preventDefault(); const title=$("#task-name").value.trim(); if(!title)return; state.tasks.unshift({id:Date.now(),title,time:"",done:false,tag:"Today"}); save(); render(); dialog.close();}; }
document.addEventListener("click", (e) => { const day=e.target.closest("[data-day]"); if(day){state.selected=day.dataset.day;save();render();} const task=e.target.closest("[data-task]"); if(task){const t=state.tasks.find(x=>x.id===Number(task.dataset.task));t.done=!t.done;save();render();} const panel=e.target.closest("[data-panel]"); if(panel)openDialog(panel.dataset.panel); });
$("#open-add").onclick=()=>openDialog("add"); $("#open-add-nav").onclick=()=>openDialog("add"); $("#record").onclick=()=>{ const b=$("#record"); b.classList.toggle("recording"); b.setAttribute("aria-label",b.classList.contains("recording")?"Stop recording":"Record a task or note"); }; $("#previous-week").onclick=()=>{const d=new Date(`${state.selected}T12:00:00`);d.setDate(d.getDate()-7);state.selected=d.toISOString().slice(0,10);save();render();}; $("#next-week").onclick=()=>{const d=new Date(`${state.selected}T12:00:00`);d.setDate(d.getDate()+7);state.selected=d.toISOString().slice(0,10);save();render();}; $("#choose-date").onclick=()=>{const input=document.createElement("input");input.type="date";input.value=state.selected;input.onchange=()=>{state.selected=input.value;save();render();};input.showPicker?.();input.click();};
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js"); render();
