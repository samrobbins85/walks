export function roundToQuarter(num) {
  const rounded = Math.round(num * 4) / 4;

  const fractionMap = {
    0.25: "¼",
    0.5: "½",
    0.75: "¾",
  };

  const fractionalPart = rounded % 1;
  const wholePart = Math.floor(rounded);

  if (fractionMap[fractionalPart]) {
    return wholePart === 0
      ? fractionMap[fractionalPart]
      : `${wholePart}${fractionMap[fractionalPart]}`;
  }

  return rounded.toString();
}
