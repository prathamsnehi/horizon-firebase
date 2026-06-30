const KEY = "horizon.deviceId";

/**
 * A stable per-browser identifier. The backend uses `deviceId` for
 * pre-generated batch lookup and rate limiting (it stands in for the
 * iOS vendor ID).
 */
export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}
