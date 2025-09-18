# API Documentation

## Base URL
```
http://localhost:5000/api
```

## Authentication
All protected routes require a JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Endpoints

### Authentication

#### POST /auth/login
Login user
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### POST /auth/register
Register new user
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "user@example.com",
  "password": "password123",
  "role": "user"
}
```

#### POST /auth/forgot-password
Request password reset
```json
{
  "email": "user@example.com"
}
```

#### POST /auth/reset-password
Reset password with token
```json
{
  "token": "reset_token",
  "password": "newpassword123"
}
```

### Users

#### GET /users
Get all users (Admin only)

#### GET /users/profile
Get current user profile

#### PUT /users/profile
Update user profile
```json
{
  "firstName": "John",
  "lastName": "Doe"
}
```

#### POST /users/change-password
Change user password
```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

### Tests

#### GET /tests
Get all tests

#### POST /tests
Create new test
```json
{
  "title": "JavaScript Fundamentals",
  "description": "Test on JS basics",
  "type": "technical",
  "duration": 60,
  "questions": []
}
```

#### GET /tests/:id
Get test by ID

#### PUT /tests/:id
Update test

#### DELETE /tests/:id
Delete test

#### POST /tests/:id/attempt
Start test attempt

#### POST /tests/:id/submit
Submit test answers
```json
{
  "answers": [
    {
      "questionId": "q1",
      "answer": "option1"
    }
  ]
}
```

### AI

#### POST /ai/generate-questions
Generate questions from resume
```json
{
  "resumeText": "...",
  "testType": "technical",
  "questionCount": 10
}
```

#### POST /ai/analyze-resume
Analyze resume for skills
```json
{
  "resumeText": "..."
}
```

### Reports

#### GET /reports/test-results/:testId
Get test results

#### GET /reports/user-analytics/:userId
Get user analytics

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {},
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": {
    "code": "ERROR_CODE",
    "details": "Detailed error information"
  }
}
```

## Status Codes

- 200: Success
- 201: Created
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 422: Validation Error
- 500: Internal Server Error

### Interviews

All Interview routes are protected. Roles: `super-admin`, `admin`, `company`.

#### GET /interviews
List interviews with filters and pagination.

Query params:
- `page` (number, default 1)
- `limit` (number, default 10)
- `status` (string: scheduled|in-progress|completed|cancelled|rescheduled|no-show)
- `type` (string: technical|behavioral|hr|final|phone|video|onsite)
- `startDate` (ISO date)
- `endDate` (ISO date)
- `candidateId` (ObjectId)
- `interviewerId` (ObjectId)

Response
```json
{
  "success": true,
  "data": [ { "_id": "...", "title": "...", "scheduledDate": "..." } ],
  "pagination": { "currentPage": 1, "totalPages": 3, "totalItems": 24, "hasNext": true, "hasPrev": false }
}
```

#### GET /interviews/:id
Get interview by ID.

#### POST /interviews
Create interview.
```json
{
  "title": "Tech Round",
  "description": "Node + System design",
  "candidateId": "<candidateObjectId>",
  "interviewerId": "<userObjectId>",
  "scheduledDate": "2025-09-20T10:30:00.000Z",
  "duration": 60,
  "type": "technical",
  "mode": "online",
  "meetingLink": "https://meet.example.com/abc",
  "location": "",
  "priority": "medium",
  "preparation": { "topics": ["DSA", "Node"] },
  "attendees": [{ "userId": "<userId>", "role": "interviewer" }],
  "relatedTestId": "<testId>",
  "relatedTestResultId": "<testResultId>"
}
```

#### PUT /interviews/:id
Update interview (fields: title, description, scheduledDate, duration, type, mode, meetingLink, location, priority, preparation, attendees, status, feedback).

#### DELETE /interviews/:id
Delete interview.

#### GET /interviews/upcoming
Upcoming interviews for the next N days (default 7).

Query params:
- `days` (number, default 7)
- `limit` (number, default 10)

Response
```json
{ "success": true, "data": [ /* interviews */ ], "count": 3 }
```

#### GET /interviews/stats
Aggregate statistics for interviews.

Query params:
- `startDate` (ISO date, optional)
- `endDate` (ISO date, optional)

Response
```json
{
  "success": true,
  "data": {
    "totalInterviews": 12,
    "scheduledCount": 6,
    "completedCount": 5,
    "cancelledCount": 1,
    "avgDuration": 58,
    "avgRating": 8.2
  }
}
```

#### POST /interviews/:id/attendees
Add attendee to an interview.

Request
```json
{ "userId": "<userId>", "role": "interviewer" }
```

Response
```json
{ "success": true, "message": "Attendee added", "data": [ /* attendees */ ] }
```

#### DELETE /interviews/:id/attendees/:attendeeId
Remove an attendee from an interview.

#### PUT /interviews/:id/attendees/:attendeeId/confirm
Confirm or unconfirm attendee participation.

Request
```json
{ "confirmed": true }
```

### Analytics KPIs

#### GET /analytics/kpi/admin
Returns admin dashboard KPIs. Responses are cached in-memory for 60 seconds to reduce DB load.

Response
```json
{
  "success": true,
  "data": {
    "totalTests": 120,
    "activeTests": 87,
    "totalUsers": 540,
    "systemHealth": "Good"
  }
}
```

#### GET /analytics/kpi/company
Returns company dashboard KPIs including a real count of upcoming interviews in the next 7 days. Responses are cached in-memory for 60 seconds per company.

Response
```json
{
  "success": true,
  "data": {
    "activeTests": 12,
    "candidatesToday": 4,
    "successRate": 67,
    "upcomingInterviews": 3
  }
}
```
