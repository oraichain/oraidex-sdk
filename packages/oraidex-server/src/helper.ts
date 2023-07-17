export function parseSymbolsToTickerId(symbols: [string, string]) {
  return `${symbols[1]}_${symbols[0]}`;
}
