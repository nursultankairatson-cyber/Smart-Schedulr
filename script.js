const STORAGE_KEY = "googleStyleSchedule_v3";

const DAYS_RU = [
  "Воскресенье",
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота"
];

const DAY_ORDER = {
  "Понедельник": 1,
  "Вторник": 2,
  "Среда": 3,
  "Четверг": 4,
  "Пятница": 5
};

function getTodayName() {
  return DAYS_RU[new Date().getDay()];
}

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function createEmptyState() {
  return {
    lessons: [],
    exams: []
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyState();
    const parsed = JSON.parse(raw);
    return {
      lessons: Array.isArray(parsed.lessons) ? parsed.lessons : [],
      exams: Array.isArray(parsed.exams) ? parsed.exams : []
    };
  } catch {
    return createEmptyState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();
let activeDayChip = "ALL";

const groupSelect = document.getElementById("groupSelect");
const liveChip = document.getElementById("liveChip");
const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearchBtn");
const dayChips = document.getElementById("dayChips");
const scheduleHeading = document.getElementById("scheduleHeading");
const scheduleList = document.getElementById("scheduleList");

const addExamForm = document.getElementById("addExamForm");
const examList = document.getElementById("examList");

const modalBackdrop = document.getElementById("addModalBackdrop");
const openAddModalBtn = document.getElementById("openAddModalBtn");
const closeModalBtn = document.getElementById("closeModalBtn");
const cancelModalBtn = document.getElementById("cancelModalBtn");
const addLessonForm = document.getElementById("addLessonForm");
const formAlert = document.getElementById("formAlert");

function escapeHtml(text) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function findConflict(candidate) {
  const startA = timeToMinutes(candidate.start);
  const endA = timeToMinutes(candidate.end);

  if (endA <= startA) {
    return "Время окончания должно быть позже начала.";
  }

  for (const lesson of state.lessons) {
    if (lesson.day !== candidate.day) continue;

    const startB = timeToMinutes(lesson.start);
    const endB = timeToMinutes(lesson.end);
    const overlaps = startA < endB && endA > startB;

    if (!overlaps) continue;

    if (lesson.group === candidate.group) {
      return `Конфликт у группы ${candidate.group}: в это время уже идёт ${lesson.title} (${lesson.start}–${lesson.end}).`;
    }

    if (lesson.room.trim().toLowerCase() === candidate.room.trim().toLowerCase()) {
      return `Кабинет ${candidate.room} занят группой ${lesson.group} (${lesson.start}–${lesson.end}).`;
    }
  }

  return null;
}

function getLiveStatus(groupLessons) {
  const now = new Date();
  const today = getTodayName();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const todayList = groupLessons
    .filter((l) => l.day === today)
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));

  let current = null;
  let next = null;

  for (const item of todayList) {
    const s = timeToMinutes(item.start);
    const e = timeToMinutes(item.end);
    if (nowMin >= s && nowMin < e) {
      current = item;
    } else if (!next && s > nowMin) {
      next = item;
    }
  }

  return { today, current, next };
}

