/**
 * Signing in with Discord.
 *
 * Chosen because the people this is for are already there: a table that plays
 * D&D has a Discord, and the name and avatar the player uses at that table is
 * the name and avatar they will recognise on their own Codex.
 *
 * Only `identify` is asked for. Not `email`, because nothing here sends mail,
 * and a scope requested is a scope the player has to read and agree to. Not
 * `guilds`, because whose server someone is in is none of this application's
 * business.
 */

const AUTHORIZE = "https://discord.com/oauth2/authorize";
const TOKEN = "https://discord.com/api/oauth2/token";
const ME = "https://discord.com/api/users/@me";

export type DiscordConfig = {
  clientId: string;
  clientSecret: string;
  /** Registered on the Discord application, and compared byte for byte. */
  redirectUri: string;
};

export type DiscordUser = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

/** Where to send the player to authorise. */
export function authorizeUrl(config: DiscordConfig, state: string): string {
  const url = new URL(AUTHORIZE);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify");
  // Discord will re-show the consent screen otherwise; a returning player has
  // already agreed and does not need to agree again.
  url.searchParams.set("prompt", "none");
  url.searchParams.set("state", state);

  return url.toString();
}

/**
 * The code Discord handed back, exchanged for who the player is.
 *
 * The access token is used once and thrown away. Storing it would mean holding
 * a credential to somebody's Discord account in order to answer "what is your
 * name", which is a liability with no matching use.
 */
export async function identify(
  config: DiscordConfig,
  code: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DiscordUser> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
  });

  const tokenResponse = await fetchImpl(TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!tokenResponse.ok) {
    throw new Error(`Discord refused the code (${tokenResponse.status}).`);
  }

  const token = (await tokenResponse.json()) as { access_token?: string };
  if (!token.access_token) throw new Error("Discord returned no access token.");

  const userResponse = await fetchImpl(ME, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });

  if (!userResponse.ok) {
    throw new Error(`Discord refused the token (${userResponse.status}).`);
  }

  const user = (await userResponse.json()) as {
    id?: string;
    username?: string;
    global_name?: string | null;
    avatar?: string | null;
  };

  if (!user.id) throw new Error("Discord returned no user id.");

  return {
    id: user.id,
    // `global_name` is the display name Discord moved to; `username` is the
    // handle underneath it. A player who set one expects to see it.
    displayName: user.global_name || user.username || "Aventurero",
    avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null,
  };
}
