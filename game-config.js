/**
 * Deployment-specific config, kept separate from game logic.
 *
 * LEADERBOARD_URL: the Google Apps Script Web App URL used for BOTH
 * submitting a score (POST) and reading back the top scores (GET). Leave
 * as an empty string to disable the leaderboard entirely (the game still
 * works fully without it — scores just won't be saved or shown).
 */
const GAME_CONFIG = {
  LEADERBOARD_URL: ""
};

if (typeof window !== "undefined") {
  window.GAME_CONFIG = GAME_CONFIG;
}
