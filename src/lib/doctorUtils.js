/**
 * Shared utility: builds unified doctor list from Doctor + Staff entities.
 *
 * Owner Portal -> Staff Management is the SINGLE SOURCE OF TRUTH for active doctors.
 * Only active staff members with role 'doctor' will be returned when staffList is available.
 * Stale, hardcoded, or inactive doctors are strictly excluded.
 */
export function buildDoctorList(doctorEntities = [], staffList = []) {
  const map = new Map();

  // If staffList is provided and contains staff records, enforce Staff Management as authoritative
  if (Array.isArray(staffList) && staffList.length > 0) {
    const activeStaffDoctors = staffList.filter(s => s.role === 'doctor' && s.status === 'active');

    activeStaffDoctors.forEach(s => {
      const key = (s.full_name || '').trim().toLowerCase();
      if (!key) return;

      // Find matching Doctor entity record to get linked doctor entity ID and synced room info
      const matchingDoc = (doctorEntities || []).find(d =>
        (d.staff_id && String(d.staff_id) === String(s.id)) ||
        (d.email && s.email && d.email.trim().toLowerCase() === s.email.trim().toLowerCase()) ||
        (d.full_name && d.full_name.trim().toLowerCase() === key)
      );

      map.set(key, {
        id: matchingDoc?.id || s.id,
        staff_id: s.id,
        full_name: s.full_name,
        specialty: s.specialization || s.department || matchingDoc?.specialty || 'General Practice',
        assigned_room_id: s.assigned_room_id || matchingDoc?.assigned_room_id || null,
        assigned_room_number: s.assigned_room_number || matchingDoc?.assigned_room_number || null,
        email: s.email || matchingDoc?.email || null,
        status: 'active',
        source: 'staff_management'
      });
    });

    return Array.from(map.values());
  }

  // Graceful fallback ONLY when staffList has not loaded yet
  (doctorEntities || [])
    .filter(d => d.status === 'active')
    .forEach(d => {
      const key = (d.full_name || '').trim().toLowerCase();
      if (!key || map.has(key)) return;

      map.set(key, {
        id: d.id,
        staff_id: d.staff_id || null,
        full_name: d.full_name,
        specialty: d.specialty || 'General Practice',
        assigned_room_id: d.assigned_room_id || null,
        assigned_room_number: d.assigned_room_number || null,
        email: d.email || null,
        status: 'active',
        source: 'doctor_entity'
      });
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