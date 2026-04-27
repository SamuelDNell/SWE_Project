const { Given, When, Then } = require('@cucumber/cucumber');
const assert = require('assert');

// ─── Background ───────────────────────────────────────────────────────────────

Given('I am registered and logged in', function () {
  assert.ok(this.token, 'Expected a valid auth token after registration');
});

// ─── Given steps ─────────────────────────────────────────────────────────────

Given('I have uploaded a document with content {string}', async function (content) {
  const res = await this.request(this.app)
    .post('/api/chat/documents/upload')
    .set('Authorization', `Bearer ${this.token}`)
    .attach('document', Buffer.from(content), {
      filename: 'test-doc.txt',
      contentType: 'text/plain'
    });
  assert.strictEqual(res.status, 200, `Document upload failed: ${JSON.stringify(res.body)}`);
  this.uploadedDocIds.push(res.body._id);
});

Given('I have an active chat', async function () {
  const res = await this.request(this.app)
    .post('/api/chat/new')
    .set('Authorization', `Bearer ${this.token}`)
    .send({ title: 'Acceptance Test Chat', model: 'ollama:llama3.2:latest' });
  assert.strictEqual(res.status, 200);
  this.activeChatId = res.body._id;
});

Given('another user has uploaded a document with content {string}', async function (content) {
  const otherUser = await this.User.create({
    username: 'otheruser', email: 'other@test.com', password: 'password123'
  });
  const doc = await this.Document.create({
    user: otherUser._id, filename: 'private.txt',
    contentType: 'text/plain', size: content.length, content
  });
  this.otherUserDocId = doc._id.toString();
});

// ─── When steps ───────────────────────────────────────────────────────────────

When('I upload a text file named {string} with content {string}', async function (filename, content) {
  this.lastResponse = await this.request(this.app)
    .post('/api/chat/documents/upload')
    .set('Authorization', `Bearer ${this.token}`)
    .attach('document', Buffer.from(content), {
      filename,
      contentType: 'text/plain'
    });
});

When('I try to upload a file named {string} with type {string}', async function (filename, contentType) {
  this.lastResponse = await this.request(this.app)
    .post('/api/chat/documents/upload')
    .set('Authorization', `Bearer ${this.token}`)
    .attach('document', Buffer.from('fake data'), { filename, contentType });
});

When('I send a message with that document selected', async function () {
  assert.ok(this.activeChatId, 'No active chat — use "Given I have an active chat" first');

  // Stub axios so the Ollama call is intercepted and captured
  const self = this;
  this.axiosStub = this.sinon.stub(this.axios, 'post').callsFake((url, data) => {
    if (url.includes('11434')) self.capturedLLMPayload = data;
    return Promise.resolve({ data: { message: { content: 'Mocked response' } } });
  });

  this.lastResponse = await this.request(this.app)
    .post(`/api/chat/${this.activeChatId}`)
    .set('Authorization', `Bearer ${this.token}`)
    .send({
      message: 'Tell me what you know about the documents.',
      models: ['ollama:llama3.2:latest'],
      documentIds: this.uploadedDocIds
    });
});

When('I send a message with all documents selected', async function () {
  assert.ok(this.activeChatId, 'No active chat — use "Given I have an active chat" first');

  const self = this;
  this.axiosStub = this.sinon.stub(this.axios, 'post').callsFake((url, data) => {
    if (url.includes('11434')) self.capturedLLMPayload = data;
    return Promise.resolve({ data: { message: { content: 'Mocked response' } } });
  });

  this.lastResponse = await this.request(this.app)
    .post(`/api/chat/${this.activeChatId}`)
    .set('Authorization', `Bearer ${this.token}`)
    .send({
      message: 'Summarize everything.',
      models: ['ollama:llama3.2:latest'],
      documentIds: this.uploadedDocIds
    });
});

When('I send a message referencing that other user\'s document', async function () {
  assert.ok(this.activeChatId, 'No active chat — use "Given I have an active chat" first');

  const self = this;
  this.axiosStub = this.sinon.stub(this.axios, 'post').callsFake((url, data) => {
    if (url.includes('11434')) self.capturedLLMPayload = data;
    return Promise.resolve({ data: { message: { content: 'Mocked response' } } });
  });

  this.lastResponse = await this.request(this.app)
    .post(`/api/chat/${this.activeChatId}`)
    .set('Authorization', `Bearer ${this.token}`)
    .send({
      message: 'What is in the private document?',
      models: ['ollama:llama3.2:latest'],
      documentIds: [this.otherUserDocId]
    });
});

When('I delete that document', async function () {
  assert.ok(this.uploadedDocIds.length > 0, 'No uploaded document to delete');
  this.lastResponse = await this.request(this.app)
    .delete(`/api/chat/documents/${this.uploadedDocIds[0]}`)
    .set('Authorization', `Bearer ${this.token}`);
});

// ─── Then steps ───────────────────────────────────────────────────────────────

Then('the upload should succeed', function () {
  assert.strictEqual(
    this.lastResponse.status, 200,
    `Expected 200 but got ${this.lastResponse.status}: ${JSON.stringify(this.lastResponse.body)}`
  );
});

Then('{string} should appear in my document list', async function (filename) {
  const res = await this.request(this.app)
    .get('/api/chat/documents')
    .set('Authorization', `Bearer ${this.token}`);
  assert.strictEqual(res.status, 200);
  const found = res.body.some(d => d.filename === filename);
  assert.ok(found, `Expected "${filename}" in document list but got: ${res.body.map(d => d.filename)}`);
});

Then('the LLM should receive the document content in the system prompt', function () {
  assert.ok(this.capturedLLMPayload, 'No LLM payload was captured — is Ollama being called?');
  const systemContent = this.capturedLLMPayload.messages[0].content;
  assert.ok(
    systemContent.includes('Use the following documents'),
    'Expected system prompt to include document context header'
  );
});

Then('the LLM should receive both documents in the system prompt', function () {
  assert.ok(this.capturedLLMPayload, 'No LLM payload was captured');
  const systemContent = this.capturedLLMPayload.messages[0].content;
  assert.ok(
    systemContent.includes('Chapter 1 covers arrays'),
    'Expected first document content in system prompt'
  );
  assert.ok(
    systemContent.includes('Chapter 2 covers linked lists'),
    'Expected second document content in system prompt'
  );
});

Then('my document list should be empty', async function () {
  const res = await this.request(this.app)
    .get('/api/chat/documents')
    .set('Authorization', `Bearer ${this.token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.length, 0, `Expected empty list but got ${res.body.length} document(s)`);
});

Then('the upload should fail with status {int}', function (status) {
  assert.strictEqual(
    this.lastResponse.status, status,
    `Expected ${status} but got ${this.lastResponse.status}`
  );
});

Then('the LLM should not receive {string} in the system prompt', function (text) {
  assert.ok(this.capturedLLMPayload, 'No LLM payload was captured');
  const systemContent = this.capturedLLMPayload.messages[0].content;
  assert.ok(
    !systemContent.includes(text),
    `Expected system prompt NOT to contain "${text}" but it did`
  );
});
