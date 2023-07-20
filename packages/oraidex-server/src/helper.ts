export function parseSymbolsToTickerId(symbols: [string, string]) {
  return `${symbols[0]}_${symbols[1]}`;
}

export function getDate24hBeforeNow() {
  return new Date(new Date().setUTCHours(0, 0, 0, 0));
}
