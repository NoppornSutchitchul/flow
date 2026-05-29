export function isNoStaffAvailableError(payload: unknown): boolean {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "code" in payload &&
    (payload as { code: string }).code === "no_staff_available"
  );
}
