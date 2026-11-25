import { describe, expect, it } from 'vitest';
import { retiredUniversityResponse } from './university-availability';

describe('retired university', () => {
  it.each(['/universidade.html', '/universidade/', '/manifest-universidade.webmanifest', '/question-images/example.png', '/resources/question-visual-map.json', '/api/edu/admin/overview', '/api/edu/progress', '/api/edu/email/session'])('denies or redirects %s', path => {
    const result = retiredUniversityResponse(new Request('https://example.test'+path));
    expect(result).not.toBeNull();
    expect([303,410]).toContain(result!.status);
  });
  it.each(['/api/edu/login','/api/edu/me','/api/edu/access-status','/api/edu/first-access','/api/edu/password','/api/phone/bootstrap','/obra.html','/api/project','/academy/'])('preserves %s', path => {
    expect(retiredUniversityResponse(new Request('https://example.test'+path,{method:'POST'}))).toBeNull();
  });
});
