function parseTimeParts(timeValue) {
  const twelveHour = timeValue.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHour) {
    let hours = Number(twelveHour[1]) % 12;
    if (twelveHour[3].toUpperCase() === "PM") hours += 12;
    return { hours, minutes: Number(twelveHour[2]) };
  }

  const twentyFourHour = timeValue.match(/^(\d{1,2}):(\d{2})/);
  if (twentyFourHour) {
    return {
      hours: Number(twentyFourHour[1]),
      minutes: Number(twentyFourHour[2]),
    };
  }

  return { hours: 0, minutes: 0 };
}

function parseDepartureDateTime(departureDate, departureTime) {
  if (!departureDate) return null;

  const rawDate = String(departureDate).trim();
  const rawTime = String(departureTime || "00:00").trim();

  const isoDateMatch = rawDate.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoDateMatch) {
    const [year, month, day] = isoDateMatch[1].split("-").map(Number);
    const { hours, minutes } = parseTimeParts(rawTime);
    const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const isoDateOnly = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateOnly) {
    const [, year, month, day] = isoDateOnly.map(Number);
    const { hours, minutes } = parseTimeParts(rawTime);
    const parsed = new Date(year, month - 1, day, hours, minutes, 0, 0);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(`${rawDate} ${rawTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isDeparturePassed(departureDate, departureTime) {
  const target = parseDepartureDateTime(departureDate, departureTime);
  if (!target) return false;
  return target.getTime() < Date.now();
}

module.exports = { parseDepartureDateTime, isDeparturePassed };
