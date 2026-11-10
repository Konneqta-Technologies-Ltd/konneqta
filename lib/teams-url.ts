const DEFAULT_TEAMS_APP_URL = "https://teams.konneqta.com";

export function getTeamsSignupUrl(): string {
  const teamsAppUrl =
    process.env.NEXT_PUBLIC_TEAMS_APP_URL || DEFAULT_TEAMS_APP_URL;

  return `${teamsAppUrl.replace(/\/+$/, "")}/teams/signup`;
}
