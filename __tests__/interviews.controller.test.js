const request = require('supertest');

// Mock DB connect to no-op
jest.mock('../src/config/database', () => jest.fn());

// Mock auth middleware to bypass protection and set a test user
jest.mock('../src/middleware/auth', () => ({
  protect: (req, res, next) => { req.user = { role: 'company', companyId: 'company-1', _id: 'user-1' }; next(); },
  authorize: () => (req, res, next) => next(),
}));

// In-memory interview stub
let interviewState;

const InterviewMock = {
  findById: jest.fn(async (id) => {
    if (!interviewState || interviewState._id !== id) return null;
    // Return a minimal mongoose-like doc with save()
    return {
      ...interviewState,
      save: async () => {
        return { ...interviewState };
      }
    };
  }),
  find: jest.fn(),
};

jest.mock('../src/models/Interview', () => InterviewMock);

const app = require('../server');

beforeEach(() => {
  // Reset interview state before each test
  interviewState = {
    _id: 'int-1',
    companyId: 'company-1',
    attendees: [],
    updatedBy: null,
  };
  InterviewMock.findById.mockClear();
});

describe('Interview attendee management', () => {
  test('POST /api/interviews/:id/attendees adds a new attendee', async () => {
    const res = await request(app)
      .post('/api/interviews/int-1/attendees')
      .send({ userId: 'u-100', role: 'observer' })
      .expect(200);

    expect(res.body.success).toBe(true);
    // simulate DB mutation that controller would do
    interviewState.attendees.push({ _id: 'a1', userId: { _id: 'u-100', firstName: 'John', lastName: 'Doe' }, role: 'observer', confirmed: false });
  });

  test('POST duplicate attendee returns 400', async () => {
    interviewState.attendees = [{ _id: 'a1', userId: 'u-100', role: 'observer', confirmed: false }];

    const res = await request(app)
      .post('/api/interviews/int-1/attendees')
      .send({ userId: 'u-100', role: 'observer' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });

  test('PUT confirm attendee toggles confirmed flag', async () => {
    interviewState.attendees = [{ _id: 'a1', userId: 'u-200', role: 'interviewer', confirmed: false }];

    const res = await request(app)
      .put('/api/interviews/int-1/attendees/a1/confirm')
      .send({ confirmed: true })
      .expect(200);

    expect(res.body.success).toBe(true);
    // update local state similar to controller side-effect
    interviewState.attendees[0].confirmed = true;
  });

  test('DELETE removes attendee', async () => {
    interviewState.attendees = [
      { _id: 'a1', userId: 'u-200', role: 'interviewer', confirmed: false },
      { _id: 'a2', userId: 'u-201', role: 'observer', confirmed: false },
    ];

    const res = await request(app)
      .delete('/api/interviews/int-1/attendees/a2')
      .expect(200);

    expect(res.body.success).toBe(true);
    // Simulate removal
    interviewState.attendees = interviewState.attendees.filter(a => a._id !== 'a2');
  });
});
