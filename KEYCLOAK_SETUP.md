# Keycloak Setup Guide

This guide provides step-by-step instructions to configure Keycloak to work with this Node.js application.

## 1. Create a Realm
1. Log in to the Keycloak Admin Console.
2. In the top-left dropdown (usually says `Master`), click **Create Realm**.
3. **Realm name**: `myrealm` (or whatever you set in `.env`).
4. Click **Create**.

## 2. Create a Client
1. Select the realm you just created (`myrealm`).
2. Click **Clients** in the left sidebar.
3. Click **Create client**.
4. **Client type**: `OpenID Connect`.
5. **Client ID**: `my-client` (must match `KEYCLOAK_CLIENT_ID` in `.env`).
6. Click **Next**.
7. Enable **Client authentication** (this makes it a "confidential" client, which provides a Client Secret).
8. Click **Save**.

## 3. Configure Client Settings
1. Go to the **Settings** tab of your new client (`my-client`).
2. **Root URL**: `http://localhost:3000` (optional).
3. **Valid redirect URIs**: `http://localhost:3000/callback` (must match `CALLBACK_URL` in `.env`).
4. **Web origins**: `+` (Allows all origins that are valid redirect URIs).
5. Scroll down to the bottom and click **Save**.

## 4. Get the Client Secret
1. Go to the **Credentials** tab of the client.
2. Copy the **Client secret** value.
3. Paste this into your `.env` file as `KEYCLOAK_CLIENT_SECRET`.

## 5. Create a User (for testing)
1. Click **Users** in the left sidebar.
2. Click **Add user**.
3. Fill in **Username** (e.g., `testuser`), **Email**, **First name**, and **Last name**.
4. Click **Create**.
5. Go to the **Credentials** tab of the user.
6. Click **Set password**.
7. Enter a password and turn **Temporary** to **Off**.
8. Click **Save** and confirm.

## 6. Update .env Reference
Ensure your `.env` reflects these values:

```env
KEYCLOAK_ISSUER=http://localhost:8080/realms/myrealm
KEYCLOAK_CLIENT_ID=my-client
KEYCLOAK_CLIENT_SECRET=xxx_your_secret_here_xxx
CALLBACK_URL=http://localhost:3000/callback
```

*Note: Replace `localhost:8080` with your actual Keycloak host/port if different.*
