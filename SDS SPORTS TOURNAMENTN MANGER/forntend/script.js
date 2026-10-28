
"use strict";

const API = "/api";

let tournaments = [];
let teams = [];
let matches = [];

const $ = (selector) => document.querySelector(selector);

// ------------------------------
// API connection helper
// ------------------------------

async function apiRequest(endpoint, options = {}) {
    let response;

    try {
        response = await fetch(`${API}${endpoint}`, {
            ...options,
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        });
    } catch (error) {
        throw new Error(
            "Cannot connect to the backend. Make sure the server is running."
        );
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.error || "Request failed.");
    }

    return data;
}

async function runAction(action) {
    clearMessage();

    try {
        await action();
    } catch (error) {
        showMessage(error.message, true);
    }
}

// ------------------------------
// Messages and helpers
// ------------------------------

function showMessage(message, isError = false) {
    const box = $("#message");

    if (!box) {
        alert(message);
        return;
    }

    box.textContent = message;
    box.style.backgroundColor = isError ? "#fee2e2" : "#dcfce7";
    box.style.color = isError ? "#991b1b" : "#166534";
    box.style.border = isError
        ? "1px solid #fca5a5"
        : "1px solid #86efac";

    box.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function clearMessage() {
    const box = $("#message");

    if (!box) return;

    box.textContent = "";
    box.style.backgroundColor = "transparent";
    box.style.border = "none";
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function getTournament(id) {
    return tournaments.find(
        (item) => Number(item.id) === Number(id)
    );
}

function getTeam(id) {
    return teams.find(
        (item) => Number(item.id) === Number(id)
    );
}

function getTournamentName(id) {
    return getTournament(id)?.name || "Unknown tournament";
}

function getTeamName(id) {
    return getTeam(id)?.name || "Unknown team";
}

function formatDate(value) {
    if (!value) return "Not specified";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Invalid date";
    }

    return date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function dateOnly(value) {
    if (!value) return "";

    return String(value).slice(0, 10);
}

// ------------------------------
// Load database records
// ------------------------------

async function loadData() {
    const [tournamentData, teamData, matchData] = await Promise.all([
        apiRequest("/tournaments"),
        apiRequest("/teams"),
        apiRequest("/matches")
    ]);

    tournaments = tournamentData;
    teams = teamData;
    matches = matchData;

    renderTournaments();
    renderTeams();
    renderMatches();
    updateDashboard();
}

// ------------------------------
// Tournament rendering
// ------------------------------

function renderTournaments() {
    const list = $("#tournament-list");

    if (tournaments.length === 0) {
        list.innerHTML = "<p>No tournaments available.</p>";
    } else {
        list.innerHTML = tournaments.map((tournament) => `
            <article>
                <h4>${escapeHTML(tournament.name)}</h4>
                <p>Sport: ${escapeHTML(tournament.sport)}</p>
                <p>Location: ${escapeHTML(tournament.location)}</p>
                <p>Start: ${escapeHTML(dateOnly(tournament.start_date))}</p>
                <p>End: ${escapeHTML(dateOnly(tournament.end_date))}</p>
                <p>Status: ${escapeHTML(tournament.status)}</p>

                <button type="button"
                    data-action="edit-tournament"
                    data-id="${tournament.id}">
                    Edit
                </button>

                <button type="button"
                    data-action="delete-tournament"
                    data-id="${tournament.id}">
                    Delete
                </button>
            </article>
        `).join("");
    }

    renderTournamentOptions();
}

function renderTournamentOptions() {
    const options = tournaments.map((tournament) => `
        <option value="${tournament.id}">
            ${escapeHTML(tournament.name)}
        </option>
    `).join("");

    ["#team-tournament", "#match-tournament"].forEach((selector) => {
        const select = $(selector);
        if (!select) return;

        const previousValue = select.value;

        select.innerHTML = `
            <option value="">Select a tournament</option>
            ${options}
        `;

        if (
            previousValue &&
            [...select.options].some(
                (option) => option.value === previousValue
            )
        ) {
            select.value = previousValue;
        }
    });

    renderTeamOptions();
}

// ------------------------------
// Team rendering
// ------------------------------

function renderTeams() {
    const list = $("#team-list");

    if (teams.length === 0) {
        list.innerHTML = "<p>No teams registered yet.</p>";
    } else {
        list.innerHTML = teams.map((team) => `
            <article>
                <h4>${escapeHTML(team.name)}</h4>
                <p>Tournament: ${escapeHTML(
                    getTournamentName(team.tournament_id)
                )}</p>
                <p>Captain: ${escapeHTML(team.captain_name)}</p>
                <p>Contact: ${escapeHTML(team.contact)}</p>

                <button type="button"
                    data-action="edit-team"
                    data-id="${team.id}">
                    Edit
                </button>

                <button type="button"
                    data-action="delete-team"
                    data-id="${team.id}">
                    Delete
                </button>
            </article>
        `).join("");
    }

    renderTeamOptions();
}

function renderTeamOptions() {
    const tournamentSelect = $("#match-tournament");
    const tournamentId = Number(tournamentSelect?.value);

    const eligibleTeams = teams.filter(
        (team) => Number(team.tournament_id) === tournamentId
    );

    ["#team-one", "#team-two"].forEach((selector) => {
        const select = $(selector);
        if (!select) return;

        const previousValue = select.value;

        select.innerHTML = `
            <option value="">Select a team</option>
            ${eligibleTeams.map((team) => `
                <option value="${team.id}">
                    ${escapeHTML(team.name)}
                </option>
            `).join("")}
        `;

        if (
            previousValue &&
            [...select.options].some(
                (option) => option.value === previousValue
            )
        ) {
            select.value = previousValue;
        }
    });
}

// ------------------------------
// Match rendering
// ------------------------------

function renderMatches() {
    const list = $("#match-list");

    if (matches.length === 0) {
        list.innerHTML = "<p>No matches scheduled yet.</p>";
    } else {
        list.innerHTML = matches.map((match) => {
            const result = match.status === "Completed"
                ? `<p>Result: ${escapeHTML(match.team1_score)} - ${escapeHTML(match.team2_score)}</p>`
                : "<p>Result: Not available</p>";

            return `
                <article>
                    <h4>
                        ${escapeHTML(getTeamName(match.team1_id))}
                        vs
                        ${escapeHTML(getTeamName(match.team2_id))}
                    </h4>

                    <p>Tournament: ${escapeHTML(
                        getTournamentName(match.tournament_id)
                    )}</p>

                    <p>Date: ${escapeHTML(formatDate(match.match_date))}</p>
                    <p>Venue: ${escapeHTML(match.venue)}</p>
                    <p>Status: ${escapeHTML(match.status)}</p>
                    ${result}

                    ${match.status !== "Completed" ? `
                        <button type="button"
                            data-action="edit-result"
                            data-id="${match.id}">
                            Enter Result
                        </button>
                    ` : ""}

                    <button type="button"
                        data-action="delete-match"
                        data-id="${match.id}">
                        Delete
                    </button>
                </article>
            `;
        }).join("");
    }

    updateDashboard();
}

// ------------------------------
// Dashboard
// ------------------------------

function updateDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    $("#total-tournaments").textContent = tournaments.length;
    $("#total-teams").textContent = teams.length;

    const upcoming = matches.filter((match) => {
        const matchDate = new Date(match.match_date);

        return match.status === "Scheduled" &&
            !Number.isNaN(matchDate.getTime()) &&
            matchDate >= today;
    }).length;

    const completed = matches.filter(
        (match) => match.status === "Completed"
    ).length;

    $("#upcoming-matches").textContent = upcoming;
    $("#completed-matches").textContent = completed;
}

// ------------------------------
// Tournament form
// ------------------------------

$("#tournament-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    await runAction(async () => {
        const form = event.currentTarget;
        const editingId = form.dataset.editingId;

        const tournament = {
            name: $("#tournament-name").value.trim(),
            sport: $("#tournament-sport").value,
            location: $("#tournament-location").value.trim(),
            start_date: $("#start-date").value,
            end_date: $("#end-date").value
        };

        if (
            !tournament.name ||
            !tournament.sport ||
            !tournament.location ||
            !tournament.start_date ||
            !tournament.end_date
        ) {
            throw new Error("Please complete all tournament fields.");
        }

        if (tournament.end_date < tournament.start_date) {
            throw new Error("End date cannot be before start date.");
        }

        if (editingId) {
            await apiRequest(`/tournaments/${editingId}`, {
                method: "PUT",
                body: JSON.stringify(tournament)
            });
        } else {
            await apiRequest("/tournaments", {
                method: "POST",
                body: JSON.stringify(tournament)
            });
        }

        form.reset();
        delete form.dataset.editingId;
        form.querySelector('button[type="submit"]').textContent =
            "Add Tournament";

        await loadData();

        showMessage(
            editingId
                ? "Tournament updated successfully."
                : "Tournament added successfully."
        );
    });
});

