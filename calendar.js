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

function marker(entry, date) {
    const button = document.createElement("button");
    const card = document.createElement("span");
    const cardId = `event-${entry.id}-${date}`;
    const icon = entry.icon || icons[entry.kind];
    const color = entry.kind === "sport" && CSS.supports("color", entry.color) ? entry.color : colors[entry.kind];
    const cover = coverUrl(entry);
    const iconSource = iconUrl(icon);

    button.type = "button";
    button.className = entry.kind === "sport" ? "marker marker--sport" : "marker marker--media";
    button.style.setProperty("--marker-color", color);
    if (entry.kind === "sport" && iconSource) {
        const image = document.createElement("img");
        image.className = "sport-icon";
        image.src = iconSource;
        image.alt = "";
        button.append(image);
    } else if (entry.kind === "sport") button.textContent = icon;
    if (cover && entry.kind !== "sport") {
        const image = document.createElement("img");
        image.className = "marker-cover";
        image.src = cover;
        image.alt = "";
        image.loading = "lazy";
        button.append(image);
    }
    button.setAttribute("aria-label", `${entry.kind === "reading" ? "Czytam" : entry.kind === "watching" ? "Oglądam" : "Sport"}: ${entry.title}`);
    button.setAttribute("aria-describedby", cardId);
    button.setAttribute("aria-expanded", "false");
    card.className = "card";
    card.id = cardId;
    card.setAttribute("role", "tooltip");
    if (cover) {
        const image = document.createElement("img");
        image.src = cover;
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
            const cell = cells.get(date);
            cell.classList.add("has-item");
            cell.append(marker(entry, date));
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
