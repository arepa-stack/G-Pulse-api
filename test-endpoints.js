const fs = require('fs');

const endpoints = [
    { method: 'GET', url: 'http://127.0.0.1:3000/' },
    { method: 'GET', url: 'http://127.0.0.1:3000/exercises' },
    { method: 'POST', url: 'http://127.0.0.1:3000/auth/register', body: {} },
    { method: 'POST', url: 'http://127.0.0.1:3000/auth/login', body: {} },
    { method: 'POST', url: 'http://127.0.0.1:3000/auth/forgot-password', body: {} },
    { method: 'GET', url: 'http://127.0.0.1:3000/users/profile' },
    { method: 'PATCH', url: 'http://127.0.0.1:3000/users/profile', body: {} },
    { method: 'POST', url: 'http://127.0.0.1:3000/routines', body: {} },
    { method: 'POST', url: 'http://127.0.0.1:3000/gemini/generate', body: {} }
];

async function testEndpoints() {
    const results = [];
    for (const ep of endpoints) {
        const options = {
            method: ep.method,
            headers: ep.method === 'POST' || ep.method === 'PATCH' ? { 'Content-Type': 'application/json' } : undefined,
            body: ep.body ? JSON.stringify(ep.body) : undefined
        };
        try {
            const res = await fetch(ep.url, options);
            const text = await res.text();
            results.push({ url: ep.url, method: ep.method, status: res.status, response: text });
        } catch (e) {
            results.push({ url: ep.url, method: ep.method, status: 'error', response: e.message });
        }
    }
    fs.writeFileSync('results.json', JSON.stringify(results, null, 2));
}

testEndpoints();
