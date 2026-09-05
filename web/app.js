import {
  parseUtterance,
  todayISO,
  formatLongDate,
  formatShortDate,
  addDaysISO
} from "./nlp.js";

const STORAGE_KEY = "said-done-v2";
const ONBOARD_KEY = "said-done-onboarded";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

const dayName = new Intl.DateTimeFormat("en-US", { weekday: "narrow" });
const NOTE_COLORS = ["yellow", "mint", "lavender", "peach", "rose"];

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHTML(value) {
  const el = document.createElement("div");
  el.textContent = value ?? "";
  return el.innerHTML;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    }
  } catch { /* ignore */ }

  // Migrate stub data if present
  try {
    const legacy = JSON.parse(localStorage.getItem("said-done-tasks") || "null");
    if (legacy?.tasks) {
      const selected = legacy.selected || todayISO();
      return normalizeState({
        selected,
        tasks: legacy.tasks.map((t) => ({
          id: String(t.id),
          title: t.title,
          date: selected,
          time: t.time || "",
          done: !!t.done,
          tag: t.tag || "Today",
          createdAt: Date.now()
        })),
        events: [],
        notes: []
      });
    }
  } catch { /* ignore */ }

  return normalizeState({
    selected: todayISO(),
    tasks: [
      { id: uid(), title: "Call Mom", date: todayISO(), time: "10:00 AM", done: false, tag: "Today", createdAt: Date.now() },
      { id: uid(), title: "Order a gift for Anna", date: todayISO(), time: "", done: false, tag: "Urgent", createdAt: Date.now() },
      { id: uid(), title: "Morning run", date: todayISO(), time: "7:30 AM", done: true, tag: "Planned", createdAt: Date.now() },
      { id: uid(), title: "Read 20 pages", date: addDaysISO(todayISO(), 1), time: "", done: false, tag: "Calm", createdAt: Date.now() }
    ],
    events: [
      { id: uid(), title: "Anna's birthday", date: addDaysISO(todayISO(), 12), time: "", notes: "Order cake", createdAt: Date.now() }
    ],
    notes: [
      { id: uid(), text: "Gift ideas for Anna", color: "yellow", createdAt: Date.now() },
      { id: uid(), text: "Plan a weekend walk", color: "mint", createdAt: Date.now() },
      { id: uid(), text: "Read: Atomic Habits", color: "lavender", createdAt: Date.now() }
    ]
  });
}

function normalizeState(s) {
  return {
    selected: s.selected || todayISO(),
    tasks: Array.isArray(s.tasks) ? s.tasks : [],
    events: Array.isArray(s.events) ? s.events : [],
    notes: Array.isArray(s.notes) ? s.notes : []
  };
}

const state = loadState();
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

function startOfWeek(date) {
  const d = new Date(date);
  const diff = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function tasksForDay(iso) {
  return state.tasks
    .filter((t) => t.date === iso)
    .sort((a, b) => Number(a.done) - Number(b.done) || (a.time || "").localeCompare(b.time || "") || a.title.localeCompare(b.title));
}

function eventsForDay(iso) {
  return state.events.filter((e) => e.date === iso);
}

function weekCompletions(selectedISO) {
  const start = startOfWeek(new Date(`${selectedISO}T12:00:00`));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const id = todayISO(d);
    return {
      iso: id,
      label: ["M", "T", "W", "T", "F", "S", "S"][i],
      count: state.tasks.filter((t) => t.date === id && t.done).length
    };
  });
}

/* ---------- Render ---------- */

function renderDays() {
  const selected = new Date(`${state.selected}T12:00:00`);
  const start = startOfWeek(selected);
  $("#days").innerHTML = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const id = todayISO(d);
    const has = tasksForDay(id).length > 0 || eventsForDay(id).length > 0;
    return `<button type="button" class="day ${id === state.selected ? "active" : ""} ${has ? "has-items" : ""}" data-day="${id}" aria-pressed="${id === state.selected}"><small>${dayName.format(d)}</small><strong>${d.getDate()}</strong></button>`;
  }).join("");
  const isToday = state.selected === todayISO();
  $("#today-label").textContent = isToday
    ? "TODAY"
    : formatLongDate(state.selected).toUpperCase();
}