function renderLessons() {
  const group = groupSelect.value;
  const query = searchInput.value.trim().toLowerCase();
  clearSearchBtn.classList.toggle("hidden", query.length === 0);

  const groupLessons = state.lessons.filter((l) => l.group === group);
  const { today, current, next } = getLiveStatus(groupLessons);

  if (current) {
    liveChip.textContent = `Сейчас: ${current.title} · ${current.room}`;
    liveChip.classList.add("is-live");
  } else if (next) {
    liveChip.textContent = `Далее в ${next.start}: ${next.title}`;
    liveChip.classList.remove("is-live");
  } else {
    liveChip.textContent = `${today} · пар нет`;
    liveChip.classList.remove("is-live");
  }

  const isWeekend = today === "Суббота" || today === "Воскресенье";
  const targetDay = activeDayChip === "TODAY" ? today : activeDayChip;

  scheduleHeading.textContent =
    activeDayChip === "TODAY" ? `Занятия · Сегодня (${today})` : "Занятия";

  if (activeDayChip === "TODAY" && isWeekend) {
    scheduleList.innerHTML = `<div class="g-surface"><p class="g-lesson-meta">Сегодня выходной — занятий нет.</p></div>`;
    return;
  }

  const visible = groupLessons
    .filter((l) => {
      if (targetDay !== "ALL" && l.day !== targetDay) return false;
      if (!query) return true;
      return (
        l.title.toLowerCase().includes(query) ||
        l.teacher.toLowerCase().includes(query) ||
        l.room.toLowerCase().includes(query) ||
        l.day.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      const diff = (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99);
      return diff !== 0 ? diff : timeToMinutes(a.start) - timeToMinutes(b.start);
    });

  if (visible.length === 0) {
    const emptyText =
      groupLessons.length === 0
        ? "Расписание пустое. Нажмите «+ Добавить пару», чтобы внести занятия."
        : "Ничего не найдено по текущему фильтру.";
    scheduleList.innerHTML = `<div class="g-surface"><p class="g-lesson-meta">${emptyText}</p></div>`;
    return;
  }

  scheduleList.innerHTML = visible
    .map((item) => {
      const isNow = current && current.id === item.id;
      const isNext = !isNow && next && next.id === item.id;
      const cardClass = isNow ? "is-now" : isNext ? "is-next" : "";
      const tag = isNow
        ? `<span class="g-tag g-tag-now">Идёт сейчас</span>`
        : isNext
        ? `<span class="g-tag g-tag-next">Следующая</span>`
        : "";

      return `
        <article class="g-lesson-card ${cardClass}">
          <div>
            <div class="g-time-row">${item.day} · ${item.start}–${item.end} · ${escapeHtml(item.room)}</div>
            <div class="g-lesson-title">${escapeHtml(item.title)}</div>
            <div class="g-lesson-meta">${escapeHtml(item.teacher)}</div>
          </div>
          <div class="g-card-right">
            ${tag}
            <button type="button" class="g-icon-btn" title="Удалить" onclick="removeLesson(${item.id})">✕</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderExams() {
  const group = groupSelect.value;
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);

  const list = state.exams
    .filter((e) => e.group === group)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (list.length === 0) {
    examList.innerHTML = `<li class="g-exam-date">Список экзаменов пуст.</li>`;
    return;
  }

  examList.innerHTML = list
    .map((exam) => {
      const target = new Date(`${exam.date}T00:00:00`);
      const days = Math.round((target - midnight) / (1000 * 60 * 60 * 24));

      let badgeText = `${days} дн.`;
      let badgeClass = "g-tag-ok";

      if (days < 0) {
        badgeText = "Завершён";
      } else if (days === 0) {
        badgeText = "Сегодня";
        badgeClass = "g-tag-urgent";
      } else if (days <= 3) {
        badgeText = `Через ${days} дн.`;
        badgeClass = "g-tag-urgent";
      } else if (days <= 7) {
        badgeText = `Через ${days} дн.`;
        badgeClass = "g-tag-soon";
      } else {
        badgeText = `Через ${days} дн.`;
      }

      return `
        <li class="g-exam-row">
          <div>
            <div class="g-exam-title">${escapeHtml(exam.title)}</div>
            <div class="g-exam-date">${exam.date}</div>
          </div>
          <div class="g-card-right">
            <span class="g-tag ${badgeClass}">${badgeText}</span>
            <button type="button" class="g-icon-btn" title="Удалить" onclick="removeExam(${exam.id})">✕</button>
          </div>
        </li>
      `;
    })
    .join("");
}

function render() {
  renderLessons();
  renderExams();
}

function removeLesson(id) {
  state.lessons = state.lessons.filter((l) => l.id !== id);
  saveState();
  render();
}

function removeExam(id) {
  state.exams = state.exams.filter((e) => e.id !== id);
  saveState();
  render();
}

function openModal() {
  formAlert.className = "g-alert hidden";
  modalBackdrop.classList.remove("hidden");
  document.getElementById("lessonTitle").focus();
}

function closeModal() {
  modalBackdrop.classList.add("hidden");
  addLessonForm.reset();
  document.getElementById("startTime").value = "00:00";
  document.getElementById("endTime").value = "00:00";
}

openAddModalBtn.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
cancelModalBtn.addEventListener("click", closeModal);

modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});

addLessonForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const candidate = {
    id: Date.now(),
    group: groupSelect.value,
    day: document.getElementById("lessonDay").value,
    start: document.getElementById("startTime").value,
    end: document.getElementById("endTime").value,
    title: document.getElementById("lessonTitle").value.trim(),
    teacher: document.getElementById("lessonTeacher").value.trim(),
    room: document.getElementById("lessonRoom").value.trim()
  };

  const conflict = findConflict(candidate);
  if (conflict) {
    formAlert.textContent = conflict;
    formAlert.className = "g-alert error";
    return;
  }

  state.lessons.push(candidate);
  saveState();
  closeModal();
  render();
});

addExamForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const titleEl = document.getElementById("examTitle");
  const dateEl = document.getElementById("examDate");
  if (!titleEl.value.trim() || !dateEl.value) return;

  state.exams.push({
    id: Date.now(),
    group: groupSelect.value,
    title: titleEl.value.trim(),
    date: dateEl.value
  });
  saveState();
  titleEl.value = "";
  dateEl.value = "";
  render();
});

dayChips.addEventListener("click", (e) => {
  const btn = e.target.closest(".g-chip");
  if (!btn) return;
  activeDayChip = btn.dataset.day;
  dayChips.querySelectorAll(".g-chip").forEach((c) => c.classList.remove("active"));
  btn.classList.add("active");
  renderLessons();
});

searchInput.addEventListener("input", renderLessons);
clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  renderLessons();
  searchInput.focus();
});

groupSelect.addEventListener("change", render);

setInterval(renderLessons, 60000);
render();