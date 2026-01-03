import * as readline from 'node:readline/promises';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function main() {
  try {
    const answer = await rl.question('n x n = ? ');
    const numbers = answer.trim().split(/\s+/);

    if (numbers.length !== 2) {
      console.log('두 개의 숫자를 입력해주세요. 예: 8 2');
      rl.close();
      return;
    }

    const num1 = parseInt(numbers[0], 10);
    const num2 = parseInt(numbers[1], 10);

    if (isNaN(num1) || isNaN(num2)) {
      console.log('유효한 숫자를 입력해주세요.');
      rl.close();
      return;
    }

    const result = num1 * num2;
    console.log(result);

    rl.close();
  } catch (error) {
    console.error('오류 발생:', error);
    rl.close();
    process.exit(1);
  }
}

main();
