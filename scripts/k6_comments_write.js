import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const payload = JSON.stringify({
    docId: 1,
    content: `load-${__VU}-${__ITER}`,
  });

  const res = http.post(__ENV.TARGET, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200/201': (r) => r.status === 200 || r.status === 201,
  });
}
