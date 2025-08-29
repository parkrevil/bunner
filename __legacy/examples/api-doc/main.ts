import { Bunner } from '../../src/web-application/bunner-web-application';

/**
 * Bunner Framework API Documentation Example
 * 
 * This example demonstrates the enableApiDocument feature of the Bunner framework.
 * Shows various methods of providing API specifications.
 */
async function main() {
  const port = 4000;
  const app = new Bunner();

  // Sample data
  const users = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      createdAt: new Date().toISOString()
    }
  ];

  const posts = [
    {
      id: 1,
      title: 'First Post',
      content: 'This is the content of the first post.',
      authorId: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: 2,
      title: 'Second Post',
      content: 'This is the content of the second post.',
      authorId: 2,
      createdAt: new Date().toISOString()
    }
  ];

  // Main route
  app.get('/', (req, res) => {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bunner API Document Example</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            .link { display: block; margin: 10px 0; padding: 10px; background: #f0f0f0; text-decoration: none; color: #333; }
            .link:hover { background: #e0e0e0; }
          </style>
        </head>
        <body>
          <h1>Bunner API Document Example</h1>
          <p>Access various API documentation through the following links:</p>
          
          <h2>YAML File Based</h2>
          <a href="/api-doc-yaml" class="link">📄 YAML File Based API Documentation</a>
          <a href="/api-doc-yaml/spec.yaml" class="link">🔗 View YAML Spec File Directly</a>
          
          <h2>JSON File Based</h2>
          <a href="/api-doc-json" class="link">📄 JSON File Based API Documentation</a>
          <a href="/api-doc-json/spec.json" class="link">🔗 View JSON Spec File Directly</a>
          
          <h2>Inline Content Based</h2>
          <a href="/api-doc-inline-yaml" class="link">📝 Inline YAML Content API Documentation</a>
          <a href="/api-doc-inline-json" class="link">📝 Inline JSON Content API Documentation</a>
          
          <h2>External URL Based</h2>
          <a href="/api-doc-external" class="link">🌐 External URL Based API Documentation (GitHub API)</a>
          
          <h2>API Endpoints</h2>
          <a href="/api/users" class="link">👥 Users API</a>
          <a href="/api/posts" class="link">📝 Posts API</a>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  });

  // Enable YAML file based API documentation
  await app.enableApiDocument('/api-doc-yaml', './spec.yaml');

  // Enable JSON file based API documentation
  await app.enableApiDocument('/api-doc-json', './spec.json');

  // Enable inline YAML content based API documentation
  const inlineYaml = `
openapi: 3.0.0
info:
  title: Inline YAML API
  version: 1.0.0
paths:
  /api/example:
    get:
      summary: Example endpoint
      responses:
        '200':
          description: Success
  `;
  await app.enableApiDocument('/api-doc-inline-yaml', inlineYaml);

  // Enable inline JSON content based API documentation
  const inlineJson = JSON.stringify({
    openapi: '3.0.0',
    info: {
      title: 'Inline JSON API',
      version: '1.0.0'
    },
    paths: {
      '/api/example': {
        get: {
          summary: 'Example endpoint',
          responses: {
            '200': {
              description: 'Success'
            }
          }
        }
      }
    }
  }, null, 2);
  await app.enableApiDocument('/api-doc-inline-json', inlineJson);

  // Enable external URL based API documentation (GitHub API)
  await app.enableApiDocument('/api-doc-external', 'https://api.apis.guru/v2/specs/github.com/1.1.4/openapi.yaml');

  // Sample API endpoints
  app.get('/api/users', (req, res) => {
    return users;
  });

  app.post('/api/users', async (req, res) => {
    const body = await req.body;
    const newUser = {
      id: Date.now(),
      name: body.name,
      email: body.email,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);

    res.setStatus(201);
    return newUser;
  });

  app.get('/api/users/:id', (req, res) => {
    const params = req.params as Record<string, string>;
    const id = parseInt(params.id || '0');

    const user = users.find(u => u.id === id);
    if (!user) {
      res.setStatus(404);
      return { error: 'User not found' };
    }

    return user;
  });

  app.get('/api/posts', (req, res) => {
    return posts;
  });

  app.post('/api/posts', async (req, res) => {
    const body = await req.body;
    const newPost = {
      id: Date.now(),
      title: body.title,
      content: body.content,
      authorId: body.authorId,
      createdAt: new Date().toISOString()
    };

    posts.push(newPost);

    res.setStatus(201);
    return newPost;
  });

  app.get('/api/posts/:id', (req, res) => {
    const params = req.params as Record<string, string>;
    const id = parseInt(params.id || '0');

    const post = posts.find(p => p.id === id);
    if (!post) {
      res.setStatus(404);
      return { error: 'Post not found' };
    }

    return post;
  });

  // Start server
  await app.listen('0.0.0.0', port);

  console.log('🚀 Bunner API Document Example server started!');
  console.log(`📖 Main page: http://localhost:${port}`);
  console.log(`📄 YAML API documentation: http://localhost:${port}/api-doc-yaml`);
  console.log(`📄 JSON API documentation: http://localhost:${port}/api-doc-json`);
  console.log(`📝 Inline YAML documentation: http://localhost:${port}/api-doc-inline-yaml`);
  console.log(`📝 Inline JSON documentation: http://localhost:${port}/api-doc-inline-json`);
  console.log(`🌐 External URL documentation: http://localhost:${port}/api-doc-external`);
  console.log(`👥 Users API: http://localhost:${port}/api/users`);
  console.log(`📝 Posts API: http://localhost:${port}/api/posts`);
}

main().catch(console.error);
