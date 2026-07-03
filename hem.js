let currentDate = new Date();
let selectedDateKey = null;
let openedReflectionIndex = null;
let editingEventIndex = null;

let events = JSON.parse(localStorage.getItem("eventsV7")) || {};

let memory = JSON.parse(localStorage.getItem("memory")) || {
  people: [],
  reminders: [],
  habits: [],
  projects: [],
  important: [],
  reflections: [],
  completedToday: []
};

if (!memory.reflections) memory.reflections = [];

let settings = JSON.parse(localStorage.getItem("settings")) || {
  city: "Stockholm",
  style: "Professionell"
};

const monthNames = [
  "Januari", "Februari", "Mars", "April", "Maj", "Juni",
  "Juli", "Augusti", "September", "Oktober", "November", "December"
];

const dayNames = [
  "Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"
];

function init() {
  updateHeader();
  applySettings();
  renderCalendar();
  renderReflections();
  refreshAll();
}

function updateHeader() {
  const now = new Date();
  const hour = now.getHours();

  let greeting = "God dag";
  if (hour < 10) greeting = "God morgon";
  else if (hour >= 18) greeting = "God kväll";

  document.getElementById("greeting").textContent = greeting;

  document.getElementById("dateText").textContent =
    dayNames[now.getDay()] + " " + now.getDate() + " " + monthNames[now.getMonth()] + " " + now.getFullYear();
}

function renderDailySummary() {
  const todayEvents = getTodayEvents();
  const next = getNextEventToday();

  if (todayEvents.length === 0) {
    document.getElementById("dailySummary").textContent = "Du har inget planerat idag.";
    return;
  }

  if (next) {
    document.getElementById("dailySummary").textContent =
      "Du har " + todayEvents.length + " saker planerade idag. Nästa är " + next.title + " klockan " + next.time + ".";
  } else {
    document.getElementById("dailySummary").textContent =
      "Du har " + todayEvents.length + " saker planerade idag.";
  }
}

function renderFocusCard() {
  const card = document.getElementById("focusCard");
  if (!card) return;

  const todayEvents = sortEvents(getTodayEvents());
  const hour = new Date().getHours();

  if (hour >= 20) {
    card.innerHTML = `
      <div class="evening-invitation">
        <h3>🌙 God kväll</h3>
        <p>Dagen börjar gå mot sitt slut.</p>
        <p>Hur har den varit?</p>
        <button onclick="openEveningMode()">Öppna kvällsreflektion</button>
      </div>
    `;
    return;
  }

  if (!todayEvents.length) {
    card.innerHTML = `
      <div class="focus-title">Dagens fokus</div>
      <div>Du har inget planerat idag.</div>
    `;
    return;
  }

  const next = getNextEventToday();

  if (next) {
    card.innerHTML = `
      <div class="focus-title">Dagens fokus</div>
      <div>
        Nästa aktivitet:
        <strong>${next.title}</strong>
        kl ${next.time}
      </div>
    `;
  } else {
    card.innerHTML = `
      <div class="focus-title">Dagens fokus</div>
      <div>Du har genomfört dagens planerade aktiviteter.</div>
    `;
  }
}

function renderToday() {
  const todayEvents = sortEvents(getTodayEvents());
  const list = document.getElementById("todayList");

  if (todayEvents.length === 0) {
    list.innerHTML = `
      <div class="item">
        <div class="item-title">Inget planerat idag</div>
        <div class="muted">Du har en lugn dag just nu.</div>
      </div>
    `;
    return;
  }

  list.innerHTML = todayEvents.map(event => `
    <div class="item">
      <span class="time">${event.time}</span>${event.title}
      <div class="muted">${formatDuration(event.duration)}</div>
    </div>
  `).join("");
}

function renderGoodToKnow() {
  const items = buildGoodToKnowItems().slice(0, 3);
  const list = document.getElementById("goodToKnowList");

  if (items.length === 0) {
    list.innerHTML = `
      <div class="item">
        <div class="item-title">Inget särskilt just nu</div>
        <div class="muted">Jag visar bara sådant som är värt din uppmärksamhet.</div>
      </div>
    `;
    return;
  }

  list.innerHTML = items.map(item => `
    <div class="item">
      <div class="item-title">${item.title}</div>
      <div class="muted">${item.text}</div>
      ${item.action ? `
        <div class="actions">
          <button class="action" onclick="${item.action}">${item.actionLabel}</button>
        </div>
      ` : ""}
    </div>
  `).join("");
}

