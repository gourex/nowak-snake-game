/**
 * Deployment-specific config, kept separate from game logic.
 *
 * LEADERBOARD_URL: the Google Apps Script Web App URL used for BOTH
 * submitting a score (POST) and reading back the top scores (GET). Leave
 * as an empty string to disable the leaderboard entirely (the game still
 * works fully without it — scores just won't be saved or shown).
 */
const GAME_CONFIG = {
  LEADERBOARD_URL: "https://script.google.com/macros/s/AKfycbzH_M6LuXL0MtrDSd7ajR8o0hOb8BFuDoEfpSqVyhetJu0gL32wFkM9UIloyvtmzJ-k/exec"
};

if (typeof window !== "undefined") {
  window.GAME_CONFIG = GAME_CONFIG;
}
