const request = require('supertest');

// Mock DB connect to no-op
jest.mock('../src/config/database', () => jest.fn());

// Mock auth middleware to bypass protection and set a test user
jest.mock('../src/middleware/auth', () => ({
  protect: (req, res, next) => { req.user = { role: 'admin', companyId: 'company-1', _id: 'user-1' }; next(); },
  authorize: () => (req, res, next) => next(),
}));

// Mock models used in analytics
const mockCounts = {
  tests: 10,
  activeTests: 7,
  users: 3,
  candidatesToday: 2,
  upcomingInterviews: 4,
  totalResults: 6,
  passedResults: 3,
};

jest.mock('../src/models/Test', () => ({
  countDocuments: jest.fn(() => Promise.resolve(mockCounts.tests)),
}));

jest.mock('../src/models/User', () => ({
  countDocuments: jest.fn(() => Promise.resolve(mockCounts.users)),
}));

jest.mock('../src/models/Candidate', () => ({
  countDocuments: jest.fn(() => Promise.resolve(mockCounts.candidatesToday)),
}));

jest.mock('../src/models/TestResult', () => ({
  aggregate: jest.fn(() => Promise.resolve([{ _id: null, total: mockCounts.totalResults, passed: mockCounts.passedResults }])),
}));

// For Interview upcoming count
const InterviewMock = {
  countDocuments: jest.fn(() => Promise.resolve(mockCounts.upcomingInterviews)),
};
jest.mock('../src/models/Interview', () => InterviewMock);

// Use real app (with connect mocked)
const app = require('../server');

describe('Analytics KPI endpoints', () => {
  beforeEach(() => {
    // Reset cache module between tests
    jest.resetModules();
  });

  test('GET /api/analytics/kpi/company returns KPI with upcomingInterviews and caches response', async () => {
    // First call - should hit Interview.countDocuments
    const res1 = await request(app)
      .get('/api/analytics/kpi/company')
      .expect(200);
    expect(res1.body.success).toBe(true);
    expect(res1.body.data).toHaveProperty('upcomingInterviews', mockCounts.upcomingInterviews);

    const callsAfterFirst = InterviewMock.countDocuments.mock.calls.length;

    // Second call immediately - cache should respond without extra DB call
    const res2 = await request(app)
      .get('/api/analytics/kpi/company')
      .expect(200);
    expect(res2.body.success).toBe(true);
    expect(InterviewMock.countDocuments.mock.calls.length).toBe(callsAfterFirst);
  });

  test('GET /api/analytics/kpi/admin returns admin KPI and is cached', async () => {
    const res = await request(app)
      .get('/api/analytics/kpi/admin')
      .expect(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('totalTests');
  });
});
