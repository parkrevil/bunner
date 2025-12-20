/**
 * JIT 생성 코드의 디버깅을 돕는 유틸리티
 */
export class JitDebugger {
  /**
   * 생성된 함수 코드에 SourceURL을 추가하여 디버거에서 파일처럼 인식되게 합니다.
   * @param code 생성된 JS 코드 본문
   * @param filename 가상 파일명 (e.g., 'UserController.factory.js')
   * @param sourceRoot (Optional) 가상 경로 루트 (default: 'bunner://jit')
   */
  static attachSourceURL(code: string, filename: string, sourceRoot: string = 'bunner://jit'): string {
    // 이미 존재하는지 체크
    if (code.includes('//# sourceURL=')) {
      return code;
    }
    return `${code}\n//# sourceURL=${sourceRoot}/${filename}`;
  }

  /**
   * 생성된 코드를 사람이 읽기 좋게 포맷팅합니다. (Simple Pretty Printer)
   * 복잡한 AST 기반 포맷터 대신, 정규식 기반의 가벼운 들여쓰기를 적용합니다.
   */
  static prettyPrint(code: string): string {
    let indentLevel = 0;
    const indentString = '  ';

    return code
      .replace(/\{/g, '{\n') // { 뒤에 줄바꿈
      .replace(/\}/g, '\n}') // } 앞에 줄바꿈
      .replace(/;/g, ';\n') // ; 뒤에 줄바꿈
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

  /**
   * 코드 생성 시 안전한 변수명 사용을 위해 이스케이프 처리
   * (JIT Injection 방지)
   */
  static safeIdentifier(name: string): string {
    return name.replace(/[^a-zA-Z0-9_$]/g, '_');
  }
}