// ------------------------------
// Team form
// ------------------------------

$("#team-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    await runAction(async () => {
        const form = event.currentTarget;
        const editingId = form.dataset.editingId;

        const team = {
            name: $("#team-name").value.trim(),
            tournament_id: Number($("#team-tournament").value),
            captain_name: $("#captain-name").value.trim(),
            contact: $("#team-contact").value.trim()
        };

        if (
            !team.name ||
            !team.tournament_id ||
            !team.captain_name ||
            !team.contact
        ) {
            throw new Error("Please complete all team fields.");
        }

        const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(team.contact);
        const validPhone = /^[0-9+()\-\s]{7,20}$/.test(team.contact);

        if (!validEmail && !validPhone) {
            throw new Error("Enter a valid email address or phone number.");
        }

        if (editingId) {
            await apiRequest(`/teams/${editingId}`, {
                method: "PUT",
                body: JSON.stringify(team)
            });
        } else {
            await apiRequest("/teams", {
                method: "POST",
                body: JSON.stringify(team)
            });
        }

        form.reset();
        delete form.dataset.editingId;
        form.querySelector('button[type="submit"]').textContent =
            "Register Team";

        await loadData();

        showMessage(
            editingId
                ? "Team updated successfully."
                : "Team registered successfully."
        );
    });
});