function renderTasks() {
  const tasks = tasksForDay(state.selected);
  $("#task-list").innerHTML = tasks.length
    ? tasks.map((t) => `
      <div class="task ${t.done ? "done" : ""}" data-task="${t.id}">
        <button type="button" class="check" data-toggle="${t.id}" aria-label="${t.done ? "Mark incomplete" : "Mark complete"}"></button>
        <button type="button" class="task-copy" data-edit-task="${t.id}" aria-label="Edit ${escapeHTML(t.title)}">
          <span class="task-title">${escapeHTML(t.title)}</span>
          ${t.time ? `<span class="task-time">${escapeHTML(t.time)}</span>` : ""}
        </button>
        <span class="task-tag ${t.tag === "Urgent" ? "urgent" : ""}">${escapeHTML(t.tag || "Today")}</span>
        <div class="task-actions">
          <button type="button" data-delete-task="${t.id}" aria-label="Delete task">×</button>
        </div>
      </div>`).join("")
    : `<p class="empty">No tasks for this day. Add one or tap the mic.</p>`;
  $("#task-count").textContent = `${tasks.filter((t) => !t.done).length} planned`;
}

function renderChart() {
  const values = weekCompletions(state.selected);
  const max = Math.max(1, ...values.map((v) => v.count));
  const total = values.reduce((a, b) => a + b.count, 0);
  $("#chart").innerHTML = values.map((v) => `
    <div class="bar-wrap">
      <div class="bar ${v.iso === state.selected ? "today" : ""}" style="height:${Math.round((v.count / max) * 100)}%" title="${v.count}"></div>
      <span>${v.label}</span>
    </div>`).join("");
  $("#week-total").textContent = `${total} this week`;
}

function render() {
  renderDays();
  renderTasks();
  renderChart();
}

/* ---------- Dialogs ---------- */

function closeDialog() {
  const dialog = $("#dialog");
  if (dialog.open) dialog.close();
}

function openDialog(html) {
  const dialog = $("#dialog");
  $("#dialog-content").innerHTML = html;
  dialog.showModal();
  $(".dialog-close", dialog)?.addEventListener("click", closeDialog);
}

function taskFormHTML(task = null, preset = {}) {
  const t = {
    title: "",
    date: state.selected,
    time: "",
    tag: "Today",
    ...preset,
    ...task
  };
  return `
    <div class="dialog-inner">
      <button type="button" class="dialog-close" aria-label="Close">×</button>
      <h2>${task ? "Edit task" : "Add a task"}</h2>
      <p class="dialog-lead">${task ? "Update details and save." : "Type it now — or use the mic anytime."}</p>
      <form class="task-form" id="entity-form">
        <label for="f-title">What do you need to do?</label>
        <input id="f-title" name="title" required maxlength="160" autofocus placeholder="e.g. Book dentist appointment" value="${escapeHTML(t.title)}" />
        <div class="form-row">
          <div>
            <label for="f-date">Date</label>
            <input id="f-date" name="date" type="date" required value="${escapeHTML(t.date)}" />
          </div>
          <div>
            <label for="f-time">Time</label>
            <input id="f-time" name="time" maxlength="32" placeholder="10:00 AM" value="${escapeHTML(t.time || "")}" />
          </div>
        </div>
        <label for="f-tag">Urgency</label>
        <select id="f-tag" name="tag">
          ${["Today", "Urgent", "Planned", "Calm"].map((tag) =>
            `<option value="${tag}" ${t.tag === tag ? "selected" : ""}>${tag}</option>`
          ).join("")}
        </select>
        <div class="form-actions">
          <button class="primary-action" type="submit">${task ? "Save changes" : "Add task"}</button>
          ${task ? `<button class="danger-action" type="button" id="form-delete">Delete</button>` : ""}
        </div>
      </form>
    </div>`;
}