function buildGoodToKnowItems() {
  const items = [];
  const today = new Date();

  memory.people.forEach(person => {
    if (!person.birthday) return;

    const nextBirthday = getNextBirthdayDate(person.birthday);
    const days = daysBetween(today, nextBirthday);

    if (days === 0 && !isCompletedToday("birthday:" + person.name)) {
      items.push({
        priority: 1,
        title: person.name + " fyller år idag",
        text: "Har du hunnit gratulera?",
        action: `markCompletedToday('birthday:${person.name}')`,
        actionLabel: "Gratulerat"
      });
    } else if (days > 0 && days <= 7) {
      items.push({
        priority: 2,
        title: person.name + " fyller år snart",
        text: "Om " + days + " dagar.",
        action: null
      });
    }
  });

  memory.reminders.forEach((reminder, index) => {
    if (reminder.completed) return;

    items.push({
      priority: 3,
      title: "Kom ihåg",
      text: reminder.text,
      action: `completeReminder(${index})`,
      actionLabel: "Klart"
    });
  });

  return items.sort((a, b) => a.priority - b.priority);
}

function renderCalendar() {
  const grid = document.getElementById("calendarGrid");
  const title = document.getElementById("monthTitle");

  grid.innerHTML = "";

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  title.textContent = monthNames[month] + " " + year;

  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay();
  if (startDay === 0) startDay = 7;

  const startDate = new Date(year, month, 1 - (startDay - 1));

  for (let i = 0; i < 42; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    const dateKey = formatDate(date);
    const day = document.createElement("div");
    day.className = "day";

    if (date.getMonth() !== month) day.classList.add("other-month");
    if (dateKey === formatDate(new Date())) day.classList.add("today");

    day.onclick = function(event) {
      event.stopPropagation();
      openDayPanel(dateKey);
    };

    const dayEvents = events[dateKey] || [];
    const dots = dayEvents.slice(0, 4).map(() => `<span class="dot"></span>`).join("");

    day.innerHTML = `
      <div class="day-number">${date.getDate()}</div>
      <div class="dots">${dots}</div>
    `;

    grid.appendChild(day);
  }

  refreshAll();
}

function sendMessage() {
  const input = document.getElementById("userInput");
  const text = input.value.trim();
  if (!text) return;

  document.getElementById("chat").classList.add("show");

  addMessage(text, "user");
  input.value = "";

  const response = handleAssistant(text);
  addMessage(response, "ai");
}

function handleAssistant(text) {
  const lower = text.toLowerCase();

  if (isCalendarIntent(lower)) {
    const eventData = parseCalendarEvent(text);

    if (!eventData.date) return "Skriv gärna vilket datum eller dag.";
    if (!eventData.time) return "Skriv gärna vilken tid.";

    const conflict = findConflict(eventData.dateKey, eventData);

    if (conflict) {
      return "Det krockar med " + conflict.title + " " + conflict.time + "–" + addMinutes(conflict.time, conflict.duration) + ". Vill du välja en annan tid?";
    }

    addEventObject(eventData.dateKey, {
      title: eventData.title,
      time: eventData.time,
      duration: eventData.duration
    });

    currentDate = new Date(eventData.date);
    renderCalendar();

    return "Klart. Jag lade in " + eventData.title + " den " + eventData.dateKey + " klockan " + eventData.time + ".";
  }

  if (isBirthdayIntent(lower)) {
    const saved = savePersonBirthday(text);
    if (saved) return "Jag har sparat födelsedagen.";
    return "Jag kan spara det, men skriv gärna så här: Mamma fyller år 4 maj.";
  }

  if (isReminderIntent(lower)) {
    saveReminder(text);
    return "Jag har sparat det som något att komma ihåg.";
  }

  if (lower.includes("vad har jag idag")) {
    refreshAll();
    return "Jag har uppdaterat dagens översikt.";
  }

  saveImportant(text);
  return "Jag har sparat det som något viktigt att komma ihåg.";
}

