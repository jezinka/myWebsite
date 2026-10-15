const calendar = document.querySelector("#calendar");
const status = document.querySelector("#calendar-status");
const title = document.querySelector("#calendar-title");
const today = new Date();
const year = today.getFullYear();
const month = today.getMonth();
const daysInMonth = new Date(year, month + 1, 0).getDate();
const monthLabel = new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(today);
const colors = { reading: "#2563eb", watching: "#dc2626", sport: "#16a34a" };
const icons = { reading: "📖", watching: "📺", sport: "🏃" };

title.textContent = monthLabel;

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date) && date.toISOString().slice(0, 10) === value;
}

function validEntry(entry) {
    return entry && typeof entry.id === "string" && typeof entry.title === "string"
        && ["reading", "watching", "sport"].includes(entry.kind) && Array.isArray(entry.periods)
        && entry.periods.some(period => period && validDate(period.startDate) && validDate(period.endDate) && period.startDate <= period.endDate);
}

function monthDays(entry) {
    const dates = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
        const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        if (entry.periods.some(period => period && validDate(period.startDate) && validDate(period.endDate) && period.startDate <= date && date <= period.endDate)) dates.push(day);
    }
    return dates;
}

function marker(entry, day) {
    const button = document.createElement("button");
    const card = document.createElement("span");
    const cardId = `event-${entry.id}-${day}`;
    const icon = entry.icon || icons[entry.kind];
    const color = entry.kind === "sport" && CSS.supports("color", entry.color) ? entry.color : colors[entry.kind];

    button.type = "button";
    button.className = entry.kind === "sport" ? "marker marker--sport" : "marker";
    button.style.setProperty("--marker-color", color);
    button.setAttribute("aria-label", `${entry.kind === "reading" ? "Czytam" : entry.kind === "watching" ? "Oglądam" : "Sport"}: ${entry.title}`);
    button.setAttribute("aria-describedby", cardId);
    button.setAttribute("aria-expanded", "false");
    card.className = "card";
    card.id = cardId;
    card.setAttribute("role", "tooltip");
    if (typeof entry.coverUrl === "string" && (/^https:\/\//.test(entry.coverUrl) || /^data\/medialog-covers\/[^/]+$/.test(entry.coverUrl))) {
        const image = document.createElement("img");
        image.src = entry.coverUrl;
        image.alt = "";
        image.loading = "lazy";
        card.append(image);
    } else {
        const iconElement = document.createElement("span");
        iconElement.className = "card-icon";
        iconElement.textContent = icon;
        card.append(iconElement);
    }
    const eventTitle = document.createElement("span");
    eventTitle.className = "card-title";
    eventTitle.textContent = entry.title;
    card.append(eventTitle);
    if (Number.isInteger(entry.seasonNumber)) {
        const season = document.createElement("span");
        season.className = "card-season";
        season.textContent = `sezon ${entry.seasonNumber}`;
        card.append(season);
    }
    button.append(card);
    button.addEventListener("click", () => {
        const open = !button.classList.contains("is-open");
        document.querySelectorAll(".marker.is-open").forEach(item => {
            item.classList.remove("is-open");
            item.setAttribute("aria-expanded", "false");
        });
        button.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", String(open));
    });
    return button;
}

function render(entries) {
    const cells = new Map();
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    for (let index = 0; index < offset; index += 1) {
        const blank = document.createElement("div");
        blank.className = "day day--empty";
        blank.setAttribute("aria-hidden", "true");
        calendar.append(blank);
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
        const cell = document.createElement("div");
        const number = document.createElement("span");
        cell.className = "day";
        number.className = "day-number";
        number.textContent = day;
        cell.append(number);
        calendar.append(cell);
        cells.set(day, cell);
    }

    const occupied = { media: new Set(), sport: new Set() };
    entries.forEach(entry => {
        const slot = entry.kind === "sport" ? occupied.sport : occupied.media;
        const available = monthDays(entry).filter(day => !slot.has(day));
        if (!available.length) return;
        const preferred = monthDays(entry)[0];
        const day = available.reduce((closest, candidate) => Math.abs(candidate - preferred) < Math.abs(closest - preferred) ? candidate : closest);
        slot.add(day);
        cells.get(day).append(marker(entry, day));
    });
}

async function loadCalendar() {
    const sources = await Promise.allSettled(["data/medialog.json", "data/sport.json"].map(async path => {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items : data.entries;
        if (data.schemaVersion !== 1 || !Array.isArray(items)) throw new Error(`${path}: nieprawidłowy format`);
        return items.filter(validEntry);
    }));
    const failed = sources.some(source => source.status === "rejected");
    if (failed) status.textContent = "Nie udało się wczytać części danych kalendarza.";
    render(sources.flatMap(source => source.status === "fulfilled" ? source.value : []));
}

loadCalendar();