function eventFormHTML(event = null, preset = {}) {
  const e = {
    title: "",
    date: state.selected,
    time: "",
    notes: "",
    ...preset,
    ...event
  };
  return `
    <div class="dialog-inner">
      <button type="button" class="dialog-close" aria-label="Close">×</button>
      <h2>${event ? "Edit event" : "Add event"}</h2>
      <p class="dialog-lead">Birthdays, meetings, and important dates.</p>
      <form class="entity-form" id="entity-form">
        <label for="f-title">Title</label>
        <input id="f-title" name="title" required maxlength="160" autofocus value="${escapeHTML(e.title)}" placeholder="e.g. Team standup" />
        <div class="form-row">
          <div>
            <label for="f-date">Date</label>
            <input id="f-date" name="date" type="date" required value="${escapeHTML(e.date)}" />
          </div>
          <div>
            <label for="f-time">Time</label>
            <input id="f-time" name="time" maxlength="32" value="${escapeHTML(e.time || "")}" placeholder="optional" />
          </div>
        </div>
        <label for="f-notes">Notes</label>
        <textarea id="f-notes" name="notes" maxlength="400" placeholder="Optional details">${escapeHTML(e.notes || "")}</textarea>
        <div class="form-actions">
          <button class="primary-action" type="submit">${event ? "Save changes" : "Add event"}</button>
          ${event ? `<button class="danger-action" type="button" id="form-delete">Delete</button>` : ""}
        </div>
      </form>
    </div>`;
}

function noteFormHTML(note = null, preset = {}) {
  const n = { text: "", color: "yellow", ...preset, ...note };
  return `
    <div class="dialog-inner">
      <button type="button" class="dialog-close" aria-label="Close">×</button>
      <h2>${note ? "Edit note" : "Add note"}</h2>
      <p class="dialog-lead">Sticky thoughts that stay on your board.</p>
      <form class="entity-form" id="entity-form">
        <label for="f-text">Note</label>
        <textarea id="f-text" name="text" required maxlength="400" autofocus placeholder="Gift ideas…">${escapeHTML(n.text)}</textarea>
        <label>Color</label>
        <div class="color-picks" id="color-picks">
          ${NOTE_COLORS.map((c) =>
            `<button type="button" class="sticky ${c} ${n.color === c ? "selected" : ""}" data-color="${c}" aria-label="${c}"></button>`
          ).join("")}
        </div>
        <input type="hidden" name="color" id="f-color" value="${escapeHTML(n.color)}" />
        <div class="form-actions">
          <button class="primary-action" type="submit">${note ? "Save note" : "Add note"}</button>
          ${note ? `<button class="danger-action" type="button" id="form-delete">Delete</button>` : ""}
        </div>
      </form>
    </div>`;
}

function reviewSheetHTML(draft) {
  const types = ["task", "event", "note"];
  return `
    <div class="dialog-inner">
      <button type="button" class="dialog-close" aria-label="Close">×</button>
      <h2>Review capture</h2>
      <p class="dialog-lead">We heard: “${escapeHTML(draft.raw)}”</p>
      <div class="review-chips" id="type-chips">
        ${types.map((ty) =>
          `<button type="button" class="chip ${draft.type === ty ? "active" : ""}" data-type="${ty}">${ty}</button>`
        ).join("")}
      </div>
      <form class="entity-form" id="review-form">
        <label for="f-title">Title / text</label>
        <input id="f-title" name="title" required maxlength="200" value="${escapeHTML(draft.title)}" />
        <div class="form-row" id="date-row">
          <div>
            <label for="f-date">Date</label>
            <input id="f-date" name="date" type="date" value="${escapeHTML(draft.date || state.selected)}" />
          </div>
          <div>
            <label for="f-time">Time</label>
            <input id="f-time" name="time" value="${escapeHTML(draft.time || "")}" placeholder="optional" />
          </div>
        </div>
        <div id="tag-row" ${draft.type !== "task" ? "hidden" : ""}>
          <label for="f-tag">Urgency</label>
          <select id="f-tag" name="tag">
            ${["Today", "Urgent", "Planned", "Calm"].map((tag) =>
              `<option value="${tag}" ${draft.tag === tag ? "selected" : ""}>${tag}</option>`
            ).join("")}
          </select>
        </div>
        <div class="form-actions">
          <button class="primary-action" type="submit">Save</button>
          <button class="secondary-action" type="button" id="review-discard">Discard</button>
        </div>
      </form>
    </div>`;
}

