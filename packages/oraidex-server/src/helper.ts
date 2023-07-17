export function parseSymbolsToTickerId(symbols: [string, string]) {
  return `${symbols[0]}_${symbols[1]}`;
}
