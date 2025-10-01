import { Logger } from '../../src/logger';

const logger = Logger.getInstance();

// 연속 다회 호출
for (let i = 0; i < 50; i++) {
  logger.init();
}

// 병렬 호출 두 라운드
await Promise.all(Array.from({ length: 32 }, () => Promise.resolve().then(() => logger.init())));
await Promise.all(Array.from({ length: 32 }, () => Promise.resolve().then(() => logger.init())));

// 각 레벨 한 번씩 호출
logger.trace('TRACE_OK_FFI_SINGLETON');
logger.debug('DEBUG_OK_FFI_SINGLETON');
logger.info('INFO_OK_FFI_SINGLETON');
logger.warn('WARN_OK_FFI_SINGLETON');
logger.error('ERROR_OK_FFI_SINGLETON');

// 인코딩 검증용 메시지 (정확 비교 가능한 마커 포함)
const unicodeMsg = '한글✓🙂 UTF-8 message';
const longMsg = 'x'.repeat(100);
const emptyMsg = '';

logger.info(`UTF8_EMPTY:${emptyMsg}`);
logger.info(`UTF8_UNICODE:${unicodeMsg}`);
logger.info(`UTF8_LONG:${longMsg}`);
