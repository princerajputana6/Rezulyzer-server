# Admin Scripts

## Create Admin User

To fix the 401 Unauthorized error when accessing `/users` or `/user-management`, you need to promote a user to admin role.

### Usage

1. First, register a user through the application or ensure you have a user account
2. Run the admin promotion script:

```bash
cd server
node scripts/createAdmin.js <your-email@example.com>
```

### Example

```bash
node scripts/createAdmin.js admin@example.com
```

This will:
- Find the user with the specified email
- Update their role from 'user' to 'admin'
- Display the updated user information

### Prerequisites

- MongoDB must be running
- The user must already exist in the database
- Environment variables must be properly configured

### Troubleshooting

If you get "User not found":
1. Make sure the email is correct
2. Verify the user exists by checking the database
3. Ensure you're connected to the correct MongoDB instance

After promoting a user to admin:
1. The user needs to log out and log back in
2. They should now have access to `/users` and user management features
