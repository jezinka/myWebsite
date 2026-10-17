const calendar = document.querySelector("#calendar");
const yearCalendar = document.querySelector("#year-calendar");
const status = document.querySelector("#calendar-status");
const title = document.querySelector("#calendar-title");
const today = new Date();
const year = today.getFullYear();
const colors = { reading: "#2563eb", watching: "#dc2626", sport: "#16a34a" };
const icons = { reading: "📖", watching: "📺", sport: "🏃" };

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

function isoDate(month, day) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function firstDate(entry, start, end) {
    return entry.periods
        .filter(period => period && validDate(period.startDate) && validDate(period.endDate) && period.startDate <= end && start <= period.endDate)
        .map(period => period.startDate < start ? start : period.startDate)
        .sort()[0];
}

function coverUrl(entry) {
    return typeof entry.coverUrl === "string" && (/^https:\/\//.test(entry.coverUrl) || /^data\/medialog-covers\/[^/]+$/.test(entry.coverUrl))
        ? entry.coverUrl : null;
}

function iconUrl(icon) {
    return typeof icon === "string" && /^\/icons\/[^/]+\.png$/.test(icon) ? icon : null;
}

function image(className, src) {
    const element = document.createElement("img");
    element.className = className;
    element.src = src;
    element.alt = "";
    element.loading = "lazy";
    return element;
}

function preview(entry) {
    const element = document.createElement("span");
    const cover = coverUrl(entry);
    const iconSource = iconUrl(entry.icon);
    element.className = entry.kind === "sport" ? "marker marker--sport" : "marker marker--media";
    if (entry.kind !== "sport" && cover) element.append(image("marker-cover", cover));
    else if (iconSource) element.append(image("sport-icon", iconSource));
    else element.textContent = icons[entry.kind];
    return element;
}

function stats(entry) {
    const hours = Math.floor(entry.durationMinutes / 60);
    return [
        Number.isFinite(entry.durationMinutes) && entry.durationMinutes > 0 ? `${hours ? `${hours} h ` : ""}${entry.durationMinutes % 60} min` : null,
        Number.isFinite(entry.distanceKm) && entry.distanceKm > 0 ? `${entry.distanceKm.toLocaleString("pl-PL")} km` : null,
        Number.isInteger(entry.seasonNumber) ? `sezon ${entry.seasonNumber}` : null,
    ].filter(Boolean).join(" · ");
}

function cardItem(entry) {
    const item = document.createElement("span");
    const cover = coverUrl(entry);
    const iconSource = iconUrl(entry.icon);
    const title = document.createElement("span");
    const details = stats(entry);
    item.className = "card-item";
    if (cover) item.append(image("card-cover", cover));
    else if (iconSource) item.append(image("card-icon", iconSource));
    else item.append(Object.assign(document.createElement("span"), { className: "card-icon", textContent: icons[entry.kind] }));
    title.className = "card-title";
    title.textContent = entry.title;
    item.append(title);
    if (details) item.append(Object.assign(document.createElement("span"), { className: "card-season", textContent: details }));
    return item;
}

// One button per day: hover, focus or tap shows a single card with everything on that day.
function dayButton(entries, date) {
    const button = document.createElement("button");
    const card = document.createElement("span");
    const labels = { reading: "Czytam", watching: "Oglądam", sport: "Sport" };
    button.type = "button";
    button.className = "day-button";
    button.setAttribute("aria-label", entries.map(entry => `${labels[entry.kind]}: ${entry.title}`).join(", "));
    button.setAttribute("aria-describedby", `card-${date}`);
    button.setAttribute("aria-expanded", "false");
    entries.forEach(entry => button.append(preview(entry)));
    card.className = "card";
    card.id = `card-${date}`;
    card.setAttribute("role", "tooltip");
    entries.forEach(entry => card.append(cardItem(entry)));
    button.append(card);
    button.addEventListener("click", () => {
        const open = !button.classList.contains("is-open");
        document.querySelectorAll(".day-button.is-open").forEach(item => {
            item.classList.remove("is-open");
            item.setAttribute("aria-expanded", "false");
        });
        button.classList.toggle("is-open", open);
        button.setAttribute("aria-expanded", String(open));
    });
    return button;
}

function renderMonth(calendar, month, cells) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
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
        cells.set(isoDate(month, day), cell);
    }
}

// Like MediaLog: each entry once, on its first day in the range; if taken, the first free day after it.
function place(entries, cells) {
    const dates = [...cells.keys()];
    const occupied = { media: new Set(), sport: new Set() };
    const byDate = new Map();
    entries
        .map(entry => ({ entry, first: firstDate(entry, dates[0], dates.at(-1)) }))
        .filter(item => item.first)
        .sort((a, b) => a.first.localeCompare(b.first))
        .forEach(({ entry, first }) => {
            const slot = entry.kind === "sport" ? occupied.sport : occupied.media;
            // ponytail: linear scan per entry, fine for 366 days
            const date = dates.slice(dates.indexOf(first)).find(candidate => !slot.has(candidate));
            if (!date) return;
            slot.add(date);
            if (!byDate.has(date)) byDate.set(date, []);
            byDate.get(date).push(entry);
        });
    byDate.forEach((dayEntries, date) => {
        const cell = cells.get(date);
        cell.classList.add("has-item");
        // Media first so the cover sits under the small sport icon.
        cell.append(dayButton(dayEntries.sort((a, b) => (a.kind === "sport") - (b.kind === "sport")), date));
    });
}

function monthSection(month) {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    const weekdays = document.createElement("div");
    const grid = document.createElement("div");
    section.className = "year-month";
    heading.textContent = new Intl.DateTimeFormat("pl-PL", { month: "long" }).format(new Date(year, month, 1));
    weekdays.className = "weekdays";
    weekdays.setAttribute("aria-hidden", "true");
    ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"].forEach(name => weekdays.append(Object.assign(document.createElement("span"), { textContent: name })));
    grid.className = "calendar-grid";
    grid.setAttribute("aria-label", heading.textContent);
    section.append(heading, weekdays, grid);
    yearCalendar.append(section);
    return grid;
}

async function loadCalendar() {
    const paths = yearCalendar ? ["data/medialog-year.json", "data/sport-year.json"] : ["data/medialog.json", "data/sport.json"];
    title.textContent = yearCalendar ? String(year)
        : new Intl.DateTimeFormat("pl-PL", { month: "long", year: "numeric" }).format(today);
    const sources = await Promise.allSettled(paths.map(async path => {
        const response = await fetch(path);
        if (!response.ok) throw new Error(`${path}: ${response.status}`);
        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items : data.entries;
        if (data.schemaVersion !== 1 || !Array.isArray(items)) throw new Error(`${path}: nieprawidłowy format`);
        return items.filter(validEntry);
    }));
    const failed = sources.some(source => source.status === "rejected");
    if (failed) status.textContent = "Nie udało się wczytać części danych kalendarza.";
    const entries = sources.flatMap(source => source.status === "fulfilled" ? source.value : []);
    const cells = new Map();
    if (yearCalendar) for (let month = 0; month < 12; month += 1) renderMonth(monthSection(month), month, cells);
    else renderMonth(calendar, today.getMonth(), cells);
    place(entries, cells);
}

loadCalendar();