function openAddTask(preset = {}) {
  openDialog(taskFormHTML(null, preset));
  wireEntityForm({
    onSubmit: (data) => {
      state.tasks.unshift({
        id: uid(),
        title: data.title,
        date: data.date,
        time: data.time || "",
        done: false,
        tag: data.tag || "Today",
        createdAt: Date.now()
      });
      state.selected = data.date;
      save();
      render();
      closeDialog();
    }
  });
}

function openEditTask(id) {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) return;
  openDialog(taskFormHTML(task));
  wireEntityForm({
    onSubmit: (data) => {
      Object.assign(task, {
        title: data.title,
        date: data.date,
        time: data.time || "",
        tag: data.tag || "Today"
      });
      save();
      render();
      closeDialog();
    },
    onDelete: () => {
      state.tasks = state.tasks.filter((t) => t.id !== id);
      save();
      render();
      closeDialog();
    }
  });
}

function openEventsPanel() {
  const upcoming = [...state.events].sort((a, b) => a.date.localeCompare(b.date) || (a.time || "").localeCompare(b.time || ""));
  openDialog(`
    <div class="dialog-inner">
      <button type="button" class="dialog-close" aria-label="Close">×</button>
      <h2>Events</h2>
      <p class="dialog-lead">Birthdays, holidays and important dates.</p>
      <button type="button" class="primary-action" id="add-event-btn">Add event</button>
      <div class="entity-list">
        ${upcoming.length ? upcoming.map((e) => {
          const d = new Date(`${e.date}T12:00:00`);
          const badge = `${d.getDate()}<br>${d.toLocaleString("en-US", { month: "short" })}`;
          return `<button type="button" class="entity-card" data-edit-event="${e.id}">
            <span class="entity-date-badge">${badge}</span>
            <span>
              <strong>${escapeHTML(e.title)}</strong>
              <span>${escapeHTML(formatShortDate(e.date))}${e.time ? " · " + escapeHTML(e.time) : ""}${e.notes ? " · " + escapeHTML(e.notes) : ""}</span>
            </span>
          </button>`;
        }).join("") : `<p class="empty">No events yet.</p>`}
      </div>
    </div>`);
  $("#add-event-btn")?.addEventListener("click", () => openAddEvent());
  $$("[data-edit-event]").forEach((btn) =>
    btn.addEventListener("click", () => openEditEvent(btn.dataset.editEvent))
  );
}

function openAddEvent(preset = {}) {
  openDialog(eventFormHTML(null, preset));
  wireEntityForm({
    onSubmit: (data) => {
      state.events.unshift({
        id: uid(),
        title: data.title,
        date: data.date,
        time: data.time || "",
        notes: data.notes || "",
        createdAt: Date.now()
      });
      save();
      render();
      closeDialog();
      openEventsPanel();
    }
  });
}

function openEditEvent(id) {
  const event = state.events.find((e) => e.id === id);
  if (!event) return;
  openDialog(eventFormHTML(event));
  wireEntityForm({
    onSubmit: (data) => {
      Object.assign(event, {
        title: data.title,
        date: data.date,
        time: data.time || "",
        notes: data.notes || ""
      });
      save();
      render();
      closeDialog();
      openEventsPanel();
    },
    onDelete: () => {
      state.events = state.events.filter((e) => e.id !== id);
      save();
      render();
      closeDialog();
      openEventsPanel();
    }
  });
}