// ------------------------------
// Match form
// ------------------------------

$("#match-tournament").addEventListener("change", renderTeamOptions);

$("#match-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    await runAction(async () => {
        const form = event.currentTarget;
        const editingId = form.dataset.editingId;

        const match = {
            tournament_id: Number($("#match-tournament").value),
            team1_id: Number($("#team-one").value),
            team2_id: Number($("#team-two").value),
            match_date: $("#match-date").value,
            venue: $("#match-venue").value.trim()
        };

        if (
            !match.tournament_id ||
            !match.team1_id ||
            !match.team2_id ||
            !match.match_date ||
            !match.venue
        ) {
            throw new Error("Please complete all match fields.");
        }

        if (match.team1_id === match.team2_id) {
            throw new Error("A team cannot play against itself.");
        }

        if (editingId) {
            await apiRequest(`/matches/${editingId}`, {
                method: "PUT",
                body: JSON.stringify(match)
            });
        } else {
            await apiRequest("/matches", {
                method: "POST",
                body: JSON.stringify(match)
            });
        }

        form.reset();
        delete form.dataset.editingId;
        form.querySelector('button[type="submit"]').textContent =
            "Schedule Match";

        await loadData();

        showMessage(
            editingId
                ? "Match updated successfully."
                : "Match scheduled successfully."
        );
    });
});

// ------------------------------
// Edit and delete actions
// ------------------------------

document.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = Number(button.dataset.id);
    const action = button.dataset.action;

    await runAction(async () => {
        if (action === "edit-tournament") {
            const tournament = getTournament(id);
            if (!tournament) throw new Error("Tournament not found.");

            $("#tournament-name").value = tournament.name;
            $("#tournament-sport").value = tournament.sport;
            $("#tournament-location").value = tournament.location;
            $("#start-date").value = dateOnly(tournament.start_date);
            $("#end-date").value = dateOnly(tournament.end_date);

            $("#tournament-form").dataset.editingId = id;
            $('#tournament-form button[type="submit"]').textContent =
                "Update Tournament";

            $("#tournaments").scrollIntoView({ behavior: "smooth" });
        }

        if (action === "delete-tournament") {
            const tournament = getTournament(id);
            if (!tournament) throw new Error("Tournament not found.");

            if (!confirm(
                `Delete "${tournament.name}" and its related teams and matches?`
            )) return;

            await apiRequest(`/tournaments/${id}`, {
                method: "DELETE"
            });

            await loadData();
            showMessage("Tournament deleted successfully.");
        }

        if (action === "edit-team") {
            const team = getTeam(id);
            if (!team) throw new Error("Team not found.");

            $("#team-name").value = team.name;
            $("#team-tournament").value = team.tournament_id;
            $("#captain-name").value = team.captain_name;
            $("#team-contact").value = team.contact;

            $("#team-form").dataset.editingId = id;
            $('#team-form button[type="submit"]').textContent =
                "Update Team";

            $("#teams").scrollIntoView({ behavior: "smooth" });
        }

        if (action === "delete-team") {
            const team = getTeam(id);
            if (!team) throw new Error("Team not found.");

            if (!confirm(`Delete team "${team.name}"?`)) return;

            await apiRequest(`/teams/${id}`, {
                method: "DELETE"
            });

            await loadData();
            showMessage("Team deleted successfully.");
        }

        if (action === "edit-result") {
            const match = matches.find(
                (item) => Number(item.id) === id
            );

            if (!match) throw new Error("Match not found.");

            const firstScore = prompt(
                `Enter score for ${getTeamName(match.team1_id)}:`
            );

            if (firstScore === null || firstScore.trim() === "") return;

            const secondScore = prompt(
                `Enter score for ${getTeamName(match.team2_id)}:`
            );

            if (secondScore === null || secondScore.trim() === "") return;

            const score1 = Number(firstScore);
            const score2 = Number(secondScore);

            if (
                !Number.isInteger(score1) ||
                !Number.isInteger(score2) ||
                score1 < 0 ||
                score2 < 0
            ) {
                throw new Error("Scores must be non-negative whole numbers.");
            }

            await apiRequest(`/matches/${id}`, {
                method: "PUT",
                body: JSON.stringify({
                    team1_score: score1,
                    team2_score: score2,
                    status: "Completed"
                })
            });

            await loadData();
            showMessage("Match result saved successfully.");
        }

        if (action === "delete-match") {
            if (!confirm("Delete this match?")) return;

            await apiRequest(`/matches/${id}`, {
                method: "DELETE"
            });

            await loadData();
            showMessage("Match deleted successfully.");
        }
    });
});

// ------------------------------
// Start frontend
// ------------------------------

async function startApp() {
    try {
        await loadData();
        showMessage("Connected to the backend. Data loaded from Supabase.");
    } catch (error) {
        showMessage(error.message, true);
    }
}

startApp();
