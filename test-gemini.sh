#!/bin/bash
curl -X POST http://localhost:3000/gemini/generate \
     -H "Content-Type: application/json" \
     -d '{"prompt": "Hello Gemini, explain the benefits of deadlifts in one sentence."}'
echo
