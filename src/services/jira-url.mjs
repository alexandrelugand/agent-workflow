export function approvedJiraBaseUrl(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port) return null;

  const siteHost = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.atlassian\.net$/i.test(url.hostname);
  const scopedMatch = url.hostname === 'api.atlassian.com' && url.pathname.match(/^\/ex\/jira\/([a-z0-9-]+)\/?$/i);
  if (siteHost && (url.pathname === '/' || url.pathname === '')) return url.origin;
  if (scopedMatch) return `${url.origin}/ex/jira/${scopedMatch[1]}`;
  return null;
}
export function requireApprovedJiraBaseUrl(value) {
  const base = approvedJiraBaseUrl(value);
  if (!base) throw new Error('JIRA_API_URL must be an approved HTTPS Jira Cloud site or scoped-token base URL');
  return base;
}
