const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// SCIM Schema definitions
const SCIM_SCHEMAS = {
  USER: 'urn:ietf:params:scim:schemas:core:2.0:User',
  LIST_RESPONSE: 'urn:ietf:params:scim:api:messages:2.0:ListResponse',
  ERROR: 'urn:ietf:params:scim:api:messages:2.0:Error'
};

// Helper function to convert Prisma user to SCIM format
function toScimUser(user) {
  return {
    schemas: [SCIM_SCHEMAS.USER],
    id: user.id.toString(),
    externalId: user.externalId,
    userName: user.userName || user.email,
    name: {
      formatted: user.name,
      familyName: user.name ? user.name.split(' ').slice(-1)[0] : undefined,
      givenName: user.name ? user.name.split(' ')[0] : undefined
    },
    emails: user.email ? [{
      value: user.email,
      primary: true
    }] : [],
    active: user.active,
    meta: {
      resourceType: 'User',
      created: user.createdAt.toISOString(),
      lastModified: user.updatedAt.toISOString(),
      location: `/scim/v2/Users/${user.id}`
    }
  };
}

// Helper function to create error response
function createErrorResponse(status, detail, scimType = null) {
  return {
    schemas: [SCIM_SCHEMAS.ERROR],
    status: status.toString(),
    detail,
    scimType
  };
}

// Middleware for basic authentication (you should implement proper auth)
function authenticateScim(req, res, next) {
  // Basic implementation - you should use proper authentication
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json(createErrorResponse(401, 'Unauthorized'));
  }
  
  // Validate token here - for now, just check if it exists
  const token = auth.substring(7);
  if (!token || token !== process.env.SCIM_TOKEN) {
    return res.status(401).json(createErrorResponse(401, 'Invalid token'));
  }
  
  next();
}

// Apply authentication to all SCIM routes
router.use(authenticateScim);

// GET /Users - List users with filtering and pagination
router.get('/Users', async (req, res) => {
  try {
    const { startIndex = 1, count = 100, filter } = req.query;
    const skip = Math.max(0, parseInt(startIndex) - 1);
    const take = Math.min(parseInt(count), 100);

    let where = {};
    
    // Basic filter parsing for userName
    if (filter) {
      const userNameMatch = filter.match(/userName eq "([^"]+)"/);
      if (userNameMatch) {
        where.userName = userNameMatch[1];
      }
    }

    const [users, totalResults] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'asc' }
      }),
      prisma.user.count({ where })
    ]);

    const scimUsers = users.map(toScimUser);

    res.json({
      schemas: [SCIM_SCHEMAS.LIST_RESPONSE],
      totalResults,
      startIndex: parseInt(startIndex),
      itemsPerPage: scimUsers.length,
      Resources: scimUsers
    });
  } catch (error) {
    console.error('SCIM Users list error:', error);
    res.status(500).json(createErrorResponse(500, 'Internal server error'));
  }
});

// GET /Users/:id - Get specific user
router.get('/Users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json(createErrorResponse(400, 'Invalid user ID'));
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json(createErrorResponse(404, 'User not found'));
    }

    res.json(toScimUser(user));
  } catch (error) {
    console.error('SCIM User get error:', error);
    res.status(500).json(createErrorResponse(500, 'Internal server error'));
  }
});

// POST /Users - Create user
router.post('/Users', async (req, res) => {
  try {
    const { userName, name, emails, active = true, externalId } = req.body;

    if (!userName) {
      return res.status(400).json(createErrorResponse(400, 'userName is required'));
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { userName }
    });

    if (existingUser) {
      return res.status(409).json(createErrorResponse(409, 'User already exists', 'uniqueness'));
    }

    const userData = {
      userName,
      name: name?.formatted || name?.givenName + (name?.familyName ? ` ${name.familyName}` : ''),
      email: emails?.[0]?.value,
      active,
      externalId
    };

    const user = await prisma.user.create({
      data: userData
    });

    res.status(201).json(toScimUser(user));
  } catch (error) {
    console.error('SCIM User create error:', error);
    res.status(500).json(createErrorResponse(500, 'Internal server error'));
  }
});