function openNotesPanel() {
  openDialog(`
    <div class="dialog-inner">
      <button type="button" class="dialog-close" aria-label="Close">×</button>
      <h2>Notes</h2>
      <p class="dialog-lead">Your visual board for loose thoughts and voice notes.</p>
      <button type="button" class="primary-action" id="add-note-btn">Add note</button>
      <div class="sticky-board">
        ${state.notes.length ? state.notes.map((n) => `
          <button type="button" class="sticky ${escapeHTML(n.color || "yellow")}" data-edit-note="${n.id}">
            ${escapeHTML(n.text)}
            <span class="sticky-meta">tap to edit</span>
          </button>`).join("") : `<p class="empty">No notes yet — capture one with the mic.</p>`}
      </div>
    </div>`);
  $("#add-note-btn")?.addEventListener("click", () => openAddNote());
  $$("[data-edit-note]").forEach((btn) =>
    btn.addEventListener("click", () => openEditNote(btn.dataset.editNote))
  );
}

function openAddNote(preset = {}) {
  openDialog(noteFormHTML(null, preset));
  wireNoteColors();
  wireEntityForm({
    onSubmit: (data) => {
      state.notes.unshift({
        id: uid(),
        text: data.text || data.title,
        color: data.color || "yellow",
        createdAt: Date.now()
      });
      save();
      closeDialog();
      openNotesPanel();
    }
  });
}

function openEditNote(id) {
  const note = state.notes.find((n) => n.id === id);
  if (!note) return;
  openDialog(noteFormHTML(note));
  wireNoteColors();
  wireEntityForm({
    onSubmit: (data) => {
      Object.assign(note, {
        text: data.text || data.title,
        color: data.color || note.color,
        updatedAt: Date.now()
      });
      save();
      closeDialog();
      openNotesPanel();
    },
    onDelete: () => {
      state.notes = state.notes.filter((n) => n.id !== id);
      save();
      closeDialog();
      openNotesPanel();
    }
  });
}

function wireNoteColors() {
  $$("#color-picks [data-color]").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$("#color-picks [data-color]").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      $("#f-color").value = btn.dataset.color;
    });
  });
}

function openSummary() {
  const week = weekCompletions(state.selected);
  const doneWeek = week.reduce((a, b) => a + b.count, 0);
  const openTasks = state.tasks.filter((t) => !t.done).length;
  const urgent = state.tasks.filter((t) => !t.done && t.tag === "Urgent").length;
  const dayTasks = tasksForDay(state.selected);
  const dayDone = dayTasks.filter((t) => t.done).length;
  const upcomingEvents = [...state.events]
    .filter((e) => e.date >= todayISO())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  openDialog(`
    <div class="dialog-inner">
      <button type="button" class="dialog-close" aria-label="Close">×</button>
      <h2>Summary</h2>
      <p class="dialog-lead">Real numbers from your device — nothing leaves this phone.</p>
      <div class="summary-grid">
        <div class="stat-card"><strong>${doneWeek}</strong><span>done this week</span></div>
        <div class="stat-card"><strong>${openTasks}</strong><span>open tasks</span></div>
        <div class="stat-card"><strong>${urgent}</strong><span>urgent</span></div>
        <div class="stat-card"><strong>${state.notes.length}</strong><span>notes</span></div>
      </div>
      <h2 style="font-size:17px;margin:8px 0 10px">Selected day</h2>
      <p class="dialog-lead">${escapeHTML(formatLongDate(state.selected))} — ${dayDone}/${dayTasks.length} completed.</p>
      <h2 style="font-size:17px;margin:16px 0 10px">Upcoming events</h2>
      ${upcomingEvents.length ? `<ul class="summary-list">${upcomingEvents.map((e) =>
        `<li><strong>${escapeHTML(e.title)}</strong> — ${escapeHTML(formatShortDate(e.date))}${e.time ? ", " + escapeHTML(e.time) : ""}</li>`
      ).join("")}</ul>` : `<p class="empty">No upcoming events.</p>`}
    </div>`);
}

function wireEntityForm({ onSubmit, onDelete }) {
  const form = $("#entity-form");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const data = Object.fromEntries(fd.entries());
    data.title = (data.title || data.text || "").trim();
    data.text = (data.text || data.title || "").trim();
    if (!data.title && !data.text) return;
    onSubmit(data);
  });
  $("#form-delete")?.addEventListener("click", () => {
    if (confirm("Delete this item?")) onDelete?.();
  });
}

