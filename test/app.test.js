
const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../index');

test('GET / returns the home page successfully', async () => {
    const response = await request(app).get('/');

    assert.equal(response.status, 200);
    assert.match(response.text, /Simple Example of Node\.js App on Server/);
    assert.match(response.text, /boilerplate app/i);
});
