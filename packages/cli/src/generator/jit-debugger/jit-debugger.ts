export class JitDebugger {

  static attachSourceURL(code: string, filename: string, sourceRoot: string = 'bunner://jit'): string {

    if (code.includes('//# sourceURL=')) {
      return code;
    }
    return `${code}\n//# sourceURL=${sourceRoot}/${filename}`;
  }

  static prettyPrint(code: string): string {
    let indentLevel = 0;
    const indentString = '  ';

    return code
      .replace(/\{/g, '{\n') 
      .replace(/\}/g, '\n}') 
      .replace(/;/g, ';\n') 
      .split('\n')
      .map(line => {
        line = line.trim();
        if (!line) {
          return '';
        }

        if (line.startsWith('}')) {
          indentLevel = Math.max(0, indentLevel - 1);
        }

        const indented = indentString.repeat(indentLevel) + line;

        if (line.endsWith('{')) {
          indentLevel++;
        }

        return indented;
      })
      .join('\n');
  }

  static safeIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_$]/g, '_');
  }
}