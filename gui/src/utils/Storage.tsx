export const getCdnUrl = (key?: string | null, orgId?: string | null): string => {
  if (!key) return '';

  // Defensive check: if the database accidentally saved a full URL, just return it
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }

  const baseUrl = import.meta.env.VITE_CDN_URL || 'http://localhost:8080/public';
  const cleanBase = baseUrl.replace(/\/$/, '');
  const cleanKey = key.replace(/^\//, '');

  // ⚡️ Safely build the URL
  const finalUrl = new URL(`${cleanBase}/${cleanKey}`);

  // ⚡️ Append the org_id query parameter to bypass the Go middleware!
  if (orgId) {
    finalUrl.searchParams.append('org_id', orgId);
  }

  return finalUrl.toString();
};