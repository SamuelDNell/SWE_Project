const request = require('supertest');
const app = require('../index'); // your Express app

describe('Multi-LLM Chat API', () => {

  it('should return responses from 3 models', async () => {
    const res = await request(app)
      .post('/api/chat/test') // we’ll create this route
      .send({ message: '2+2' });

    expect(res.statusCode).toBe(200);
    expect(res.body.model1).toBeDefined();
    expect(res.body.model2).toBeDefined();
    expect(res.body.model3).toBeDefined();
  });

});