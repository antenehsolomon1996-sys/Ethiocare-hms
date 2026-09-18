/**
 * Shared utility: builds unified doctor list from Doctor + Staff entities.
 * Each entry guaranteed to have: id (Doctor entity id), full_name, specialty
 *
 * Priority: Doctor entity records are preferred; Staff records fill in gaps.
 */
export function buildDoctorList(doctorEntities = [], staffList = []) {
  const map = new Map();

  // First pass: Doctor entity records (authoritative)
  doctorEntities
    .filter(d => d.status === 'active')
    .forEach(d => {
      map.set(d.full_name, {
        id: d.id,
        full_name: d.full_name,
        specialty: d.specialty || 'General Practice',
        source: 'doctor_entity'
      });
    });

  // Second pass: Staff records — only if not already in map
  staffList
    .filter(s => s.role === 'doctor' && s.status === 'active')
    .forEach(s => {
      if (!map.has(s.full_name)) {
        map.set(s.full_name, {
          id: null, // no Doctor entity record
          full_name: s.full_name,
          specialty: s.specialization || 'General Practice',
          source: 'staff'
        });
      }
    });

  return Array.from(map.values());
}

/**
 * Given the current logged-in user and all available data,
 * returns the matching Doctor entity record (or null).
 *
 * Match priority:
 *  1. Email match (most reliable — unique per doctor)
 *  2. Exact full_name match
 *  3. Case-insensitive full_name match
 */
export function findMyDoctorRecord(user, doctorEntities = []) {
  if (!user) return null;

  // 1. Match by email (strongest signal)
  if (user.email) {
    const byEmail = doctorEntities.find(d => d.email && d.email.toLowerCase() === user.email.toLowerCase());
    if (byEmail) return byEmail;
  }

  // 2. Exact name match
  const byExactName = doctorEntities.find(d => d.full_name === user.full_name);
  if (byExactName) return byExactName;

  // 3. Case-insensitive name match
  const byNameCI = doctorEntities.find(
    d => d.full_name?.toLowerCase() === user.full_name?.toLowerCase()
  );
  return byNameCI || null;
}