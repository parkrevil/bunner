import { HttpMethod } from '../src/enums';
import { RadixRouter } from '../src/router/router';

console.log('Starting Debug Session');

const builder = new RadixRouter();
builder.add(HttpMethod.Get, '/proxy/*path');
const router = builder.build();

console.log('Router Built. Matching...');

const result = router.match(HttpMethod.Get, '/proxy/v1/api/users');

console.log('Match Result:', result ? 'FOUND' : 'NULL');
if (result) {
  console.log('Params:', JSON.stringify(result.params));
}

// Test 2: Standard parameter
const builder2 = new RadixRouter();
builder2.add(HttpMethod.Get, '/users/:id');
const router2 = builder2.build();
const result2 = router2.match(HttpMethod.Get, '/users/123');
console.log('Match Result 2:', result2 ? 'FOUND' : 'NULL');
if (result2) {
  console.log('Params 2:', JSON.stringify(result2.params));
}

// Test 3: Wildcard root
const builder3 = new RadixRouter();
builder3.add(HttpMethod.Get, '/*');
const router3 = builder3.build();
const result3 = router3.match(HttpMethod.Get, '/anything');
console.log('Match Result 3:', result3 ? 'FOUND' : 'NULL');
if (result3) {
  console.log('Params 3:', JSON.stringify(result3.params));
}
