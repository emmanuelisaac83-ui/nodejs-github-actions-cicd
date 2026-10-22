const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../index');

test('GET / returns the CI/CD deployment home page successfully', async () => {
    const response = await request(app).get('/');

    assert.equal(response.status, 200);
    assert.match(response.text, /Node\.js CI\/CD Deployment Demo/);
    assert.match(response.text, /deployed on AWS EC2 using GitHub Actions/i);
    assert.match(response.text, /AWS OIDC and Systems Manager/i);
    assert.match(response.text, /emmanuelisaac83-ui\/nodejs-github-actions-cicd/);
});