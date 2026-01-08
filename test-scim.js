// SCIM Sync Simulation Script
// This script mimics how a SCIM client (like Keycloak or Okta) synchronizes users.
// Run with: node test-scim.js

const baseUrl = 'http://localhost:3000/scim/v2';
const token = 'test_token'; // Ensure this matches your SCIM_TOKEN in .env

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/scim+json',
  'Accept': 'application/scim+json'
};

/**
 * Helper to make SCIM API requests
 */
async function scimRequest(path, method = 'GET', body = null) {
  const options = {
    method,
    headers,
  };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${baseUrl}${path}`, options);
  let data = null;
  
  if (response.status !== 204) {
    try {
      data = await response.json();
    } catch (e) {
      data = { detail: 'Could not parse response JSON' };
    }
  }

  return { status: response.status, ok: response.ok, data };
}

/**
 * Mimics the 'Check if user exists' step in SCIM syncing
 */
async function findUserByUserName(userName) {
  const filter = encodeURIComponent(`userName eq "${userName}"`);
  const result = await scimRequest(`/Users?filter=${filter}`);
  if (result.ok && result.data.totalResults > 0) {
    return result.data.Resources[0];
  }
  return null;
}

/**
 * The core sync logic: Find -> (Update OR Create)
 */
async function syncUser(userData) {
  console.log(`\n[SYNC] Processing user: ${userData.userName}`);
  
  // STEP 1: Check if user already exists in the target system
  const existingUser = await findUserByUserName(userData.userName);
  
  if (existingUser) {
    console.log(`[FOUND] User exists with ID: ${existingUser.id}. Syncing updates...`);
    
    // STEP 2a: Update existing user
    // We send a PUT request with the full user object to ensure it matches our source
    const updateResponse = await scimRequest(`/Users/${existingUser.id}`, 'PUT', {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      ...userData
    });
    
    if (updateResponse.ok) {
      console.log(`[SUCCESS] User ${userData.userName} updated.`);
      return updateResponse.data;
    } else {
      console.error(`[ERROR] Failed to update user: ${updateResponse.data?.detail || 'Unknown error'}`);
    }
  } else {
    console.log(`[NOT FOUND] User does not exist. Creating...`);
    
    // STEP 2b: Create new user
    const createResponse = await scimRequest('/Users', 'POST', {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      ...userData
    });
    
    if (createResponse.ok) {
      console.log(`[SUCCESS] User ${userData.userName} created with ID: ${createResponse.data.id}.`);
      return createResponse.data;
    } else {
      console.error(`[ERROR] Failed to create user: ${createResponse.data?.detail || 'Unknown error'}`);
    }
  }
}

/**
 * Mimics deactivation via PATCH
 */
async function toggleUserStatus(userId, active) {
  console.log(`\n[PATCH] Setting active=${active} for User ID: ${userId}`);
  const patchResponse = await scimRequest(`/Users/${userId}`, 'PATCH', {
    schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
    Operations: [
      {
        op: 'replace',
        path: 'active',
        value: active
      }
    ]
  });

  if (patchResponse.ok) {
    console.log(`[SUCCESS] User status updated.`);
    return patchResponse.data;
  } else {
    console.error(`[ERROR] Failed to update status: ${patchResponse.data?.detail || 'Unknown error'}`);
  }
}

async function runDetailedSyncSimulation() {
  console.log('=========================================');
  console.log('   SCIM END-TO-END SYNC SIMULATION      ');
  console.log('=========================================\n');

  // We'll use users that are likely already in the system (based on common seed data)
  // this ensures the 'Update' logic is demonstrated if 'Create' is failing.
  const usersToSync = [
    {
      userName: 'alice@example.com',
      name: { formatted: 'Alice Smith (Synced)', givenName: 'Alice', familyName: 'Smith' },
      emails: [{ value: 'alice@example.com', primary: true }],
      active: true,
      externalId: 'ext-alice-123'
    },
    {
      userName: 'new.sync.user@example.com', // This one will try to create
      name: { formatted: 'New Sync User', givenName: 'New', familyName: 'Sync' },
      emails: [{ value: 'new.sync.user@example.com', primary: true }],
      active: true,
      externalId: 'ext-new-456'
    }
  ];

  // 1. Run the sync for our users
  console.log('--- Phase 1: Initial Sync ---');
  const results = [];
  for (const user of usersToSync) {
    const result = await syncUser(user);
    if (result) results.push(result);
  }

  // 2. Demonstrate a PATCH operation (Partial Sync / Deactivation)
  console.log('\n--- Phase 2: Partial Update (Deactivation) ---');
  // We'll try to deactivate Alice (who should have been updated in Phase 1)
  const alice = results.find(u => u.userName === 'alice@example.com');
  if (alice) {
    await toggleUserStatus(alice.id, false);
    
    // Verify by fetching the user again
    const verify = await scimRequest(`/Users/${alice.id}`);
    console.log(`Verification: Alice active status is now: ${verify.data.active}`);
    
    // Re-activate her for next time
    await toggleUserStatus(alice.id, true);
  }

  // 3. Summary List
  console.log('\n--- Phase 3: Final System State ---');
  const listResult = await scimRequest('/Users');
  if (listResult.ok) {
    console.table(listResult.data.Resources.map(u => ({
      id: u.id,
      userName: u.userName,
      name: u.name?.formatted,
      active: u.active
    })));
  }

  console.log('\nSync Simulation Complete!');
}

runDetailedSyncSimulation().catch(err => {
  console.error('Fatal Simulation Error:', err);
});