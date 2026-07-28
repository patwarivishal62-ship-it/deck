// Mentions are stored as explicit tokens: @[Display Name](userId) — inserted
// by the composer when someone picks a name from the suggestion dropdown,
// never guessed from plain "@Name" text (which breaks the moment a name has
// a space in it). This turns a comment body into a list of plain strings and
// { mention: true, name, userId } markers, ready to map over in JSX.
const MENTION_TOKEN = /@\[([^\]]+)\]\(([a-zA-Z0-9_-]+)\)/g;

export function parseCommentBody(body) {
  const nodes = [];
  let lastIndex = 0;
  let match;
  const re = new RegExp(MENTION_TOKEN);
  while ((match = re.exec(body))) {
    if (match.index > lastIndex) {
      nodes.push(body.slice(lastIndex, match.index));
    }
    nodes.push({ mention: true, name: match[1], userId: match[2], key: `m-${match.index}` });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < body.length) nodes.push(body.slice(lastIndex));
  return nodes;
}

export function mentionToken(name, userId) {
  return `@[${name}](${userId})`;
}
