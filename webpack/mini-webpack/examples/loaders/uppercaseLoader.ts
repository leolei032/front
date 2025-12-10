export default function uppercaseLoader(source: string) {
  const lines = source.split('\n');
  const commented = lines.map((line) => `// ${line.toUpperCase()}`).join('\n');
  return `${source}\n\n${commented}\n`;
}