function openReview(draft) {
  let current = { ...draft };
  openDialog(reviewSheetHTML(current));

  const syncTypeUI = () => {
    $$("#type-chips .chip").forEach((c) =>
      c.classList.toggle("active", c.dataset.type === current.type)
    );
    const tagRow = $("#tag-row");
    if (tagRow) tagRow.hidden = current.type !== "task";
    const dateRow = $("#date-row");
    if (dateRow) dateRow.hidden = current.type === "note";
  };

  $$("#type-chips .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      current.type = chip.dataset.type;
      syncTypeUI();
    });
  });
  syncTypeUI();

  $("#review-discard")?.addEventListener("click", closeDialog);
  $("#review-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const title = String(fd.get("title") || "").trim();
    if (!title) return;
    const date = String(fd.get("date") || state.selected);
    const time = String(fd.get("time") || "").trim();
    const tag = String(fd.get("tag") || "Today");

    if (current.type === "task") {
      state.tasks.unshift({
        id: uid(), title, date, time, done: false, tag, createdAt: Date.now()
      });
      state.selected = date;
    } else if (current.type === "event") {
      state.events.unshift({
        id: uid(), title, date, time, notes: "", createdAt: Date.now()
      });
    } else {
      state.notes.unshift({
        id: uid(), text: title, color: "yellow", createdAt: Date.now()
      });
    }
    save();
    render();
    closeDialog();
  });
}

/* ---------- Voice ---------- */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let voiceActive = false;
let finalTranscript = "";

function setVoiceUI(show, opts = {}) {
  const overlay = $("#voice-overlay");
  if (show) {
    overlay.hidden = false;
    overlay.classList.remove("hidden", "error");
    $("#voice-status").textContent = opts.status || "LISTENING";
    $("#voice-transcript").textContent = opts.transcript || "Say a task, event, or note…";
    $("#record").classList.add("recording");
  } else {
    overlay.hidden = true;
    overlay.classList.add("hidden");
    $("#record").classList.remove("recording");
  }
}

function stopVoice(process = true) {
  voiceActive = false;
  try { recognition?.stop(); } catch { /* ignore */ }
  $("#record").classList.remove("recording");
  setVoiceUI(false);
  const text = finalTranscript.trim();
  finalTranscript = "";
  if (process && text) {
    const draft = parseUtterance(text, { baseDate: state.selected });
    openReview(draft);
  }
}

function startVoice() {
  if (!SpeechRecognition) {
    setVoiceUI(true, {
      status: "UNAVAILABLE",
      transcript: "Speech recognition isn’t supported here. Type instead — Safari needs HTTPS and mic permission."
    });
    $("#voice-overlay").classList.add("error");
    $("#voice-status").textContent = "FALLBACK";
    return;
  }

  finalTranscript = "";
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  // Prefer device language; also try en + ru by setting lang to browser lang
  const lang = (navigator.language || "en-US").toLowerCase().startsWith("ru") ? "ru-RU" : "en-US";
  recognition.lang = lang;

  recognition.onstart = () => {
    voiceActive = true;
    setVoiceUI(true, { status: "LISTENING", transcript: "Listening…" });
  };
  recognition.onerror = (ev) => {
    const msg = ev.error === "not-allowed"
      ? "Microphone blocked. Allow mic access or type instead."
      : ev.error === "no-speech"
        ? "No speech detected. Try again or type instead."
        : `Speech error: ${ev.error}. You can type instead.`;
    setVoiceUI(true, { status: "ERROR", transcript: msg });
    $("#voice-overlay").classList.add("error");
    voiceActive = false;
    $("#record").classList.remove("recording");
  };
  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const piece = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += piece + " ";
      else interim += piece;
    }
    const shown = (finalTranscript + interim).trim();
    $("#voice-transcript").textContent = shown || "Listening…";
    $("#voice-status").textContent = interim ? "HEARING" : "LISTENING";
  };
  recognition.onend = () => {
    if (voiceActive) {
      // Some browsers end early — restart while user still recording
      try { recognition.start(); } catch { /* ignore */ }
    }
  };

  try {
    recognition.start();
  } catch (err) {
    setVoiceUI(true, {
      status: "ERROR",
      transcript: "Could not start microphone. Type instead."
    });
    $("#voice-overlay").classList.add("error");
  }
}

