export function hoursToHM(decimalHours) {
  let totalMinutes = Math.round(Math.abs(decimalHours) * 60);

  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  return `${h}h` + (m > 0 ? ` ${m}m` : "");
}