function saveReflection() {
  const input = document.getElementById("reflectionInput");
  const text = input.value.trim();

  if (!text) return;

  memory.reflections.unshift({
    date: formatDate(new Date()),
    text,
    createdAt: new Date().toISOString()
  });

  input.value = "";
  saveMemory();
  renderReflections();
}

function renderReflections() {
  const list = document.getElementById("reflectionList");

  if (!memory.reflections.length) {
    list.innerHTML = `
      <div class="item">
        <div class="item-title">Inga reflektioner ännu</div>
        <div class="muted">När du sparar en reflektion visas datumet här.</div>
      </div>
    `;
    return;
  }

  list.innerHTML = memory.reflections.slice(0, 20).map((entry, index) => `
    <div class="item reflection-date-card" onclick="openReflectionReader(${index})">
      <div>
        <div class="item-title">📖 ${formatReadableDate(entry.date)}</div>
        <div class="muted">Öppna reflektion</div>
      </div>
      <strong>→</strong>
    </div>
  `).join("");
}

function openReflectionReader(index) {
  openedReflectionIndex = index;
  const entry = memory.reflections[index];

  if (!entry) return;

  document.getElementById("reflectionReaderDate").textContent = formatReadableDate(entry.date);
  document.getElementById("reflectionReaderText").textContent = entry.text;

  document.getElementById("reflectionReader").classList.add("show");
}

function closeReflectionReader() {
  document.getElementById("reflectionReader").classList.remove("show");
  openedReflectionIndex = null;
}

function deleteOpenedReflection() {
  if (openedReflectionIndex === null) return;

  memory.reflections.splice(openedReflectionIndex, 1);
  openedReflectionIndex = null;

  saveMemory();
  renderReflections();
  closeReflectionReader();
}

function isCalendarIntent(text) {
  return (
    text.includes("lägg in") ||
    text.includes("boka") ||
    text.includes("planera") ||
    text.includes("jag vill")
  ) && hasDateOrDay(text);
}

function hasDateOrDay(text) {
  return (
    text.includes("idag") ||
    text.includes("imorgon") ||
    /\d{1,2}\s*(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)/i.test(text) ||
    /måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag/i.test(text)
  );
}

function parseCalendarEvent(text) {
  const date = findDateInText(text);
  const time = extractTime(text);
  const duration = extractDuration(text) || 60;

  let title = text
    .replace(/lägg in/ig, "")
    .replace(/boka/ig, "")
    .replace(/planera/ig, "")
    .replace(/jag vill/ig, "")
    .replace(/idag/ig, "")
    .replace(/imorgon/ig, "")
    .replace(/\d{1,2}\s*(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)/ig, "")
    .replace(/kl\s*\d{1,2}([:.]\d{2})?/ig, "")
    .replace(/i\s*\d+\s*(minuter|min|timmar|h)/ig, "")
    .trim();

  if (!title) title = "Händelse";

  return {
    title: capitalize(title),
    date,
    dateKey: date ? formatDate(date) : null,
    time,
    duration
  };
}

function findConflict(dateKey, newEvent, ignoreIndex = null) {
  const dayEvents = events[dateKey] || [];
  const newStart = timeToMinutes(newEvent.time);
  const newEnd = newStart + newEvent.duration;

  return dayEvents.find((existing, index) => {
    if (ignoreIndex !== null && index === ignoreIndex) return false;

    const existingStart = timeToMinutes(existing.time);
    const existingEnd = existingStart + existing.duration;

    return newStart < existingEnd && newEnd > existingStart;
  });
}

function addEventObject(dateKey, eventObject) {
  if (!events[dateKey]) events[dateKey] = [];
  events[dateKey].push(eventObject);
  events[dateKey] = sortEvents(events[dateKey]);
  saveEvents();
}

function saveEvents() {
  localStorage.setItem("eventsV7", JSON.stringify(events));
  refreshAll();
}

function openDayPanel(dateKey) {
  selectedDateKey = dateKey;
  closeAllPopups();
  document.getElementById("dayPanel").classList.add("show", "fullscreen");
  document.getElementById("overlay").classList.add("show");
  renderDayPanel();
}

