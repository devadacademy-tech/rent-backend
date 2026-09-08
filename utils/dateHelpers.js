// Returns the number of whole calendar days between "now" and a target date.
// Positive = target is in the future, negative = target is in the past.
const daysBetween = (targetDate, fromDate = new Date()) => {
  const target = new Date(targetDate);
  const from = new Date(fromDate);
  const diffMs =
    Date.UTC(target.getFullYear(), target.getMonth(), target.getDate()) -
    Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
};

const formatDate = (date) => {
  return new Date(date).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const formatMoney = (amount, currency = "NGN") => {
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
};

module.exports = { daysBetween, formatDate, formatMoney };
