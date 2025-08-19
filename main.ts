import { fetch } from 'bun';
import { Bunner } from './src/bunner';

const bunner = new Bunner();

bunner.get('/', (req, res) => {
  res.send('Hello World');
});

bunner.listen('0.0.0.0', 3030, () => {
  console.log('Server is running on http://0.0.0.0:3030');
});

fetch('http://localhost:3030/').then(res => res.text());