function renderDayPanel() {
  const date = parseDateKey(selectedDateKey);
  const dayEvents = sortEvents(events[selectedDateKey] || []);

  document.getElementById("selectedDayTitle").textContent =
    dayNames[date.getDay()] + " " + date.getDate() + " " + monthNames[date.getMonth()];

  document.getElementById("selectedDaySummary").textContent =
    dayEvents.length === 0 ? "Inget planerat." : dayEvents.length + " saker planerade.";

  const container = document.getElementById("selectedDayEvents");

  if (dayEvents.length === 0) {
    container.innerHTML = `
      <div class="item">
        <div class="item-title">Inget bokat</div>
        <div class="muted">Du kan lägga till något nedanför.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = dayEvents.map((event, index) => `
    <div class="calendar-event">
      <div>
        <div>
          <span class="event-time">${event.time}–${addMinutes(event.time, event.duration)}</span>
          <strong>${escapeHtml(event.title)}</strong>
        </div>

        <div class="muted">${formatDuration(event.duration)}</div>

        ${event.note ? `
          <div class="event-note">
            <strong>Anteckning:</strong><br>
            ${escapeHtml(event.note)}
          </div>
        ` : ""}
      </div>

      <div class="actions">
        <button class="action" onclick="editEvent('${selectedDateKey}', ${index})">Redigera</button>
        <button class="action danger" onclick="deleteEvent('${selectedDateKey}', ${index})">Ta bort</button>
      </div>
    </div>
  `).join("");
}

function addEventFromDayPanel() {
  const titleInput = document.getElementById("newEventTitle");
  const timeInput = document.getElementById("newEventTime");
  const durationInput = document.getElementById("newEventDuration");
  const noteInput = document.getElementById("newEventNote");

  const title = titleInput.value.trim();
  const time = normalizeTime(timeInput.value.trim());
  const duration = parseInt(durationInput.value.trim()) || 60;
  const note = noteInput.value.trim();

  if (!title || !time) {
    alert("Fyll i både vad och tid.");
    return;
  }

  const newEvent = { title, time, duration, note };
  const conflict = findConflict(selectedDateKey, newEvent, editingEventIndex);

  if (conflict) {
    alert("Det krockar med " + conflict.title + " " + conflict.time + "–" + addMinutes(conflict.time, conflict.duration) + ".");
    return;
  }

  if (editingEventIndex !== null) {
    events[selectedDateKey][editingEventIndex] = newEvent;
  } else {
    if (!events[selectedDateKey]) events[selectedDateKey] = [];
    events[selectedDateKey].push(newEvent);
  }

  events[selectedDateKey] = sortEvents(events[selectedDateKey]);
  saveEvents();

  resetEventForm();
  renderCalendar();
  renderDayPanel();

  function editEvent(dateKey, index) {
  const event = events[dateKey][index];

  editingEventIndex = index;

  document.getElementById("eventFormTitle").textContent = "Redigera händelse";
  document.getElementById("saveEventButton").textContent = "Spara ändringar";

  document.getElementById("newEventTitle").value = event.title || "";
  document.getElementById("newEventTime").value = event.time || "";
  document.getElementById("newEventDuration").value = event.duration || 60;
  document.getElementById("newEventNote").value = event.note || "";
}

function resetEventForm() {
  editingEventIndex = null;

  document.getElementById("eventFormTitle").textContent = "Lägg till";
  document.getElementById("saveEventButton").textContent = "Spara händelse";

  document.getElementById("newEventTitle").value = "";
  document.getElementById("newEventTime").value = "";
  document.getElementById("newEventDuration").value = "";
  document.getElementById("newEventNote").value = "";
}
}

function deleteEvent(dateKey, index) {
  events[dateKey].splice(index, 1);
  if (events[dateKey].length === 0) delete events[dateKey];
  saveEvents();
  renderCalendar();
  renderDayPanel();
}

function extractTime(text) {
  const match = text.match(/kl\s*(\d{1,2})([:.](\d{2}))?/i);
  if (!match) return null;
  return match[1].padStart(2, "0") + ":" + (match[3] || "00");
}

function extractDuration(text) {
  const match = text.match(/i\s*(\d+)\s*(minuter|min|timmar|h)/i);
  if (!match) return null;
  const amount = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  return unit.includes("tim") || unit === "h" ? amount * 60 : amount;
}

function normalizeTime(value) {
  const match = value.match(/^(\d{1,2})([:.](\d{2}))?$/);
  if (!match) return null;
  return match[1].padStart(2, "0") + ":" + (match[3] || "00");
}

function timeToMinutes(time) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function addMinutes(time, minutes) {
  const total = timeToMinutes(time) + minutes;
  return String(Math.floor(total / 60)).padStart(2, "0") + ":" + String(total % 60).padStart(2, "0");
}

function sortEvents(list) {
  return [...list].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
}

function formatDuration(minutes) {
  if (minutes === 60) return "1 timme";
  if (minutes < 60) return minutes + " minuter";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? hours + " timmar" : hours + " timmar " + rest + " minuter";
}

function getTodayEvents() {
  return events[formatDate(new Date())] || [];
}

function getNextEventToday() {
  const now = new Date();

  return sortEvents(getTodayEvents())
    .map(event => {
      const [hour, minute] = event.time.split(":").map(Number);
      const date = new Date();
      date.setHours(hour, minute, 0, 0);
      return { ...event, date };
    })
    .filter(event => event.date >= now)[0] || null;
}

function isBirthdayIntent(text) {
  return text.includes("fyller år");
}

function isReminderIntent(text) {
  return text.includes("kom ihåg") || text.includes("påminn mig") || text.includes("måste komma ihåg");
}

function savePersonBirthday(text) {
  const monthWords = monthNames.map(m => m.toLowerCase()).join("|");
  const regex = new RegExp("(.+?)\\s+fyller år\\s+(\\d{1,2})\\s*(" + monthWords + ")", "i");
  const match = text.match(regex);
  if (!match) return false;

  const name = cleanPersonName(match[1]);
  const day = parseInt(match[2]);
  const month = monthNames.map(m => m.toLowerCase()).indexOf(match[3].toLowerCase()) + 1;

  memory.people.push({ name, birthday: { day, month } });
  saveMemory();
  return true;
}

function saveReminder(text) {
  const cleaned = text
    .replace(/kom ihåg att/ig, "")
    .replace(/kom ihåg/ig, "")
    .replace(/påminn mig att/ig, "")
    .replace(/påminn mig om att/ig, "")
    .trim();

  memory.reminders.push({
    text: capitalize(cleaned || text),
    completed: false,
    createdAt: new Date().toISOString()
  });

  saveMemory();
}

function saveImportant(text) {
  memory.important.push({ text, createdAt: new Date().toISOString() });
  saveMemory();
}

function saveMemory() {
  localStorage.setItem("memory", JSON.stringify(memory));
  refreshAll();
}

function completeReminder(index) {
  memory.reminders[index].completed = true;
  saveMemory();
}

function markCompletedToday(key) {
  if (!memory.completedToday.includes(todayCompletionKey(key))) {
    memory.completedToday.push(todayCompletionKey(key));
  }
  saveMemory();
}

function isCompletedToday(key) {
  return memory.completedToday.includes(todayCompletionKey(key));
}

function todayCompletionKey(key) {
  return formatDate(new Date()) + ":" + key;
}

function getNextBirthdayDate(birthday) {
  const today = new Date();
  let date = new Date(today.getFullYear(), birthday.month - 1, birthday.day);
  if (date < startOfDay(today)) date = new Date(today.getFullYear() + 1, birthday.month - 1, birthday.day);
  return date;
}

function daysBetween(a, b) {
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.round((startOfDay(b) - startOfDay(a)) / oneDay);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function findDateInText(text) {
  const today = new Date();

  let match = text.match(/(\d{1,2})\s*(januari|februari|mars|april|maj|juni|juli|augusti|september|oktober|november|december)/i);

  if (match) {
    const day = parseInt(match[1]);
    const month = monthNames.map(m => m.toLowerCase()).indexOf(match[2].toLowerCase());
    return new Date(today.getFullYear(), month, day);
  }

  if (text.includes("idag")) return today;

  if (text.includes("imorgon")) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }

  const weekdays = {
    "måndag": 1,
    "tisdag": 2,
    "onsdag": 3,
    "torsdag": 4,
    "fredag": 5,
    "lördag": 6,
    "söndag": 0
  };

  for (const day in weekdays) {
    if (text.includes(day)) {
      const target = weekdays[day];
      const date = new Date();
      const diff = (target + 7 - date.getDay()) % 7 || 7;
      date.setDate(date.getDate() + diff);
      return date;
    }
  }

  return null;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatReadableDate(dateKey) {
  const date = parseDateKey(dateKey);
  return date.getDate() + " " + monthNames[date.getMonth()] + " " + date.getFullYear();
}

function parseDateKey(dateKey) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function openCalendar() {
  closeAllPopups();
  document.getElementById("calendarCard").classList.add("fullscreen");
  document.getElementById("overlay").classList.add("show");
  document.getElementById("closeBtn").style.display = "inline-block";
}

function openWeather() {
  closeAllPopups();
  document.getElementById("weatherCard").classList.add("fullscreen");
  document.getElementById("overlay").classList.add("show");
  document.getElementById("forecast").style.display = "grid";
  document.getElementById("weatherCloseBtn").style.display = "inline-block";
}

function openSettings() {
  closeAllPopups();
  document.getElementById("settingsCard").classList.add("show", "fullscreen");
  document.getElementById("overlay").classList.add("show");
  document.getElementById("cityInput").value = settings.city;
  document.getElementById("styleInput").value = settings.style;
}

function openMemory() {
  closeAllPopups();
  renderMemoryView();
  document.getElementById("memoryCard").classList.add("show", "fullscreen");
  document.getElementById("overlay").classList.add("show");
}

function closeAllPopups() {
  document.getElementById("calendarCard").classList.remove("fullscreen");
  document.getElementById("weatherCard").classList.remove("fullscreen");
  document.getElementById("settingsCard").classList.remove("show", "fullscreen");
  document.getElementById("memoryCard").classList.remove("show", "fullscreen");
  document.getElementById("dayPanel").classList.remove("show", "fullscreen");
  document.getElementById("overlay").classList.remove("show");

  document.getElementById("closeBtn").style.display = "none";
  document.getElementById("weatherCloseBtn").style.display = "none";
  document.getElementById("forecast").style.display = "none";
}

function saveSettings() {
  settings.city = document.getElementById("cityInput").value || "Stockholm";
  settings.style = document.getElementById("styleInput").value;
  localStorage.setItem("settings", JSON.stringify(settings));
  applySettings();
  closeAllPopups();
}

function applySettings() {
  document.getElementById("weatherCity").textContent = settings.city;
}

function renderMemoryView() {
  const view = document.getElementById("memoryView");

  view.innerHTML = `
    <div class="memory-section">
      <h2>Personer</h2>
      ${memory.people.length ? memory.people.map((person, index) => `
        <div class="memory-item">
          <div>
            <div class="item-title">${person.name}</div>
            <div class="muted">
              ${person.birthday ? "Fyller år " + person.birthday.day + "/" + person.birthday.month : ""}
            </div>
          </div>
          <button class="action danger" onclick="deleteMemoryItem('people', ${index})">Ta bort</button>
        </div>
      `).join("") : `<div class="item muted">Inget sparat</div>`}
    </div>

    <div class="memory-section">
      <h2>Påminnelser</h2>
      ${memory.reminders.length ? memory.reminders.map((reminder, index) => `
        <div class="memory-item">
          <div>
            <div class="item-title">${reminder.completed ? "✓ " : ""}${reminder.text}</div>
          </div>
          <button class="action danger" onclick="deleteMemoryItem('reminders', ${index})">Ta bort</button>
        </div>
      `).join("") : `<div class="item muted">Inget sparat</div>`}
    </div>

    <div class="memory-section">
      <h2>Viktigt</h2>
      ${memory.important.length ? memory.important.map((item, index) => `
        <div class="memory-item">
          <div>
            <div class="item-title">${item.text}</div>
          </div>
          <button class="action danger" onclick="deleteMemoryItem('important', ${index})">Ta bort</button>
        </div>
      `).join("") : `<div class="item muted">Inget sparat</div>`}
    </div>

    <div class="memory-section">
      <h2>Reflektioner</h2>
      ${memory.reflections.length ? memory.reflections.map((reflection, index) => `
        <div class="memory-item">
          <div>
            <div class="item-title">${formatReadableDate(reflection.date)}</div>
            <div class="muted">Sparad reflektion</div>
          </div>
          <button class="action danger" onclick="deleteMemoryItem('reflections', ${index})">Ta bort</button>
        </div>
      `).join("") : `<div class="item muted">Inget sparat</div>`}
    </div>
  `;
}

function deleteMemoryItem(type, index) {
  if (!memory[type]) return;

  const confirmDelete = confirm("Vill du ta bort detta minne?");
  if (!confirmDelete) return;

  memory[type].splice(index, 1);

  saveMemory();
  renderMemoryView();
  renderReflections();
}

function clearMemory() {
  if (!confirm("Vill du rensa minnesbanken?")) return;

  memory = {
    people: [],
    reminders: [],
    habits: [],
    projects: [],
    important: [],
    reflections: [],
    completedToday: []
  };

  localStorage.setItem("memory", JSON.stringify(memory));
  renderMemoryView();
  renderReflections();
  refreshAll();
}

function addDemoData() {
  const todayKey = formatDate(new Date());
  const august13 = new Date(new Date().getFullYear(), 7, 13);
  const august13Key = formatDate(august13);

  events[todayKey] = [
    { title: "Tandläkare", time: "13:00", duration: 60 },
    { title: "Gym", time: "18:00", duration: 60 }
  ];

  events[august13Key] = [
    { title: "Tandläkare", time: "15:00", duration: 60 }
  ];

  memory.people = [
    { name: "Mamma", birthday: { day: new Date().getDate(), month: new Date().getMonth() + 1 } }
  ];

  memory.reminders = [
    { text: "Boka tid för passförnyelse", completed: false, createdAt: new Date().toISOString() }
  ];

  if (!memory.reflections) memory.reflections = [];

  localStorage.setItem("eventsV7", JSON.stringify(events));
  saveMemory();
  renderCalendar();
  renderReflections();
  closeAllPopups();
}

function previousMonth() {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderCalendar();
}

function nextMonth() {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderCalendar();
}

function goToday() {
  currentDate = new Date();
  renderCalendar();
}

function refreshAll() {
  renderToday();
  renderGoodToKnow();
  renderDailySummary();
  renderFocusCard();
}

function renderEveningQuestion() {
  const question = document.getElementById("eveningQuestion");
  if (!question) return;

  const questions = [
    "Vad gjorde dig glad idag?",
    "Vad vill du ta med dig från dagen?",
    "Vad vill du släppa innan du går och lägger dig?",
    "Vad gick bättre än du trodde?",
    "Vad vill du komma ihåg från idag?",
    "Vad hade du behövt mer av idag?",
    "Vad känns viktigast att få ur huvudet just nu?"
  ];

  const today = new Date();
  const index = today.getDate() % questions.length;

  question.textContent = questions[index];
}

function openEveningMode() {
  document.getElementById("eveningMode").classList.add("show");
  document.body.style.overflow = "hidden";
  renderEveningQuestion();
  renderReflections();
}

function closeEveningMode() {
  document.getElementById("eveningMode").classList.remove("show");
  document.body.style.overflow = "";
}

function comingSoon(type) {
  alert(type + " kommer senare. Just nu kan du skriva din reflektion.");
}

function cleanPersonName(text) {
  return text
    .replace(/min|mitt|mina|mammas|pappas/gi, "")
    .trim()
    .replace(/^./, c => c.toUpperCase());
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function addMessage(text, sender) {
  const chat = document.getElementById("chat");
  const message = document.createElement("div");
  message.className = "message " + sender;
  message.innerHTML = text;
  chat.appendChild(message);
  chat.scrollTop = chat.scrollHeight;
}

document.getElementById("userInput").addEventListener("keydown", function(event) {
  if (event.key === "Enter") sendMessage();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js");
}

function editEvent(dateKey, index) {
  const event = events[dateKey][index];

  if (!event) return;

  editingEventIndex = index;

  document.getElementById("eventFormTitle").textContent = "Redigera händelse";
  document.getElementById("saveEventButton").textContent = "Spara ändringar";

  document.getElementById("newEventTitle").value = event.title || "";
  document.getElementById("newEventTime").value = event.time || "";
  document.getElementById("newEventDuration").value = event.duration || 60;
  document.getElementById("newEventNote").value = event.note || "";
}

function resetEventForm() {
  editingEventIndex = null;

  document.getElementById("eventFormTitle").textContent = "Lägg till";
  document.getElementById("saveEventButton").textContent = "Spara händelse";

  document.getElementById("newEventTitle").value = "";
  document.getElementById("newEventTime").value = "";
  document.getElementById("newEventDuration").value = "";
  document.getElementById("newEventNote").value = "";
}

init();