
require("dotenv").config({ path: __dirname + "/.env" });

const express = require("express");
const path = require("path");
const supabase = require("./supabase");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve the frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// Home route
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Helper to handle Supabase errors
function handleError(res, error) {
  console.error("Database error:", error.message);
  return res.status(500).json({
    error: "Database operation failed."
  });
}

// Get all tournaments
app.get("/api/tournaments", async (req, res) => {
  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("id", { ascending: false });

  if (error) return handleError(res, error);
  res.json(data);
});

// Create a tournament
app.post("/api/tournaments", async (req, res) => {
  const { name, sport, location, start_date, end_date, status } = req.body;

  if (!name || !sport || !location || !start_date || !end_date) {
    return res.status(400).json({
      error: "Please provide all required tournament fields."
    });
  }

  if (end_date < start_date) {
    return res.status(400).json({
      error: "End date cannot be before start date."
    });
  }

  const { data, error } = await supabase
    .from("tournaments")
    .insert([{
      name,
      sport,
      location,
      start_date,
      end_date,
      status: status || "Planned"
    }])
    .select()
    .single();

  if (error) return handleError(res, error);
  res.status(201).json(data);
});

// Update a tournament
app.put("/api/tournaments/:id", async (req, res) => {
  const { name, sport, location, start_date, end_date, status } = req.body;

  if (start_date && end_date && end_date < start_date) {
    return res.status(400).json({
      error: "End date cannot be before start date."
    });
  }

  const { data, error } = await supabase
    .from("tournaments")
    .update({ name, sport, location, start_date, end_date, status })
    .eq("id", req.params.id)
    .select()
    .maybeSingle();

  if (error) return handleError(res, error);
  if (!data) return res.status(404).json({ error: "Tournament not found." });

  res.json(data);
});

// Delete a tournament
app.delete("/api/tournaments/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("tournaments")
    .delete()
    .eq("id", req.params.id)
    .select("id");

  if (error) return handleError(res, error);
  if (!data.length) {
    return res.status(404).json({ error: "Tournament not found." });
  }

  res.json({ message: "Tournament deleted successfully." });
});

// Get all teams
app.get("/api/teams", async (req, res) => {
  const { data, error } = await supabase
    .from("teams")
    .select("*")
    .order("id", { ascending: false });

  if (error) return handleError(res, error);
  res.json(data);
});

// Register a team
app.post("/api/teams", async (req, res) => {
  const { tournament_id, name, captain_name, contact } = req.body;

  if (!tournament_id || !name || !captain_name || !contact) {
    return res.status(400).json({
      error: "Please provide all required team fields."
    });
  }

  const { data, error } = await supabase
    .from("teams")
    .insert([{ tournament_id, name, captain_name, contact }])
    .select()
    .single();

  if (error) return handleError(res, error);
  res.status(201).json(data);
});

// Update a team
app.put("/api/teams/:id", async (req, res) => {
  const { tournament_id, name, captain_name, contact } = req.body;

  const { data, error } = await supabase
    .from("teams")
    .update({ tournament_id, name, captain_name, contact })
    .eq("id", req.params.id)
    .select()
    .maybeSingle();

  if (error) return handleError(res, error);
  if (!data) return res.status(404).json({ error: "Team not found." });

  res.json(data);
});

// Delete a team
app.delete("/api/teams/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("teams")
    .delete()
    .eq("id", req.params.id)
    .select("id");

  if (error) return handleError(res, error);
  if (!data.length) {
    return res.status(404).json({
      error: "Team not found. It may be used in a match."
    });
  }

  res.json({ message: "Team deleted successfully." });
});

// Get all matches
app.get("/api/matches", async (req, res) => {
  const { data, error } = await supabase
    .from("matches")
    .select("*")
    .order("match_date", { ascending: true });

  if (error) return handleError(res, error);
  res.json(data);
});

// Schedule a match
app.post("/api/matches", async (req, res) => {
  const {
    tournament_id,
    team1_id,
    team2_id,
    match_date,
    venue
  } = req.body;

  if (
    !tournament_id ||
    !team1_id ||
    !team2_id ||
    !match_date ||
    !venue
  ) {
    return res.status(400).json({
      error: "Please provide all required match fields."
    });
  }

  if (String(team1_id) === String(team2_id)) {
    return res.status(400).json({
      error: "A team cannot play against itself."
    });
  }

  // Ensure both teams belong to the selected tournament
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, tournament_id")
    .in("id", [team1_id, team2_id]);

  if (teamsError) return handleError(res, teamsError);

  const correctTeams =
    teams.length === 2 &&
    teams.every(team => String(team.tournament_id) === String(tournament_id));

  if (!correctTeams) {
    return res.status(400).json({
      error: "Both teams must belong to the selected tournament."
    });
  }

  const { data, error } = await supabase
    .from("matches")
    .insert([{
      tournament_id,
      team1_id,
      team2_id,
      match_date,
      venue,
      status: "Scheduled"
    }])
    .select()
    .single();

  if (error) return handleError(res, error);
  res.status(201).json(data);
});

// Update match result or details
app.put("/api/matches/:id", async (req, res) => {
  const allowedFields = [
    "tournament_id",
    "team1_id",
    "team2_id",
    "match_date",
    "venue",
    "team1_score",
    "team2_score",
    "status"
  ];

  const updates = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(req.body, field)) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: "No match fields provided." });
  }

  if (
    updates.team1_id !== undefined &&
    updates.team2_id !== undefined &&
    String(updates.team1_id) === String(updates.team2_id)
  ) {
    return res.status(400).json({
      error: "A team cannot play against itself."
    });
  }

  const { data, error } = await supabase
    .from("matches")
    .update(updates)
    .eq("id", req.params.id)
    .select()
    .maybeSingle();

  if (error) return handleError(res, error);
  if (!data) return res.status(404).json({ error: "Match not found." });

  res.json(data);
});

// Delete a match
app.delete("/api/matches/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("matches")
    .delete()
    .eq("id", req.params.id)
    .select("id");

  if (error) return handleError(res, error);
  if (!data.length) return res.status(404).json({ error: "Match not found." });

  res.json({ message: "Match deleted successfully." });
});

// Dashboard counts
app.get("/api/dashboard", async (req, res) => {
  const [tournaments, teams, matches] = await Promise.all([
    supabase.from("tournaments").select("id", { count: "exact", head: true }),
    supabase.from("teams").select("id", { count: "exact", head: true }),
    supabase.from("matches").select("id", { count: "exact", head: true })
  ]);

  const errors = [tournaments.error, teams.error, matches.error].filter(Boolean);

  if (errors.length) return handleError(res, errors[0]);

  res.json({
    tournaments: tournaments.count,
    teams: teams.count,
    matches: matches.count
  });
});

// Handle unknown API routes
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found." });
});

// Start server
app.listen(PORT, () => {
  console.log(`Sports Tournament Manager running at http://localhost:${PORT}`);
});
