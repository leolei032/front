import path from 'path';

export default function bannerLoader(this: any, source: string) {
  const file = path.basename(this.resourcePath || '');
  const banner = `// [bannerLoader] ${file}\n`;
  return banner + source;
}

