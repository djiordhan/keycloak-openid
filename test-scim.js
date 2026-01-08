// Simple SCIM endpoint test script
// Run with: node test-scim.js

const baseUrl = 'http://localhost:3000/scim/v2';
const token = 'your-scim-bearer-token-here'; // Make sure this matches your .env

async function testScimEndpoints() {
  console.log('Testing SCIM endpoints...\n');

  // Test 1: Get Service Provider Config
  console.log('1. Testing Service Provider Config...');
  try {
    const response = await fetch(`${baseUrl}/ServiceProviderConfig`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/scim+json'
      }
    });
    console.log(`Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log('✓ Service Provider Config retrieved successfully');
    } else {
      console.log('✗ Failed to get Service Provider Config');
    }
  } catch (error) {
    console.log('✗ Error:', error.message);
  }

  // Test 2: List Users (empty initially)
  console.log('\n2. Testing List Users...');
  try {
    const response = await fetch(`${baseUrl}/Users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/scim+json'
      }
    });
    console.log(`Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`✓ Found ${data.totalResults} users`);
    } else {
      console.log('✗ Failed to list users');
    }
  } catch (error) {
    console.log('✗ Error:', error.message);
  }

  // Test 3: Create a User
  console.log('\n3. Testing Create User...');
  const newUser = {
    schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    userName: 'testuser@example.com',
    name: {
      formatted: 'Test User',
      givenName: 'Test',
      familyName: 'User'
    },
    emails: [{
      value: 'testuser@example.com',
      primary: true
    }],
    active: true
  };

  try {
    const response = await fetch(`${baseUrl}/Users`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/scim+json'
      },
      body: JSON.stringify(newUser)
    });
    console.log(`Status: ${response.status}`);
    if (response.ok) {
      const data = await response.json();
      console.log(`✓ User created with ID: ${data.id}`);
      return data.id; // Return user ID for further tests
    } else {
      const error = await response.json();
      console.log('✗ Failed to create user:', error.detail);
    }
  } catch (error) {
    console.log('✗ Error:', error.message);
  }

  return null;
}

// Run the tests
testScimEndpoints().then((userId) => {
  if (userId) {
    console.log(`\nUser created successfully! You can test other endpoints with user ID: ${userId}`);
    console.log(`Example: GET ${baseUrl}/Users/${userId}`);
  }
}).catch(console.error);