function toggleVoice() {
  if (voiceActive) {
    stopVoice(true);
  } else {
    startVoice();
  }
}

/* ---------- Onboarding ---------- */

function isOnboarded() {
  return localStorage.getItem(ONBOARD_KEY) === "1";
}

function finishOnboarding() {
  localStorage.setItem(ONBOARD_KEY, "1");
  const el = $("#onboarding");
  el.hidden = true;
  el.classList.add("hidden");
}

function showOnboarding() {
  const root = $("#onboarding");
  root.hidden = false;
  root.classList.remove("hidden");
  let step = 0;
  const slides = $$(".onboard-slide");
  const dots = $("#onboard-dots");
  dots.innerHTML = slides.map((_, i) => `<span class="${i === 0 ? "active" : ""}"></span>`).join("");

  const paint = () => {
    slides.forEach((s, i) => {
      const on = i === step;
      s.hidden = !on;
      s.classList.toggle("hidden", !on);
    });
    $$("#onboard-dots span").forEach((d, i) => d.classList.toggle("active", i === step));
    $("#onboard-next").textContent = step === slides.length - 1 ? "Get started" : "Continue";
  };

  $("#onboard-next").onclick = () => {
    if (step >= slides.length - 1) finishOnboarding();
    else {
      step += 1;
      paint();
    }
  };
  $("#onboard-skip").onclick = finishOnboarding;
  paint();
}

/* ---------- Events ---------- */

document.addEventListener("click", (e) => {
  const day = e.target.closest("[data-day]");
  if (day) {
    state.selected = day.dataset.day;
    save();
    render();
    return;
  }
  const toggle = e.target.closest("[data-toggle]");
  if (toggle) {
    const t = state.tasks.find((x) => x.id === toggle.dataset.toggle);
    if (t) {
      t.done = !t.done;
      save();
      render();
    }
    return;
  }
  const editTask = e.target.closest("[data-edit-task]");
  if (editTask) {
    openEditTask(editTask.dataset.editTask);
    return;
  }
  const delTask = e.target.closest("[data-delete-task]");
  if (delTask) {
    e.stopPropagation();
    if (confirm("Delete this task?")) {
      state.tasks = state.tasks.filter((t) => t.id !== delTask.dataset.deleteTask);
      save();
      render();
    }
    return;
  }
  const panel = e.target.closest("[data-panel]");
  if (panel) {
    const kind = panel.dataset.panel;
    if (kind === "events") openEventsPanel();
    else if (kind === "notes") openNotesPanel();
    else if (kind === "summary") openSummary();
  }
});

$("#open-add").onclick = () => openAddTask();
$("#open-add-nav").onclick = () => openAddTask();
$("#record").onclick = () => toggleVoice();
$("#voice-cancel").onclick = () => stopVoice(false);
$("#voice-stop").onclick = () => stopVoice(true);
$("#voice-type-fallback").onclick = () => {
  stopVoice(false);
  openAddTask();
};

$("#previous-week").onclick = () => {
  state.selected = addDaysISO(state.selected, -7);
  save();
  render();
};
$("#next-week").onclick = () => {
  state.selected = addDaysISO(state.selected, 7);
  save();
  render();
};
$("#choose-date").onclick = () => {
  const input = document.createElement("input");
  input.type = "date";
  input.value = state.selected;
  input.onchange = () => {
    if (input.value) {
      state.selected = input.value;
      save();
      render();
    }
  };
  input.showPicker?.();
  input.click();
};

$("#dialog").addEventListener("click", (e) => {
  if (e.target === $("#dialog")) closeDialog();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js").catch(() => {});
}

if (!isOnboarded()) showOnboarding();
render();
