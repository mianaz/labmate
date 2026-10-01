// Where the published recipe library lives. Shared by the app's Refresh
// (RecipeProvider) and the release tooling (scripts/recipes-sync.mjs), so both
// read the same signed files.
export const REMOTE_BASE = 'https://raw.githubusercontent.com/mianaz/labmate-recipes/main/dist/';
