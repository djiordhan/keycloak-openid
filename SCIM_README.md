# SCIM Implementation

This application now includes SCIM (System for Cross-domain Identity Management) v2.0 endpoints for user provisioning.

## Endpoints

All SCIM endpoints are available under `/scim/v2/`:

### Core User Operations
- `GET /scim/v2/Users` - List users with filtering and pagination
- `GET /scim/v2/Users/{id}` - Get specific user
- `POST /scim/v2/Users` - Create new user
- `PUT /scim/v2/Users/{id}` - Update user (full replacement)
- `PATCH /scim/v2/Users/{id}` - Partial update user
- `DELETE /scim/v2/Users/{id}` - Delete user

### Discovery Endpoints
- `GET /scim/v2/ServiceProviderConfig` - SCIM service provider configuration
- `GET /scim/v2/ResourceTypes` - Available resource types
- `GET /scim/v2/Schemas` - SCIM schemas

## Authentication

All SCIM endpoints require Bearer token authentication. Set your token in the `.env` file:

```
SCIM_TOKEN=your-scim-bearer-token-here
```

Include the token in requests:
```
Authorization: Bearer your-scim-bearer-token-here
```

## Example Usage

### Create a User
```bash
curl -X POST http://localhost:3000/scim/v2/Users \
  -H "Authorization: Bearer your-scim-bearer-token-here" \
  -H "Content-Type: application/scim+json" \
  -d '{
    "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
    "userName": "john.doe@example.com",
    "name": {
      "formatted": "John Doe",
      "givenName": "John",
      "familyName": "Doe"
    },
    "emails": [{
      "value": "john.doe@example.com",
      "primary": true
    }],
    "active": true
  }'
```

### List Users
```bash
curl -X GET "http://localhost:3000/scim/v2/Users?startIndex=1&count=10" \
  -H "Authorization: Bearer your-scim-bearer-token-here" \
  -H "Content-Type: application/scim+json"
```

### Filter Users
```bash
curl -X GET 'http://localhost:3000/scim/v2/Users?filter=userName eq "john.doe@example.com"' \
  -H "Authorization: Bearer your-scim-bearer-token-here" \
  -H "Content-Type: application/scim+json"
```

### Update User Status (PATCH)
```bash
curl -X PATCH http://localhost:3000/scim/v2/Users/1 \
  -H "Authorization: Bearer your-scim-bearer-token-here" \
  -H "Content-Type: application/scim+json" \
  -d '{
    "schemas": ["urn:ietf:params:scim:api:messages:2.0:PatchOp"],
    "Operations": [{
      "op": "replace",
      "path": "active",
      "value": false
    }]
  }'
```

## Database Schema

The User model has been updated to support SCIM fields:

- `userName` - Unique identifier for SCIM users
- `active` - User status (active/inactive)
- `externalId` - External system identifier
- `keycloakId` - Made optional to support SCIM-only users

## Testing

Run the test script to verify SCIM endpoints:

```bash
node test-scim.js
```

Make sure your server is running and the SCIM_TOKEN in the test file matches your .env configuration.

## Integration with Identity Providers

This SCIM implementation can be integrated with identity providers like:
- Okta
- Azure AD
- Google Workspace
- OneLogin
- Auth0

Configure your identity provider to use:
- Base URL: `http://your-domain.com/scim/v2`
- Authentication: Bearer Token
- Token: Your configured SCIM_TOKEN

## Security Notes

1. Use a strong, unique token for SCIM_TOKEN
2. Consider implementing more robust authentication (OAuth 2.0, mutual TLS)
3. Add rate limiting for production use
4. Implement proper logging and monitoring
5. Use HTTPS in production environments