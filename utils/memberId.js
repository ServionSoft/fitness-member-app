/**
 * Resolve CRM `members.id` from auth user payload.
 * Login often returns users.id as `id` — prefer explicit member fields.
 */
export function getMemberId(userData) {
  if (!userData || typeof userData !== 'object') return null;
  const candidates = [
    userData.member_id,
    userData.memberId,
    userData.member?.id,
    userData.members_id,
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Prefer members.id; fall back to userData.id only when member_id is unknown. */
export function getMemberIdOrFallback(userData) {
  return getMemberId(userData) ?? (userData?.id != null ? Number(userData.id) : null);
}

export function extractMemberIdFromDetails(details) {
  if (!details || typeof details !== 'object') return null;
  const candidates = [
    details.member_id,
    details.memberId,
    details.id, // /mobile/member/details is member-scoped → id is usually members.id
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function extractMemberIdFromLoginUser(user) {
  if (!user || typeof user !== 'object') return null;
  return (
    getMemberId(user) ||
    extractMemberIdFromDetails(user.member) ||
    null
  );
}
