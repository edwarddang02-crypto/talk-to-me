import { listPersonas, applyCors, handlePreflight } from '@persona-hub/core';

export default async function handler(req, res) {
  applyCors(res);
  if (handlePreflight(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = 200;
  res.end(JSON.stringify({ personas: listPersonas() }));
}
