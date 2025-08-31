# User Tracking Middleware

This middleware automatically tracks user interactions with the bot and updates user data in the database. It also logs changes to username, first name, and last name to the configured logs chat.

## Features

- **Automatic User Tracking**: Captures all user interactions (messages, button clicks, etc.)
- **Database Updates**: Automatically updates user information in the database
- **Change Logging**: Sends detailed logs to the logs chat when user info changes
- **Rate Limiting**: Prevents excessive database calls with intelligent caching
- **New User Detection**: Logs when new users first interact with the bot

## How It Works

The middleware runs on every user interaction and:

1. Extracts user information from the Telegram context
2. Compares current Telegram data with stored database data
3. Updates the database if changes are detected
4. Sends detailed change logs to the logs chat
5. Creates basic user entries for new users

## Configuration

### Environment Variables

- `USER_TRACKER_DEBUG=true` - Enable debug logging (optional)

### Settings

The middleware uses the `LOGS` chat ID from `settings.json` to send change notifications.

## Log Messages

### User Info Changes
```
👤 User info updated for @oldusername (123456789):
Username: @oldusername → @newusername
First name: Old Name → New Name
Last name: Old Last → New Last
```

### New User Interactions
```
🆕 New user interaction: @username (123456789)
```

## Database Schema

The middleware works with the existing database schema:

- `users` table: Basic user information
- `userRoles` table: User roles and permissions
- `userPurchases` table: User balance and ticket information
- `userGroups` table: User group memberships
- `userKickstarters` table: User kickstarter purchases

## Performance Considerations

- **Caching**: 5-minute cache prevents duplicate updates for the same user info
- **Selective Processing**: Skips channel posts, service messages, and other non-user content
- **Error Handling**: Gracefully handles database errors without breaking bot functionality

## Integration

The middleware is automatically loaded in both `index.js` and `indexf.js` and runs before other bot handlers.

## Testing

Run the test script to verify functionality:

```bash
node test_user_tracker.js
```

## Troubleshooting

### Debug Mode
Enable debug logging by setting:
```bash
export USER_TRACKER_DEBUG=true
```

### Common Issues
- **Database Connection**: Ensure database is accessible
- **Logs Chat**: Verify `LOGS` chat ID is correct in settings
- **Permissions**: Bot must have permission to send messages to logs chat

## Security

- Only tracks public user information (username, first name, last name)
- No sensitive data is logged
- All database operations use parameterized queries
- Error handling prevents information leakage