// PUT /Users/:id - Update user (full replacement)
router.put('/Users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json(createErrorResponse(400, 'Invalid user ID'));
    }

    const { userName, name, emails, active = true, externalId } = req.body;

    if (!userName) {
      return res.status(400).json(createErrorResponse(400, 'userName is required'));
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return res.status(404).json(createErrorResponse(404, 'User not found'));
    }

    // Check for userName conflicts with other users
    const conflictUser = await prisma.user.findFirst({
      where: {
        userName,
        id: { not: userId }
      }
    });

    if (conflictUser) {
      return res.status(409).json(createErrorResponse(409, 'userName already exists', 'uniqueness'));
    }

    const userData = {
      userName,
      name: name?.formatted || name?.givenName + (name?.familyName ? ` ${name.familyName}` : ''),
      email: emails?.[0]?.value,
      active,
      externalId
    };

    const user = await prisma.user.update({
      where: { id: userId },
      data: userData
    });

    res.json(toScimUser(user));
  } catch (error) {
    console.error('SCIM User update error:', error);
    res.status(500).json(createErrorResponse(500, 'Internal server error'));
  }
});

// PATCH /Users/:id - Partial update user
router.patch('/Users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json(createErrorResponse(400, 'Invalid user ID'));
    }

    const { Operations } = req.body;

    if (!Operations || !Array.isArray(Operations)) {
      return res.status(400).json(createErrorResponse(400, 'Operations array is required'));
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return res.status(404).json(createErrorResponse(404, 'User not found'));
    }

    let updateData = {};

    for (const operation of Operations) {
      const { op, path, value } = operation;

      switch (op.toLowerCase()) {
        case 'replace':
          if (path === 'active') {
            updateData.active = value;
          } else if (path === 'userName') {
            updateData.userName = value;
          } else if (path === 'name.formatted') {
            updateData.name = value;
          } else if (path === 'emails[0].value') {
            updateData.email = value;
          }
          break;
        case 'add':
          // Handle add operations
          break;
        case 'remove':
          if (path === 'active') {
            updateData.active = false;
          }
          break;
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData
    });

    res.json(toScimUser(user));
  } catch (error) {
    console.error('SCIM User patch error:', error);
    res.status(500).json(createErrorResponse(500, 'Internal server error'));
  }
});

// DELETE /Users/:id - Delete user
router.delete('/Users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    if (isNaN(userId)) {
      return res.status(400).json(createErrorResponse(400, 'Invalid user ID'));
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      return res.status(404).json(createErrorResponse(404, 'User not found'));
    }

    await prisma.user.delete({
      where: { id: userId }
    });

    res.status(204).send();
  } catch (error) {
    console.error('SCIM User delete error:', error);
    res.status(500).json(createErrorResponse(500, 'Internal server error'));
  }
});

// GET /ServiceProviderConfig - SCIM service provider configuration
router.get('/ServiceProviderConfig', (req, res) => {
  res.json({
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
    documentationUri: 'https://tools.ietf.org/html/rfc7644',
    patch: {
      supported: true
    },
    bulk: {
      supported: false,
      maxOperations: 0,
      maxPayloadSize: 0
    },
    filter: {
      supported: true,
      maxResults: 100
    },
    changePassword: {
      supported: false
    },
    sort: {
      supported: false
    },
    etag: {
      supported: false
    },
    authenticationSchemes: [{
      name: 'Bearer Token',
      description: 'Authentication scheme using the Bearer Token',
      specUri: 'https://tools.ietf.org/html/rfc6750',
      type: 'bearertoken',
      primary: true
    }]
  });
});

// GET /ResourceTypes - SCIM resource types
router.get('/ResourceTypes', (req, res) => {
  res.json([{
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
    id: 'User',
    name: 'User',
    endpoint: '/Users',
    description: 'User Account',
    schema: 'urn:ietf:params:scim:schemas:core:2.0:User'
  }]);
});

// GET /Schemas - SCIM schemas
router.get('/Schemas', (req, res) => {
  res.json([{
    id: 'urn:ietf:params:scim:schemas:core:2.0:User',
    name: 'User',
    description: 'User Account',
    attributes: [
      {
        name: 'userName',
        type: 'string',
        multiValued: false,
        description: 'Unique identifier for the User',
        required: true,
        caseExact: false,
        mutability: 'readWrite',
        returned: 'default',
        uniqueness: 'server'
      },
      {
        name: 'name',
        type: 'complex',
        multiValued: false,
        description: 'The components of the user\'s real name',
        required: false,
        subAttributes: [
          {
            name: 'formatted',
            type: 'string',
            multiValued: false,
            description: 'The full name',
            required: false,
            caseExact: false,
            mutability: 'readWrite',
            returned: 'default',
            uniqueness: 'none'
          }
        ]
      }
    ]
  }]);
});

module.exports = router;